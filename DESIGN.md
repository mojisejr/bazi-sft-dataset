---
# DESIGN.md — Mumate design tokens (สกัดจาก Figma redesign ก.ค. 2026)
# spec: https://github.com/google-labs-code/design.md (alpha)
name: Mumate
version: 0.1.0
colors:
  primary: "#1B9AAF"        # teal หลัก — ปุ่ม CTA, ลิงก์, กราฟ, ไฮไลต์
  primary-dark: "#15808F"   # hover/pressed ของ primary
  accent: "#F4C430"         # เหลืองทอง — การ์ดสตรีค/ไฮไลต์พลังงาน/เหรียญ
  accent-soft: "#FEF3C7"    # เหลืองอ่อน — พื้นการ์ด hero, ป้ายโปรโมท
  background: "#FAF7F2"     # ครีมอุ่น — พื้นหลังแอปทุกจอ
  surface: "#FFFFFF"        # การ์ด/แผงเนื้อหา
  surface-alt: "#F1ECE2"    # ชิป/pill/แถบ progress พื้น
  ink: "#1F1A17"            # ตัวอักษรหลัก (น้ำตาลเข้มเกือบดำ ไม่ใช่ดำสนิท)
  muted: "#8A8377"          # ตัวอักษรรอง/คำอธิบาย
  border: "#E5DED2"         # เส้นแบ่ง/ขอบการ์ด
  dark-card: "#1F2430"      # การ์ดพรีเมียม/Karma dashboard (พื้นเข้ม ตัวอักษรขาว)
  love: "#E0245E"           # หัวใจ/มิติความรัก
  love-soft: "#F5D7E3"      # การ์ดจับคู่ความรัก (ชมพูพาสเทล)
  work-soft: "#D7E3F5"      # การ์ดจับคู่การงาน (ฟ้าพาสเทล)
  success: "#2E9E5B"
  warning: "#8A6D3B"
  danger: "#C0392B"
typography:
  font-family: "'Noto Sans Thai', 'IBM Plex Sans Thai', system-ui, sans-serif"
  scale:
    display: { size: "2.2rem", weight: 800 }   # ตัวเลขใหญ่ % / เกรด / เหรียญ
    h1: { size: "1.5rem", weight: 700 }
    h2: { size: "1.05rem", weight: 700 }
    body: { size: "0.95rem", weight: 400 }
    small: { size: "0.82rem", weight: 400 }
spacing:
  unit: 4                    # px — ใช้ทวีคูณ 4 (4/8/12/16/24)
  card-padding: 14
  screen-padding: 16
radius:
  card: 16
  card-lg: 24                # กรอบจอ/การ์ด hero
  button: 999                # ปุ่มหลักเป็น pill เสมอ
  input: 10
components:
  button-primary: { bg: "$primary", color: "#FFFFFF", radius: "$radius.button", weight: 700 }
  button-secondary: { bg: "$surface-alt", color: "$ink", radius: 10 }
  card: { bg: "$surface", radius: "$radius.card", shadow: "0 1px 4px rgba(0,0,0,.06)" }
  card-hero: { bg: "linear-gradient(135deg, $accent-soft, $surface)", radius: "$radius.card" }
  chip: { border: "1px solid $border", radius: 999, on-bg: "$primary", on-color: "#FFFFFF" }
  progress-bar: { track: "$surface-alt", fill: "$primary", height: 8, radius: 999 }
---

# Mumate Design System

แอปดูดวง + Manifestation แนว **"ฮีลใจ"** — อบอุ่น เป็นเพื่อน ไม่ขลังจนน่ากลัว
อารมณ์รวม: ครีมอุ่นเป็นพื้น, teal เป็นแอ็กชัน, เหลืองทองเป็นพลังงาน/กำลังใจ

## หลักการ

- **พื้นครีม ไม่ใช่ขาว** — ทุกจอใช้ `background` (#FAF7F2) การ์ดขาวลอยบนครีมด้วยเงาเบา ๆ ให้ความรู้สึกกระดาษสา/ธรรมชาติ
- **Teal = การกระทำ** — ปุ่มหลัก ลิงก์ กราฟ ตัวเลขเด่น ใช้ `primary` ที่เดียวกันหมด ห้ามใช้สีอื่นกับ CTA
- **เหลืองทอง = พลังงานบวก** — สตรีค 🔥, เหรียญ, การ์ดคำคม, ป้าย premium ใช้ตระกูล `accent` เพื่อให้ "สิ่งที่อยากให้ผู้ใช้กลับมาทำทุกวัน" สะดุดตาที่สุดในจอ
- **การ์ดเข้ม = ของพิเศษ** — Karma dashboard / Premium ใช้ `dark-card` ตัดกับพื้นครีมให้รู้สึกเอ็กซ์คลูซีฟ (ใช้ได้ไม่เกิน 1 การ์ดต่อจอ)
- **โค้งเสมอ** — ไม่มีมุมฉากในแอป: การ์ด 16px, กรอบใหญ่/hero 24px, ปุ่มหลักเป็น pill เต็ม, อินพุต 10px
- **ตัวอักษร ink ไม่ใช่ดำ** — #1F1A17 (น้ำตาลเข้ม) ทั้งแอป เข้ากับพื้นครีม; ข้อความรองใช้ `muted`
- **คู่สีจับคู่ดวง** — ความรัก = ชมพูพาสเทล `love-soft`, การงาน = ฟ้าพาสเทล `work-soft` (การ์ดเลือกโหมดในจอ Connect)
- **อิโมจิเป็นไอคอน** — MVP ใช้อิโมจิแทนไอคอนเซ็ตได้ (❤️ 💼 💰 🔥 🪙) โทนแอปรับได้ ไม่ต้องรีบหาไลบรารีไอคอน

## เสียงของแบรนด์ (สำหรับ copy)

ภาษาไทยแบบเพื่อนคุยกับเพื่อน ลงท้าย "นะ/เลย/กัน" ได้ ไม่ใช้คำสั่ง ไม่ขู่เรื่องดวง
เรื่องร้ายให้เล่าแบบ "ควรระวัง/ค่อยเป็นค่อยไป" เสมอ (ตามหลักฮีลใจของโปรดักต์)

## การใช้กับหน้าในโปรเจกต์นี้

หน้า demo/print ที่ AI สร้างในโปรเจกต์นี้ต้องอิงโทเคนไฟล์นี้:
- `/mvp` — หน้าเดโมแอป (CSS ตัวแปรใน `src/app/mvp/page.tsx`)
- `/pair-match/report` — รายงาน PDF (สไตล์ใน `src/styles/features/pair-matching.css` ส่วน `.pair-report-page`)

ดีไซน์จริงของแอป production เป็นของทีม UI (Figma) — ไฟล์นี้สกัดมาจาก Figma อีกที
ถ้าทีมดีไซน์แก้โทเคน ให้แก้ไฟล์นี้เป็นแหล่งความจริงเดียวแล้วไล่ปรับ CSS ตาม
