// ═══════════════════════════════════════════════════════════
//  cropper.js — ตัวครอปรูปปกแบบโต้ตอบ (ลากเลื่อน + ซูม)
//  ใช้: const dataURL = await window.openCoverCropper(file, 1920, 600);
//  คืน dataURL (JPEG) หรือ null ถ้ากดยกเลิก
// ═══════════════════════════════════════════════════════════
(function () {
  let overlay = null;

  function buildUI() {
    if (overlay) return;
    const style = document.createElement('style');
    style.textContent = `
      .cropper-overlay { position: fixed; inset: 0; z-index: 99999; background: rgba(0,0,0,0.72); display: flex; align-items: center; justify-content: center; padding: 18px; }
      .cropper-card { background: var(--bg, #181715); border: 1px solid var(--border, rgba(255,255,255,0.1)); border-radius: 16px; padding: 18px; width: 100%; max-width: 820px; box-shadow: 0 24px 60px rgba(0,0,0,0.5); }
      .cropper-title { font-size: 15px; font-weight: 700; color: var(--text, #ece8e1); margin-bottom: 4px; }
      .cropper-sub { font-size: 12px; color: var(--muted, #9a8f80); margin-bottom: 12px; }
      .cropper-frame { position: relative; width: 100%; aspect-ratio: 1920 / 600; overflow: hidden; border-radius: 10px; background: #000; border: 1px solid var(--border, rgba(255,255,255,0.12)); cursor: grab; touch-action: none; }
      .cropper-frame.dragging { cursor: grabbing; }
      .cropper-frame img { position: absolute; top: 0; left: 0; transform-origin: 0 0; user-select: none; -webkit-user-drag: none; pointer-events: none; max-width: none; }
      .cropper-grid { position: absolute; inset: 0; pointer-events: none; background:
        linear-gradient(to right, transparent calc(33.33% - 0.5px), rgba(255,255,255,0.18) 33.33%, transparent calc(33.33% + 0.5px)),
        linear-gradient(to right, transparent calc(66.66% - 0.5px), rgba(255,255,255,0.18) 66.66%, transparent calc(66.66% + 0.5px)),
        linear-gradient(to bottom, transparent calc(50% - 0.5px), rgba(255,255,255,0.18) 50%, transparent calc(50% + 0.5px)); }
      .cropper-zoom-row { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
      .cropper-zoom-row .cz-ico { color: var(--muted, #9a8f80); font-size: 14px; flex: none; }
      .cropper-zoom { flex: 1; accent-color: var(--gold, #d4af55); }
      .cropper-actions { display: flex; gap: 10px; margin-top: 14px; }
      .cropper-actions button { flex: 1; padding: 12px; border-radius: 11px; font-weight: 700; font-size: 14px; cursor: pointer; font-family: var(--font-ui, 'Noto Sans Thai', sans-serif); transition: all 0.15s; }
      .cropper-cancel { background: var(--btn-secondary, #2a2723); color: var(--btn-secondary-text, #ece8e1); border: 1px solid var(--border, rgba(255,255,255,0.12)); }
      .cropper-cancel:hover { border-color: var(--gold, #d4af55); }
      .cropper-ok { background: var(--btn-primary, #bf6730); color: var(--btn-primary-text, #fff); border: none; box-shadow: inset 0 1px 0 var(--btn-sheen-top, rgba(255,255,255,0.25)); }
      .cropper-ok:hover { background: var(--btn-primary-hover, #d27a3c); }
      @media (max-width: 600px) { .cropper-card { padding: 12px; } }
    `;
    document.head.appendChild(style);

    overlay = document.createElement('div');
    overlay.className = 'cropper-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
      <div class="cropper-card">
        <div class="cropper-title">จัดตำแหน่งรูปปก</div>
        <div class="cropper-sub">🖐️ ลากเพื่อเลื่อนรูป · 🔍 ใช้แถบด้านล่างหรือลูกกลิ้งเมาส์เพื่อซูม — กรอบ = ส่วนที่จะแสดง (1920×600)</div>
        <div class="cropper-frame" id="cropper-frame">
          <img id="cropper-img" alt="">
          <div class="cropper-grid"></div>
        </div>
        <div class="cropper-zoom-row">
          <span class="cz-ico">➖</span>
          <input type="range" class="cropper-zoom" id="cropper-zoom" min="1" max="4" step="0.01" value="1">
          <span class="cz-ico">➕</span>
        </div>
        <div class="cropper-actions">
          <button type="button" class="cropper-cancel" id="cropper-cancel">ยกเลิก</button>
          <button type="button" class="cropper-ok" id="cropper-ok">✓ ใช้รูปนี้</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  window.openCoverCropper = function (file, outWTarget, outHTarget) {
    outWTarget = outWTarget || 1920;
    outHTarget = outHTarget || 600;
    buildUI();

    return new Promise((resolve) => {
      const img = document.getElementById('cropper-img');
      const frame = document.getElementById('cropper-frame');
      const zoomEl = document.getElementById('cropper-zoom');
      const url = URL.createObjectURL(file);

      let natW = 0, natH = 0;      // ขนาดรูปจริง
      let baseScale = 1;           // สเกลขั้นต่ำให้คลุมกรอบพอดี
      let zoom = 1;                // ตัวคูณซูม (1..4)
      let tx = 0, ty = 0;          // ตำแหน่งเลื่อน (px บนจอ)
      let dragging = false, sx = 0, sy = 0, stx = 0, sty = 0;

      function scale() { return baseScale * zoom; }
      function clamp() {
        const fw = frame.clientWidth, fh = frame.clientHeight;
        const sw = natW * scale(), sh = natH * scale();
        tx = Math.min(0, Math.max(fw - sw, tx));
        ty = Math.min(0, Math.max(fh - sh, ty));
      }
      function paint() {
        img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale()})`;
      }
      function setZoom(z, cx, cy) {
        // ซูมรอบจุด (cx,cy) ภายในกรอบ — ค่าเริ่มต้นกลางกรอบ
        const fw = frame.clientWidth, fh = frame.clientHeight;
        if (cx == null) { cx = fw / 2; cy = fh / 2; }
        const old = scale();
        zoom = Math.min(4, Math.max(1, z));
        const nw = scale();
        // คงจุดภาพใต้เคอร์เซอร์ให้อยู่ที่เดิม
        tx = cx - ((cx - tx) / old) * nw;
        ty = cy - ((cy - ty) / old) * nw;
        clamp(); paint();
        zoomEl.value = zoom;
      }

      img.onload = () => {
        natW = img.naturalWidth; natH = img.naturalHeight;
        const fw = frame.clientWidth, fh = frame.clientHeight;
        baseScale = Math.max(fw / natW, fh / natH);
        zoom = 1;
        // เริ่มที่กลางภาพ
        tx = (fw - natW * baseScale) / 2;
        ty = (fh - natH * baseScale) / 2;
        zoomEl.value = 1;
        clamp(); paint();
      };
      img.src = url;
      overlay.style.display = 'flex';

      // ── ลากเลื่อน (เมาส์ + นิ้ว ผ่าน Pointer Events) ──
      function onDown(e) {
        dragging = true; frame.classList.add('dragging');
        sx = e.clientX; sy = e.clientY; stx = tx; sty = ty;
        frame.setPointerCapture && frame.setPointerCapture(e.pointerId);
      }
      function onMove(e) {
        if (!dragging) return;
        tx = stx + (e.clientX - sx);
        ty = sty + (e.clientY - sy);
        clamp(); paint();
      }
      function onUp() { dragging = false; frame.classList.remove('dragging'); }
      frame.addEventListener('pointerdown', onDown);
      frame.addEventListener('pointermove', onMove);
      frame.addEventListener('pointerup', onUp);
      frame.addEventListener('pointercancel', onUp);

      // ── ซูม: แถบเลื่อน + ลูกกลิ้งเมาส์ ──
      function onSlide() { setZoom(parseFloat(zoomEl.value)); }
      function onWheel(e) {
        e.preventDefault();
        const rect = frame.getBoundingClientRect();
        setZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.925), e.clientX - rect.left, e.clientY - rect.top);
      }
      zoomEl.addEventListener('input', onSlide);
      frame.addEventListener('wheel', onWheel, { passive: false });

      function cleanup() {
        overlay.style.display = 'none';
        URL.revokeObjectURL(url);
        frame.removeEventListener('pointerdown', onDown);
        frame.removeEventListener('pointermove', onMove);
        frame.removeEventListener('pointerup', onUp);
        frame.removeEventListener('pointercancel', onUp);
        zoomEl.removeEventListener('input', onSlide);
        frame.removeEventListener('wheel', onWheel);
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onBackdrop);
        img.src = '';
      }

      const okBtn = document.getElementById('cropper-ok');
      const cancelBtn = document.getElementById('cropper-cancel');

      function onOk() {
        // แปลงพื้นที่ในกรอบ → พิกัดรูปจริง
        const fw = frame.clientWidth, fh = frame.clientHeight;
        const s = scale();
        const srcX = -tx / s, srcY = -ty / s;
        const srcW = fw / s, srcH = fh / s;
        // ไม่ขยายเกินจริง: ถ้าส่วนที่ครอปเล็กกว่าเป้า ให้ output เท่าขนาดจริง (คงสัดส่วน)
        let outW = outWTarget, outH = outHTarget;
        if (srcW < outWTarget) {
          outW = Math.max(320, Math.round(srcW));
          outH = Math.round(outW * outHTarget / outWTarget);
        }
        const cv = document.createElement('canvas');
        cv.width = outW; cv.height = outH;
        cv.getContext('2d').drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
        const data = cv.toDataURL('image/jpeg', 0.85);
        cleanup();
        resolve(data);
      }
      function onCancel() { cleanup(); resolve(null); }
      function onBackdrop(e) { if (e.target === overlay) onCancel(); }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', onBackdrop);
    });
  };
})();