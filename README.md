# RUKTHAI — หมากรุกไทยออนไลน์

เว็บแอปหมากรุกไทย (Makruk) · HTML/CSS/JS ล้วน + Firebase Realtime Database
Deploy แบบ static ได้เลย (เช่น Render / GitHub Pages) — ไม่มี build step

---

## 🎨 เปลี่ยนธีม / สีปุ่ม — แก้ที่เดียว: `theme-refresh.css`

ไฟล์ `theme-refresh.css` คือ **"ไฟล์ธีมกลาง"** โหลดทุกหน้า คุมรูปลักษณ์ทั้งเว็บผ่าน CSS variables ใน `:root`

### สีปุ่ม (ทุกปุ่มทั้งเว็บ)
แก้ตัวแปรในบล็อก `🎨 สีปุ่มทั้งเว็บ`:
```css
--btn-primary: #bf6730;        /* ปุ่มหลัก */
--btn-primary-hover: #cb7338;
--btn-secondary: #2a2521;      /* ปุ่มรอง */
--btn-danger: #34221f;         /* ปุ่มอันตราย */
```
ปุ่มมี 3 ระดับ — ใช้คลาส:
- `class="btn-action"` → ปุ่มรอง (ค่าเริ่มต้น)
- `class="btn-action primary"` → ปุ่มหลัก (เด่น)
- `class="btn-action danger"` → ปุ่มอันตราย

### สีหลัก / ฟอนต์ / ระยะห่าง / มุมโค้ง / เงา
อยู่ใน `:root` + บล็อกโหมด `html[data-background-mode="dark"|"light"]` ของไฟล์เดียวกัน
(`--bg`, `--gold`, `--text`, `--font-ui`, `--sp-*`, `--r-*`, `--shadow-*` ฯลฯ)

---

## 📁 โครงสร้างไฟล์

### CSS (แยกตามหน้าที่)
| ไฟล์ | หน้าที่ | โหลดที่ |
|------|--------|---------|
| `theme-refresh.css` | **ธีมกลาง** (token สี/ฟอนต์/ปุ่ม + topbar/nav) | ทุกหน้า |
| `styles.css` | โครงหลัก + เลย์เอาต์พื้นฐาน | ทุกหน้า |
| `styles-friend-enhanced.css` | UI เพื่อน/สังคม | เกือบทุกหน้า |
| `mobile.css` | responsive มือถือ/แท็บเล็ต | ทุกหน้า |
| `game.css` | กระดาน + ปุ่มเกม + การ์ดผู้เล่น | หน้าเกม |
| `play-online.css` | เลย์เอาต์ 2 คอลัมน์ของหน้าเล่น | play-online/bot/review |

### JS
| ไฟล์ | หน้าที่ |
|------|--------|
| `firebase.js` | ตั้งค่า Firebase |
| `auth.js` | ล็อกอิน/topbar/เมนูมือถือ/ธีม |
| `game.js` | กติกาหมากรุก + วาดกระดาน (`renderBoard`) |
| `setting.js` | หน้าตั้งค่า + พื้นช่องกระดาน (manifest) |
| `elo.js` `friend.js` `notification.js` `profile.js` `playerid.js` `sound.js` | ระบบย่อย |

### โฟลเดอร์
- `pages/` — ทุกหน้า (.html)
- `Pieces/` — รูปหมาก
- `Boards/` — พื้นหลังหน้า (Board1-9) + พื้นช่องกระดาน (cell-wood.jpg)
- `Sounds/` — เสียงเอฟเฟกต์

---

## ➕ เพิ่มลายพื้นช่องกระดานใหม่
1. วางรูปใน `Boards/` เช่น `Boards/cell-marble.jpg`
2. เพิ่ม 1 บรรทัดใน `setting.js` (ลิสต์ `BOARD_CELL_STYLES`):
```js
{ id: "marble", name: "ลายหินอ่อน", file: "/Boards/cell-marble.jpg", line: "rgba(80,80,90,0.5)" },
```
dropdown ในตั้งค่าจะขึ้นเอง

---

## ⚠️ ก่อนเปิดใช้จริง (production)
- ล็อก Firebase Security Rules (ตอนนี้เปิดเต็มสำหรับ dev)
- พิจารณาย้ายไป Firebase Auth
