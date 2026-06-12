# planEdit.md — คำทำนายแบบ "กล่อง (box)" ตาม `docs/ทายดวง 15 หัวข้อ.docx`

> สถานะ: **ครบทั้ง 15 บท predict แล้ว** — ทุกบทเป็นกล่อง: เกริ่นนำ (YLC) + กล่องหัวข้อย่อย docx · ตารางเสริมวัยจรถูกถอด (ย้ายเป็นลิสต์ในบท 12)
> branch: `pdf-dev`
>
> **โครงกล่องปัจจุบัน (ทุกบท):** `[[box=เกริ่นนำ]]` (คอนเซ็ปต์บท CHAPTER_INTRO_TH + พาดหัวดิถี buildChapterOpening — แก้ได้) → กล่องหัวข้อย่อยตาม docx → กล่องข้อเสนอแนะ → ภาพเปรียบปิดท้ายนอกกล่อง
> **ฟีเจอร์กล่อง:** ทุกกล่องมี "ชื่อหัวข้อย่อย" เป็นย่อหน้าแรกในเนื้อด้วย (helper `readingBox`) — ซินแสเห็น/แก้หัวข้อได้ตอนแก้กล่อง + หัวข้อติดไปกับ PDF/Word

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

## ✅ บทที่ 2 (career_potential / อาชีพ-ธุรกิจ) — เสร็จแล้ว
- engine ใหม่ `buildCareerBoxes` + `CAREER_SUBTOPICS` ใน `topic-knowledge.ts` (reuse ชิ้นส่วน `buildCareerReading` เดิม ไม่คิดเลขใหม่)
- โครงกล่องตามที่ซินแสกำชับ: **กล่องแรก = ภาพรวมดิถี/แนวทางหาเงิน** (frame + ดาวถ่ายเท + พรสวรรค์→งาน + กลุ่มลูกค้า/ช่องทาง) แล้วตามด้วย
  **ควรทำ อันดับ 1–3** (ตามจำนวน useful element ของดวง) + **ไม่ควรทำ อันดับ 1–2** (officer พิฆาตดิถี + drain ของ balanced "บางคนมี")
- wiring: `buildTopicHumanReading(useBoxFormat=true)` route → `buildCareerBoxes` (prose path `false` ยังเป็นของเดิม consumer/LLM/docx ไม่กระทบ)
- คงคำว่า "อาชีพธาตุ (useful god)" ในกล่องควรทำ / ใช้ "สายงานธาตุ" ในกล่องไม่ควรทำ → marker test เดิมผ่าน
- test: เพิ่ม career_potential เข้า BOX_FORMAT_TOPICS ใน reading-narrative + อัปเดต snapshot 3 ดวง · full suite แดง 7 = pre-existing baseline เป๊ะ (ยืนยันด้วย stash)

---

## ✅ บทที่ 3 (wealth_and_investment / โชคลาภ) — เสร็จแล้ว
- refactor `buildWealthReading` → `collectWealthSegments` (ติด tag `main`/`caution`/`advice` ตามลำดับเดิม) + wrapper บางคืน prose เดิม
  **byte-identical** (prose path `useBoxFormat=false` ไม่เปลี่ยน → test/snapshot prose เดิมเขียวหมด)
- `buildWealthBoxes` + `WEALTH_SUBTOPICS` → 3 กล่องตาม docx:
  **ทายโชคลาภ** (นำด้วยสายโซ่ ดิถี→ถ่ายเท→โชคลาภ + ตำแหน่งดาวลาภ 12 เชี่ยงแซ + market + ลักษณะลาภ) /
  **สิ่งพึงระวัง (ผั่วไฉ่โข่ว)** (ขุมคลังถูกทำลาย 破财库 + ความเสี่ยงจมทุน/หนี้ของดิถีอ่อน) /
  **ข้อเสนอแนะ** (chapter advice เพิ่มเงินเก็บ-ลดรายจ่าย)
- wiring ใน `buildTopicHumanReading` (useBoxFormat=true) + เพิ่ม wealth_and_investment เข้า BOX_FORMAT_TOPICS (reading-narrative) + อัปเดต snapshot
- full suite แดง 7 = pre-existing baseline เป๊ะ

---

## ✅ บทที่ 4 (benefactor / ผู้อุปถัมภ์) — เสร็จแล้ว
- `buildBenefactorBoxes` + `BENEFACTOR_SUBTOPICS` + `BENEFACTOR_PERSON_TH` → 4 กล่องตามบทบาทธาตุที่ docx กำหนด
  (印 ส่งเสริม / 比 คู่ธาตุ / 食傷 ถ่ายเท-บริวาร / 财 โชคลาภ-ลูกค้า) — **ตาม docx ไม่ใช้ 官杀 เหมือน prose เดิม**
- แต่ละกล่อง: **อยู่ตรงไหน** (สแกน 4 เสาหาตำแหน่งธาตุ + 12 เชี่ยงแซ self-seat → GOOD_QI/BAD_QI verdict) /
  **คือใคร** (`BENEFACTOR_PERSON_TH`) / **ลักษณะ** (reuse `ELEMENT_TEMPER_TH[el].balanced`) — ธาตุที่ไม่ปรากฏ = หมายเหตุมาทางวัยจร
- prose path (`buildBenefactorReading` เดิม 印+官杀) ไม่แตะ → consumer/test เดิมเขียว · full suite แดง 7 = baseline

---

## ✅ รอบใหญ่: กล่องครบ 15 บท + เกริ่นนำ + ถอดตารางเสริม (ตามซินแสสั่ง)
- **กล่องเกริ่นนำทุกบท**: `buildIntroBox` = CHAPTER_INTRO_TH + buildChapterOpening (พาดหัวดิถี YLC) — รวมบท 1 ที่เคยตัด intro (ซินแสกลับคำ)
- **dispatcher `buildTopicBoxes`**: บท 1-4, 8, 12 ใช้ builder เฉพาะ · บทที่เหลือ (5,6,7,9,10,11,13,14,15) ใช้ `buildBoxesFromBody` + `TOPIC_BOX_SPECS`
  (regex จัดย่อหน้า prose เดิมเข้ากล่องตามหัวข้อ docx — ไม่แตะ prose path เลย consumer/test เดิมเขียว)
- **บท 8 (เพื่อน/ศัตรู)**: bespoke `buildFriendsFoesBoxes` — มิตร/ระวังมิตร/ศัตรู/ระวังศัตรู จาก scanPositionRelations
- **บท 12 (วัยจร)**: bespoke `buildTurningPointsBoxes` — กล่อง "ลิสต์ช่วงอายุ 16 วัยจร" (เนื้อหาเดียวกับตารางเสริมเดิม) + กล่องปีจร/พยากรณ์รายปี
- **ตารางเสริมถอดออกทุก surface**: PDF appendix (ไม่ส่ง relationshipLines เข้า ReadingPrintDocument), Word บทเสริม (reading-docx ทั้ง full + per-topic),
  workspace (RelationshipLinesEditor ลบ + EditPanel ส่ง null) — state/sync ใน workspace คงไว้ (invisible, session schema เดิม)
- **partnership**: บล็อกช่วงอายุ (วัยจร) ตัดออกจากกล่อง (doctrine เดียวกับบท 3 — เรื่องอายุรวมที่บท 12) แต่คงใน prose
- test: reading-narrative เช็คทุกบทเริ่ม `[[box=เกริ่นนำ]]` + มี CHAPTER_INTRO_TH · snapshot regen · full suite แดง 7 = pre-existing baseline เป๊ะ

---

## ⏳ ยังต้องทำ

### A. ของเดิมที่ระบุไว้ (อัปเดต)
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
