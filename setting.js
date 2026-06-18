const STORAGE_SETTINGS_KEY = "rukthai_settings";
let settingsModal = null;

// 1. ปรับค่าเริ่มต้น (Default) โดยตัดส่วนการแจ้งเตือนออก
const DEFAULT_SETTINGS = {
  backgroundMode: "dark",
  boardBackground: "Board9.png",
  customBackground: "",   // URL ภาพพื้นหลังที่ผู้ใช้ตั้งเอง (ว่าง = ไม่ใช้)
  moveMethod: "both",
  showMoves: "show",
  soundEnabled: true,     // เสียงเอฟเฟกต์ (เดินหมาก/กิน/รุก ฯลฯ)
  premoveEnabled: true    // เดินล่วงหน้า (premove)
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_SETTINGS_KEY));
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

  // ภาพพื้นหลังที่ผู้ใช้ตั้งเอง (ใช้ร่วมกับ theme-refresh.css)
  const bg = (settings.customBackground || "").trim();
  if (bg) {
    html.style.setProperty("--user-bg-image", `url("${bg.replace(/"/g, '%22')}")`);
    html.setAttribute("data-user-bg", "on");
  } else {
    html.style.removeProperty("--user-bg-image");
    html.removeAttribute("data-user-bg");
  }
}

function populateSettingsForm() {
  if (!settingsModal) return;
  const settings = loadSettings();
  const form = settingsModal.querySelector("#settings-form");
  
  form.elements.backgroundMode.value = settings.backgroundMode;
  if (form.elements.boardBackground) {
    form.elements.boardBackground.value = settings.boardBackground;
  }
  if (form.elements.customBackground) {
    form.elements.customBackground.value = settings.customBackground || "";
    updateBgPreview(form, settings.customBackground || "");
  }

  // ดึงค่าการเดินหมากและจุดสีเทามาแสดงให้ตรงตอนเปิดหน้าตั้งค่า
  const moveSelect = form.querySelector("#set-move-method");
  const showSelect = form.querySelector("#set-show-moves");
  if (moveSelect) moveSelect.value = settings.moveMethod;
  if (showSelect) showSelect.value = settings.showMoves;
  const soundSelect = form.querySelector("#set-sound");
  const premoveSelect = form.querySelector("#set-premove");
  if (soundSelect) soundSelect.value = settings.soundEnabled === false ? "off" : "on";
  if (premoveSelect) premoveSelect.value = settings.premoveEnabled === false ? "off" : "on";
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

  // บันทึกเฉพาะข้อมูลที่มีอยู่จริง (ตัดตัวแปรกดรับแจ้งเตือนออกแล้ว)
  const soundSelect = form.querySelector("#set-sound");
  const premoveSelect = form.querySelector("#set-premove");
  const settings = {
    backgroundMode: form.elements.backgroundMode.value,
    boardBackground: form.elements.boardBackground?.value || "Board9.png",
    customBackground: (form.elements.customBackground?.value || "").trim(),
    moveMethod: moveSelect ? moveSelect.value : "both",
    showMoves: showSelect ? showSelect.value : "show",
    soundEnabled: soundSelect ? soundSelect.value === "on" : true,
    premoveEnabled: premoveSelect ? premoveSelect.value === "on" : true,
  };

  try {
    saveSettings(settings);
  } catch (e) {
    // มักเกิดเมื่อรูปใหญ่เกินพื้นที่ localStorage
    showSettingsMessage("รูปใหญ่เกินไป บันทึกไม่ได้ ลองใช้รูปขนาดเล็กลง");
    return;
  }
  applyThemeAndBackground();
  // อัปเดตระบบเสียงทันที (ถ้าหน้านี้มี)
  if (window.Sound && typeof window.Sound.setEnabled === 'function') {
    window.Sound.setEnabled(settings.soundEnabled);
  }
  
  // บังคับอัปเดตหน้ากระดานทันทีที่กดบันทึก
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
          <div class="settings-row" style="display:flex; flex-direction:column; align-items:flex-start; gap:8px; margin-top:12px;">
            <span class="settings-row-label" style="font-weight:600;">ภาพพื้นหลัง</span>
            <input type="file" id="set-bg-file" accept="image/*" hidden>
            <input type="hidden" name="customBackground">
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; width:100%;">
              <button type="button" id="set-bg-pick" class="auth-input" style="cursor:pointer; width:auto;">เลือกรูป…</button>
              <button type="button" id="set-bg-clear" class="auth-input" style="cursor:pointer; width:auto;">ลบรูป</button>
              <span id="set-bg-name" style="font-size:12px; color:var(--muted);">ยังไม่ได้เลือก</span>
            </div>
            <div id="set-bg-preview" style="display:none; width:100%; height:84px; border-radius:10px; background-size:cover; background-position:center; border:1px solid var(--border, rgba(128,128,128,0.2));"></div>
            <span style="font-size:12px; color:var(--muted);">ระบบย่อรูปอัตโนมัติและใส่ฉากทับให้อ่านข้อความได้ง่าย</span>
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

          <div class="settings-row" style="display: flex; flex-direction: column; align-items: flex-start; gap: 6px; margin-top: 12px;">
            <span class="settings-row-label" style="font-weight: 600;">เสียงเอฟเฟกต์</span>
            <select id="set-sound" class="auth-input" style="width: 100%;">
              <option value="on">เปิดเสียง</option>
              <option value="off">ปิดเสียง</option>
            </select>
          </div>

          <div class="settings-row" style="display: flex; flex-direction: column; align-items: flex-start; gap: 6px; margin-top: 12px;">
            <span class="settings-row-label" style="font-weight: 600;">เดินล่วงหน้า (Premove)</span>
            <select id="set-premove" class="auth-input" style="width: 100%;">
              <option value="on">เปิด</option>
              <option value="off">ปิด</option>
            </select>
          </div>
        </div>

        <button type="submit" class="auth-button" style="margin-top: 10px;">บันทึกการตั้งค่า</button>
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

  // ── เลือกรูปพื้นหลังจากไฟล์ ──
  const form = settingsModal.querySelector("#settings-form");
  const fileInput = form.querySelector("#set-bg-file");
  form.querySelector("#set-bg-pick").addEventListener("click", () => fileInput.click());
  form.querySelector("#set-bg-clear").addEventListener("click", () => {
    form.elements.customBackground.value = "";
    fileInput.value = "";
    updateBgPreview(form, "");
  });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const dataUrl = await fileToScaledDataURL(file);
      form.elements.customBackground.value = dataUrl;
      updateBgPreview(form, dataUrl);
    } catch (e) {
      showSettingsMessage("อ่านไฟล์รูปไม่สำเร็จ ลองรูปอื่น");
    }
  });
}

// ย่อรูปก่อนเก็บ (กว้างไม่เกิน 1600px, JPEG) — กันไฟล์ใหญ่เกิน localStorage
function fileToScaledDataURL(file, maxW = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function updateBgPreview(form, dataUrl) {
  const prev = form.querySelector("#set-bg-preview");
  const name = form.querySelector("#set-bg-name");
  if (dataUrl) {
    prev.style.display = "block";
    prev.style.backgroundImage = `url("${dataUrl}")`;
    name.textContent = "เลือกรูปแล้ว";
  } else {
    prev.style.display = "none";
    prev.style.backgroundImage = "";
    name.textContent = "ยังไม่ได้เลือก";
  }
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