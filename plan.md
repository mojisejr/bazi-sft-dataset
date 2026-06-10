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

## อัปเดต 2026-06-09 — แยกหน้า + หน้างานหลายคน
แยกฟีเจอร์เดิม (toggle งาน/รัก หน้าเดียว) ออกเป็น 2 หน้า:
- `/pair-matching` = **คู่รัก** อย่างเดียว (ตัด toggle งานออก, domain คงที่ = love)
- `/work-matching` = **การงาน** กรอก "เรา" + ผู้ร่วมงาน (หุ้นส่วน/ลูกน้อง) **สูงสุด 3 คน** → จัดอันดับใครเข้ากับเราดีสุด
  - จัดอันดับด้วยคะแนนทิศ **forward (เรา→เขา)** ตามตำรา
  - engine: `buildWorkComparison(self, others[])` → `WorkComparisonResult { self, candidates[], ranking[] }`
  - API `POST /api/bazi/work` (self + candidates 1..3)
  - reuse `/api/bazi/pair/rephrase` (เรียบเรียง LLM รายคน), export PDF (`WorkPrintReport`)
  - `PersonInputs` แยกเป็นไฟล์ใช้ร่วม 2 หน้า
  - tests เพิ่ม 2 เคส (rankScore=forward, ranking order, candidates order-preserved)
- หน้าแรกมี 2 ปุ่ม: "เปรียบเทียบคู่รัก" + "เปรียบเทียบการงาน"

## หมายเหตุ / ค้างไว้
- คะแนน directional ตามตำรา (เรา↔คู่ ต่างกันได้) — หน้าเว็บโชว์ทั้ง 2 ทิศ + คะแนนรวมเฉลี่ย
- 12 สี่ซิ้งรายคน: ยังใช้สี่ซิ้งจากการจับคู่ + ตาราง 12 ดาวอ้างอิง (กฎ map รายบุคคลในตำรายังไม่ชัดพอ encode)
- คู่บุญคู่กรรม (ตามปีเกิด) เก็บเป็น raw ใน reference.json — ยังไม่ได้แสดงผล

---

# งานแก้ตามซินแสแก้ (เคส 1993-11-24 male, editCase)

> อัปเดต 2026-06-09 — ปรับ engine/prompt ของรายงาน 15 บท ตามที่ซินแส redline บน `example/editCase/EditSinza-1993-11-24-male.pdf`
> หมายเหตุ: ไฟล์ `reading...(9).docx` ที่ซินแสแก้เป็น output เก่า — engine ปัจจุบันทำ rule-wide หลายข้อไปแล้ว (สี/อัญมณี/องค์เทพ หลุดออกจากบทอื่นนอก 14,15 เรียบร้อย) เหลือ ~11 จุด + กฎ prompt ที่แก้รอบนี้

## ✅ แก้แล้ว (engine — `src/lib/bazi/topic-knowledge.ts`)
- **บท1 ไห่ (害):** ทำให้ระบุ "ตำแหน่งเสา" + แปลเป็นคู่ความสัมพันธ์ (เช่น 申ยาม↔亥เดือน = ลูก/บริวาร/supplier ↔ พ่อแม่/ครอบครัว) แทนข้อความรวม — `buildNatalRelationNotes`
- **บท2 อาชีพ:** ธาตุไฟ = **อันดับ 1** (ส่งเสริมหลัก) / ธาตุดิน = **อันดับ 2** (รอง ดีกับดิถีโดยตรง); ตัด "หมายเหตุ" 2 จุด (missingNote + avoidMitigation → ย้ายไปบทแก้ดวง); สิ่งที่ควรระวังเหลือแค่ "อาชีพที่ควรเลี่ยง"
- **บท3 โชคลาภ:** "ทอ" = รายได้ประจำได้น้อยแต่นาน + (ทอ→ตี้อ๋วง) ต่อยอดกองทุนรวม/หุ้นกลุ่มธาตุลาภ-เทค-พลังงาน; ตัดบล็อก "ช่วงวัยแห่งโชคลาภ" (อายุ 5-9); **Market Target** = ผสมธาตุราศีบนปี + ราศีล่างปี แล้วถ้าเซี่ยงแซเสาปี "ดี"→ทายตรง / "เสีย"→ดึงด้านดีมาทาย
- **บท7 ความรัก:** เพิ่ม "ธาตุคู่มาก → ระวังเจ้าชู้/มือที่สาม รักษาศีลข้อ 3" + "ดิถีอ่อนตามใจคู่มากไป / ดิถีแข็งไม่ค่อยตามใจ"; ตัดบล็อก "ช่วงอายุที่เด่นเรื่องคู่"
- **บท12 วัยจร:** ทายตั้งแต่ **วัยจรแรก** (เดิมเริ่มที่ช่วงปัจจุบัน) + แปลงป้าย [ยุคทอง]/[เฝ้าระวัง] เป็น **ดาว 4 ระดับ** เฉพาะ narrative บทนี้ (⭐⭐⭐ ยุคทอง · ⭐⭐ โอกาสมาพร้อมภาระ/จังหวะดี · ⭐ เฝ้าระวัง · ◇ ช่วงทั่วไป) — `luckGradeToStars`. ตาราง appendix ยังคงป้ายเดิม
- **บท15 องค์เทพ:** เทียบเชี่ยงแซตัวอักษรทั้งผัง (rank เดิม) แล้วเหลือ **ดีที่สุด 2 องค์** = 1 หลัก + 1 รอง (เดิมไล่ทั้ง 8)

## ✅ แก้แล้ว (prompt — `reading-llm.ts`, `reading-prompt-profiles.ts`)
- รวม "สิ่งที่ควรเลี่ยง" เข้า "⚠️ สิ่งที่ควรระวัง" — ห้ามแยกหัวข้อ/ใช้ ❌ เป็นหัวข้อต่างหาก
- ห้าม LLM เพิ่มลิสต์ สี/อัญมณี/วัตถุมงคล/องค์เทพ นอกบท 14,15
- preserveDetail บท12 อัปเดตเป็นไอคอนดาว (ห้ามแปลงกลับเป็น [ยุคทอง]/[เฝ้าระวัง])

## ✅ ตรวจสอบ
- export docx เคส 1993-11-24 → ตรวจทุกจุดตรงตามที่ซินแสสั่ง
- tests/real-case-1993-11-24 + 1986-09-16 + 1981-03-17 ผ่าน (อัปเดต expectation องค์เทพ: "องค์หลักที่ควรบูชา (ดีที่สุด…)", เหลือ 1 หลัก+1 รอง)
- ESLint 0 errors, typecheck สะอาดในไฟล์ที่แก้

## ค้างไว้ / ทำต่อได้
- ตาราง appendix (บทเสริม) ยังใช้ป้าย [ยุคทอง]/[เฝ้าระวัง] — ถ้าต้องการให้ใช้ดาวด้วยค่อยปรับ
- "หมายเหตุ ขาดก้านธาตุไฟ" ที่ตัดจากบท2 ยังไม่ได้ไปโผล่ในบทแก้ดวง (14/15) อย่างชัดเจน

---

# บทเสริม (ต่อจากบทที่ 15): ตารางเส้นขีดความสัมพันธ์ หมวดช่วงอายุ/วัยจร — แก้ไขได้ + gen LLM + บันทึก DB

> อัปเดต 2026-06-10 — เดิมตารางบทเสริมใน `/reading` เป็น **read-only** ทำให้แก้ไขถ้อยคำเองได้, gen ช่อง "คำอธิบายดี-ร้ายเชิงลึก" ด้วย LLM แยกเดี่ยว ๆ และบันทึกฉบับที่แก้ลงฐานข้อมูล (ประวัติการดูดวง)

## ✅ เสร็จแล้ว

### 1. แก้ไขได้ (editable table)
- คอมโพเนนต์ใหม่ `src/components/bazi/reading/RelationshipLinesEditor.tsx` — ทุกช่อง (ช่วงอายุ/เสาวัยจร/เส้นขีด = input, คำอธิบายดี-ร้ายเชิงลึก = textarea)
- ใน `ReadingPathWorkspace.tsx` เปลี่ยน `relationshipLines` จาก derived ของบท `turning_points` เป็น **editable state ตัวเดียว** (source of truth สำหรับโชว์/พิมพ์/บันทึก)
- sync จากผลบท `turning_points` ผ่าน `lastTurningResultRef` (เทียบ reference: รันบทใหม่เท่านั้นที่ทับ — การแก้มือ/ค่าที่ restore จาก DB ไม่ถูกล้าง); เคลียร์ตอน reset/submit เคสใหม่

### 2. gen "คำอธิบายดี-ร้ายเชิงลึก" ด้วย LLM (เดี่ยว ๆ)
- route ใหม่ `POST /api/reading/relationship-lines` → `polishRelationshipLinesLlm` แต่งเฉพาะ `deepNote` (คง ช่วงอายุ/เสา/เส้นขีด + ป้าย [เฝ้าระวัง]/[ยุคทอง] เดิม; LLM ล้มเหลว = คืนแถวเดิม)
- ปุ่ม "✨ Gen คำอธิบายดี-ร้ายเชิงลึก (LLM)" บนหัวตาราง — แยกจากการรันบท 12 เต็มบท; ใช้ค่าย LLM/API key ส่วนกลาง (รองรับ Local Claude key="local")

### 3. บันทึกลง DB (ไม่ต้อง migration)
- `session_data` (JSONB) มีฟิลด์ `relationshipLines` (nullable) ใน `SessionDataSchema` อยู่แล้ว → save เขียน state **ฉบับที่แก้/gen แล้ว**, resume คืนจาก `sessionData.relationshipLines`
- export-docx (ฉบับ LLM) + PagedPreview (PDF) ใช้ state เดียวกัน → ที่แก้/gen ขึ้นในเอกสารด้วย

### 4. เทสต์
- `tests/reading-relationship-lines-route.test.ts` — 3 เคส (ไม่มี apiKey→400, rows ว่าง→400, mock LLM: คงคอลัมน์อื่นทับเฉพาะ deepNote) ผ่านทั้งหมด
- typecheck สะอาดในไฟล์ที่แก้, ESLint 0 errors, หน้า `/reading` เสิร์ฟ HTTP 200

## ไฟล์หลัก
- `src/app/api/reading/relationship-lines/route.ts` (ใหม่)
- `src/components/bazi/reading/RelationshipLinesEditor.tsx` (ใหม่)
- `src/components/bazi/reading/ReadingPathWorkspace.tsx` (state + handler + save/export/resume)
- `src/styles/features/path-reading.css` (สไตล์ช่องแก้ไข)
- `tests/reading-relationship-lines-route.test.ts` (ใหม่)
