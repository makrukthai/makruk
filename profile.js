export function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

let profileOverlay = null;

export function createProfileModal() {
  if (profileOverlay) {
    return;
  }

  profileOverlay = document.createElement("div");
  profileOverlay.id = "profile-modal";
  profileOverlay.className = "auth-overlay hidden";
  profileOverlay.innerHTML = `
    <div class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
      <button type="button" class="auth-close" aria-label="ปิด">×</button>
      <h2 id="profile-modal-title">แก้ไขโปรไฟล์</h2>
      <form class="auth-form" id="profile-form">
        <label>ชื่อผู้ใช้<input type="text" name="profileName" class="auth-input" required></label>
        <label>URL รูปภาพ<input type="url" name="avatarUrl" class="auth-input" placeholder="วางลิงก์รูปภาพที่นี่"></label>
        <label>อัพโหลดรูปภาพ<input type="file" name="avatarFile" accept="image/*" class="auth-input"></label>
        <div class="profile-photo-preview">
          <img id="profile-avatar-preview" alt="รูปโปรไฟล์ตัวอย่าง" />
        </div>
        <button type="submit" class="auth-button">บันทึก</button>
      </form>
    </div>
  `;

  document.body.appendChild(profileOverlay);

  profileOverlay.addEventListener("click", (event) => {
    if (event.target === profileOverlay) {
      closeProfileModal();
    }
  });

  profileOverlay.querySelector(".auth-close").addEventListener("click", closeProfileModal);

  profileOverlay.querySelector("#profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    handleProfileForm(event.target);
  });

  const urlInput = profileOverlay.querySelector("input[name=avatarUrl]");
  const fileInput = profileOverlay.querySelector("input[name=avatarFile]");
  const preview = profileOverlay.querySelector("#profile-avatar-preview");

  urlInput.addEventListener("input", () => {
    if (!fileInput.files.length) {
      preview.src = urlInput.value || "";
    }
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      preview.src = reader.result;
      urlInput.value = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function openProfileModal(currentUser) {
  if (!profileOverlay) return;
  const nameInput = profileOverlay.querySelector("input[name=profileName]");
  const urlInput = profileOverlay.querySelector("input[name=avatarUrl]");
  const preview = profileOverlay.querySelector("#profile-avatar-preview");
  const fileInput = profileOverlay.querySelector("input[name=avatarFile]");

  nameInput.value = currentUser.name || "";
  urlInput.value = currentUser.avatar || "";
  preview.src = currentUser.avatar || "";
  fileInput.value = "";

  profileOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

export function closeProfileModal() {
  if (!profileOverlay) return;
  profileOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}

let profileSubmitHandler = null;

export function setProfileSubmitHandler(handler) {
  profileSubmitHandler = handler;
}

function handleProfileForm(form) {
  const name = form.elements.profileName.value.trim();
  const avatar = form.elements.avatarUrl.value.trim();

  if (!name) {
    alert("กรุณากรอกชื่อผู้ใช้");
    return;
  }

  if (profileSubmitHandler) {
    profileSubmitHandler({ name, avatar });
  }
}

export function renderProfileMenu(currentUser, onEdit, onSettings, onLogout) {
  const profileMenu = document.createElement("div");
  profileMenu.className = "profile-menu";
  profileMenu.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  const profileButton = document.createElement("button");
  profileButton.className = "profile-button";
  profileButton.type = "button";
  profileButton.innerHTML = currentUser.avatar
    ? `<img src="${currentUser.avatar}" alt="${currentUser.name}" />`
    : `<span>${getInitials(currentUser.name)}</span>`;
  profileButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    // Toggle dropdown when clicking avatar
    toggleProfileDropdown(profileMenu);
  });

  profileMenu.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

  const avatarHtml = currentUser.avatar
    ? `<img class="profile-dropdown-avatar" src="${currentUser.avatar}" alt="${currentUser.name}">`
    : `<div class="profile-dropdown-avatar-fallback">${getInitials(currentUser.name)}</div>`;

  const profileDropdown = document.createElement("div");
  profileDropdown.className = "profile-dropdown hidden";
  profileDropdown.innerHTML = `
    <div class="profile-dropdown-info">
      ${avatarHtml}
      <div class="profile-dropdown-text">
        <div class="profile-dropdown-name">${currentUser.name}</div>
      </div>
    </div>
    <div class="profile-dropdown-items">
      <button type="button" class="profile-dropdown-item" data-action="profile">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        โปรไฟล์
      </button>
      <button type="button" class="profile-dropdown-item" data-action="settings">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        ตั้งค่า
      </button>
      <button type="button" class="profile-dropdown-item danger" data-action="logout">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        ออกจากระบบ
      </button>
    </div>
  `;

  profileDropdown.addEventListener("click", (event) => {
    event.stopPropagation();
    const button = event.target.closest("[data-action]");
    if (!button) return;
    
    const action = button.dataset.action;
    
    // Close dropdown first before executing action
    closeProfileDropdown();
    
    if (action === "profile") {
      const inPages = window.location.pathname.includes("/pages/");
      const dest = inPages ? "profile.html" : "pages/profile.html";
      window.location.href = dest;
    } else if (action === "settings") {
      onSettings();
    } else if (action === "logout") {
      onLogout();
    }
  });

  profileMenu.appendChild(profileButton);
  profileMenu.appendChild(profileDropdown);

  return profileMenu;
}

export function toggleProfileDropdown(menu) {
  const dropdown = menu.querySelector(".profile-dropdown");
  if (!dropdown) return;
  const isHidden = dropdown.classList.contains("hidden");
  closeProfileDropdown();
  if (isHidden) {
    dropdown.classList.remove("hidden");
    dropdown.style.display = "block";
  }
}

export function closeProfileDropdown() {
  document.querySelectorAll(".profile-dropdown").forEach((dropdown) => {
    dropdown.classList.add("hidden");
    dropdown.style.display = "";
  });
}