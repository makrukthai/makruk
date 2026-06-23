// ═══════════════════════════════════════════════════════════
//   RUKTHAI — ระบบเสียง (เดินหมาก/กิน/รุก/เริ่ม-จบเกม ฯลฯ)
//   ใช้ร่วมทุกหน้า: window.Sound.play('move'), window.Sound.toggle()
// ═══════════════════════════════════════════════════════════
(function () {
  const FILES = {
    move: 'move', capture: 'capture', check: 'check',
    start: 'start', end: 'end', promote: 'promote',
    premove: 'premove', illegal: 'illegal'
  };
  // หาที่อยู่โฟลเดอร์ Sounds ให้ถูกไม่ว่าจะอยู่หน้า /pages/ หรือราก
  const base = location.pathname.includes('/pages/') ? '../Sounds/' : 'Sounds/';
  const SETTINGS_KEY = 'rukthai_settings';

  const buffers = {};   // ชื่อ -> AudioBuffer
  let ctx = null, ready = false, loading = false;

  function readSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; }
  }
  function isEnabled() {
    const s = readSettings();
    return s.soundEnabled !== false;   // ค่าเริ่มต้น = เปิด
  }
  function setEnabled(on) {
    const s = readSettings();
    s.soundEnabled = !!on;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
    if (on) ensureLoaded();
    window.dispatchEvent(new CustomEvent('rukthai-sound-changed', { detail: { enabled: !!on } }));
  }

  function getCtx() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    return ctx;
  }

  async function ensureLoaded() {
    if (ready || loading) return;
    const c = getCtx(); if (!c) return;
    loading = true;
    await Promise.all(Object.entries(FILES).map(async ([name, file]) => {
      try {
        const res = await fetch(`${base}${file}.wav`);
        const arr = await res.arrayBuffer();
        buffers[name] = await c.decodeAudioData(arr);
      } catch (e) { /* ไฟล์เสียงหาย — ข้ามเงียบ ๆ */ }
    }));
    ready = true; loading = false;
  }

  // ปลดล็อก AudioContext หลัง interaction แรก (นโยบายเบราว์เซอร์)
  function unlock() {
    const c = getCtx();
    if (c && c.state === 'suspended') c.resume();
    if (isEnabled()) ensureLoaded();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, unlock, { once: false, passive: true }));

  let last = 0;
  function play(name) {
    if (!isEnabled()) return;
    const c = getCtx(); if (!c) return;
    if (c.state === 'suspended') c.resume();
    if (!ready) { ensureLoaded(); return; }   // โหลดไม่ทันตาแรกก็ข้าม
    const buf = buffers[name]; if (!buf) return;
    // กันเสียงซ้อนถี่เกินไป
    const now = performance.now();
    if (name === 'move' && now - last < 40) return;
    last = now;
    try {
      const src = c.createBufferSource(); src.buffer = buf;
      const g = c.createGain(); g.gain.value = 1;
      src.connect(g).connect(c.destination); src.start(0);
    } catch (e) {}
  }

  window.Sound = {
    play, isEnabled, setEnabled,
    toggle() { const v = !isEnabled(); setEnabled(v); return v; },
    // เลือกเสียงให้เหมาะกับตาเดิน: รุก > โปรโมท > กิน > เดิน
    move({ captured, promoted, check, from, to } = {}) {
      if (check) { play('check'); return; }
      if (promoted) { play('promote'); return; }
      if (captured) { play('capture'); return; }
      play('move');
    }
  };

  if (isEnabled()) ensureLoaded();
})();
