const STORAGE_SETTINGS_KEY = "rukthai_settings";
let settingsModal = null;

const DEFAULT_SETTINGS = {
  backgroundMode: "dark",
  emailNotifications: true,
  soundNotifications: true,
  boardBackground: "Board9.png",
};

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_SETTINGS_KEY)) || DEFAULT_SETTINGS;
  } catch (error) {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
}

function applyThemeAndBackground() {
  const settings = loadSettings();
  const html = document.documentElement;
  
  // Apply background mode
  html.setAttribute("data-background-mode", settings.backgroundMode);
}

function populateSettingsForm() {
  if (!settingsModal) return;
  const settings = loadSettings();
  const form = settingsModal.querySelector("#settings-form");
  form.elements.backgroundMode.value = settings.backgroundMode;
  form.elements.emailNotifications.checked = settings.emailNotifications;
  form.elements.soundNotifications.checked = settings.soundNotifications;
  if (form.elements.boardBackground) {
    form.elements.boardBackground.value = settings.boardBackground;
  }
}

function showSettingsMessage(message) {
  if (!settingsModal) return;
  const messageElement = settingsModal.querySelector(".settings-message");
  messageElement.textContent = message;
  messageElement.style.opacity = "1";
  clearTimeout(messageElement.hideTimeout);
  messageElement.hideTimeout = setTimeout(() => {
    messageElement.style.opacity = "0";
  }, 3200);
}

function handleSettingsSubmit(event) {
  event.preventDefault();
  if (!settingsModal) return;

  const form = event.target;
  const settings = {
    backgroundMode: form.elements.backgroundMode.value,
    emailNotifications: form.elements.emailNotifications.checked,
    soundNotifications: form.elements.soundNotifications.checked,
    boardBackground: form.elements.boardBackground?.value || "Board9.png",
  };

  saveSettings(settings);
  applyThemeAndBackground();
  showSettingsMessage("บันทึกการตั้งค่าเรียบร้อยแล้ว");
}

export function handleSettingsClick() {
  openSettingsModal();
}

export function createSettingsModal() {
  if (settingsModal) {
    return;
  }

  settingsModal = document.createElement("div");
  settingsModal.id = "settings-modal";
  settingsModal.className = "auth-overlay hidden";
  settingsModal.innerHTML = `
    <div class="auth-modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
      <button type="button" class="auth-close" aria-label="ปิด">×</button>
      <h2 id="settings-modal-title">ตั้งค่า</h2>
      <form id="settings-form" class="auth-form">

        <!-- ── Appearance ── -->
        <div class="settings-section">
          <div class="settings-section-title">รูปแบบการแสดงผล</div>
          <div class="settings-row">
            <span class="settings-row-label">พื้นหลัง</span>
            <select name="backgroundMode" class="auth-input">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>

        <!-- ── Notifications ── -->
        <div class="settings-section">
          <div class="settings-section-title">การแจ้งเตือน</div>
          <label class="settings-toggle">
            <span>รับการแจ้งเตือนทางอีเมล</span>
            <input type="checkbox" name="emailNotifications">
          </label>
          <label class="settings-toggle">
            <span>เสียงแจ้งเตือน</span>
            <input type="checkbox" name="soundNotifications">
          </label>
        </div>

        <!-- ── Board picker ── -->
        <div class="settings-section">
          <div class="settings-section-title">เลือกกระดาน</div>
          <div class="settings-board-grid">
            <label class="board-choice">
              <input type="radio" name="boardBackground" value="Board6.png">
              <img src="/Boards/Board6.png" alt="กระดาน 6">
              <span>กระดาน 6</span>
            </label>
            <label class="board-choice">
              <input type="radio" name="boardBackground" value="Board7.png">
              <img src="/Boards/Board7.png" alt="กระดาน 7">
              <span>กระดาน 7</span>
            </label>
            <label class="board-choice">
              <input type="radio" name="boardBackground" value="Board8.png">
              <img src="/Boards/Board8.png" alt="กระดาน 8">
              <span>กระดาน 8</span>
            </label>
            <label class="board-choice">
              <input type="radio" name="boardBackground" value="Board9.png">
              <img src="/Boards/Board9.png" alt="กระดาน 9">
              <span>กระดาน 9</span>
            </label>
            <label class="board-choice">
              <input type="radio" name="boardBackground" value="Board1.png">
              <img src="/Boards/Board1.png" alt="กระดาน 1">
              <span>กระดาน 1</span>
            </label>
            <label class="board-choice">
              <input type="radio" name="boardBackground" value="Board2.png">
              <img src="/Boards/Board2.png" alt="กระดาน 2">
              <span>กระดาน 2</span>
            </label>
          </div>
        </div>

        <button type="submit" class="auth-button">บันทึกการตั้งค่า</button>
      </form>
      <div class="settings-message" aria-live="polite"></div>
    </div>
  `;

  document.body.appendChild(settingsModal);

  settingsModal.addEventListener("click", (event) => {
    if (event.target === settingsModal) {
      closeSettingsModal();
    }
  });

  settingsModal.querySelector(".auth-close").addEventListener("click", closeSettingsModal);
  settingsModal.querySelector("#settings-form").addEventListener("submit", handleSettingsSubmit);
}

export function openSettingsModal() {
  if (!settingsModal) {
    createSettingsModal();
  }
  populateSettingsForm();
  settingsModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

export function closeSettingsModal() {
  if (!settingsModal) return;
  settingsModal.classList.add("hidden");
  document.body.style.overflow = "";
}

export function initializeTheme() {
  applyThemeAndBackground();
}