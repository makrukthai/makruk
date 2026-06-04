import { createProfileModal, openProfileModal, renderProfileMenu, setProfileSubmitHandler, closeProfileDropdown, closeProfileModal } from "./profile.js";
import { createNotificationButton } from "./notification.js";
import { createFriendButton } from "./friend.js";
import { handleSettingsClick, initializeTheme } from "./setting.js";

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
  return typeof avatar === "string" && avatar.length <= 2000 ? avatar : "";
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

function initAuth() {
  initializeTheme();
  createAuthModal();
  createProfileModal();
  setProfileSubmitHandler(handleProfileForm);
  updateAuthUI();
  attachTopbarButtons();
  document.addEventListener("click", handleDocumentClick);
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
    window.location.href = "home.html";
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

  const newUser = { id: email, name, email, password };
  authState.users.push(newUser);
  saveUsers(authState.users);
  saveCurrentUser(newUser);
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

function handleGoogleCredentialResponse(response) {
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
  if (!user) {
    user = { id: email, name, email, password: "", avatar: picture };
    authState.users.push(user);
    saveUsers(authState.users);
  } else {
    if (!user.id) {
      user.id = email;
    }
    if (!user.avatar && picture) {
      user.avatar = picture;
    }
    saveUsers(authState.users);
  }

  saveCurrentUser(user);
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