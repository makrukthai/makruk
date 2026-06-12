import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, off, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { START_ELO } from "./elo.js";

// ─── Firebase Config ───
const firebaseConfig = {
  apiKey: "AIzaSyCJjQsqiJsbJW0pwlI0fqnklRhKFPSJh_w",
  authDomain: "rukthai-b4971.firebaseapp.com",
  databaseURL: "https://rukthai-b4971-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "rukthai-b4971",
  storageBucket: "rukthai-b4971.firebasestorage.app",
  messagingSenderId: "140554271105",
  appId: "1:140554271105:web:00530dbfb7b8c4aed1d080"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);

let friendWrapper = null;
let friendWrapperUserId = null;
let onlineFriends = [];
let onlineFriendRequests = [];
let globalStatuses = {}; // เก็บสถานะออน/ออฟไลน์ของทุกคน
let friendListeners = {}; // สำหรับเก็บสถานะการดักฟังโปรไฟล์เพื่อนแบบ Real-time
let isListening = false;

// ─── Helpers ───
function getSafeId(id) {
  return id ? String(id).replace(/[.#$\[\]]/g, '_') : '';
}

function loadCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("rukthai_current_user")) || null;
  } catch (error) {
    return null;
  }
}

// ─── Friend Status Management (Firebase Presence) ───
function getFriendStatus(friendId) {
  const safeId = getSafeId(friendId);
  return globalStatuses[safeId]?.state || "offline";
}

export function setCurrentUserStatus(stateStr) {
  const currentUser = loadCurrentUser();
  if (!currentUser) return;
  const safeUid = getSafeId(currentUser.id);
  set(ref(db, `status/${safeUid}`), { state: stateStr, last_changed: Date.now() });
}

// แชร์ฟังก์ชันให้ไฟล์อื่น (เช่น play-online.html) เรียกใช้ได้ผ่าน window
window.setCurrentUserStatus = setCurrentUserStatus;

function getProfileStats(user) {
  const stats = user?.stats || {};
  return {
    bullet: Number(stats.bullet) || 0,
    rapid: Number(stats.rapid) || Number(stats.elo) || 1600,
    blitz: Number(stats.blitz) || 0,
    daily: Number(stats.daily) || 0,
    total: Number(stats.total) || 0,
    wins: Number(stats.wins) || 0,
    losses: Number(stats.losses) || 0,
  };
}

// ─── Firebase Real-time Listeners ───
export function listenToFriendUpdates() {
  const currentUser = loadCurrentUser();
  if (!currentUser || isListening) return;
  isListening = true;

  const safeUid = getSafeId(currentUser.id);

  // 1. ดักฟังสถานะ Online/Offline ของทุกคน (Presence System)
  const statusRef = ref(db, 'status');
  onValue(statusRef, (snap) => {
    if (snap.exists()) {
      globalStatuses = snap.val();
      renderFriendList(); 
    }
  });

  // 2. แจ้ง Firebase ให้รู้ว่าเราออนไลน์อยู่ และตั้งเวลาให้ออฟไลน์อัตโนมัติเมื่อปิดเว็บ
  const connectedRef = ref(db, '.info/connected');
  const myStatusRef = ref(db, `status/${safeUid}`);
  onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      onDisconnect(myStatusRef).set({ state: 'offline', last_changed: Date.now() }).then(() => {
        set(myStatusRef, { state: 'online', last_changed: Date.now() });
      });
    }
  });

  // 3. ดักฟังคำขอเพิ่มเพื่อน (Friend Requests)
  const requestsRef = ref(db, `friend_requests/${safeUid}`);
  onValue(requestsRef, (snap) => {
    onlineFriendRequests = [];
    if (snap.exists()) {
      const data = snap.val();
      for (const reqId in data) {
        if (data[reqId].status === "pending") {
          onlineFriendRequests.push({ id: reqId, ...data[reqId] });
        }
      }
    }
    renderFriendRequests();
    refreshFriendBadge();
  });

  // 4. ดักฟังรายชื่อเพื่อน (Friends List) แบบซิงค์ข้อมูลโปรไฟล์ Real-time
  const friendsRef = ref(db, `friends/${safeUid}`);
  onValue(friendsRef, (snap) => {
    if (!snap.exists()) {
      onlineFriends = [];
      renderFriendList();
      return;
    }
    
    const friendIds = Object.keys(snap.val());
    onlineFriends = onlineFriends.filter(f => friendIds.includes(f.id));
    
    friendIds.forEach(fid => {
      if (!friendListeners[fid]) {
        friendListeners[fid] = true;
        onValue(ref(db, `users/${fid}`), (userSnap) => {
          if (userSnap.exists()) {
            const userData = { id: fid, ...userSnap.val() };
            const existingIndex = onlineFriends.findIndex(f => f.id === fid);
            
            if (existingIndex !== -1) {
              onlineFriends[existingIndex] = userData;
            } else {
              onlineFriends.push(userData);
            }
            renderFriendList(); 
          }
        });
      }
    });
  });
}

// ─── Friend Actions (Firebase) ───
async function sendFriendRequest(toUserId, toUserData) {
  const currentUser = loadCurrentUser();
  if (!currentUser) {
    showFriendAlert("กรุณาเข้าสู่ระบบก่อน", true);
    return false;
  }

  const safeUid = getSafeId(currentUser.id);
  const safeToId = getSafeId(toUserId);

  if (safeUid === safeToId) {
    showFriendAlert("ไม่สามารถเพิ่มตัวเองเป็นเพื่อนได้", true);
    return false;
  }
  if (onlineFriends.some(f => getSafeId(f.id) === safeToId)) {
    showFriendAlert("คุณเป็นเพื่อนกับผู้เล่นนี้แล้ว", true);
    return false;
  }

  try {
    const newRequestRef = push(ref(db, `friend_requests/${safeToId}`));
    await set(newRequestRef, {
      from: safeUid,
      fromName: currentUser.name || currentUser.email,
      to: safeToId,
      toName: toUserData.name || toUserData.email,
      status: "pending",
      timestamp: Date.now()
    });
    showFriendAlert("ส่งขอเพิ่มเพื่อนเรียบร้อยแล้ว");
    return true;
  } catch (error) {
    showFriendAlert("เกิดข้อผิดพลาดในการส่งคำขอ", true);
    return false;
  }
}

async function acceptFriendRequest(requestId) {
  const request = onlineFriendRequests.find(r => r.id === requestId);
  const currentUser = loadCurrentUser();
  if (!request || !currentUser) return false;

  const safeUid = getSafeId(currentUser.id);
  const safeFromId = getSafeId(request.from);

  try {
    await update(ref(db, `friends/${safeUid}`), { [safeFromId]: true });
    await update(ref(db, `friends/${safeFromId}`), { [safeUid]: true });
    await remove(ref(db, `friend_requests/${safeUid}/${requestId}`));
    showFriendAlert("ยอมรับคำขอเพิ่มเพื่อนเรียบร้อยแล้ว");
    return true;
  } catch (error) {
    showFriendAlert("เกิดข้อผิดพลาดในการยอมรับ", true);
    return false;
  }
}

async function rejectFriendRequest(requestId) {
  const currentUser = loadCurrentUser();
  if (!currentUser) return false;
  const safeUid = getSafeId(currentUser.id);

  try {
    await remove(ref(db, `friend_requests/${safeUid}/${requestId}`));
    showFriendAlert("ปฏิเสธคำขอเพิ่มเพื่อนแล้ว");
    return true;
  } catch (error) {
    return false;
  }
}

async function removeFriend(friendId) {
  const currentUser = loadCurrentUser();
  if (!currentUser) return;

  const safeUid = getSafeId(currentUser.id);
  const safeFriendId = getSafeId(friendId);

  try {
    await remove(ref(db, `friends/${safeUid}/${safeFriendId}`));
    await remove(ref(db, `friends/${safeFriendId}/${safeUid}`));
    showFriendAlert("ลบเพื่อนเรียบร้อยแล้ว");
  } catch (error) {
    showFriendAlert("เกิดข้อผิดพลาดในการลบ", true);
  }
}

// ─── UI Rendering ───
function showFriendAlert(message, isError = false) {
  if (!friendWrapper) return;
  const alertElement = friendWrapper.querySelector(".friend-alert");
  if (!alertElement) return;
  
  alertElement.textContent = message;
  alertElement.classList.toggle("error", isError);
  alertElement.style.display = "block";
  clearTimeout(alertElement.hideTimeout);
  alertElement.hideTimeout = setTimeout(() => {
    alertElement.style.display = "none";
  }, 2600);
}

function refreshFriendBadge() {
  if (!friendWrapper) return;
  const button = friendWrapper.querySelector(".friend-button");
  if (!button) return;

  const pendingCount = onlineFriendRequests.length;
  let badge = button.querySelector(".friend-request-badge");
  if (pendingCount > 0) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "friend-request-badge";
      button.insertBefore(badge, button.firstChild);
    }
    badge.textContent = pendingCount;
  } else {
    badge?.remove();
  }
}

function renderFriendList() {
  if (!friendWrapper) return;
  const listContainer = friendWrapper.querySelector(".friend-list");
  listContainer.innerHTML = "";

  if (!onlineFriends.length) {
    listContainer.innerHTML = `<div class="friend-empty">คุณยังไม่มีเพื่อนในตอนนี้</div>`;
    return;
  }

  onlineFriends.forEach((friend) => {
    const status = getFriendStatus(friend.id); 
    const statusClass = status === "online" ? "status-online" : status === "playing" ? "status-playing" : "status-offline";
    const statusText = status === "online" ? "ออนไลน์" : status === "playing" ? "กำลังเล่น" : "ออฟไลน์";
    const displayName = friend.name || friend.email || 'ผู้ใช้';
    
    const avatarHtml = (friend.avatar && friend.avatar.trim() !== "")
      ? `<img src="${friend.avatar}" alt="${displayName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" onerror="this.outerHTML='${displayName.charAt(0).toUpperCase()}'">`
      : displayName.charAt(0).toUpperCase();

    const item = document.createElement("div");
    item.className = "friend-item";
    item.innerHTML = `
      <div class="friend-item-header">
        <div class="friend-item-left">
          <div class="friend-item-avatar" style="background: linear-gradient(135deg, #d6b16b, #f0d8a1); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #1a1a1a; flex-shrink: 0; overflow: hidden;">
            ${avatarHtml}
          </div>
          <div class="friend-item-info">
            <div class="friend-item-name" title="${displayName}">${displayName}</div>
            <div class="friend-item-status ${statusClass}"><span class="status-dot">●</span> ${statusText}</div>
          </div>
        </div>
        <div class="friend-item-actions">
          <button type="button" class="friend-action-btn friend-play" data-id="${friend.id}" title="เชิญเล่น">🎮</button>
          <button type="button" class="friend-action-btn friend-profile" data-id="${friend.id}" title="ดูโปรไฟล์">👤</button>
          <button type="button" class="friend-remove" data-id="${friend.id}" title="ลบเพื่อน">✕</button>
        </div>
      </div>
    `;
    listContainer.appendChild(item);
  });
}

function renderFriendRequests() {
  if (!friendWrapper) return;
  const requestContainer = friendWrapper.querySelector(".friend-requests");
  if (!requestContainer) return;
  requestContainer.innerHTML = "";

  if (!onlineFriendRequests.length) {
    requestContainer.innerHTML = `<div class="friend-request-empty">ไม่มีคำขอเพิ่มเพื่อนใหม่</div>`;
    return;
  }

  onlineFriendRequests.forEach((request) => {
    const item = document.createElement("div");
    item.className = "friend-request-item";
    item.innerHTML = `
      <div class="friend-request-header">
        <div class="friend-request-avatar" style="background: linear-gradient(135deg, #d6b16b, #f0d8a1); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #1a1a1a;">
          ${(request.fromName || 'U').charAt(0).toUpperCase()}
        </div>
        <div class="friend-request-name">${request.fromName} ขอเพิ่มเพื่อน</div>
      </div>
      <div class="friend-request-actions">
        <button type="button" class="friend-request-accept" data-id="${request.id}">ยอมรับ</button>
        <button type="button" class="friend-request-reject" data-id="${request.id}">ปฏิเสธ</button>
      </div>
    `;
    requestContainer.appendChild(item);
  });
}

async function renderFriendSearchResult(user) {
  const resultContainer = friendWrapper?.querySelector(".friend-search-result");
  const currentUser = loadCurrentUser();
  if (!resultContainer || !currentUser || !user) return;

  const safeUid = getSafeId(currentUser.id);
  const safeUserId = getSafeId(user.id);

  const alreadyFriend = onlineFriends.some(f => getSafeId(f.id) === safeUserId);
  
  let outgoingRequest = false;
  const reqSnap = await get(ref(db, `friend_requests/${safeUserId}`));
  if (reqSnap.exists()) {
    const data = reqSnap.val();
    outgoingRequest = Object.values(data).some(r => r.from === safeUid && r.status === 'pending');
  }

  const incomingRequest = onlineFriendRequests.some(r => r.from === safeUserId);

  let actionHTML = `<button type="button" class="friend-result-add" data-id="${user.id}">ADD</button>`;

  if (alreadyFriend) {
    actionHTML = `<button type="button" class="friend-result-add" disabled>เป็นเพื่อนแล้ว</button>`;
  } else if (outgoingRequest) {
    actionHTML = `<button type="button" class="friend-result-add" disabled>ส่งคำขอแล้ว</button>`;
  } else if (incomingRequest) {
    actionHTML = `<button type="button" class="friend-result-add" disabled>รอคุณตอบรับ</button>`;
  }

  const displayName = user.name || user.email || "U";
  resultContainer.innerHTML = `
    <div class="friend-search-card">
      <div class="friend-search-avatar">${displayName.charAt(0).toUpperCase()}</div>
      <div class="friend-search-info">
        <div class="friend-search-name">${displayName}</div>
        <div class="friend-search-email">${user.email || ""}</div>
      </div>
      ${actionHTML}
    </div>
  `;
}

function clearFriendSearchResult() {
  const resultContainer = friendWrapper?.querySelector(".friend-search-result");
  if (resultContainer) resultContainer.innerHTML = "";
}

// ─── สไตล์ของหน้าต่างโปรไฟล์เพื่อน (ให้เหมือนกับ modal ใน play-online.html) ───
function ensureFriendProfileStyles() {
  if (document.getElementById('fp-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'fp-modal-styles';
  style.textContent = `
    .fp-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.82);
      backdrop-filter: blur(10px);
      display: flex; align-items: center; justify-content: center;
      z-index: 9600;
      animation: fpFade 0.2s ease;
    }
    @keyframes fpFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fpSlideUp {
      from { opacity: 0; transform: translateY(28px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .fp-modal {
      width: min(520px, 92vw);
      background: var(--bg2);
      border: 1px solid rgba(128,128,128,0.18);
      border-radius: 28px;
      padding: 40px 36px;
      box-shadow: 0 32px 80px rgba(0,0,0,0.6);
      position: relative;
      animation: fpSlideUp 0.3s cubic-bezier(0.22,1,0.36,1);
      max-height: 85vh;
      overflow-y: auto;
      font-family: 'Noto Sans Thai', sans-serif;
    }
    .fp-modal::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(128,128,128,0.55), transparent);
      border-radius: 28px 28px 0 0;
    }
    .fp-close {
      position: absolute; top: 16px; right: 16px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px; width: 32px; height: 32px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-size: 18px; color: var(--muted); transition: all 0.2s;
    }
    .fp-close:hover { background: rgba(255,255,255,0.09); color: var(--text); }
    .fp-header { text-align: center; margin-bottom: 28px; padding-top: 8px; }
    .fp-avatar {
      width: 80px; height: 80px; border-radius: 50%;
      background: linear-gradient(135deg, #555, #888);
      display: flex; align-items: center; justify-content: center;
      font-size: 2.4rem; margin: 0 auto 12px; overflow: hidden; color:#fff;
    }
    .fp-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .fp-name { font-size: 1.5rem; font-weight: 700; color: var(--text); margin-bottom: 4px; }
    .fp-rank { font-size: 0.9rem; color: var(--muted); }
    .fp-rank .fp-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:5px; vertical-align: middle; }
    .fp-dot.online { background:#22c55e; } .fp-dot.playing { background:#fbbf24; } .fp-dot.offline { background:#6b7280; }
    .fp-section { margin-bottom: 24px; }
    .fp-section-title {
      font-size: 0.85rem; color: var(--muted); letter-spacing: 1px;
      text-transform: uppercase; margin-bottom: 12px; font-weight: 600;
    }
    .fp-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .fp-stats.cols3 { grid-template-columns: repeat(3, 1fr); }
    .fp-stat {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px; padding: 12px; text-align: center;
    }
    .fp-stat-label { font-size: 0.75rem; color: var(--muted); margin-bottom: 4px; }
    .fp-stat-value { font-size: 1.2rem; font-weight: 700; color: var(--text); }
    .fp-h2h {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px; padding: 16px;
    }
    .fp-h2h-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 0.9rem;
    }
    .fp-h2h-row:last-child { border-bottom: none; }
    .fp-h2h-label { color: var(--muted); }
    .fp-h2h-value { font-weight: 700; color: var(--text); }
    .fp-games { margin-top: 4px; }
    .fp-game {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px; padding: 10px; margin-bottom: 8px;
      font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;
    }
    .fp-res-win { color: #22c55e; font-weight: 700; }
    .fp-res-loss { color: #ef4444; font-weight: 700; }
    .fp-res-draw { color: #f59e0b; font-weight: 700; }
    .fp-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
    .fp-btn {
      padding: 12px; border: 1px solid rgba(128,128,128,0.2);
      border-radius: 12px; background: rgba(255,255,255,0.05);
      color: var(--text); cursor: pointer; font-family: 'Noto Sans Thai', sans-serif;
      font-size: 0.95rem; transition: all 0.2s; font-weight: 600;
    }
    .fp-btn:hover { background: rgba(255,255,255,0.09); border-color: rgba(128,128,128,0.35); }
    .fp-btn.primary { background: linear-gradient(135deg, #555, #888); border: none; color: #fff; }
    .fp-btn.primary:hover { background: linear-gradient(135deg, #666, #999); }
    .fp-btn.danger { color: #ef4444; border-color: rgba(239,68,68,0.3); }
    .fp-btn.danger:hover { background: rgba(239,68,68,0.1); }
    .fp-muted { color: var(--muted); font-size: 0.9rem; }
  `;
  document.head.appendChild(style);
}

async function showFriendProfile(userData) {
  if (!userData) return;
  ensureFriendProfileStyles();

  const status = getFriendStatus(userData.id);
  const statusText = status === "online" ? "ออนไลน์" : status === "playing" ? "กำลังเล่น" : "ออฟไลน์";
  const friendName = userData.name || userData.email || 'เพื่อน';
  const safeFriendId = getSafeId(userData.id);

  // โครงหน้าต่าง (เหมือน modal คู่ต่อสู้ใน play-online) — แสดงก่อนแล้วค่อยเติมข้อมูล
  const profileHTML = `
    <div class="fp-overlay" id="fp-overlay">
      <div class="fp-modal" id="fp-modal">
        <button type="button" class="fp-close" id="fp-close">✕</button>

        <div class="fp-header">
          <div class="fp-avatar" id="fp-avatar">${friendName.charAt(0).toUpperCase()}</div>
          <div class="fp-name" id="fp-name">${friendName}</div>
          <div class="fp-rank"><span class="fp-dot ${status}"></span><span id="fp-status">${statusText}</span></div>
        </div>

        <div class="fp-section">
          <div class="fp-section-title">📊 สถิติ</div>
          <div class="fp-stats">
            <div class="fp-stat"><div class="fp-stat-label">ทั้งหมด</div><div class="fp-stat-value" id="fp-total">0</div></div>
            <div class="fp-stat"><div class="fp-stat-label">ชนะ</div><div class="fp-stat-value" id="fp-wins">0</div></div>
            <div class="fp-stat"><div class="fp-stat-label">แพ้</div><div class="fp-stat-value" id="fp-losses">0</div></div>
            <div class="fp-stat"><div class="fp-stat-label">อัตราชนะ</div><div class="fp-stat-value" id="fp-winrate">0%</div></div>
          </div>
        </div>

        <div class="fp-section">
          <div class="fp-section-title">🏅 คะแนน ELO</div>
          <div class="fp-stats cols3">
            <div class="fp-stat"><div class="fp-stat-label">⚡ Blitz</div><div class="fp-stat-value" id="fp-elo-blitz">${START_ELO}</div></div>
            <div class="fp-stat"><div class="fp-stat-label">♟ Rapid</div><div class="fp-stat-value" id="fp-elo-rapid">${START_ELO}</div></div>
            <div class="fp-stat"><div class="fp-stat-label">🏛 Standard</div><div class="fp-stat-value" id="fp-elo-standard">${START_ELO}</div></div>
          </div>
        </div>

        <div class="fp-section">
          <div class="fp-section-title">🏁 ผลการเล่นกับคุณ</div>
          <div class="fp-h2h">
            <div class="fp-h2h-row"><span class="fp-h2h-label">คุณชนะ</span><span class="fp-h2h-value" id="fp-h2h-wins">0</span></div>
            <div class="fp-h2h-row"><span class="fp-h2h-label">เสมอ</span><span class="fp-h2h-value" id="fp-h2h-draws">0</span></div>
            <div class="fp-h2h-row"><span class="fp-h2h-label">คุณแพ้</span><span class="fp-h2h-value" id="fp-h2h-losses">0</span></div>
          </div>
        </div>

        <div class="fp-section">
          <div class="fp-section-title">🎮 เกมล่าสุด</div>
          <div class="fp-games" id="fp-games"><div class="fp-muted">กำลังโหลด…</div></div>
        </div>

        <div class="fp-actions">
          <button type="button" class="fp-btn primary" id="fp-invite">🎮 เชิญเล่นเกม</button>
          <button type="button" class="fp-btn" id="fp-view-full">👤 ดูโปรไฟล์เต็ม</button>
          <button type="button" class="fp-btn danger" id="fp-remove">✕ ลบเพื่อน</button>
        </div>
      </div>
    </div>
  `;

  const modal = document.createElement("div");
  modal.innerHTML = profileHTML;
  document.body.appendChild(modal);

  const overlay = document.getElementById("fp-overlay");
  const closeBtn = document.getElementById("fp-close");
  const inviteBtn = document.getElementById("fp-invite");
  const removeBtn = document.getElementById("fp-remove");
  const viewFullBtn = document.getElementById("fp-view-full");

  const closeModal = () => modal.remove();
  overlay?.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  closeBtn?.addEventListener("click", closeModal);

  inviteBtn?.addEventListener("click", () => {
    showTimeSelectionModal(userData);
    closeModal();
  });

  viewFullBtn?.addEventListener("click", () => {
    window.location.href = `/pages/profile.html?user=${userData.id}`;
  });

  removeBtn?.addEventListener("click", () => {
    if (confirm("แน่ใจหรือไม่ที่จะลบเพื่อนคนนี้?")) {
      removeFriend(userData.id);
      closeModal();
    }
  });

  // ── เติมข้อมูลจริงจาก Firebase ──
  await populateFriendProfile(safeFriendId, friendName);
}

// ดึงและแสดงข้อมูลโปรไฟล์เพื่อน (สถิติ / Elo / ผลการเล่นกับคุณ / เกมล่าสุด)
async function populateFriendProfile(safeFriendId, friendName) {
  try {
    // 1) โปรไฟล์ + Elo + รูป
    const userSnap = await get(ref(db, `users/${safeFriendId}`));
    if (userSnap.exists()) {
      const u = userSnap.val();
      const avatarEl = document.getElementById('fp-avatar');
      if (avatarEl) {
        if (u.avatar) avatarEl.innerHTML = `<img src="${u.avatar}" alt="">`;
        else avatarEl.textContent = (u.name || friendName).charAt(0).toUpperCase();
      }
      if (u.name) {
        const nameEl = document.getElementById('fp-name');
        if (nameEl) nameEl.textContent = u.name;
      }
      const elo = u.elo || {};
      setText('fp-elo-blitz',    (elo.blitz    != null) ? elo.blitz    : START_ELO);
      setText('fp-elo-rapid',    (elo.rapid    != null) ? elo.rapid    : START_ELO);
      setText('fp-elo-standard', (elo.standard != null) ? elo.standard : START_ELO);
    }

    // 2) สถิติของเพื่อน (จากประวัติจริงของเขา)
    const histSnap = await get(ref(db, `user_history/${safeFriendId}`));
    let total = 0, wins = 0, losses = 0;
    if (histSnap.exists()) {
      const games = Object.values(histSnap.val());
      total = games.length;
      games.forEach(g => {
        if (g.result === 'win') wins++;
        else if (g.result === 'loss') losses++;
      });
    }
    const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;
    setText('fp-total', total);
    setText('fp-wins', wins);
    setText('fp-losses', losses);
    setText('fp-winrate', winrate + '%');

    // 3) ผลการเล่นกับคุณ + เกมล่าสุด (จากประวัติของเรา กรองเฉพาะเกมที่เจอเพื่อนคนนี้)
    const current = loadCurrentUser();
    if (current) {
      const safeMyId = getSafeId(current.id || current.email);
      const myHistSnap = await get(ref(db, `user_history/${safeMyId}`));
      let h2hW = 0, h2hD = 0, h2hL = 0;
      const together = [];
      if (myHistSnap.exists()) {
        const myGames = myHistSnap.val();
        for (const gid in myGames) {
          const g = myGames[gid];
          const matchById = g.opponentId && getSafeId(g.opponentId) === safeFriendId;
          const matchByName = !g.opponentId && g.opponentName === friendName;
          if (matchById || matchByName) {
            if (g.result === 'win') h2hW++;
            else if (g.result === 'draw') h2hD++;
            else if (g.result === 'loss') h2hL++;
            together.push({ ...g, id: gid });
          }
        }
      }
      setText('fp-h2h-wins', h2hW);
      setText('fp-h2h-draws', h2hD);
      setText('fp-h2h-losses', h2hL);

      const gamesEl = document.getElementById('fp-games');
      if (gamesEl) {
        together.sort((a, b) => (b.date || 0) - (a.date || 0));
        if (together.length === 0) {
          gamesEl.innerHTML = '<div class="fp-muted">ยังไม่มีเกมด้วยกัน</div>';
        } else {
          gamesEl.innerHTML = together.slice(0, 5).map(g => {
            const cls = g.result === 'win' ? 'fp-res-win' : g.result === 'loss' ? 'fp-res-loss' : 'fp-res-draw';
            const txt = g.result === 'win' ? '🏆 ชนะ' : g.result === 'loss' ? '😔 แพ้' : '🤝 เสมอ';
            const date = g.date ? new Date(g.date).toLocaleDateString('th-TH') : '';
            return `<div class="fp-game">
              <div><span class="${cls}">${txt}</span><span class="fp-muted" style="margin-left:8px;">${g.minutes||''}m · ${date}</span></div>
              <span class="fp-muted" style="font-size:0.8rem;">${g.reason || ''}</span>
            </div>`;
          }).join('');
        }
      }
    }
  } catch (e) {
    console.error('โหลดโปรไฟล์เพื่อนไม่สำเร็จ:', e);
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ════════════════════════════════════════════════
//   GAME INVITATION SYSTEM (ระบบท้าดวลสมบูรณ์แบบ)
// ════════════════════════════════════════════════

// 1. ดักฟังคำท้าดวลที่ส่งมาหาเรา
function listenToGameInvites() {
  const currentUser = loadCurrentUser();
  if (!currentUser) return;
  
  const safeUid = getSafeId(currentUser.id);
  onValue(ref(db, `game_invites/${safeUid}`), (snap) => {
    if (snap.exists()) {
      const invites = snap.val();
      for (const gameId in invites) {
        if (invites[gameId].status === 'pending') {
          showIncomingInvitePopup(invites[gameId], gameId);
        }
      }
    }
  });
}

// 2. แสดง Pop-up รับคำท้าดวลบนหน้าจอ (เวอร์ชันเสถียร ส่งค่าเวลาครบถ้วน)
function showIncomingInvitePopup(inviteData, gameId) {
  if (document.getElementById(`invite-${gameId}`)) return;

  const popup = document.createElement("div");
  popup.id = `invite-${gameId}`;
  popup.className = "game-invite-popup";
  popup.innerHTML = `
    <p>⚔️ <strong>${inviteData.fromName}</strong> ท้าดวลหватьรุก <strong>(${inviteData.timeControl} นาที)</strong></p>
    <div class="invite-actions">
      <button class="invite-btn invite-btn-accept" id="accept-${gameId}">รับคำท้า</button>
      <button class="invite-btn invite-btn-reject" id="reject-${gameId}">ปฏิเสธ</button>
    </div>
  `;
  document.body.appendChild(popup);

  const currentUser = loadCurrentUser();
  const safeUid = getSafeId(currentUser.id);

  document.getElementById(`accept-${gameId}`).onclick = async () => {
    popup.innerHTML = `<p style="text-align:center;">กำลังสร้างห้อง...</p>`;
    
    const myColor = Math.random() > 0.5 ? 'w' : 'b';
    const challengerColor = myColor === 'w' ? 'b' : 'w';
    const minutes = parseInt(inviteData.timeControl) || 10;
    
    const friendSnap = await get(ref(db, `users/${inviteData.from}`));
    const friendAvatar = friendSnap.exists() ? (friendSnap.val().avatar || '') : '';

    const meData = { uid: safeUid, name: currentUser.name || currentUser.email, avatar: currentUser.avatar || '' };
    const oppData = { uid: inviteData.from, name: inviteData.fromName, avatar: friendAvatar };

    const initBoard = [
      "Rb,Nb,Bb,Qb,Kb,Bb,Nb,Rb",
      ",,,,,,,",
      "Pb,Pb,Pb,Pb,Pb,Pb,Pb,Pb",
      ",,,,,,,",
      ",,,,,,,",
      "Pw,Pw,Pw,Pw,Pw,Pw,Pw,Pw",
      ",,,,,,,",
      "Rw,Nw,Bw,Kw,Qw,Bw,Nw,Rw"
    ];

    // สร้างข้อมูลกระดานและตัวแปร minutes ให้ตรงกับ play-online.html เป๊ะๆ
    await set(ref(db, `games/${gameId}`), {
       w: myColor === 'w' ? meData : oppData,
       b: myColor === 'b' ? meData : oppData,
       minutes: minutes,
       timeW: minutes * 60,
       timeB: minutes * 60,
       turn: 'w',
       board: initBoard,
       moveCount: 0,
       startedAt: Date.now(),
       conn_w: true,
       conn_b: true
    });

    await update(ref(db, `game_invites/${safeUid}/${gameId}`), {
       status: 'accepted',
       challengerColor: challengerColor 
    });

    popup.remove();
    window.location.href = `play-online.html?room=${gameId}&color=${myColor}`;
  };

  document.getElementById(`reject-${gameId}`).onclick = async () => {
    await update(ref(db, `game_invites/${safeUid}/${gameId}`), { status: 'rejected' });
    popup.remove();
  };
}

// 3. หน้าต่างให้ผู้ส่งเลือกเวลาก่อนท้า
function showTimeSelectionModal(friend) {
  if (document.getElementById('time-select-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'time-select-overlay';
  overlay.className = 'time-select-overlay';
  overlay.innerHTML = `
    <div class="time-select-modal">
      <div class="time-select-title">ท้าดวล ${friend.name || friend.email}</div>
      <button class="time-option-btn" data-time="5">⏱️ 5 นาที (Blitz)</button>
      <button class="time-option-btn" data-time="10">⏱️ 10 นาที (Rapid)</button>
      <button class="time-option-btn" data-time="30">⏱️ 30 นาที (Classic)</button>
      <button class="time-cancel-btn">ยกเลิก</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('.time-option-btn').forEach(btn => {
    btn.onclick = () => {
      const time = parseInt(btn.dataset.time);
      handleSendGameInvite(friend.id, friend.name || friend.email, time);
      overlay.remove();
    };
  });

  overlay.querySelector('.time-cancel-btn').onclick = () => overlay.remove();
}

// 4. ฟังก์ชันส่งคำท้าไปหาเพื่อน
async function handleSendGameInvite(friendId, friendName, timeControl) {
  const currentUser = loadCurrentUser();
  if (!currentUser) return;
  
  const safeMyId = getSafeId(currentUser.id);
  const safeFriendId = getSafeId(friendId);
  const gameId = "room_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

  try {
    await set(ref(db, `game_invites/${safeFriendId}/${gameId}`), {
      from: safeMyId,
      fromName: currentUser.name || currentUser.email,
      gameId: gameId,
      timeControl: timeControl, 
      status: 'pending',
      timestamp: Date.now()
    });

    showFriendAlert(`ส่งคำท้าหา ${friendName} (${timeControl} นาที) แล้ว...`);

    const mySentInviteRef = ref(db, `game_invites/${safeFriendId}/${gameId}`);
    const unsub = onValue(mySentInviteRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        if (data.status === 'accepted') {
          unsub();
          const myColor = data.challengerColor; 
          remove(mySentInviteRef);
          window.location.href = `play-online.html?room=${gameId}&color=${myColor}`;
        } else if (data.status === 'rejected') {
          unsub();
          showFriendAlert(`${friendName} ปฏิเสธคำท้าของคุณ`, true);
          remove(mySentInviteRef);
        }
      } else {
        unsub();
      }
    });

    setTimeout(() => {
      unsub();
      get(mySentInviteRef).then(snap => {
        if(snap.exists() && snap.val().status === 'pending') {
          remove(mySentInviteRef);
          showFriendAlert(`คำท้าดวลหมดเวลาแล้ว`, true);
        }
      });
    }, 30000);

  } catch (error) {
    showFriendAlert("เกิดข้อผิดพลาดในการส่งคำท้า", true);
  }
}

// ─── Event Handlers ───
async function handleAddFriend(event) {
  event.preventDefault();
  event.stopPropagation();
  if (!friendWrapper) return;

  const form = friendWrapper.querySelector("#friend-add-form");
  const searchInput = form.elements.friendSearch?.value.trim().toLowerCase();

  if (!searchInput) {
    showFriendAlert("กรุณากรอกชื่อหรืออีเมลของเพื่อน", true);
    return;
  }

  const currentUser = loadCurrentUser();
  if (!currentUser) {
    showFriendAlert("กรุณาเข้าสู่ระบบก่อน", true);
    return;
  }

  try {
    const usersSnap = await get(ref(db, 'users'));
    if (!usersSnap.exists()) {
      showFriendAlert("ไม่พบข้อมูลผู้เล่นในระบบ", true);
      return;
    }

    const usersData = usersSnap.val();
    let foundUser = null;
    const safeUid = getSafeId(currentUser.id);

    for (const uid in usersData) {
      const u = usersData[uid];
      if (uid !== safeUid && (
          u.name?.toLowerCase().includes(searchInput) || 
          u.email?.toLowerCase().includes(searchInput)
      )) {
        foundUser = { id: uid, ...u };
        break;
      }
    }

    if (!foundUser) {
      showFriendAlert("ไม่พบผู้เล่นที่ตรงกับการค้นหา", true);
      return;
    }

    renderFriendSearchResult(foundUser);
  } catch (error) {
    showFriendAlert("เกิดข้อผิดพลาดในการค้นหา", true);
  }
}

async function handleFriendSearchResultClick(event) {
  event.stopPropagation();
  const addBtn = event.target.closest("button.friend-result-add");
  if (!addBtn || addBtn.disabled) return;

  const userId = addBtn.dataset.id;
  const safeUserId = getSafeId(userId);
  
  const userSnap = await get(ref(db, `users/${safeUserId}`));
  if (!userSnap.exists()) {
    showFriendAlert("ไม่พบผู้เล่นนี้แล้ว", true);
    clearFriendSearchResult();
    return;
  }

  const foundUser = { id: userId, ...userSnap.val() };
  if (await sendFriendRequest(foundUser.id, foundUser)) {
    renderFriendSearchResult(foundUser);
  }
}

async function handleFriendRequestAction(event) {
  event.stopPropagation();
  
  const acceptBtn = event.target.closest("button.friend-request-accept");
  if (acceptBtn) {
    const requestId = acceptBtn.dataset.id;
    await acceptFriendRequest(requestId);
    clearFriendSearchResult();
    return;
  }

  const rejectBtn = event.target.closest("button.friend-request-reject");
  if (rejectBtn) {
    const requestId = rejectBtn.dataset.id;
    await rejectFriendRequest(requestId);
    return;
  }
}

function handleFriendListClick(event) {
  event.stopPropagation();
  
  const removeBtn = event.target.closest("button.friend-remove");
  if (removeBtn) {
    const friendId = removeBtn.dataset.id;
    if(confirm("แน่ใจหรือไม่ที่จะลบเพื่อนคนนี้?")) {
      removeFriend(friendId);
    }
    return;
  }

  const playBtn = event.target.closest("button.friend-play");
  if (playBtn) {
    const friendId = playBtn.dataset.id;
    const friend = onlineFriends.find(f => f.id === friendId);
    if (friend) {
      showTimeSelectionModal(friend); 
    }
    return;
  }

  const profileBtn = event.target.closest("button.friend-profile");
  if (profileBtn) {
    const friendId = profileBtn.dataset.id;
    const friend = onlineFriends.find(u => u.id === friendId);
    if (friend) showFriendProfile(friend);
    return;
  }
}

function closeFriendDropdown() {
  if (!friendWrapper) return;
  const dropdown = friendWrapper.querySelector(".profile-dropdown");
  if (dropdown) {
    dropdown.classList.add("hidden");
    const button = friendWrapper.querySelector(".topbar-icon-btn");
    if (button) button.setAttribute("aria-expanded", "false");
  }
}

function toggleFriendDropdown() {
  if (!friendWrapper) return;
  const dropdown = friendWrapper.querySelector(".profile-dropdown");
  if (!dropdown) return;
  
  const isHidden = dropdown.classList.contains("hidden");
  document.querySelectorAll(".profile-dropdown").forEach((menu) => {
    menu.classList.add("hidden");
  });

  if (isHidden) {
    dropdown.classList.remove("hidden");
    const button = friendWrapper.querySelector(".topbar-icon-btn");
    if (button) button.setAttribute("aria-expanded", "true");
  } else {
    closeFriendDropdown();
  }
}

// ─── Setup Widget ───
export function createFriendButton() {
  const currentUser = loadCurrentUser();
  const currentUserId = currentUser?.id || null;

  if (friendWrapper && friendWrapperUserId !== currentUserId) {
    friendWrapper.remove();
    friendWrapper = null;
  }

  if (friendWrapper) {
    return friendWrapper;
  }

  friendWrapper = document.createElement("div");
  friendWrapperUserId = currentUserId;
  friendWrapper.className = "profile-menu friend-menu";
  friendWrapper.style.position = "relative";
  
  listenToFriendUpdates();
  listenToGameInvites(); // เปิดระบบรอสแตนบายรับคำท้าดวล

  friendWrapper.innerHTML = `
    <button type="button" class="topbar-icon-btn friend-button" title="เพิ่มเพื่อน" aria-haspopup="true" aria-expanded="false">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="19" y1="8" x2="19" y2="14"/>
        <line x1="22" y1="11" x2="16" y2="11"/>
      </svg>
    </button>
    <div class="profile-dropdown hidden" role="menu" aria-label="Friend dropdown">
      <div class="profile-dropdown-info">
        <div class="profile-dropdown-text">
          <div class="profile-dropdown-name">จัดการเพื่อน</div>
          <div class="profile-dropdown-email">ค้นหาและเพิ่มเพื่อนในรายชื่อของคุณ</div>
        </div>
      </div>
      <div class="profile-dropdown-items">
        <div class="friend-requests-section">
          <div class="friend-section-title">คำขอเพิ่มเพื่อน</div>
          <div class="friend-requests"></div>
        </div>

        <form id="friend-add-form" class="friend-search-form">
          <input type="text" name="friendSearch" class="auth-input" placeholder="ค้นหาชื่อหรืออีเมล" required>
          <button type="submit" class="auth-button">ค้นหา</button>
        </form>
        <div class="friend-search-result"></div>
        
        <div class="friend-alert settings-message" aria-live="polite" style="display:none"></div>

        <div class="friend-list-section">
          <div class="friend-section-title">รายชื่อเพื่อน</div>
          <div class="friend-list"></div>
        </div>
      </div>
    </div>
  `;

  const button = friendWrapper.querySelector(".topbar-icon-btn");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFriendDropdown();
  });

  friendWrapper.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".profile-menu")) {
      closeFriendDropdown();
    }
  });

  friendWrapper.querySelector("#friend-add-form").addEventListener("submit", handleAddFriend);
  friendWrapper.querySelector(".friend-search-result").addEventListener("click", handleFriendSearchResultClick);
  friendWrapper.querySelector(".friend-list").addEventListener("click", handleFriendListClick);
  friendWrapper.querySelector(".friend-requests").addEventListener("click", handleFriendRequestAction);

  return friendWrapper;
}