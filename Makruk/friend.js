const STORAGE_FRIENDS_KEY = "rukthai_friends";
const STORAGE_FRIEND_REQUESTS_KEY = "rukthai_friend_requests";
const STORAGE_FRIEND_STATUS_KEY = "rukthai_friend_status";

let friendWrapper = null;
let friendModal = null;
let friendWrapperUserId = null;

// ─── Friend Status Management ───
function getFriendStatus(friendId) {
  try {
    const statuses = JSON.parse(localStorage.getItem(STORAGE_FRIEND_STATUS_KEY)) || {};
    return statuses[friendId] || "offline";
  } catch (error) {
    return "offline";
  }
}

function setFriendStatus(friendId, status) {
  try {
    const statuses = JSON.parse(localStorage.getItem(STORAGE_FRIEND_STATUS_KEY)) || {};
    statuses[friendId] = status;
    localStorage.setItem(STORAGE_FRIEND_STATUS_KEY, JSON.stringify(statuses));
  } catch (error) {
    console.error("Error setting friend status:", error);
  }
}

// ─── Friends List Management ───
function loadFriends() {
  const currentUser = loadCurrentUser();
  if (!currentUser) return [];
  return getFriendsForUser(currentUser.id);
}

function saveFriends(friends) {
  const currentUser = loadCurrentUser();
  if (!currentUser) return;
  saveFriendsForUser(currentUser.id, friends);
}

function addFriend(friend, ownerId = loadCurrentUser()?.id) {
  if (!ownerId || !friend?.id || ownerId === friend.id) return;
  const friends = getFriendsForUser(ownerId);
  if (!friends.find(f => f.id === friend.id)) {
    friends.push(friend);
    saveFriendsForUser(ownerId, friends);
  }
}

function removeFriend(friendId, ownerId = loadCurrentUser()?.id) {
  if (!ownerId || !friendId) return;
  const friends = getFriendsForUser(ownerId).filter(f => f.id !== friendId);
  saveFriendsForUser(ownerId, friends);
  const peerFriends = getFriendsForUser(friendId).filter(f => f.id !== ownerId);
  saveFriendsForUser(friendId, peerFriends);
}

function isFriendWithUser(userId) {
  const currentUser = loadCurrentUser();
  if (!currentUser) return false;
  return areUsersFriends(currentUser.id, userId);
}

// ─── Friend Requests Management ───
function loadFriendRequests() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_FRIEND_REQUESTS_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function saveFriendRequests(requests) {
  localStorage.setItem(STORAGE_FRIEND_REQUESTS_KEY, JSON.stringify(requests));
}

function getPendingRequestBetween(fromUserId, toUserId) {
  return loadFriendRequests().find(request =>
    request.from === fromUserId &&
    request.to === toUserId &&
    request.status === "pending"
  );
}

function refreshFriendBadge() {
  if (!friendWrapper) return;
  const button = friendWrapper.querySelector(".friend-button");
  if (!button) return;

  const pendingCount = getPendingRequestsForMe().length;
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

function sendFriendRequest(toUserId, toUserData) {
  const requests = loadFriendRequests();
  const currentUser = loadCurrentUser();
  
  if (!currentUser) {
    showFriendAlert("กรุณาเข้าสู่ระบบก่อน", true);
    return false;
  }

  if (currentUser.id === toUserId) {
    showFriendAlert("ไม่สามารถเพิ่มตัวเองเป็นเพื่อนได้", true);
    return false;
  }

  // Check if already friends
  if (isFriendWithUser(toUserId)) {
    showFriendAlert("คุณเป็นเพื่อนกับผู้เล่นนี้แล้ว", true);
    return false;
  }

  // Check if request already sent
  if (requests.some(r => r.from === currentUser.id && r.to === toUserId && r.status === "pending")) {
    showFriendAlert("ส่งขอเพิ่มเพื่อนไปแล้ว", true);
    return false;
  }

  if (requests.some(r => r.from === toUserId && r.to === currentUser.id && r.status === "pending")) {
    showFriendAlert("ผู้เล่นนี้ส่งคำขอถึงคุณแล้ว กรุณากดยอมรับในรายการคำขอ", true);
    return false;
  }

  requests.push({
    id: Date.now().toString(),
    from: currentUser.id,
    fromName: currentUser.name || currentUser.email,
    to: toUserId,
    toName: toUserData.name || toUserData.email,
    status: "pending",
    timestamp: Date.now()
  });

  saveFriendRequests(requests);
  showFriendAlert("ส่งขอเพิ่มเพื่อนเรียบร้อยแล้ว");
  return true;
}

function acceptFriendRequest(requestId) {
  const requests = loadFriendRequests();
  const request = requests.find(r => r.id === requestId);
  const currentUser = loadCurrentUser();
  
  if (!request || !currentUser || request.to !== currentUser.id) return false;

  // Load user data
  const users = loadUsers();
  const fromUser = users.find(u => u.id === request.from);
  const toUser = users.find(u => u.id === request.to);

  if (!fromUser || !toUser) return false;

  // Add as friends
  addFriend({
    id: fromUser.id,
    name: fromUser.name || fromUser.email,
    email: fromUser.email,
    avatar: fromUser.avatar || ""
  }, toUser.id);

  addFriend({
    id: toUser.id,
    name: toUser.name || toUser.email,
    email: toUser.email,
    avatar: toUser.avatar || ""
  }, fromUser.id);

  // Update request status
  saveFriendRequests(requests.filter(item => item.id !== requestId));

  showFriendAlert("ยอมรับคำขอเพิ่มเพื่อนเรียบร้อยแล้ว");
  return true;
}

function rejectFriendRequest(requestId) {
  const requests = loadFriendRequests();
  const request = requests.find(r => r.id === requestId);
  const currentUser = loadCurrentUser();
  
  if (!request || !currentUser || request.to !== currentUser.id) return false;

  saveFriendRequests(requests.filter(item => item.id !== requestId));
  showFriendAlert("ปฏิเสธคำขอเพิ่มเพื่อนแล้ว");
  return true;
}

function getPendingRequestsForMe() {
  const currentUser = loadCurrentUser();
  if (!currentUser) return [];
  return loadFriendRequests().filter(r => r.to === currentUser.id && r.status === "pending");
}

// ─── UI Functions ───
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

function getUserById(userId) {
  return loadUsers().find(user => user.id === userId) || null;
}

function getDisplayUser(user) {
  const fullUser = user?.id ? getUserById(user.id) : null;
  return fullUser || user;
}

function getAvatarHtml(user, className) {
  const name = user?.name || user?.email || "U";
  if (user?.avatar) {
    return `<img class="${className}" src="${user.avatar}" alt="${name}">`;
  }
  return `<div class="${className}">${name.charAt(0).toUpperCase()}</div>`;
}

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

function renderFriendList() {
  if (!friendWrapper) return;
  const listContainer = friendWrapper.querySelector(".friend-list");
  const friends = loadFriends();

  listContainer.innerHTML = "";

  if (!friends.length) {
    listContainer.innerHTML = `<div class="friend-empty">คุณยังไม่มีเพื่อนในตอนนี้</div>`;
    return;
  }

  friends.forEach((friend) => {
    const displayFriend = getDisplayUser(friend);
    const stats = getProfileStats(displayFriend);
    const status = getFriendStatus(friend.id);
    const statusClass = status === "online" ? "status-online" : status === "playing" ? "status-playing" : "status-offline";
    const statusText = status === "online" ? "ออนไลน์" : status === "playing" ? "กำลังเล่น" : "ออฟไลน์";
    
    const item = document.createElement("div");
    item.className = "friend-item";
    item.innerHTML = `
      <div class="friend-item-header">
        <div class="friend-item-left">
          <div class="friend-item-avatar" style="background: linear-gradient(135deg, #d6b16b, #f0d8a1); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #1a1a1a;">${friend.name.charAt(0).toUpperCase()}</div>
          <div>
            <div class="friend-item-name">${friend.name}</div>
            <div class="friend-item-status ${statusClass}">${statusText}</div>
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

  const requests = getPendingRequestsForMe();
  requestContainer.innerHTML = "";

  if (!requests.length) {
    requestContainer.innerHTML = `<div class="friend-request-empty">ไม่มีคำขอเพิ่มเพื่อนใหม่</div>`;
    return;
  }

  requests.forEach((request) => {
    const item = document.createElement("div");
    item.className = "friend-request-item";
    item.innerHTML = `
      <div class="friend-request-header">
        <div class="friend-request-avatar" style="background: linear-gradient(135deg, #d6b16b, #f0d8a1); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #1a1a1a;">${request.fromName.charAt(0).toUpperCase()}</div>
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

function clearFriendSearchResult() {
  const resultContainer = friendWrapper?.querySelector(".friend-search-result");
  if (resultContainer) {
    resultContainer.innerHTML = "";
  }
}

function renderFriendSearchResult(user) {
  const resultContainer = friendWrapper?.querySelector(".friend-search-result");
  const currentUser = loadCurrentUser();
  if (!resultContainer || !currentUser || !user) return;

  const alreadyFriend = areUsersFriends(currentUser.id, user.id);
  const outgoingRequest = getPendingRequestBetween(currentUser.id, user.id);
  const incomingRequest = getPendingRequestBetween(user.id, currentUser.id);
  let actionHTML = `<button type="button" class="friend-result-add" data-id="${user.id}">ADD</button>`;

  if (alreadyFriend) {
    actionHTML = `<button type="button" class="friend-result-add" disabled>เป็นเพื่อนแล้ว</button>`;
  } else if (outgoingRequest) {
    actionHTML = `<button type="button" class="friend-result-add" disabled>ส่งคำขอแล้ว</button>`;
  } else if (incomingRequest) {
    actionHTML = `<button type="button" class="friend-result-add" disabled>รอคุณตอบรับ</button>`;
  }

  resultContainer.innerHTML = `
    <div class="friend-search-card">
      <div class="friend-search-avatar">${(user.name || user.email || "U").charAt(0).toUpperCase()}</div>
      <div class="friend-search-info">
        <div class="friend-search-name">${user.name || user.email}</div>
        <div class="friend-search-email">${user.email || ""}</div>
      </div>
      ${actionHTML}
    </div>
  `;
}

function handleAddFriend(event) {
  event.preventDefault();
  event.stopPropagation();
  if (!friendWrapper) return;

  const form = friendWrapper.querySelector("#friend-add-form");
  if (!form) return;

  const searchInput = form.elements.friendSearch?.value.trim().toLowerCase();

  if (!searchInput) {
    showFriendAlert("กรุณากรอกชื่อหรืออีเมลของเพื่อน", true);
    return;
  }

  const users = loadUsers() || [];
  const currentUser = loadCurrentUser();

  if (!currentUser) {
    showFriendAlert("กรุณาเข้าสู่ระบบก่อน", true);
    return;
  }
  
  const foundUser = users.find(u => 
    u.id !== currentUser.id && (
      u.name?.toLowerCase().includes(searchInput) || 
      u.email?.toLowerCase().includes(searchInput)
    )
  );

  if (!foundUser) {
    showFriendAlert("ไม่พบผู้เล่นที่ตรงกับการค้นหา", true);
    return;
  }

  renderFriendSearchResult(foundUser);
}

function handleFriendSearchResultClick(event) {
  event.stopPropagation();

  const addBtn = event.target.closest("button.friend-result-add");
  if (!addBtn || addBtn.disabled) return;

  const userId = addBtn.dataset.id;
  const foundUser = loadUsers().find(user => user.id === userId);
  if (!foundUser) {
    showFriendAlert("ไม่พบผู้เล่นนี้แล้ว", true);
    clearFriendSearchResult();
    return;
  }

  if (sendFriendRequest(foundUser.id, foundUser)) {
    renderFriendSearchResult(foundUser);
  }
}

function handleFriendListClick(event) {
  event.stopPropagation();
  
  const removeBtn = event.target.closest("button.friend-remove");
  if (removeBtn) {
    const friendId = removeBtn.dataset.id;
    removeFriend(friendId);
    renderFriendList();
    showFriendAlert("ลบเพื่อนเรียบร้อยแล้ว");
    return;
  }

  const playBtn = event.target.closest("button.friend-play");
  if (playBtn) {
    const friendId = playBtn.dataset.id;
    const friend = loadFriends().find(f => f.id === friendId);
    if (friend) {
      showFriendAlert(`เชิญ ${friend.name} เล่นเกมแล้ว!`);
      // TODO: Implement game invitation logic
    }
    return;
  }

  const profileBtn = event.target.closest("button.friend-profile");
  if (profileBtn) {
    const friendId = profileBtn.dataset.id;
    const users = loadUsers();
    const friend = users.find(u => u.id === friendId);
    if (friend) {
      showFriendProfile(friend);
    }
    return;
  }
}

function handleFriendRequestAction(event) {
  event.stopPropagation();
  
  const acceptBtn = event.target.closest("button.friend-request-accept");
  if (acceptBtn) {
    const requestId = acceptBtn.dataset.id;
    if (acceptFriendRequest(requestId)) {
      renderFriendRequests();
      renderFriendList();
      clearFriendSearchResult();
      refreshFriendBadge();
    }
    return;
  }

  const rejectBtn = event.target.closest("button.friend-request-reject");
  if (rejectBtn) {
    const requestId = rejectBtn.dataset.id;
    if (rejectFriendRequest(requestId)) {
      renderFriendRequests();
      refreshFriendBadge();
    }
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
    menu.style.display = "";
  });

  if (isHidden) {
    renderFriendList();
    renderFriendRequests();
    dropdown.classList.remove("hidden");
    const button = friendWrapper.querySelector(".topbar-icon-btn");
    if (button) button.setAttribute("aria-expanded", "true");
  } else {
    closeFriendDropdown();
  }
}

function showFriendProfile(friend) {
  const users = loadUsers();
  const userData = users.find(u => u.id === friend.id);
  if (!userData) return;

  const status = getFriendStatus(friend.id);
  const statusText = status === "online" ? "ออนไลน์" : status === "playing" ? "กำลังเล่น" : "ออฟไลน์";

  const profileHTML = `
    <div class="friend-profile-modal">
      <div class="friend-profile-overlay" id="friend-profile-overlay"></div>
      <div class="friend-profile-content">
        <button type="button" class="friend-profile-close" id="friend-profile-close">✕</button>
        <div class="friend-profile-header">
          <div class="friend-profile-avatar">${userData.name?.charAt(0).toUpperCase() || 'U'}</div>
          <div class="friend-profile-info">
            <div class="friend-profile-name">${userData.name || userData.email}</div>
            <div class="friend-profile-status status-${status}">${statusText}</div>
            <div class="friend-profile-email">${userData.email}</div>
          </div>
        </div>
        
        <div class="friend-profile-stats">
          <div class="stat-item">
            <span class="stat-label">เกมทั้งหมด</span>
            <span class="stat-value">${userData.stats?.total || 0}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">ชนะ</span>
            <span class="stat-value" style="color: #4ade80;">${userData.stats?.wins || 0}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">แพ้</span>
            <span class="stat-value" style="color: #ef4444;">${userData.stats?.losses || 0}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">ELO</span>
            <span class="stat-value">${userData.stats?.elo || 1600}</span>
          </div>
        </div>

        <div class="friend-profile-actions">
          <button type="button" class="btn-invite-game" id="friend-profile-invite">🎮 เชิญเล่นเกม</button>
          <button type="button" class="btn-remove-friend" id="friend-profile-remove">✕ ลบเพื่อน</button>
        </div>
      </div>
    </div>
  `;

  const modal = document.createElement("div");
  modal.innerHTML = profileHTML;
  document.body.appendChild(modal);

  const overlay = document.getElementById("friend-profile-overlay");
  const closeBtn = document.getElementById("friend-profile-close");
  const inviteBtn = document.getElementById("friend-profile-invite");
  const removeBtn = document.getElementById("friend-profile-remove");

  const closeModal = () => {
    modal.remove();
  };

  overlay?.addEventListener("click", closeModal);
  closeBtn?.addEventListener("click", closeModal);

  inviteBtn?.addEventListener("click", () => {
    showFriendAlert(`เชิญ ${userData.name || userData.email} เล่นเกมแล้ว!`);
    closeModal();
  });

  removeBtn?.addEventListener("click", () => {
    removeFriend(friend.id);
    renderFriendList();
    showFriendAlert("ลบเพื่อนเรียบร้อยแล้ว");
    closeModal();
  });
}

export function createFriendButton() {
  const currentUser = loadCurrentUser();
  const currentUserId = currentUser?.id || null;

  if (friendWrapper && friendWrapperUserId !== currentUserId) {
    friendWrapper.remove();
    friendWrapper = null;
  }

  if (friendWrapper) {
    clearFriendSearchResult();
    renderFriendRequests();
    renderFriendList();
    refreshFriendBadge();
    return friendWrapper;
  }

  friendWrapper = document.createElement("div");
  friendWrapperUserId = currentUserId;
  friendWrapper.className = "profile-menu friend-menu";
  friendWrapper.style.position = "relative";
  
  const pendingCount = getPendingRequestsForMe().length;
  const requestBadge = pendingCount > 0 ? `<span class="friend-request-badge">${pendingCount}</span>` : "";

  friendWrapper.innerHTML = `
    <button type="button" class="topbar-icon-btn friend-button" title="เพิ่มเพื่อน" aria-haspopup="true" aria-expanded="false">
      ${requestBadge}
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
        <!-- Friend Requests Section -->
        <div class="friend-requests-section">
          <div class="friend-section-title">คำขอเพิ่มเพื่อน</div>
          <div class="friend-requests"></div>
        </div>

        <!-- Friend Search Section -->
        <form id="friend-add-form" class="friend-search-form">
          <input type="text" name="friendSearch" class="auth-input" placeholder="ค้นหาชื่อหรืออีเมล" required>
          <button type="submit" class="auth-button">ค้นหา</button>
        </form>
        <div class="friend-search-result"></div>
        
        <div class="friend-alert settings-message" aria-live="polite" style="display:none"></div>

        <!-- Friends List Section -->
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

  // Close all dropdowns when clicking outside
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

// Helper functions to load data (same as in auth.js)
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

function loadUsers() {
  try {
    const stored = JSON.parse(localStorage.getItem("rukthai_users")) || [];
    const users = Array.isArray(stored) ? stored.map(normalizeUser) : [];
    if (JSON.stringify(users) !== JSON.stringify(stored)) {
      localStorage.setItem("rukthai_users", JSON.stringify(users));
    }
    return users;
  } catch (error) {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem("rukthai_users", JSON.stringify(users));
}

function toFriendSummary(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name || user.email,
    email: user.email || "",
    avatar: user.avatar || ""
  };
}

function getFriendsForUser(userId) {
  const users = loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user || !Array.isArray(user.friends)) return [];

  return user.friends
    .map(friend => {
      if (typeof friend === "string") {
        return toFriendSummary(users.find(u => u.id === friend));
      }
      return toFriendSummary(friend);
    })
    .filter(friend => friend && friend.id && friend.id !== userId);
}

function saveFriendsForUser(userId, friends) {
  const users = loadUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) return;

  const uniqueFriends = [];
  friends.forEach(friend => {
    const summary = toFriendSummary(friend);
    if (summary && summary.id !== userId && !uniqueFriends.some(item => item.id === summary.id)) {
      uniqueFriends.push(summary);
    }
  });

  users[userIndex] = { ...users[userIndex], friends: uniqueFriends };
  saveUsers(users);

  const currentUser = loadCurrentUser();
  if (currentUser?.id === userId) {
    localStorage.setItem("rukthai_current_user", JSON.stringify({
      ...currentUser,
      friends: uniqueFriends
    }));
  }
}

function areUsersFriends(userId, otherUserId) {
  return getFriendsForUser(userId).some(friend => friend.id === otherUserId);
}

function loadCurrentUser() {
  try {
    const stored = JSON.parse(localStorage.getItem("rukthai_current_user"));
    const user = normalizeUser(stored);
    if (user && (!stored || user.id !== stored.id)) {
      localStorage.setItem("rukthai_current_user", JSON.stringify(user));
    }
    return user;
  } catch (error) {
    return null;
  }
}