// ═══════════════════════════════════════════════
//   notification.js — แจ้งเตือน (ผูก Firebase RTDB)
//   path: notifications/{safeUid}/{pushId}
//     = { type, title, message, link, ts, read }
// ═══════════════════════════════════════════════
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCJjQsqiJsbJW0pwlI0fqnklRhKFPSJh_w",
  authDomain: "rukthai-b4971.firebaseapp.com",
  databaseURL: "https://rukthai-b4971-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "rukthai-b4971",
  storageBucket: "rukthai-b4971.firebasestorage.app",
  messagingSenderId: "140554271105",
  appId: "1:140554271105:web:00530dbfb7b8c4aed1d080"
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

const safeId = (id) => id ? String(id).replace(/[.#$\[\]]/g, '_') : '';
function loadUser() { try { return JSON.parse(localStorage.getItem('rukthai_current_user')) || null; } catch (e) { return null; } }
const currentUser = loadUser();
const mySid = currentUser ? safeId(currentUser.id || currentUser.email) : null;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let notificationWrapper = null;
let notifCache = [];

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'เมื่อสักครู่';
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}

function getUnreadCount() { return notifCache.filter(n => !n.read).length; }
function refreshNotificationDot() {
  if (!notificationWrapper) return;
  const dot = notificationWrapper.querySelector(".notif-dot");
  if (dot) dot.style.display = getUnreadCount() > 0 ? "block" : "none";
}

function renderNotificationList() {
  if (!notificationWrapper) return;
  const listContainer = notificationWrapper.querySelector(".notification-list");
  if (!listContainer) return;
  if (!notifCache.length) {
    listContainer.innerHTML = `<div class="notification-empty">ยังไม่มีการแจ้งเตือน</div>`;
    return;
  }
  listContainer.innerHTML = notifCache.map(n => `
    <div class="notification-item ${n.read ? "read" : "unread"}" ${n.link ? `data-link="${esc(n.link)}"` : ''} data-id="${esc(n.id)}" style="${n.link ? 'cursor:pointer;' : ''}">
      <div class="notification-header">
        <div>
          <div class="notification-title">${esc(n.title || 'การแจ้งเตือน')}</div>
          <div class="notification-time">${timeAgo(n.ts)}</div>
        </div>
        <button type="button" class="notification-mark" data-action="toggle-read" data-id="${esc(n.id)}">${n.read ? "อ่านแล้ว" : "ทำว่าอ่านแล้ว"}</button>
      </div>
      <p class="notification-message">${esc(n.message || '')}</p>
    </div>`).join('');
}

function closeNotificationDropdown() {
  if (!notificationWrapper) return;
  const dropdown = notificationWrapper.querySelector(".profile-dropdown");
  if (dropdown) {
    dropdown.classList.add("hidden");
    const button = notificationWrapper.querySelector(".topbar-icon-btn");
    if (button) button.setAttribute("aria-expanded", "false");
  }
}

function toggleNotificationDropdown() {
  if (!notificationWrapper) return;
  const dropdown = notificationWrapper.querySelector(".profile-dropdown");
  if (!dropdown) return;
  const isHidden = dropdown.classList.contains("hidden");
  document.querySelectorAll(".profile-dropdown").forEach((menu) => { menu.classList.add("hidden"); menu.style.display = ""; });
  if (isHidden) {
    renderNotificationList();
    refreshNotificationDot();
    dropdown.classList.remove("hidden");
    const button = notificationWrapper.querySelector(".topbar-icon-btn");
    if (button) button.setAttribute("aria-expanded", "true");
  } else {
    closeNotificationDropdown();
  }
}

function markRead(id) { if (mySid && id) update(ref(db, `notifications/${mySid}/${id}`), { read: true }).catch(() => {}); }

function handleNotificationActionClick(event) {
  event.stopPropagation();
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "mark-all" && mySid) {
    notifCache.filter(n => !n.read).forEach(n => markRead(n.id));
  }
  if (action === "clear-all" && mySid) {
    remove(ref(db, `notifications/${mySid}`)).catch(() => {});
  }
}

function handleNotificationListClick(event) {
  const markBtn = event.target.closest('button[data-action="toggle-read"]');
  if (markBtn) {
    event.stopPropagation();
    markRead(markBtn.dataset.id);
    return;
  }
  // คลิกตัวการแจ้งเตือน → ทำว่าอ่านแล้ว + ไปยังลิงก์
  const item = event.target.closest('.notification-item[data-link]');
  if (item) {
    event.stopPropagation();
    markRead(item.dataset.id);
    location.href = item.dataset.link;
  }
}

function subscribeNotifications() {
  if (!mySid) { notifCache = []; renderNotificationList(); refreshNotificationDot(); return; }
  onValue(ref(db, `notifications/${mySid}`), (snap) => {
    notifCache = [];
    snap.forEach(ch => { const v = ch.val(); notifCache.push({ id: ch.key, ...v }); });
    notifCache.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    if (notifCache.length > 50) notifCache = notifCache.slice(0, 50);
    renderNotificationList();
    refreshNotificationDot();
  }, (err) => console.error('โหลดแจ้งเตือนไม่ได้:', err.code || err.message));
}

export function createNotificationButton() {
  if (notificationWrapper) return notificationWrapper;
  notificationWrapper = document.createElement("div");
  notificationWrapper.className = "profile-menu notification-menu";
  notificationWrapper.style.position = "relative";
  notificationWrapper.innerHTML = `
    <button type="button" class="topbar-icon-btn" title="การแจ้งเตือน" aria-haspopup="true" aria-expanded="false">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span class="notif-dot"></span>
    </button>
    <div class="profile-dropdown hidden" role="menu" aria-label="Notification dropdown">
      <div class="profile-dropdown-info">
        <div class="profile-dropdown-text">
          <div class="profile-dropdown-name">การแจ้งเตือน</div>
          <div class="profile-dropdown-email">ดูรายการแจ้งเตือนและจัดการสถานะ</div>
        </div>
      </div>
      <div class="profile-dropdown-items">
        <div class="notification-actions">
          <button type="button" class="notification-action-btn" data-action="mark-all">ทำว่าอ่านแล้วทั้งหมด</button>
          <button type="button" class="notification-action-btn" data-action="clear-all">ล้างการแจ้งเตือน</button>
        </div>
        <div class="notification-list"></div>
      </div>
    </div>
  `;
  const button = notificationWrapper.querySelector(".topbar-icon-btn");
  button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); toggleNotificationDropdown(); });
  notificationWrapper.addEventListener("click", (event) => { event.stopPropagation(); });
  document.addEventListener("click", (event) => { if (!event.target.closest(".profile-menu")) closeNotificationDropdown(); });
  notificationWrapper.querySelector(".notification-actions").addEventListener("click", handleNotificationActionClick);
  notificationWrapper.querySelector(".notification-list").addEventListener("click", handleNotificationListClick);

  subscribeNotifications();
  refreshNotificationDot();
  return notificationWrapper;
}