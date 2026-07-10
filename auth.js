// 📌 1. นำเข้า getApps และ getApp เพิ่มเข้ามา
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, update, get, set, push, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

import { createProfileModal, openProfileModal, renderProfileMenu, setProfileSubmitHandler, closeProfileDropdown, closeProfileModal } from "./profile.js";
import { createNotificationButton } from "./notification.js";
import { createFriendButton, initTopbarSearch } from "./friend.js";
import { handleSettingsClick, initializeTheme } from "./setting.js";
import { ensurePlayerId } from "./playerid.js";

const firebaseConfig = {
  apiKey: "AIzaSyCJjQsqiJsbJW0pwlI0fqnklRhKFPSJh_w",
  authDomain: "rukthai-b4971.firebaseapp.com",
  databaseURL: "https://rukthai-b4971-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "rukthai-b4971",
  storageBucket: "rukthai-b4971.firebasestorage.app",
  messagingSenderId: "140554271105",
  appId: "1:140554271105:web:00530dbfb7b8c4aed1d080"
};

// 📌 2. เช็คก่อนว่ามี App อยู่แล้วหรือยัง ถ้ายังไม่มีให้ Initialize ถ้ามีแล้วให้ดึงของเดิมมาใช้
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);

// 📌 ตรวจสอบว่ารูปนี้เป็นรูปจาก Google/Gmail หรือไม่
// รูปที่ผู้ใช้ตั้งเองจะเป็น data: URL (อัปโหลด) หรือ URL อื่น ๆ ที่ผู้ใช้กรอกเอง
function isGoogleAvatar(url) {
  if (!url || typeof url !== "string") return false;
  return url.includes("googleusercontent.com") || url.includes("google.com/");
}

// 📌 ฟังก์ชันช่วยอัปเดตข้อมูลผู้ใช้ขึ้น Firebase (โดยตัดรหัสผ่านออกเพื่อความปลอดภัย)
function syncUserToFirebase(user) {
  if (!user || !user.id) return;
  // Firebase ไม่ยอมให้ใช้จุด (.) เป็นชื่อ key เลยต้องแปลง ID ให้ปลอดภัย
  const safeId = user.id.replace(/[.#$\[\]]/g, '_');

  const { password, ...safeUserData } = user;
  safeUserData.id = safeId;

  // ❗ อย่าเขียนทับ avatar/name ใน Firebase ด้วยค่าว่าง
  // (กันกรณีที่ผู้ใช้ตั้งรูป/ชื่อเองไว้แล้ว แต่ localStorage ยังไม่มีค่านั้น)
  if (!safeUserData.avatar) {
    delete safeUserData.avatar;
  }
  if (!safeUserData.name) {
    delete safeUserData.name;
  }

  update(ref(db, `users/${safeId}`), safeUserData).catch(e => console.error("Firebase sync error:", e));
}

// 📌 ทำให้ผู้ใช้ปัจจุบันมีรหัสผู้เล่น 8 หลัก (ถ้ายังไม่มีจะสร้างให้)
// แล้วเก็บลง localStorage เพื่อให้หน้าอื่นใช้ได้ทันที
async function ensureMyPlayerId(user) {
  if (!user || !user.id) return;
  try {
    const safeId = String(user.id).replace(/[.#$\[\]]/g, '_');
    const pid = await ensurePlayerId(db, { ref, get, set }, safeId);
    if (pid) {
      user.playerId = pid;
      // อัปเดต localStorage current_user ให้มี playerId
      try {
        const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
        if (raw) {
          const cu = JSON.parse(raw);
          if (cu && (cu.id === user.id)) {
            cu.playerId = pid;
            localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(cu));
          }
        }
      } catch (e) {}
    }
  } catch (e) {
    console.warn("[PlayerID] สร้างรหัสผู้เล่นไม่สำเร็จ:", e);
  }
}
// Global function to close ALL dropdowns
function closeAllDropdowns() {
  document.querySelectorAll(".profile-dropdown").forEach((dropdown) => {
    dropdown.classList.add("hidden");
  });
  document.querySelectorAll(".topbar-icon-btn").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
  });
}

const GOOGLE_CLIENT_ID = "229136501224-h3elre8ssit85s7gnug7f8pca54orvlh.apps.googleusercontent.com";
const STORAGE_USERS_KEY = "rukthai_users";
const STORAGE_CURRENT_USER_KEY = "rukthai_current_user";
let googleIdentityInitialized = false;

const authState = {
  users: loadUsers(),
  currentUser: loadCurrentUser(),
};

function normalizeUser(user) {
  if (!user || typeof user !== "object") return user;
  return {
    id: user.id || user.email || `${user.name || "user"}-${Date.now()}`,
    name: user.name || user.email || "ผู้ใช้",
    email: user.email || "",
    password: user.password || "",
    avatar: user.avatar || "",
    ...user,
  };
}

function compactAvatar(avatar) {
  return typeof avatar === "string" ? avatar : "";
}

function compactStats(stats) {
  if (!stats || typeof stats !== "object") return undefined;
  return {

    total: Number(stats.total) || 0,
    wins: Number(stats.wins) || 0,
    losses: Number(stats.losses) || 0,
    elo: Number(stats.elo) || 1600,
  };
}

function toStoredUser(user) {
  const normalized = normalizeUser(user);
  if (!normalized) return null;
  const friends = Array.isArray(normalized.friends)
    ? normalized.friends.map((friend) => ({
        id: friend.id || friend.email || "",
        name: friend.name || friend.email || "",
        email: friend.email || "",
        avatar: compactAvatar(friend.avatar),
      })).filter((friend) => friend.id)
    : [];

  return {
    id: normalized.id,
    name: normalized.name,
    email: normalized.email,
    password: normalized.password || "",
    avatar: compactAvatar(normalized.avatar),
    friends,
    stats: compactStats(normalized.stats),
  };
}

function isQuotaExceededError(error) {
  return error?.name === "QuotaExceededError" || error?.code === 22 || error?.code === 1014;
}

function writeJsonStorage(key, value) {
  const payload = JSON.stringify(value);

  try {
    localStorage.removeItem(key);
    localStorage.setItem(key, payload);
    return true;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      throw error;
    }

    try {
      const storedUsers = JSON.parse(localStorage.getItem(STORAGE_USERS_KEY)) || [];
      const compactUsers = Array.isArray(storedUsers) ? storedUsers.map(toStoredUser).filter(Boolean) : [];
      localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
      localStorage.removeItem(STORAGE_USERS_KEY);
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(compactUsers));
      localStorage.setItem(key, payload);
      return true;
    } catch (compactError) {
      console.error("[Auth] Cannot save auth data because localStorage is full:", compactError);
      return false;
    }
  }
}

function loadUsers() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_USERS_KEY)) || [];
    const users = Array.isArray(stored) ? stored.map(normalizeUser) : [];
    if (JSON.stringify(users) !== JSON.stringify(stored)) {
      saveUsers(users);
    }
    return users;
  } catch (error) {
    return [];
  }
}

function saveUsers(users) {
  writeJsonStorage(STORAGE_USERS_KEY, users.map(toStoredUser).filter(Boolean));
}

function loadCurrentUser() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_CURRENT_USER_KEY));
    const user = normalizeUser(stored);
    if (user && (!stored || user.id !== stored.id)) {
      saveCurrentUser(user);
    }
    return user;
  } catch (error) {
    return null;
  }
}

function saveCurrentUser(user) {
  if (user) {
    const storedUser = toStoredUser(user);
    writeJsonStorage(STORAGE_CURRENT_USER_KEY, storedUser);
    authState.currentUser = storedUser;
  } else {
    localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    authState.currentUser = null;
  }
}

// ─── Dropdown เมนู เรียนรู้/ชุมชน บน topbar (hover เปิดได้เลย ไม่ต้องคลิกเข้าไปก่อน) ───
function enhanceNavDropdowns() {
  const nav = document.querySelector(".topbar .nav");
  if (!nav || nav.querySelector(".nav-drop")) return;
  const MENUS = {
    "learn.html": [
      { href: "learn.html#lessons", label: "📖 บทเรียน" },
      { href: "learn.html#tactics", label: "🧩 ชั้นเชิง" },
      { href: "learn.html#courses", label: "🎓 คอร์ส" },
    ],
    "community.html": [
      { href: "community.html#clubs", label: "🏛 ซุ้ม" },
      { href: "community.html#chat",  label: "💬 แชทรวม" },
      { href: "community.html#blog",  label: "📰 ข่าวสาร" },
    ],
  };
  Object.keys(MENUS).forEach((page) => {
    const link = nav.querySelector(`a[href$="${page}"]`);
    if (!link) return;
    const wrap = document.createElement("span");
    wrap.className = "nav-drop";
    link.parentNode.insertBefore(wrap, link);
    wrap.appendChild(link);
    const menu = document.createElement("div");
    menu.className = "nav-drop-menu";
    menu.innerHTML = `<div class="ndm-box">` + MENUS[page].map(m =>
      `<a href="${m.href}">${m.label}</a>`).join("") + `</div>`;
    wrap.appendChild(menu);
    // ถ้าอยู่หน้าเดียวกันอยู่แล้ว ให้เปลี่ยนแท็บทันที (hashchange จัดการ)
    menu.querySelectorAll("a").forEach(a => a.addEventListener("click", (e) => {
      if (location.pathname.endsWith("/" + page) || location.pathname.endsWith(page)) {
        e.preventDefault();
        location.hash = a.getAttribute("href").split("#")[1] || "";
      }
    }));
  });
}

function createMobileNav() {
  if (document.getElementById("hamburger-btn")) return;

  const nav = document.querySelector(".topbar .nav");
  if (!nav) return;

  // สร้างปุ่ม hamburger
  const btn = document.createElement("button");
  btn.id = "hamburger-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "เมนู");
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect y="3" width="20" height="2" rx="1" fill="currentColor"/>
    <rect y="9" width="20" height="2" rx="1" fill="currentColor"/>
    <rect y="15" width="20" height="2" rx="1" fill="currentColor"/>
  </svg>`;
  btn.style.cssText = `
    display: none;
    width: 36px; height: 36px;
    background: transparent;
    border: none;
    color: var(--text);
    cursor: pointer;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    padding: 0;
    flex-shrink: 0;
  `;

  // สร้าง drawer overlay
  const drawer = document.createElement("div");
  drawer.id = "mobile-nav-drawer";
  drawer.style.cssText = `
    display: none;
    position: fixed;
    inset: 0;
    z-index: 9999;
  `;

  // backdrop
  const backdrop = document.createElement("div");
  backdrop.style.cssText = `
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
  `;

  // panel
  const panel = document.createElement("div");
  panel.style.cssText = `
    position: absolute;
    top: 0; left: 0;
    width: 260px;
    height: 100%;
    background: var(--bg, #1a1a1a);
    border-right: 1px solid rgba(255,255,255,0.08);
    display: flex;
    flex-direction: column;
    padding: 0;
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.22,1,0.36,1);
    overflow-y: auto;
  `;

  // header ใน panel
  const panelHeader = document.createElement("div");
  panelHeader.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    height: 56px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  `;

  const panelTitle = document.createElement("span");
  panelTitle.textContent = "เมนู";
  panelTitle.style.cssText = `font-weight: 700; color: var(--text); font-size: 16px;`;

  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "✕";
  closeBtn.style.cssText = `
    background: none; border: none;
    color: var(--muted); font-size: 16px;
    cursor: pointer; padding: 4px 8px;
    border-radius: 6px;
  `;

  panelHeader.appendChild(panelTitle);
  panelHeader.appendChild(closeBtn);

  // nav links
  const navLinks = document.createElement("nav");
  navLinks.style.cssText = `display: flex; flex-direction: column; padding: 12px 0; flex: 1;`;

  const links = [
    { href: "play.html",       label: "♟ เล่น" },
    { href: "tournament.html", label: "🏆 ทัวร์นาเมนต์" },
    { href: "learn.html",      label: "📖 เรียนรู้" },
    { href: "watch.html",      label: "👁 ดูเกม" },
    { href: "community.html",  label: "💬 ชุมชน" },
  ];

  links.forEach(({ href, label }) => {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    a.style.cssText = `
      padding: 14px 20px;
      color: var(--text);
      text-decoration: none;
      font-size: 15px;
      font-weight: 500;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      transition: background 0.15s;
    `;
    a.addEventListener("mouseenter", () => a.style.background = "rgba(255,255,255,0.05)");
    a.addEventListener("mouseleave", () => a.style.background = "transparent");
    navLinks.appendChild(a);
  });

  // search ใน drawer
  const searchWrap = document.createElement("div");
  searchWrap.style.cssText = `padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.07);`;
  const searchInput = document.createElement("input");
  searchInput.placeholder = "ค้นหาผู้เล่น...";
  searchInput.style.cssText = `
    width: 100%; height: 38px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.06);
    color: var(--text);
    font-size: 14px;
    box-sizing: border-box;
  `;
  searchWrap.appendChild(searchInput);

  panel.appendChild(panelHeader);
  panel.appendChild(navLinks);
  panel.appendChild(searchWrap);
  drawer.appendChild(backdrop);
  drawer.appendChild(panel);
  document.body.appendChild(drawer);

  // insert hamburger ก่อน nav
  nav.parentNode.insertBefore(btn, nav);

  // show/hide ตาม screen size
  function checkSize() {
    if (window.innerWidth <= 640) {
      btn.style.display = "flex";
    } else {
      btn.style.display = "none";
      closeDrawer();
    }
  }

  function openDrawer() {
    drawer.style.display = "block";
    requestAnimationFrame(() => { panel.style.transform = "translateX(0)"; });
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    panel.style.transform = "translateX(-100%)";
    setTimeout(() => {
      if (panel.style.transform === "translateX(-100%)") {
        drawer.style.display = "none";
        document.body.style.overflow = "";
      }
    }, 300);
  }

  btn.addEventListener("click", openDrawer);
  closeBtn.addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);

  window.addEventListener("resize", checkSize);
  checkSize();
}

// ════════════════════════════════════════════════════════════
//   ปุ่มลอย "กลับเข้าสู่เกม" — แสดงทุกหน้าเมื่อมีเกมค้างอยู่
// ════════════════════════════════════════════════════════════
function ensureResumeGameStyles() {
  if (document.getElementById("resume-game-styles")) return;
  const style = document.createElement("style");
  style.id = "resume-game-styles";
  style.textContent = `
    #resume-game-fab {
      position: fixed;
      top: 74px; right: 16px;
      z-index: 10050;
      display: flex; align-items: stretch; gap: 0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.45);
      animation: rgfPop 0.25s ease;
      font-family: 'Noto Sans Thai', sans-serif;
    }
    @keyframes rgfPop { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    .resume-game-btn {
      background: linear-gradient(135deg, #b88a2e, #e0c070);
      color: #1a1a1a;
      border: none;
      font-weight: 700;
      font-size: 0.9rem;
      padding: 10px 16px;
      cursor: pointer;
      display: flex; align-items: center; gap: 6px;
      font-family: 'Noto Sans Thai', sans-serif;
      transition: filter 0.2s;
    }
    .resume-game-btn:hover { filter: brightness(1.08); }
    .resume-game-dismiss {
      background: rgba(0,0,0,0.25);
      color: #fff;
      border: none;
      cursor: pointer;
      padding: 0 12px;
      font-size: 0.85rem;
      transition: background 0.2s;
    }
    .resume-game-dismiss:hover { background: rgba(0,0,0,0.4); }
    @media screen and (max-width: 600px) {
      #resume-game-fab { top: 64px; right: 8px; }
      .resume-game-btn { font-size: 0.82rem; padding: 8px 12px; }
    }
  `;
  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════
//   AUTO-START ทัวร์นาเมนต์ตามเวลา (client trigger + transaction กัน race)
// ═══════════════════════════════════════════════════════════
const TN_INITIAL_FB = [
  'Rb,Nb,Bb,Qb,Kb,Bb,Nb,Rb', ',,,,,,,', 'Pb,Pb,Pb,Pb,Pb,Pb,Pb,Pb', ',,,,,,,',
  ',,,,,,,', 'Pw,Pw,Pw,Pw,Pw,Pw,Pw,Pw', ',,,,,,,', 'Rw,Nw,Bw,Kw,Qw,Bw,Nw,Rw'
];
function tnSafe(id) { return id ? String(id).replace(/[.#$\[\]]/g, '_') : ''; }
function tnPgInfo(t, uid) { const p = (t.players && t.players[uid]) || {}; return { name: p.name || 'ผู้เล่น', avatar: p.avatar || '' }; }
function tnArrToObj(arr) { const o = {}; arr.forEach((p, i) => o[i] = p); return o; }
function tnNextPow2(n) { let p = 1; while (p < n) p *= 2; return p; }
function tnSwissTotal(t, n) {
  if (t.swissRoundsMode === 'manual' && t.swissRounds) return t.swissRounds;
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));
}
function tnGenSwissR1(t) {
  const pool = Object.entries(t.players).map(([uid, p]) => ({ uid, name: p.name, avatar: p.avatar || '', rating: p.rating || 0 })).sort((a, b) => b.rating - a.rating);
  const out = []; let bye = null;
  if (pool.length % 2 === 1) bye = pool.pop();
  for (let k = 0; k < pool.length; k += 2) {
    const a = pool[k], b = pool[k + 1];
    out.push({ white: a.uid, whiteName: a.name, whiteAvatar: a.avatar, black: b.uid, blackName: b.name, blackAvatar: b.avatar, result: null });
  }
  if (bye) out.push({ white: bye.uid, whiteName: bye.name, whiteAvatar: bye.avatar, black: null, blackName: null, result: 'bye' });
  return out;
}
function tnGenKnockoutR1(t) {
  const players = Object.entries(t.players).map(([uid, p]) => ({ uid, name: p.name, avatar: p.avatar || '', rating: p.rating || 0 })).sort((a, b) => b.rating - a.rating);
  const size = tnNextPow2(players.length), slots = [];
  for (let i = 0; i < size; i++) slots.push(players[i] || null);
  const out = [];
  for (let k = 0; k < size / 2; k++) {
    const a = slots[k], b = slots[size - 1 - k];
    if (a && b) out.push({ white: a.uid, whiteName: a.name, whiteAvatar: a.avatar, black: b.uid, blackName: b.name, blackAvatar: b.avatar, result: null });
    else if (a) out.push({ white: a.uid, whiteName: a.name, whiteAvatar: a.avatar, black: null, blackName: null, result: 'bye' });
    else if (b) out.push({ white: b.uid, whiteName: b.name, whiteAvatar: b.avatar, black: null, blackName: null, result: 'bye' });
  }
  return out;
}
function tnRoundRobinSchedule(uids) {
  const arr = uids.slice(); if (arr.length % 2 === 1) arr.push('');
  const n = arr.length, rounds = [], fixed = arr[0]; let rest = arr.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const row = [fixed, ...rest], pairs = [];
    for (let i = 0; i < n / 2; i++) pairs.push([row[i], row[n - 1 - i]]);
    rounds.push(pairs);
    rest = [rest[rest.length - 1], ...rest.slice(0, rest.length - 1)];
  }
  return rounds;
}
function tnRRPairings(t, pairs) {
  return pairs.map(([a, b]) => {
    if (!a || !b) { const u = a || b; const inf = tnPgInfo(t, u); return { white: u, whiteName: inf.name, whiteAvatar: inf.avatar, black: null, blackName: null, result: 'bye' }; }
    const ai = tnPgInfo(t, a), bi = tnPgInfo(t, b);
    return { white: a, whiteName: ai.name, whiteAvatar: ai.avatar, black: b, blackName: bi.name, blackAvatar: bi.avatar, result: null };
  });
}
async function tnCreateRooms(tid, round, pairings, t) {
  for (let i = 0; i < pairings.length; i++) {
    const pg = pairings[i];
    if (pg.black == null || pg.result === 'bye') continue;
    const gref = push(ref(db, 'games'));
    await set(gref, {
      w: { uid: pg.white, name: pg.whiteName, avatar: pg.whiteAvatar || '' },
      b: { uid: pg.black, name: pg.blackName, avatar: pg.blackAvatar || '' },
      minutes: t.timeControl, bonus: t.bonus || 0, turn: 'w', board: TN_INITIAL_FB,
      timeW: t.timeControl * 60, timeB: t.timeControl * 60, moveCount: 0,
      startedAt: serverTimestamp(), conn_w: false, conn_b: false, ranked: !!t.rated,
      tournament: { tid, round, pair: String(i), type: t.type, lateMin: t.lateMin || 5 }
    });
    pg.room = gref.key;
  }
}
async function tnNotifyAll(t, tid, title, message) {
  if (!t.players) return;
  const link = `tournament.html#t=${tid}`;
  await Promise.all(Object.keys(t.players).map(sid =>
    push(ref(db, `notifications/${sid}`), { type: 'tournament', title, message, link, ts: Date.now(), read: false }).catch(() => {})));
}
async function tnBuildFirstRound(id, t) {
  const cnt = Object.keys(t.players).length;
  let pairings, extra = {};
  if (t.type === 'knockout') pairings = tnGenKnockoutR1(t);
  else if (t.type === 'roundrobin') {
    const uids = Object.entries(t.players).sort((a, b) => (b[1].rating || 0) - (a[1].rating || 0)).map(([u]) => u);
    const sched = tnRoundRobinSchedule(uids);
    extra.rrSchedule = sched.map(rd => rd.map(([a, b]) => [a || '', b || '']));
    extra.totalRounds = sched.length;
    pairings = tnRRPairings(t, sched[0]);
  } else { pairings = tnGenSwissR1(t); extra.totalRounds = tnSwissTotal(t, cnt); }
  await tnCreateRooms(id, 1, pairings, t);
  await update(ref(db, `tournaments/${id}`), {
    currentRound: 1, [`rounds/1/pairings`]: tnArrToObj(pairings), ...extra,
    announcement: { round: 1, text: 'การแข่งขันเริ่มแล้ว! กรุณาเข้าห้องแข่งขันของคุณ', ts: Date.now() }
  });
  tnNotifyAll(t, id, '🏆 ทัวร์นาเมนต์เริ่มแล้ว', `${t.name} — รอบที่ 1 เริ่มแล้ว เข้าห้องแข่งขันได้เลย`);
}
async function autoStartDueTournaments() {
  let snap; try { snap = await get(ref(db, 'tournaments')); } catch (e) { return; }
  const all = snap.val() || {}, now = Date.now();
  for (const [id, t] of Object.entries(all)) {
    if (!t || t.started || t.finished || !t.startAt || now < t.startAt) continue;
    const cnt = t.players ? Object.keys(t.players).length : 0;
    if (cnt < (t.minPlayers || 2)) continue;     // ผู้เล่นไม่พอ → ไม่เริ่มอัตโนมัติ
    let won = false;
    try {
      const txn = await runTransaction(ref(db, `tournaments/${id}/started`), cur => cur ? undefined : true);
      won = txn.committed;     // ผู้ที่เปลี่ยน false→true ได้สำเร็จเท่านั้นที่เป็นคนเริ่ม
    } catch (e) { continue; }
    if (!won) continue;
    try { await tnBuildFirstRound(id, t); } catch (e) { console.error('auto-start error', e); }
  }
}

// ── เครื่องยนต์เดินทัวร์อัตโนมัติ: adjudicate → นับถอยหลัง → จับรอบถัดไป → จบเอง ──
function tnComputeStandings(t) {
  const stat = {};
  const init = (uid) => { if (stat[uid]) return; const p = (t.players && t.players[uid]) || {};
    stat[uid] = { uid, name: p.name || 'ผู้เล่น', avatar: p.avatar || '', rating: p.rating || 0, score: 0, wins: 0, draws: 0, losses: 0, hadBye: false, opps: [], oppRes: {}, cw: 0, cb: 0 }; };
  for (let rd = 1; rd <= (t.currentRound || 0); rd++) {
    const pr = t.rounds && t.rounds[rd] && t.rounds[rd].pairings; if (!pr) continue;
    Object.values(pr).forEach(pg => {
      if (pg.black == null || pg.result === 'bye') { if (pg.white) { init(pg.white); stat[pg.white].score += 1; stat[pg.white].hadBye = true; } return; }
      init(pg.white); init(pg.black); stat[pg.white].cw++; stat[pg.black].cb++;
      stat[pg.white].opps.push(pg.black); stat[pg.black].opps.push(pg.white);
      if (pg.result === '1-0') { stat[pg.white].score++; stat[pg.white].wins++; stat[pg.black].losses++; stat[pg.white].oppRes[pg.black] = 'w'; stat[pg.black].oppRes[pg.white] = 'l'; }
      else if (pg.result === '0-1') { stat[pg.black].score++; stat[pg.black].wins++; stat[pg.white].losses++; stat[pg.black].oppRes[pg.white] = 'w'; stat[pg.white].oppRes[pg.black] = 'l'; }
      else if (pg.result === '½-½') { stat[pg.white].score += 0.5; stat[pg.black].score += 0.5; stat[pg.white].draws++; stat[pg.black].draws++; stat[pg.white].oppRes[pg.black] = 'd'; stat[pg.black].oppRes[pg.white] = 'd'; }
      else if (pg.result === 'double') { stat[pg.white].losses++; stat[pg.black].losses++; stat[pg.white].oppRes[pg.black] = 'l'; stat[pg.black].oppRes[pg.white] = 'l'; }
    });
  }
  if (t.players) Object.keys(t.players).forEach(init);
  Object.values(stat).forEach(s => {
    s.buch = s.opps.reduce((a, o) => a + (stat[o] ? stat[o].score : 0), 0);
    s.sb = s.opps.reduce((a, o) => { const r = s.oppRes[o], os = stat[o] ? stat[o].score : 0; return a + (r === 'w' ? os : r === 'd' ? os * 0.5 : 0); }, 0);
  });
  return Object.values(stat).sort((a, b) => (b.score - a.score) || (b.buch - a.buch) || (b.sb - a.sb) ||
    (a.oppRes[b.uid] === 'w' ? -1 : a.oppRes[b.uid] === 'l' ? 1 : b.rating - a.rating));
}
function tnRoundComplete(t, rd) {
  const pr = t.rounds && t.rounds[rd] && t.rounds[rd].pairings; if (!pr) return false;
  return Object.values(pr).every(pg => {
    if (pg.black == null || pg.result === 'bye' || pg.result === 'double') return true;
    if (t.type === 'knockout') return pg.result === '1-0' || pg.result === '0-1';
    return !!pg.result;
  });
}
function tnGenSwissNext(t, standings) {
  const pool = standings.slice(); const out = []; let bye = null;
  if (pool.length % 2 === 1) { let idx = -1; for (let i = pool.length - 1; i >= 0; i--) if (!pool[i].hadBye) { idx = i; break; } if (idx === -1) idx = pool.length - 1; bye = pool.splice(idx, 1)[0]; }
  const used = new Set();
  for (let i = 0; i < pool.length; i++) {
    if (used.has(pool[i].uid)) continue; let j = -1;
    for (let k = i + 1; k < pool.length; k++) if (!used.has(pool[k].uid) && !pool[i].opps.includes(pool[k].uid)) { j = k; break; }
    if (j === -1) for (let k = i + 1; k < pool.length; k++) if (!used.has(pool[k].uid)) { j = k; break; }
    if (j === -1) continue; used.add(pool[i].uid); used.add(pool[j].uid);
    let a = pool[i], b = pool[j]; if (b.cw < a.cw) { const tmp = a; a = b; b = tmp; }
    out.push({ white: a.uid, whiteName: a.name, whiteAvatar: a.avatar, black: b.uid, blackName: b.name, blackAvatar: b.avatar, result: null });
  }
  if (bye) out.push({ white: bye.uid, whiteName: bye.name, whiteAvatar: bye.avatar, black: null, blackName: null, result: 'bye' });
  return out;
}
function tnGenKnockoutNext(t) {
  const pr = t.rounds[t.currentRound].pairings;
  const winners = Object.keys(pr).sort((a, b) => +a - +b).map(k => { const pg = pr[k]; if (pg.result === 'bye' || pg.result === '1-0') return pg.white; if (pg.result === '0-1') return pg.black; return null; }).filter(Boolean);
  const out = [];
  for (let i = 0; i < winners.length; i += 2) {
    const a = winners[i], b = winners[i + 1], ai = tnPgInfo(t, a);
    if (b == null) { out.push({ white: a, whiteName: ai.name, whiteAvatar: ai.avatar, black: null, blackName: null, result: 'bye' }); continue; }
    const bi = tnPgInfo(t, b); out.push({ white: a, whiteName: ai.name, whiteAvatar: ai.avatar, black: b, blackName: bi.name, blackAvatar: bi.avatar, result: null });
  }
  return { pairings: out, winners };
}
async function tnAdjudicateLate(id, t) {
  const pr = t.rounds && t.rounds[t.currentRound] && t.rounds[t.currentRound].pairings; if (!pr) return false;
  let changed = false;
  for (const k of Object.keys(pr)) {
    const pg = pr[k]; if (pg.result || pg.black == null || !pg.room) continue;
    let g; try { g = (await get(ref(db, `games/${pg.room}`))).val(); } catch (e) { continue; }
    if (!g) continue;
    const lateMin = (g.tournament && g.tournament.lateMin) || t.lateMin || 5;
    const started = g.startedAt || 0;
    if (!started || Date.now() <= started + lateMin * 60000) continue;
    const wArr = !!g.arrived_w, bArr = !!g.arrived_b; if (wArr && bArr) continue;
    const res = (wArr && !bArr) ? '1-0' : (!wArr && bArr) ? '0-1' : 'double';
    try { await set(ref(db, `tournaments/${id}/rounds/${t.currentRound}/pairings/${k}/result`), res); changed = true; pg.result = res; } catch (e) {}
  }
  return changed;
}
async function tnFinish(id, t) {
  const arr = tnComputeStandings(t); const total = arr.length;
  const medalOf = (i) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : null;
  await Promise.all(arr.map((s, i) => set(ref(db, `user_tournaments/${s.uid}/${id}`), {
    tournamentName: t.name, type: t.type, rank: i + 1, totalPlayers: total, medal: medalOf(i),
    score: s.score, wins: s.wins, draws: s.draws, losses: s.losses, finishedAt: Date.now()
  }).catch(() => {})));
  const finalRanks = arr.map((s, i) => ({ uid: s.uid, name: s.name, rank: i + 1, score: s.score, medal: medalOf(i) }));
  await update(ref(db, `tournaments/${id}`), { finished: true, finalRanks });
  if (arr[0]) tnNotifyAll(t, id, '🏁 ทัวร์นาเมนต์จบแล้ว', `${t.name} — แชมป์คือ ${arr[0].name} 🥇`);
}
async function tnAdvance(id, t) {
  const nextNum = t.currentRound + 1;
  // คว้าสิทธิ์เลื่อนรอบ (กัน race): เปลี่ยน currentRound R→R+1 ได้คนเดียว
  let won = false;
  try { const txn = await runTransaction(ref(db, `tournaments/${id}/currentRound`), cur => cur === t.currentRound ? nextNum : undefined); won = txn.committed; } catch (e) { return; }
  if (!won) return;
  let pairings, extra = {};
  if (t.type === 'knockout') {
    const r = tnGenKnockoutNext(t); if (r.winners.length <= 1) { await tnFinish(id, t); return; } pairings = r.pairings;
  } else if (t.type === 'roundrobin') {
    if (t.currentRound >= (t.totalRounds || 0)) { await tnFinish(id, t); return; }
    pairings = tnRRPairings(t, (t.rrSchedule || [])[t.currentRound] || []);
  } else {
    if (t.currentRound >= (t.totalRounds || 0)) { await tnFinish(id, t); return; }
    pairings = tnGenSwissNext(t, tnComputeStandings(t));
  }
  await tnCreateRooms(id, nextNum, pairings, t);
  await update(ref(db, `tournaments/${id}`), {
    [`rounds/${nextNum}/pairings`]: tnArrToObj(pairings), roundEndedAt: null,
    announcement: { round: nextNum, text: `รอบที่ ${nextNum} เริ่มแล้ว กรุณาเข้าห้องแข่งขัน`, ts: Date.now() }
  });
  tnNotifyAll(t, id, '📢 รอบใหม่เริ่มแล้ว', `${t.name} — รอบที่ ${nextNum} เริ่มแล้ว`);
}
async function progressTournaments() {
  let snap; try { snap = await get(ref(db, 'tournaments')); } catch (e) { return; }
  const all = snap.val() || {}, now = Date.now();
  for (const [id, t] of Object.entries(all)) {
    if (!t || !t.started || t.finished || !t.currentRound) continue;
    // 1) ตัดสินคู่ที่เลยเวลาเข้าร่วมอัตโนมัติ
    let tt = t;
    try { if (await tnAdjudicateLate(id, tt)) { const fr = (await get(ref(db, `tournaments/${id}`))).val(); if (fr) tt = fr; } } catch (e) {}
    // 2) รอบยังไม่จบ → ข้าม
    if (!tnRoundComplete(tt, tt.currentRound)) continue;
    // 3) รอบจบ → ตั้งเวลาเริ่มนับถอยหลัง (ครั้งเดียว)
    if (!tt.roundEndedAt) {
      try { await runTransaction(ref(db, `tournaments/${id}/roundEndedAt`), cur => cur ? undefined : Date.now()); } catch (e) {}
      continue;
    }
    // 4) ครบเวลาพัก → จับรอบถัดไป / จบทัวร์
    const breakMs = (tt.breakMin != null ? tt.breakMin : 2) * 60000;
    if (now >= tt.roundEndedAt + breakMs) {
      const lastRound = (tt.type !== 'knockout') && (tt.currentRound >= (tt.totalRounds || 0));
      try { if (lastRound) await tnFinishGuarded(id, tt); else await tnAdvance(id, tt); } catch (e) { console.error('progress error', e); }
    }
  }
}
async function tnFinishGuarded(id, t) {
  // กัน finish ซ้ำด้วย transaction บน finished
  let won = false;
  try { const txn = await runTransaction(ref(db, `tournaments/${id}/finished`), cur => cur ? undefined : true); won = txn.committed; } catch (e) { return; }
  if (!won) return;
  await tnFinish(id, t);
}

// เด้งเข้าห้องแข่งขันทัวร์อัตโนมัติ — ถ้าผู้เล่นมีคู่ในรอบปัจจุบันที่ยังไม่จบ
// เริ่มเด้งตั้งแต่ 1 นาทีก่อนเวลาเริ่ม · กัน redirect loop (ไม่เด้งถ้าอยู่ในห้องนั้นแล้ว)
async function checkTournamentRedirect(safeId) {
  if (!safeId) return;
  const path = window.location.pathname;
  let snap;
  try { snap = await get(ref(db, 'tournaments')); } catch (e) { return; }
  const all = snap.val() || {};
  const now = Date.now();
  for (const [tid, t] of Object.entries(all)) {
    if (!t || !t.started || t.finished || !t.players || !t.players[safeId]) continue;
    if (t.startAt && now < t.startAt - 60000) continue;       // ยังไม่ถึง 1 นาทีก่อนเริ่ม
    const pr = t.rounds && t.rounds[t.currentRound] && t.rounds[t.currentRound].pairings;
    if (!pr) continue;
    const myPg = Object.values(pr).find(p =>
      (p.white === safeId || p.black === safeId) && p.black != null && p.result == null && p.room);
    if (!myPg) continue;
    const color = myPg.white === safeId ? 'w' : 'b';
    const target = myPg.room;
    // อยู่ในห้องนี้อยู่แล้ว → ไม่ต้องเด้ง (กัน loop)
    const params = new URLSearchParams(window.location.search);
    if (path.endsWith('play-online.html') && params.get('room') === target) return;
    window.location.href = `/pages/play-online.html?room=${encodeURIComponent(target)}&color=${color}`;
    return;
  }
}

function renderResumeGameButton() {
  // ลบปุ่มเดิมถ้ามี
  const old = document.getElementById("resume-game-fab");
  if (old) old.remove();

  let active = null;
  try { active = JSON.parse(localStorage.getItem("rukthai_active_game")); } catch (e) {}
  if (!active || !active.gameId) return;

  // ไม่ต้องแสดงบนหน้า play-online เอง
  const path = window.location.pathname;
  if (path.endsWith("play-online.html")) return;

  ensureResumeGameStyles();

  const fab = document.createElement("div");
  fab.id = "resume-game-fab";
  fab.innerHTML = `
    <button class="resume-game-btn" type="button">▶ กลับเข้าสู่เกม</button>
    <button class="resume-game-dismiss" type="button" title="ซ่อน">✕</button>
  `;
  document.body.appendChild(fab);

  fab.querySelector(".resume-game-btn").addEventListener("click", () => {
    window.location.href = `/pages/play-online.html?room=${encodeURIComponent(active.gameId)}&color=${encodeURIComponent(active.color)}`;
  });
  fab.querySelector(".resume-game-dismiss").addEventListener("click", () => {
    fab.remove();
  });
}

// เพิ่มเมนู "อันดับ" (leaderboard) เข้า topbar ถ้ายังไม่มี — ใช้ทุกหน้าโดยไม่ต้องแก้ HTML
function ensureLeaderboardNavLink() {
  const nav = document.querySelector(".nav");
  if (!nav) return;
  if (nav.querySelector('a[href$="leaderboard.html"]')) return; // มีแล้ว

  // อิงพาธจากลิงก์ที่มีอยู่ (รองรับทั้งหน้าใน /pages/ และ root)
  let href = "leaderboard.html";
  const sample = nav.querySelector("a[href]");
  if (sample) {
    href = sample.getAttribute("href").replace(/[^\/]*$/, "leaderboard.html");
  }

  const link = document.createElement("a");
  link.href = href;
  link.textContent = "อันดับ";

  // วางต่อจาก "ดูเกม" (watch) ถ้าเจอ ไม่งั้นต่อท้ายเมนูสุดท้ายก่อนช่องค้นหา
  const watchLink = nav.querySelector('a[href$="watch.html"]');
  const searchBox = nav.querySelector(".search");
  if (watchLink && watchLink.nextSibling) {
    nav.insertBefore(link, watchLink.nextSibling);
  } else if (searchBox) {
    nav.insertBefore(link, searchBox);
  } else {
    nav.appendChild(link);
  }
}

// ════════════════════════════════════════════════════════════
//   ทำตัวหนาเมนู topbar ของหน้าปัจจุบัน
// ════════════════════════════════════════════════════════════
function highlightCurrentNav() {
  // ใส่สไตล์ครั้งเดียว
  if (!document.getElementById("nav-active-style")) {
    const style = document.createElement("style");
    style.id = "nav-active-style";
    style.textContent = `.nav a.nav-active { font-weight: 700; color: var(--text); }`;
    document.head.appendChild(style);
  }

  // ชื่อไฟล์ของหน้าปัจจุบัน (เช่น "play.html")
  let current = window.location.pathname.split("/").pop();
  if (!current) current = "play.html"; // กรณีเป็น root/โฟลเดอร์

  document.querySelectorAll(".nav a").forEach(link => {
    const href = (link.getAttribute("href") || "").split("/").pop().split("?")[0].split("#")[0];
    link.classList.toggle("nav-active", href !== "" && href === current);
  });
}

function initAuth() {
  initializeTheme();
  createAuthModal();
  createProfileModal();
  createMobileNav();
  enhanceNavDropdowns();
  setProfileSubmitHandler(handleProfileForm);
  updateAuthUI();
  attachTopbarButtons();
  initTopbarSearch();
  ensureLeaderboardNavLink();
  highlightCurrentNav();
  renderResumeGameButton();
  window.addEventListener('storage', (e) => {
    if (e.key === 'rukthai_active_game') renderResumeGameButton();
  });
  document.addEventListener("click", handleDocumentClick);
  if (authState.currentUser) {
    // ผู้ใช้ที่ล็อกอินค้างอยู่แล้ว — แจกรหัสผู้เล่นให้ถ้ายังไม่มี
    ensureMyPlayerId(authState.currentUser);
  }
  // ทัวร์นาเมนต์: เริ่มอัตโนมัติตามเวลา แล้วเด้งผู้เล่นเข้าห้อง (ทำงานทุกหน้า)
  const sidForTn = authState.currentUser ? String(authState.currentUser.id || authState.currentUser.email).replace(/[.#$\[\]]/g, '_') : null;
  const runTnCycle = async () => {
    try { await autoStartDueTournaments(); } catch (e) {}
    try { await progressTournaments(); } catch (e) {}
    if (sidForTn) { try { await checkTournamentRedirect(sidForTn); } catch (e) {} }
  };
  runTnCycle();
  // เช็คซ้ำทุก 20 วิ เผื่อเปิดหน้าค้างไว้จนถึงเวลาเริ่ม/รอบใหม่
  setInterval(runTnCycle, 20000);
  if (!authState.currentUser && isProfilePage()) {
    redirectToLoginPage();
    return;
  }
  if (sessionStorage.getItem("redirectToLoginAfterLogout")) {
    sessionStorage.removeItem("redirectToLoginAfterLogout");
    openAuthModal("login");
  }
  if (GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes("YOUR_GOOGLE_CLIENT_ID")) {
    loadGoogleScript();
  }
}

function isProfilePage() {
  return window.location.pathname.endsWith("/profile.html");
}

function redirectToLoginPage() {
  if (isProfilePage()) {
    sessionStorage.setItem("redirectToLoginAfterLogout", "true");
    window.location.href = "play.html";
  } else {
    openAuthModal("login");
  }
}

function attachTopbarButtons() {
  const loginButton = document.querySelector(".topbar .login");
  const registerButton = document.querySelector(".topbar .register");
  if (loginButton) {
    loginButton.addEventListener("click", () => openAuthModal("login"));
  }
  if (registerButton) {
    registerButton.addEventListener("click", () => openAuthModal("register"));
  }
}

function updateAuthUI() {
  const rightSection = document.querySelector(".topbar .right");
  if (!rightSection) {
    return;
  }

  if (authState.currentUser) {
    rightSection.innerHTML = "";
    
    const addFriendBtn = createFriendButton();
    const notificationBtn = createNotificationButton();
    const profileMenu = renderProfileMenu(
      authState.currentUser,
      () => openProfileModal(authState.currentUser),
      handleSettingsClick,
      logout
    );

    rightSection.appendChild(addFriendBtn);
    rightSection.appendChild(notificationBtn);
    rightSection.appendChild(profileMenu);
    return;
  }

  // If already showing auth buttons, don't recreate them
  if (document.querySelector(".topbar .register") && document.querySelector(".topbar .login")) {
    return;
  }

  rightSection.innerHTML = "";

  const registerButton = document.createElement("button");
  registerButton.className = "register";
  registerButton.textContent = "ลงทะเบียน";
  registerButton.type = "button";
  registerButton.addEventListener("click", () => openAuthModal("register"));

  const loginButton = document.createElement("button");
  loginButton.className = "login";
  loginButton.textContent = "เข้าสู่ระบบ";
  loginButton.type = "button";
  loginButton.addEventListener("click", () => openAuthModal("login"));

  rightSection.appendChild(registerButton);
  rightSection.appendChild(loginButton);
}

function createAuthModal() {
  if (document.getElementById("auth-modal")) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "auth-modal";
  overlay.className = "auth-overlay hidden";
  overlay.innerHTML = `
    <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <button type="button" class="auth-close" aria-label="ปิด">✕</button>

      <!-- Brand / Logo -->
      <div class="auth-brand">
        <div class="auth-avatar-ring">
          <img src="/Images/LOGO.png" alt="RUKTHAI">
        </div>
        <span class="auth-brand-title">Rukthai</span>
      </div>

      <!-- Tab Switcher -->
      <div class="auth-header">
        <button type="button" class="auth-tab auth-tab--login active">เข้าสู่ระบบ</button>
        <button type="button" class="auth-tab auth-tab--register">ลงทะเบียน</button>
      </div>

      <!-- Panels -->
      <div class="auth-body">

        <!-- LOGIN -->
        <div class="auth-tab-panel auth-tab-panel--login active">
          <p class="auth-panel-heading" id="auth-modal-title">ยินดีต้อนรับกลับ</p>
          <form class="auth-form" id="login-form">
            <label>อีเมล<input type="email" name="email" class="auth-input" placeholder="your@Email.com" required></label>
            <label>รหัสผ่าน<input type="password" name="password" class="auth-input" placeholder="••••••••" required></label>
            <button type="submit" class="auth-button">เข้าสู่ระบบ</button>
          </form>
          <div class="auth-divider">หรือ</div>
          <div class="google-login-area">
            <div id="google-signin-button"></div>
          </div>
        </div>

        <!-- REGISTER -->
        <div class="auth-tab-panel auth-tab-panel--register">
          <p class="auth-panel-heading">สร้างบัญชีใหม่</p>
          <form class="auth-form" id="register-form">
            <label>ชื่อผู้ใช้<input type="text" name="name" class="auth-input" placeholder="Username" required></label>
            <label>อีเมล<input type="email" name="email" class="auth-input" placeholder="your@Email.com" required></label>
            <label>รหัสผ่าน<input type="password" name="password" class="auth-input" placeholder="อย่างน้อย 6 ตัวอักษร" required></label>
            <button type="submit" class="auth-button">สร้างบัญชี</button>
          </form>
          <div class="auth-divider">หรือ</div>
          <div class="google-login-area">
            <div id="google-signin-button-register"></div>
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".auth-close").addEventListener("click", closeAuthModal);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeAuthModal();
    }
  });

  overlay.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchAuthTab(tab.classList.contains("auth-tab--register") ? "register" : "login"));
  });

  const loginForm = overlay.querySelector("#login-form");
  const registerForm = overlay.querySelector("#register-form");

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleLogin(loginForm);
  });

  registerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleRegister(registerForm);
  });

  overlay.querySelectorAll(".auth-google-button").forEach((button) => {
    button.addEventListener("click", handleGoogleButtonClick);
  });
}

function openAuthModal(type = "login") {
  createAuthModal();
  const overlay = document.getElementById("auth-modal");
  if (!overlay) return;
  overlay.classList.remove("hidden");
  switchAuthTab(type);
  document.body.style.overflow = "hidden";
}

function closeAuthModal() {
  const overlay = document.getElementById("auth-modal");
  if (!overlay) return;
  overlay.classList.add("hidden");
  document.body.style.overflow = "";
}

function switchAuthTab(type) {
  const overlay = document.getElementById("auth-modal");
  if (!overlay) return;

  overlay.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.classList.contains(`auth-tab--${type}`));
  });

  overlay.querySelectorAll(".auth-tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.classList.contains(`auth-tab-panel--${type}`));
  });
}

function handleRegister(form) {
  const name = form.elements.name.value.trim();
  const email = form.elements.email.value.trim().toLowerCase();
  const password = form.elements.password.value.trim();

  if (!name || !email || !password) {
    ALERT: "กรุณากรอกข้อมูลทุกช่อง"
    console.log("[Register] Fill all fields required");
    return;
  }

  if (password.length < 6) {
    ALERT: "รหัสผ่านควรมีอย่างน้อย 6 ตัวอักษร"
    console.log("[Register] Password must be at least 6 characters");
    return;
  }

  if (authState.users.some((user) => user.email === email)) {
    ALERT: "อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้บัญชีอื่น"
    console.log("[Register] Email already in use");
    return;
  }

  // โค้ดที่แก้ใหม่
  const userId = "user_" + Date.now().toString(); // สร้าง ID แบบไม่มีจุด
  const newUser = { id: userId, name, email, password };
  
  authState.users.push(newUser);
  saveUsers(authState.users);
  saveCurrentUser(newUser);
  
  // 📌 ส่งข้อมูลขึ้น Firebase
  syncUserToFirebase(newUser);
  // 📌 แจกรหัสผู้เล่น 8 หลัก
  ensureMyPlayerId(newUser);

  updateAuthUI();
  closeAuthModal();
  ALERT: "สมัครสมาชิกสำเร็จแล้ว ยินดีต้อนรับ!"
  console.log("[Register] Registration successful - Welcome!");
}

function handleLogin(form) {
  const email = form.elements.email.value.trim().toLowerCase();
  const password = form.elements.password.value.trim();

  const user = authState.users.find((item) => item.email === email && item.password === password);
  if (!user) {
    ALERT: "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง"
    console.log("[Login] Invalid email or password");
    return;
  }

  saveCurrentUser(user);
  syncUserToFirebase(user);
  ensureMyPlayerId(user);
  updateAuthUI();
  closeAuthModal();
  ALERT: `ยินดีต้อนรับกลับ, ${user.name}`
  console.log(`[Login] Welcome back, ${user.name}`);
}

function handleDocumentClick(event) {
  // Close all dropdowns if clicking outside any profile-menu
  if (!event.target.closest(".profile-menu")) {
    document.querySelectorAll(".profile-dropdown").forEach((dropdown) => {
      dropdown.classList.add("hidden");
      dropdown.style.display = "";
    });
    document.querySelectorAll(".topbar-icon-btn").forEach((btn) => {
      btn.setAttribute("aria-expanded", "false");
    });
  }
}

function logout() {
  saveCurrentUser(null);
  updateAuthUI();
  if (isProfilePage()) {
    redirectToLoginPage();
  }
}

function handleProfileForm({ name, avatar }) {
  if (!name) {
    ALERT: "กรุณากรอกชื่อผู้ใช้"
    console.log("[Profile] Please enter username");
    return;
  }

  const currentUser = authState.currentUser;
  currentUser.name = name;
  currentUser.avatar = avatar;

  const userIndex = authState.users.findIndex((item) => item.email === currentUser.email);
  if (userIndex !== -1) {
    authState.users[userIndex] = currentUser;
    saveUsers(authState.users);
  }

  saveCurrentUser(currentUser);
  syncUserToFirebase(currentUser);
  updateAuthUI();
  closeProfileModal();
  // REMOVED ALERT: "บันทึกโปรไฟล์เรียบร้อยแล้ว"
  console.log("[Profile] Profile saved successfully");
}

function handleGoogleButtonClick() {
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes("YOUR_GOOGLE_CLIENT_ID")) {
    ALERT: "กรุณาตั้งค่า Google Client ID ใน auth.js เพื่อใช้งานเข้าสู่ระบบด้วย Google"
    console.log("[Google] Please configure Google Client ID in auth.js");
    return;
  }

  if (window.google && window.google.accounts && window.google.accounts.id) {
    window.google.accounts.id.prompt();
  } else {
    ALERT: "กำลังเตรียมการเข้าสู่ระบบด้วย Google โปรดลองใหม่อีกครั้ง"
    console.log("[Google] Google is preparing, please try again");
  }
}

function loadGoogleScript() {
  if (document.getElementById("google-client-script")) {
    return;
  }

  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;
  script.onload = initializeGoogleIdentity;
  script.id = "google-client-script";
  document.head.appendChild(script);
}

function initializeGoogleIdentity() {
  if (googleIdentityInitialized || !window.google || !window.google.accounts || !window.google.accounts.id) {
    return;
  }

  googleIdentityInitialized = true;

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredentialResponse,
    auto_select: false,
  });

  const buttonOptions = { theme: "outline", size: "large" };
  const loginButtonContainer = document.getElementById("google-signin-button");
  const registerButtonContainer = document.getElementById("google-signin-button-register");

  if (loginButtonContainer) {
    window.google.accounts.id.renderButton(loginButtonContainer, buttonOptions);
  }

  if (registerButtonContainer) {
    window.google.accounts.id.renderButton(registerButtonContainer, buttonOptions);
  }
}

async function handleGoogleCredentialResponse(response) {
  if (!response.credential) {
    // REMOVED ALERT: "ไม่สามารถเข้าสู่ระบบด้วย Google ได้ในขณะนี้"
    console.log("[Google] Cannot login with Google at this moment");
    return;
  }

  const userData = parseJwt(response.credential);
  const email = userData.email;
  if (!email) {
    console.log("[Google] Google account did not return an email");
    return;
  }
  const name = userData.name || userData.email.split("@")[0];
  const picture = userData.picture || "";

  let user = authState.users.find((item) => item.email === email);

  // 📌 ดึง "โปรไฟล์เดิมทั้งหมด" จาก Firebase ก่อน (ชื่อ + รูป)
  // เพื่อให้ชื่อ/รูปที่ผู้ใช้ตั้งเองเป็นค่าหลักเสมอ ไม่ถูกชื่อ/รูปจาก Gmail ทับ
  let existingProfile = {};
  try {
    const safeId = (user?.id || email).replace(/[.#$\[\]]/g, '_');
    const snap = await get(ref(db, `users/${safeId}`));
    if (snap.exists()) existingProfile = snap.val() || {};
  } catch (e) {
    console.warn("[Google] ไม่สามารถอ่านโปรไฟล์เดิมได้:", e);
  }

  // ชื่อที่บันทึกไว้ใน Firebase ถือเป็นชื่อหลักเสมอ (ถ้ามี) มิฉะนั้นค่อยใช้ชื่อ Gmail
  const finalName = (existingProfile.name && existingProfile.name.trim())
    ? existingProfile.name
    : name;

  // รูปที่ตั้งเอง (ไม่ใช่รูป Google) ถือเป็นรูปหลักเสมอ
  const existingAvatar = existingProfile.avatar || "";
  const customAvatar = (existingAvatar && !isGoogleAvatar(existingAvatar)) ? existingAvatar : "";

  if (!user) {
    // ผู้ใช้ใหม่: ใช้ชื่อ/รูปที่ตั้งเอง (ถ้ามีใน Firebase) ไม่งั้นใช้ของ Gmail
    user = {
      id: email,
      name: finalName,
      email,
      password: "",
      avatar: customAvatar || picture
    };
    authState.users.push(user);
    saveUsers(authState.users);
  } else {
    if (!user.id) {
      user.id = email;
    }
    // ชื่อ: ใช้ชื่อที่ตั้งเองจาก Firebase เสมอ
    user.name = finalName;
    // รูป: เก็บรูปที่ตั้งเองไว้ก่อน ถ้ายังไม่เคยตั้งเลยค่อยใช้รูป Gmail
    if (customAvatar) {
      user.avatar = customAvatar;
    } else if (!user.avatar && picture) {
      user.avatar = picture;
    }
    saveUsers(authState.users);
  }

  // เก็บข้อมูลจาก Gmail แยกไว้เป็นข้อมูลสำรอง (ไม่นำมาแสดงทับของที่ตั้งเอง)
  if (picture) user.googleAvatar = picture;
  user.googleName = name;

  saveCurrentUser(user);
  syncUserToFirebase(user);
  ensureMyPlayerId(user);
  updateAuthUI();
  closeAuthModal();
  // REMOVED ALERT: `เข้าสู่ระบบด้วย Google สำเร็จ: ${name}`
  console.log(`[Google] Google login successful: ${name}`);
}

function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return {};
  }
}

window.addEventListener("DOMContentLoaded", initAuth);