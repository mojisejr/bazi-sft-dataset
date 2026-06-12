# planEdit.md — คำทำนายแบบ "กล่อง (box)" ตาม `docs/ทายดวง 15 หัวข้อ.docx`

> สถานะ: **บทที่ 1 (chart_foundation) เสร็จครบ loop** (engine → แก้ทีละกล่อง → PDF/Word) · เหลือขยายอีก 14 บท
> branch: `pdf-dev`

---

## บริบท
`docs/ทายดวง 15 หัวข้อ.docx` = master spec ของหัวข้อย่อยที่ซินแสกำหนดให้แต่ละบททำนายตาม
(15 หัวข้อหลัก = 15 บทใน `src/lib/bazi/topic-path.ts` เป๊ะ — สิ่งที่ docx เพิ่มคือ "หัวข้อย่อย" ใต้แต่ละบท)

เป้าหมาย: เปลี่ยนคำทำนายจาก markdown ก้อนเดียว → **กล่อง (box) แยกตามหัวข้อย่อย** ให้ซินแสแก้ทีละกล่องได้ง่าย
แล้วออก PDF/Word เป็นข้อความล้วน (กล่อง = เครื่องมือช่วยแก้ ไม่ใช่ของลูกค้า)

---

## ✅ บทที่ 1 (chart_foundation) — เสร็จแล้ว

### 1) โครงสร้าง box (infra — ใช้ซ้ำได้ทุกบท)
construct ใหม่ `[[box=หัวข้อย่อย]] ...เนื้อใน... [[/box]]` (block-level, ซ้อนได้) ครบทุกจุดที่ render:
| ไฟล์ | บทบาท |
|---|---|
| `src/lib/bazi/reading-markdown.ts` | parse/serialize box round-trip (editor ↔ markdown) |
| `src/components/bazi/reading/ChapterEditor.tsx` | Tiptap `BoxNode` (หน้าแก้ = กล่องมีกรอบ, หัวข้อ contenteditable=false) |
| `src/components/bazi/reading/ReadingPrintDocument.tsx` | PDF: box → **ข้อความล้วน** (ตัดกรอบ+หัวข้อ) |
| `src/lib/bazi/reading-docx.ts` | Word: box → ย่อหน้าล้วน (ไม่มี Table) |
| `src/components/bazi/reading/TopicCard.tsx` | การ์ดผลทำนาย: box → **กล่องจริง** + render markdown เต็ม |
| `src/styles/features/ylc-pdf.css`, `path-reading.css` | สไตล์กล่อง |

### 2) engine เติมเนื้อหา 6 หัวข้อย่อย (`buildChartFoundationBoxes` ใน `topic-knowledge.ts`)
ตอบครบทุกส่วนตามหัวข้อ docx, ทุกรายการแยกย่อหน้า (reuse helper เดิม ไม่คิดเลขใหม่):
1. **ดิถี / เกิดถูกฤดู / นั่งถูกที่ / กำลัง** — imagery + `isSeasonalCommand` (ถูกฤดู) + self-seat `RISING_QI`/`FALLING_QI` (นั่งถูกที่) + band
2. **นิสัยจากราศีล่างหลักวัน** — `record.branchText`
3. **นิสัยจากราศีบน+ล่าง (อิม+12เชี่ยงแซ)** — stem nature + element/qi + temper
4. **ดิถี→ถ่ายเท→โชคลาภ** — สายโซ่ `GENERATES`/`CONTROLS` + แต่ละหลักจาก `buildOutputTransferReading`
5. **สิ่งพึงระวัง** — temper ล้น/พร่อง + `buildNatalRelationNotes` (ผั่ว/ชง) แต่ละ note แยกย่อหน้า
6. **ข้อเสนอแนะ** — virtues ตามธาตุที่ดวงต้องการ + บทสรุป
- wiring: `buildTopicHumanReading(useBoxFormat=true)` คืน box markdown (consumer path `false` ยังเป็น prose)
- **ตัดหัวเกริ่นนำ (intro/พาดหัว) ทิ้ง** — เริ่มที่กล่องเลย

### 3) 3 surface แยกบทบาทชัดเจน
- **การ์ดผลทำนาย** = กล่องจริง (หัวข้อ + กรอบ)
- **หน้าแก้ (Tiptap)** = กล่องจริง — แก้ได้
- **PDF / Word** = ข้อความล้วน (ไม่มีกรอบ/หัวข้อย่อย — ลูกค้าเห็น prose สะอาด)

### 4) UX "แก้ไขโดยซินแส"
- **แก้ทีละกล่อง** — แต่ละกล่องมีปุ่ม "✎ แก้กล่องนี้" → textarea เฉพาะกล่องนั้น → บันทึก rebuild ทั้งบท (เปลี่ยนแค่กล่องนั้น)
- **กฎแทนคำต่อกล่อง** — แต่ละกล่องมี `🔧 กฎแทนคำ` (diff ระบบ↔ฉบับซินแสเฉพาะกล่อง, scope=topic)
- **Enter = บรรทัดใหม่** — `normalizeBoxBody` แปลงทุก Enter เป็นย่อหน้าใหม่ (bullet ติดกันคงเป็นลิสต์เดียว)

### 5) ตรวจสอบแล้ว
- `npx tsc --noEmit` สะอาด (ไฟล์ที่แก้) · `npm test` = แดง 7 ตัว **pre-existing ทั้งหมด** (reading-inline 3 + วัยจร/turning_points 4 — ยืนยันด้วยการ stash งานแล้วแดงเท่าเดิม)
- เบราว์เซอร์ (1993-11-24): การ์ด 6 กล่อง, แก้ทีละกล่อง/กฎแทนคำ/Enter ทำงานครบ, PDF/Word ข้อความล้วน, ไม่มี console error

---

## ⏳ ยังต้องทำ (ทั้งหมด)

### A. ขยายบทที่ 2–15 (งานหลักที่เหลือ)
infra กล่อง + UX แก้ทีละกล่อง/กฎแทนคำ **ใช้ซ้ำได้ทันที** — งานต่อบท = เพิ่ม engine builder ตามหัวข้อย่อยใน docx:
- แต่ละบทเพิ่ม `*_SUBTOPICS` (หัวข้อย่อยจาก docx) + `build*Boxes()` แล้ว wire ใน `buildTopicHumanReading`
- หัวข้อย่อยต่อบท (อ้าง docx): บท2 อาชีพ/ธุรกิจ(ควร/ไม่ควร อันดับ1-3), บท3 โชคลาภ(ผั่วไฉ่โข่ว), บท4 ผู้อุปถัมภ์,
  บท5 พรสวรรค์, บท6 ครอบครัว(ปี/เดือน/พ่อ/แม่), บท7 ความรัก/คู่ครอง, บท8 มิตร/ศัตรู, บท9 หุ้นส่วน, บท10 บริวาร,
  บท11 การเรียน, บท12 วัยจร 16 ช่วง (มีตารางอยู่แล้ว), บท13 สุขภาพ, บท14 สี/ทิศมงคล, บท15 องค์เทพ
- ทุกบทที่แปลงเป็นกล่อง: ต้องอัปเดต snapshot + ยกเว้นจาก test ที่บังคับ intro (เหมือนบท 1)

### B. ค้างคา / ความเสี่ยงที่ควรเก็บ
- **paged.js บน pdf-dev นับหน้าไม่นิ่ง** (counter off-screen ≠ ที่ print จริง) — ต้อง port patch null-guard ฉบับเต็ม + ให้ counter ใช้ render path เดียวกับ PagedPreview
- **7 test แดง pre-existing** (ไม่เกี่ยวกับ box): reading-inline tokenizer 3, turning_points/วัยจร phrasing 4 — ควรไล่แก้แยก
- **ฉบับซินแสเก่าค้าง intro**: correction ที่ snapshot ก่อนตัด intro จะยังโชว์หัวเกริ่นนำ — ต้องกด "ล้างการแก้ไข"/regenerate (พิจารณา auto-strip ถ้าจะให้เนียน)
- **Word fidelity** เป็นรอง (PDF เป็นหลัก) — กล่อง = ย่อหน้าล้วน ยังไม่มีหัวข้อ/กรอบใน Word (ตามดีไซน์ที่ตกลง)

### C. ก่อนส่งจริง (เมื่อครบ 15 บท)
- รัน real-case หลายดวง (ดู `tests/real-case-*`) ให้เนื้อหากล่องครบทุกหัวข้อย่อยทุกดวง
- E2E: generate → แก้ทีละกล่อง → ออก PDF (server puppeteer `api/reading/export-pdf`) เนื้อหาครบไม่ตัด
