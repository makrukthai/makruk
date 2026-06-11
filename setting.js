const STORAGE_SETTINGS_KEY = "rukthai_settings";
let settingsModal = null;

// 1. รวมค่าเริ่มต้น (Default) ไว้ที่เดียวกัน
const DEFAULT_SETTINGS = {
  backgroundMode: "dark",
  emailNotifications: true,
  soundNotifications: true,
  boardBackground: "Board9.png",
  moveMethod: "both",  // เพิ่มการเดินหมาก
  showMoves: "show"    // เพิ่มการแสดงตาเดิน
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_SETTINGS_KEY));
    // รวมค่าที่เซฟไว้ กับค่าเริ่มต้น เผื่อมีคีย์ใหม่ๆ เพิ่มเข้ามา
    return saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS;
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

  // 2. ดึงค่าการเดินหมากและจุดสีเทามาแสดงให้ตรงตอนเปิดหน้าตั้งค่า
  const moveSelect = form.querySelector("#set-move-method");
  const showSelect = form.querySelector("#set-show-moves");
  if (moveSelect) moveSelect.value = settings.moveMethod;
  if (showSelect) showSelect.value = settings.showMoves;
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
  const moveSelect = form.querySelector("#set-move-method");
  const showSelect = form.querySelector("#set-show-moves");

  // 3. เซฟข้อมูลทั้งหมดพร้อมกันรวดเดียว
  const settings = {
    backgroundMode: form.elements.backgroundMode.value,
    emailNotifications: form.elements.emailNotifications.checked,
    soundNotifications: form.elements.soundNotifications.checked,
    boardBackground: form.elements.boardBackground?.value || "Board9.png",
    moveMethod: moveSelect ? moveSelect.value : "both",
    showMoves: showSelect ? showSelect.value : "show",
  };

  saveSettings(settings);
  applyThemeAndBackground();
  
  // 4. บังคับอัปเดตหน้ากระดานทันทีที่กดบันทึก
  if (typeof window.syncSharedStateAndRender === 'function') {
    window.syncSharedStateAndRender();
  }

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

        <div class="settings-section">
          <div class="settings-section-title">การควบคุมเกม</div>
          
          <div class="settings-row" style="margin-bottom: 12px; display: flex; flex-direction: column; align-items: flex-start; gap: 6px;">
            <span class="settings-row-label" style="font-weight: 600;">การเดินหมาก</span>
            <select id="set-move-method" class="auth-input" style="width: 100%;">
              <option value="both">ลาก + คลิก (มาตรฐาน)</option>
              <option value="drag">ลาก (ไม่สามารถคลิกได้)</option>
              <option value="click">คลิก (ไม่สามารถลากได้)</option>
            </select>
          </div>

          <div class="settings-row" style="display: flex; flex-direction: column; align-items: flex-start; gap: 6px;">
            <span class="settings-row-label" style="font-weight: 600;">แสดงตาเดิน (จุดสีเทา)</span>
            <select id="set-show-moves" class="auth-input" style="width: 100%;">
              <option value="show">แสดงจุดตาเดิน</option>
              <option value="hide">ไม่แสดงตาเดิน</option>
            </select>
          </div>
        </div>

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