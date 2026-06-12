// ════════════════════════════════════════════════════════════
//   RUKTHAI — ระบบคะแนน Elo (มาตรฐานสากล)
//   3 ประเภท: Blitz (5 นาที) / Rapid (10 นาที) / Standard (30 นาที)
//   คะแนนเริ่มต้นทุกประเภท = 200
// ════════════════════════════════════════════════════════════

// คะแนนเริ่มต้นของผู้เล่นใหม่ทุกประเภท
export const START_ELO = 200;

// รายชื่อประเภทเกม
export const ELO_MODES = ['blitz', 'rapid', 'standard'];

// แปลงเวลาต่อฝ่าย (นาที) เป็นประเภทเกม
export function modeFromMinutes(minutes) {
  const m = Number(minutes);
  if (m === 5)  return 'blitz';    // เกมส์เร็ว
  if (m === 10) return 'rapid';    // เกมส์ปกติ
  if (m === 30) return 'standard'; // เกมส์ยาว
  return 'rapid'; // ค่าเริ่มต้นเผื่อกรณีอื่น
}

// ชื่อประเภทเกมแบบไทย
export function modeLabel(mode) {
  return ({
    blitz:    'เกมส์เร็ว (Blitz)',
    rapid:    'เกมส์ปกติ (Rapid)',
    standard: 'เกมส์ยาว (Standard)',
  })[mode] || mode;
}

// ────────────────────────────────────────────────
//   สูตร Elo มาตรฐาน
// ────────────────────────────────────────────────

// โอกาสชนะที่คาดหวังของผู้เล่น A เมื่อเจอ B (Expected Score)
// Ea = 1 / (1 + 10^((Rb - Ra) / 400))
export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (Number(ratingB) - Number(ratingA)) / 400));
}

// ค่า K (K-factor) แบบ FIDE
// ผู้เล่นใหม่ (เล่นน้อยกว่า 30 เกมในประเภทนั้น) ใช้ K สูง เพื่อให้คะแนนหาระดับจริงได้เร็ว
// ผู้เล่นที่มีประสบการณ์แล้วใช้ K ต่ำลง เพื่อให้คะแนนนิ่ง ไม่แกว่งง่าย
export function kFactor(gamesPlayed) {
  return (Number(gamesPlayed) || 0) < 30 ? 40 : 20;
}

// คะแนนของผลการแข่ง: ชนะ = 1, เสมอ = 0.5, แพ้ = 0
export function scoreFromResult(result) {
  if (result === 'win')  return 1;
  if (result === 'draw') return 0.5;
  return 0; // loss
}

// คำนวณคะแนนใหม่ + ส่วนต่าง
//   Ra_ใหม่ = Ra + K × (Sa − Ea)
// คืนค่า { newRating, delta }
export function computeRatingChange(rating, opponentRating, score, gamesPlayed) {
  const r   = Math.round(Number(rating));
  const exp = expectedScore(r, Number(opponentRating));
  const k   = kFactor(gamesPlayed);
  const newRating = Math.round(r + k * (Number(score) - exp));
  return { newRating, delta: newRating - r };
}

// ────────────────────────────────────────────────
//   ส่วนต่างคะแนนรายวัน (Daily delta)
//   แสดงผลรวมการเปลี่ยนแปลงของ "วันก่อนหน้า" เช่น
//   เมื่อวานเล่น Rapid คะแนนรวมเพิ่ม 55 → วันนี้แสดง +55 (สีเขียว)
// ────────────────────────────────────────────────

// คีย์วันที่แบบ local: "YYYY-MM-DD"
export function dateKey(ts) {
  const d = ts ? new Date(ts) : new Date();
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// อัปเดต record รายวันเมื่อมีส่วนต่าง delta เกิดขึ้นในวัน today
// record = { todayDate, todayDelta, shownDate, shownDelta }
//   - ถ้ายังเป็นวันเดิม: บวกสะสมเข้า todayDelta
//   - ถ้าขึ้นวันใหม่: ย้ายยอดของวันก่อนไปเป็น shown (วันที่จบแล้ว) แล้วเริ่มนับ today ใหม่
export function rollDailyDelta(record, delta, today) {
  const rec = record ? { ...record } : {};
  if (rec.todayDate === today) {
    rec.todayDelta = (Number(rec.todayDelta) || 0) + delta;
  } else {
    if (rec.todayDate) {
      rec.shownDate  = rec.todayDate;
      rec.shownDelta = Number(rec.todayDelta) || 0;
    }
    rec.todayDate  = today;
    rec.todayDelta = delta;
  }
  return rec;
}

// ดึงส่วนต่างที่ควร "แสดง" บนป้ายมุมขวาบน
//   = ผลรวมการเปลี่ยนแปลงของวันที่ผ่านมาล่าสุด (ก่อนวันนี้)
//   คืน null ถ้ายังไม่มีวันที่ผ่านมาให้แสดง
export function getDisplayDelta(record, today) {
  if (!record) return null;
  // ถ้าวันล่าสุดที่เล่นเป็นวันก่อนหน้า (ยังไม่เล่นวันนี้) → แสดงยอดของวันนั้น
  if (record.todayDate && record.todayDate < today) {
    return Number(record.todayDelta) || 0;
  }
  // ถ้าเล่นวันนี้แล้ว → แสดงยอดของวันก่อนหน้าที่จบไปแล้ว
  if (record.shownDate && record.shownDate < today) {
    return Number(record.shownDelta) || 0;
  }
  return null;
}