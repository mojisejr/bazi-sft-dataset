# แผนงาน: หน้าเปรียบเทียบดวง 2 คน (คู่สมพงษ์ การงาน + ความรัก)

> อัปเดตล่าสุด 2026-06-08 — ฟีเจอร์ใหม่ "เปรียบเทียบดวง 2 คน" แยกหน้าจากของเดิม (`/reading`)
> ประวัติงานก่อนหน้า (engine deterministic, consumer render, Gemini A/B, R5) ดูได้จาก git log / memory/

## เป้าหมาย
หน้าใหม่ `/pair-matching` กรอกวันเกิด **2 คน** แล้วจับคู่ดวงแบบ **แม่นตามตำรา (สเปรดชีต)**
ทั้ง **การงาน + ความรัก** พร้อมคำทำนายพื้นฐาน, ปุ่ม popup, เรียบเรียงด้วย LLM และ **export PDF**

ฐานความรู้: `knownlage/ปฏิกิริยาธาตุ/` 3 ไฟล์ Excel
- `12 สี่ซิ้ง.xlsx` — 12 ดาวสี่ซิ้ง + คะแนน + ความหมาย 6 ด้าน
- `คู่สมพงษ์(การงาน).xlsx` / `คู่สมพงษ์(ความรัก).xlsx` — เมทริกซ์ 60 ชีต (หลักวันเรา × หลักวันคู่)

---

## ✅ เสร็จแล้ว

### 1. Distill Excel → JSON (`scripts/distill-pair-knowledge.py`)
สกัด 3 ไฟล์เป็น JSON ใน `src/lib/bazi/data/pair/`:
- `pair-matrix.json` — **3,600 คู่/โดเมน** (60×60) key `"<ก้านราศีเรา>|<ก้านราศีคู่>"` → percent (เฉลี่ย 3 องค์ประกอบ), components, points, สี่ซิ้ง
- `rating-scale.json` — เกรด 13 ขั้น (A+…F) + เรตติ้ง 10 ระดับ (emoji + คำบรรยาย) ต่อโดเมน
- `sising.json` — 12 สี่ซิ้ง (ชื่อ/คะแนน/6 ด้าน/สรุป)
- `reference.json` — นิสัยหลักวัน (ก้าน/ราศี/เชี่ยงแซ), บทบาท เจ้านาย/ลูกน้อง/หุ้นส่วน, 12 เชี่ยงแซความรัก, คู่บุญคู่กรรม
- normalize codepoint (U+F971→辰) + แก้ typo ต้นฉบับ

### 2. Engine (`src/lib/bazi/pair-matching.ts` + `pair-types.ts`)
- `computePairMatch` — จับคู่แม่นตามชีต → percent/เกรด/องค์ประกอบ/สี่ซิ้ง/คำเรตติ้ง
- `computePairMatchPair` — **2 ทิศทาง (เรา↔คู่) + คะแนนรวมเฉลี่ย** (แก้ปัญหากรอก 1-2 vs 2-1 ได้ผลต่าง — เป็น directional ตามตำรา)
- `buildElementInteractionAB` — ปฏิกิริยาธาตุ 5 ประการ A↔B (reuse `GENERATES`/`CONTROLS`)
- `buildNisai` — นิสัยหลักวัน 3 บรรทัด (ก้าน/ราศี/เชี่ยงแซ ผ่าน `resolveDisplayTwelveQiStage`)
- `buildWorkRoleReadings` / `buildLoveRoleReadings` — บทบาทตามหลักวัน×ราศีคู่

### 3. API
- `POST /api/bazi/pair` — คำนวณ 2 ดวง (`calculateBaziStateFromRawInput`) + เปรียบเทียบ 2 โดเมน
- `POST /api/bazi/pair/rephrase` — เรียบเรียง engine-truth ด้วย LLM (reuse `generateProseLlm` ใน `reading-llm.ts`)

### 4. หน้าเว็บ (`/pair-matching`)
- `page.tsx` (Clerk guard) + `PairMatchingWorkspace.tsx` + `PairDetailModal.tsx` + `PairPrintReport.tsx`
- กรอก 2 คน (reuse option/`buildPayload` จาก trainer-workspace), toggle งาน/รัก
- แสดง: คำทำนายพื้นฐานรายคน, แบนเนอร์เกรด+คำตัดสิน, 2 ทิศทาง, ปฏิกิริยาธาตุ, สี่ซิ้งประจำคู่ (คำอธิบายเต็ม + 3 ด้านตรงโดเมน), บทบาท
- popup: ผังธาตุ 2 คน, 12 สี่ซิ้งทั้งหมด
- ปุ่มเรียบเรียงด้วย LLM (Gemini/Local Claude/OpenCode)
- ลิงก์เข้าหน้าใหม่จากหน้าแรก (`BaziTrainerWorkspace.tsx`)

### 5. Export PDF (print-to-PDF ผ่านเบราว์เซอร์)
ปุ่ม "บันทึกเป็น PDF / พิมพ์" → `PairPrintReport` (ซ่อนบนจอ แสดงเฉพาะตอนพิมพ์) รวมในไฟล์เดียว:
- หัวรายงาน + วันที่จัดทำ
- การ์ด 2 คน: หลักวัน + **วันเวลาเกิด** + นิสัย
- **ตารางพื้นดวงเทียบกัน**: 4 เสา + ลัคนา + **ปีปัจจุบันเท่านั้น** (ไม่เอาวัยจรทุกปี)
- ความรัก + การงาน (เต็ม)
- print CSS: `@page` margin, `break-inside: avoid`, ซ่อน chrome ทั้งหมดตอนพิมพ์

### 6. เทสต์
`tests/pair-matching.test.ts` — 10 เคส (ความแม่นตามชีต, directional, คะแนนรวม order-independent, ปฏิกิริยาธาตุ) ผ่านทั้งหมด

---

## ไฟล์หลัก
- `scripts/distill-pair-knowledge.py`, `src/lib/bazi/data/pair/*.json`
- `src/lib/bazi/pair-matching.ts`, `pair-types.ts`
- `src/app/api/bazi/pair/route.ts`, `src/app/api/bazi/pair/rephrase/route.ts`
- `src/app/pair-matching/page.tsx`
- `src/components/bazi/pair/{PairMatchingWorkspace,PairDetailModal,PairPrintReport,pair-presentation}.{tsx,ts}`
- `src/styles/features/pair-matching.css`
- `tests/pair-matching.test.ts`

## หมายเหตุ / ค้างไว้
- คะแนน directional ตามตำรา (เรา↔คู่ ต่างกันได้) — หน้าเว็บโชว์ทั้ง 2 ทิศ + คะแนนรวมเฉลี่ย
- 12 สี่ซิ้งรายคน: ยังใช้สี่ซิ้งจากการจับคู่ + ตาราง 12 ดาวอ้างอิง (กฎ map รายบุคคลในตำรายังไม่ชัดพอ encode)
- คู่บุญคู่กรรม (ตามปีเกิด) เก็บเป็น raw ใน reference.json — ยังไม่ได้แสดงผล
