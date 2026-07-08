---
# DESIGN.md — Mumate design tokens
# ✅ ค่าจริงดึงจาก Figma ผ่าน MCP (get_design_context จอ home-the-cosmos ฯลฯ) — ไม่ใช่กะจากภาพ
# spec: https://github.com/google-labs-code/design.md (alpha)
name: Mumate
version: 0.2.0
colors:
  primary: "#1B9AAF"          # teal หลัก — CTA, ลิงก์, ชิปเวลา, แท็บ active, FAB แชท
  primary-soft: "rgba(27,154,175,0.1)"  # ป้ายจาง ๆ เช่น "1 ครั้ง/วัน"
  accent-from: "#F5A623"      # การ์ด mascot/พลังงาน = gradient ส้มทอง → เหลือง
  accent-to: "#FFED68"
  background: "#FAF7F4"       # พื้นแอปครีมอุ่น (ทุกจอ)
  surface: "#FFFFFF"          # การ์ดเนื้อหา
  surface-alt: "#F4F4F5"      # tile quick-action, พื้น progress (zinc-100)
  ink: "#1F2937"              # ตัวอักษรหลัก — slate-800 (Figma variable "Text/Title Color")
  muted: "#71717A"            # ตัวอักษรรอง (zinc-500)
  border: "#E4E4E7"           # เส้นขอบ/แบ่ง (zinc-200)
  dark-card: "#1F2937"        # การ์ดพิเศษ (จั่วไพ่/Karma/Premium) — สีเดียวกับ ink
  love: "#E0245E"
  love-soft: "#F5D7E3"        # การ์ดจับคู่ความรัก
  work-soft: "#D7E3F5"        # การ์ดจับคู่การงาน
  success: "#2E9E5B"
  warning: "#8A6D3B"
  danger: "#C0392B"
typography:
  font-family: "'IBM Plex Sans Thai', system-ui, sans-serif"   # ไทยทั้งแอป (Regular/Bold)
  font-family-numeric: "'Inter', sans-serif"                    # ตัวเลข/เวลา ใช้ Inter SemiBold
  scale:
    greeting-name: { size: "28px", weight: 700 }
    section-header: { size: "18px", weight: 700 }
    card-title: { size: "16px", weight: 700 }
    body: { size: "15px", weight: 400 }
    small: { size: "14px", weight: 400 }
    tiny: { size: "12px", weight: 400 }
    nav-label: { size: "11px" }        # bold เมื่อ active
spacing:
  screen-padding: 24            # ซ้าย-ขวาแต่ละจอ
  section-gap: 32               # ระยะระหว่าง section
  card-padding: 20
  card-gap: 20                  # ช่องว่างในการ์ด
radius:
  card: 16
  card-lg: 24                   # การ์ดเนื้อหาหลัก/การ์ดเข้ม
  chip: 100                     # pill เสมอ (ป้าย/ปุ่มหลัก)
  time-chip: 12                 # ชิปช่วงเวลา
  tile: 20                      # quick-action 64×64
  avatar: 22                    # วงกลม 44×44
  phone: 40                     # กรอบจอ
components:
  button-primary: { bg: "$primary", color: "#FFFFFF", radius: "$radius.chip", weight: 700 }
  card: { bg: "$surface", radius: "$radius.card-lg", padding: 20 }
  card-hero: { bg: "linear-gradient(90deg, $accent-from, $accent-to)", radius: "$radius.card", height: 120 }
  card-dark: { bg: "$dark-card", color: "#FFFFFF", radius: "$radius.card-lg" }
  chip-time: { bg: "$primary", color: "#FFFFFF", radius: 12, font: "Inter 13px semibold" }
  badge-soft: { bg: "$primary-soft", color: "$primary", radius: 100, size: "12px" }
  bottom-nav: { bg: "$surface", height: 84, border-top: "1px solid $surface-alt", active-color: "$primary", inactive-color: "$muted" }
  fab: { bg: "$primary", size: 60, radius: 30, position: "right 20px, above nav" }
---

# Mumate Design System

แอปดูดวง + Manifestation แนว **"ฮีลใจ"** — อบอุ่น เป็นเพื่อน ไม่ขลังจนน่ากลัว
พื้นครีมอุ่น + ตัวอักษร slate + teal เป็นแอ็กชัน + gradient ส้มทองเป็นพลังงาน

## หลักการ (ยืนยันจากไฟล์ Figma จริง)

- **พื้นครีม `#FAF7F4` ตัวอักษร slate `#1F2937`** — ไม่ใช่ดำ ไม่ใช่น้ำตาล; โทนรองใช้ตระกูล zinc (`#71717A`, `#E4E4E7`, `#F4F4F5`)
- **Teal `#1B9AAF` = การกระทำ** — ปุ่มหลัก ลิงก์ "ดูปฏิทิน →" ชิปเวลา แท็บ active FAB ใช้ตัวเดียวกันหมด ป้ายรองใช้ `primary-soft` (10% opacity)
- **พลังงานบวก = gradient ส้มทอง→เหลือง** (`#F5A623→#FFED68`) — การ์ด mascot/คำทำนายวันนี้/สตรีค ไม่ใช่เหลืองแบน
- **การ์ดเข้ม `#1F2937` = ของพิเศษ** — จั่วไพ่ / Karma / Premium (สีเดียวกับ ink, ≤1 ใบ/จอ)
- **โค้งเสมอ** — การ์ด 16-24px, ปุ่มหลัก/ป้าย pill (100px), tile 20px, ไม่มีมุมฉาก
- **ฟอนต์: IBM Plex Sans Thai** ทั้งแอป (Bold สำหรับหัวข้อ) + **Inter SemiBold เฉพาะตัวเลข/เวลา** (เช่น "09:00 - 11:00", "9:41")
- **โครงจอ**: padding ข้าง 24px · ระยะ section 32px · bottom nav สูง 84px (label 11px) · FAB แชท 60px มุมขวาล่างเหนือ nav
- **คู่สีจับคู่ดวง** — ความรัก = ชมพูพาสเทล, การงาน = ฟ้าพาสเทล (จอ Connect)

## เสียงของแบรนด์ (สำหรับ copy)

ภาษาไทยแบบเพื่อนคุยกับเพื่อน ลงท้าย "นะ/เลย/กัน" ได้ ไม่ใช้คำสั่ง ไม่ขู่เรื่องดวง
เรื่องร้ายเล่าแบบ "ควรระวัง/ค่อยเป็นค่อยไป" เสมอ (หลักฮีลใจของโปรดักต์)

## การใช้กับหน้าในโปรเจกต์นี้

หน้า demo/print ที่ AI สร้างในโปรเจกต์นี้ต้องอิงโทเคนไฟล์นี้:
- `/mvp` — หน้าเดโมแอป (CSS ตัวแปรใน `src/app/mvp/page.tsx`)
- `/pair-match/report` — รายงาน PDF (`src/styles/features/pair-matching.css` ส่วน `.pair-report-page`)

แหล่งความจริง = ไฟล์ Figma `vhVAKThTJrZ7aV4cU9a62O` (เข้าถึงผ่าน Figma MCP ได้)
ถ้าดีไซน์เปลี่ยน: ดึงค่าใหม่ด้วย `get_design_context` → แก้ไฟล์นี้ → ไล่ปรับ CSS ตาม
