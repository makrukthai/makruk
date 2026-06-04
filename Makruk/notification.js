const STORAGE_NOTIFICATIONS_KEY = "rukthai_notifications";
let notificationWrapper = null;

const DEFAULT_NOTIFICATIONS = [
  { id: "1", title: "คำเชิญใหม่", message: "คุณได้รับคำขอเป็นเพื่อนใหม่", read: false, time: "2 นาทีที่แล้ว" },
  { id: "2", title: "ข่าวสาร", message: "มีบทความใหม่ในชุมชนของคุณ", read: false, time: "1 ชั่วโมงที่แล้ว" },
];

function loadNotifications() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_NOTIFICATIONS_KEY));
    return Array.isArray(stored) ? stored : DEFAULT_NOTIFICATIONS.slice();
  } catch (error) {
    return DEFAULT_NOTIFICATIONS.slice();
  }
}

function saveNotifications(notifications) {
  localStorage.setItem(STORAGE_NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

function getUnreadCount() {
  return loadNotifications().filter((notification) => !notification.read).length;
}

function refreshNotificationDot() {
  if (!notificationWrapper) return;
  const dot = notificationWrapper.querySelector(".notif-dot");
  if (!dot) return;
  dot.style.display = getUnreadCount() > 0 ? "block" : "none";
}

function renderNotificationList() {
  if (!notificationWrapper) return;
  const listContainer = notificationWrapper.querySelector(".notification-list");
  const notifications = loadNotifications();
  listContainer.innerHTML = "";

  if (!notifications.length) {
    listContainer.innerHTML = `<div class="notification-empty">ยังไม่มีการแจ้งเตือน</div>`;
    return;
  }

  notifications.forEach((notification) => {
    const item = document.createElement("div");
    item.className = `notification-item ${notification.read ? "read" : "unread"}`;
    item.innerHTML = `
      <div class="notification-header">
        <div>
          <div class="notification-title">${notification.title}</div>
          <div class="notification-time">${notification.time}</div>
        </div>
        <button type="button" class="notification-mark" data-action="toggle-read" data-id="${notification.id}">${notification.read ? "อ่านแล้ว" : "ทำเครื่องหมายว่าอ่านแล้ว"}</button>
      </div>
      <p class="notification-message">${notification.message}</p>
    `;
    listContainer.appendChild(item);
  });
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

  document.querySelectorAll(".profile-dropdown").forEach((menu) => {
    menu.classList.add("hidden");
    menu.style.display = "";
  });

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

function handleNotificationActionClick(event) {
  event.stopPropagation();
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;

  if (action === "mark-all") {
    const notifications = loadNotifications().map((notification) => ({ ...notification, read: true }));
    saveNotifications(notifications);
    renderNotificationList();
    refreshNotificationDot();
  }

  if (action === "clear-all") {
    saveNotifications([]);
    renderNotificationList();
    refreshNotificationDot();
  }
}

function handleNotificationListClick(event) {
  event.stopPropagation();
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action !== "toggle-read" || !id) return;

  const notifications = loadNotifications().map((notification) => {
    if (notification.id === id) {
      return { ...notification, read: true };
    }
    return notification;
  });

  saveNotifications(notifications);
  renderNotificationList();
  refreshNotificationDot();
}

export function createNotificationButton() {
  if (notificationWrapper) {
    return notificationWrapper;
  }

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
          <button type="button" class="notification-action-btn" data-action="mark-all">ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว</button>
          <button type="button" class="notification-action-btn" data-action="clear-all">ล้างการแจ้งเตือน</button>
        </div>
        <div class="notification-list"></div>
      </div>
    </div>
  `;

  const button = notificationWrapper.querySelector(".topbar-icon-btn");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleNotificationDropdown();
  });

  notificationWrapper.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  // Close all dropdowns when clicking outside
  document.addEventListener("click", (event) => {
    // Only close if we're not clicking inside any profile-menu
    if (!event.target.closest(".profile-menu")) {
      closeNotificationDropdown();
    }
  });

  notificationWrapper.querySelector(".notification-actions").addEventListener("click", handleNotificationActionClick);
  notificationWrapper.querySelector(".notification-list").addEventListener("click", handleNotificationListClick);

  refreshNotificationDot();
  return notificationWrapper;
}
