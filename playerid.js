// ════════════════════════════════════════════════════════════
//   RUKTHAI — ระบบรหัสผู้เล่น (Player ID) แบบตัวเลข 8 หลัก
//   ใช้ค้นหาเพื่อนได้ง่าย เช่น 10472938
//   เก็บที่ users/{uid}/playerId  และ index ที่ playerIds/{ID} = uid
// ════════════════════════════════════════════════════════════

// สุ่มรหัส 8 หลัก (หลักแรกไม่เป็น 0 เพื่อให้ครบ 8 หลักเสมอ)
export function randomPlayerId() {
  const first = 1 + Math.floor(Math.random() * 9);        // 1–9
  let rest = '';
  for (let i = 0; i < 7; i++) rest += Math.floor(Math.random() * 10); // 0–9
  return String(first) + rest;
}

// จัดรูปแบบให้อ่านง่าย: 1047 2938
export function formatPlayerId(id) {
  if (!id) return '';
  const s = String(id);
  return s.length === 8 ? `${s.slice(0, 4)} ${s.slice(4)}` : s;
}

// ตัดช่องว่าง/ขีด เหลือเฉพาะตัวเลข (รองรับผู้ใช้พิมพ์มีหรือไม่มีช่องว่าง)
export function normalizePlayerId(input) {
  if (input == null) return '';
  return String(input).replace(/[^0-9]/g, '');
}

// ตรวจว่าข้อความที่พิมพ์มีลักษณะเป็นรหัสผู้เล่นหรือไม่ (ตัวเลขล้วน)
export function looksLikePlayerId(input) {
  const s = normalizePlayerId(input);
  return s.length >= 4 && /^[0-9]+$/.test(String(input).trim().replace(/\s+/g, ''));
}

// ทำให้ user มีรหัส (ถ้ายังไม่มี) + เขียน index playerIds/{ID} = uid
// fns = { ref, get, set }  (ส่งฟังก์ชัน Firebase เข้ามาเพื่อไม่ผูกกับ instance ใด instance หนึ่ง)
export async function ensurePlayerId(db, fns, safeUid) {
  const { ref, get, set } = fns;
  if (!safeUid) return null;

  // ถ้ามีรหัสอยู่แล้วก็คืนค่าเดิม
  const existing = await get(ref(db, `users/${safeUid}/playerId`));
  if (existing.exists() && existing.val()) {
    // กันกรณี index หาย — เขียนซ้ำให้แน่ใจว่าค้นหาได้
    try { await set(ref(db, `playerIds/${existing.val()}`), safeUid); } catch (e) {}
    return existing.val();
  }

  // สุ่มจนกว่าจะได้รหัสที่ไม่ซ้ำ
  for (let attempt = 0; attempt < 15; attempt++) {
    const id = randomPlayerId();
    const idxRef = ref(db, `playerIds/${id}`);
    const idxSnap = await get(idxRef);
    if (!idxSnap.exists()) {
      await set(idxRef, safeUid);
      await set(ref(db, `users/${safeUid}/playerId`), id);
      return id;
    }
  }
  return null; // โอกาสน้อยมากที่จะหาไม่ได้
}

// ค้นหา uid จากรหัสผู้เล่น (คืน uid หรือ null)
export async function findUidByPlayerId(db, fns, input) {
  const { ref, get } = fns;
  const id = normalizePlayerId(input);
  if (id.length !== 8) return null;
  const snap = await get(ref(db, `playerIds/${id}`));
  return snap.exists() ? snap.val() : null;
}