# แผนงาน: หน้าแก้ไขบทดูดวง WYSIWYG (Reading Edit Panel) ก่อน export PDF/Word

> อัปเดต 2026-06-11 — ทำหน้า "แก้ไขบท" แบบ WYSIWYG (TipTap) ในโหมด preview ของ `/reading`
> ให้ซินแสแก้รายงาน 15 บท + บทเสริม แบบ "แก้ที่ไหน เห็นหน้าตรงนั้น" แล้ว export PDF/Word ตรงกับที่แก้
> ประวัติงานก่อนหน้า (pair-matching, work-matching, editCase 1993-11-24, ตารางบทเสริม editable) ดูได้จาก `git log` / `memory/`

## เป้าหมาย
แก้เนื้อหารายงานในหน้า preview ก่อนออกเอกสาร — เห็นหน้า A4 จริงตอนแก้, คุมการแบ่งหน้า/รูปแบบเองได้,
และผลที่แก้ไหลครบทั้ง 3 ทาง: มินิพรีวิว, PDF (paged.js), Word (.docx)

## สถาปัตยกรรม
- **ตัวแก้ = TipTap** (`ChapterEditor`) → เก็บกลับเป็น **markdown subset เดิม** → paged.js (PDF) + docx lib ใช้ต่อได้
- ใช้ CSS `.ylc-prose` ตัวเดียวกับ PDF ในตัวแก้ → หน้าตาใกล้เอกสารจริง
- **tokenizer กลาง** (`reading-inline.ts`) — แหล่งเดียวที่ทั้ง editor/PDF/docx เรียกใช้ กันตีความไม่ตรง
- markdown subset ที่รองรับ:
  - `**หนา**` · `***เน้นแดง***` · `[[c=KEY]]…[[/c]]` (สี) · `[[s=PT]]…[[/s]]` (ขนาดตัวอักษร)
  - `## หัวข้อย่อย` · `- bullet` · `[[indent]] …` (เยื้องบรรทัดแรก) · ช่องว่างนำหน้า (space bar) · `[[pagebreak]]`

---

## ✅ เสร็จแล้ว

### 1. ตัวแก้บท WYSIWYG + แถบเครื่องมือ (`ChapterEditor.tsx`)
- TipTap (StarterKit subset) + mark/node เสริม: `red` (เน้นแดง), `pageBreak`, `ParagraphWarn` (บรรทัดเตือน), `ParagraphIndent` (ย่อหน้า), `FontSize` (ขนาดบน textStyle), Color/TextStyle
- แถบเครื่องมือ **แนวตั้ง ชิดซ้าย sticky** (กว้าง 124px) — ไม่มี icon เหลือข้อความล้วน:
  ตัวหนา · เน้นแดง · หัวข้อ · **ย่อหน้า** · รายการ · บรรทัดเตือน · สี · **ก+ / ก−** (ขนาด) · แบ่งหน้า
- ตัวแก้กว้าง **174mm เท่าหน้า A4 จริง** (210−ขอบ 18mm×2) → จุดตัดบรรทัดใกล้เคียง PDF

### 2. ย่อหน้า / ช่องว่างนำหน้า
- เอา indent บังคับ 2em ออกจาก `.ylc-prose p`
- ปุ่ม "ย่อหน้า" = เยื้องบรรทัดแรกต่อย่อหน้า (attr → marker `[[indent]]`)
- กด space เว้นวรรคหน้าบรรทัดแรกได้ (parser ทั้ง 3 ฝั่งเก็บช่องว่างนำหน้า — trimEnd อย่างเดียว)

### 3. ขนาดตัวอักษรเฉพาะข้อความที่เลือก (inline)
- ปุ่ม ก+/ก− → setMark `textStyle.fontSize` (±1pt, base 15) → marker `[[s=PT]]…[[/s]]` (ครอบสี/หนาได้)
- ไหลถึง PDF (`<span style="font-size">`) และ docx (`TextRun size = pt×2`)

### 4. บทเสริม (ตารางวัยจร) — แก้แถว + แบ่งหน้า + พรีวิว
- `RelationshipLineRow` เพิ่ม `pageBreakBefore?` — ปุ่มต่อแถว "ขึ้นหน้าใหม่" + "ลบ" + ปุ่ม "เพิ่มแถว"
- PDF/Word/พรีวิว แตกแถวเป็นกลุ่มตาม `pageBreakBefore` → กลุ่มละ 1 หน้า A4 (`AppendixSheets` / docx `relationshipTables` คั่น `PageBreak`)
- มินิพรีวิว "หน้าจริง" ของบทเสริม (`SingleAppendixDocument`)

### 5. พรีวิว + จำนวนหน้า
- มินิพรีวิวต่อบท/บทเสริม (`ChapterPagePreview` + paged.js, auto-fit) · ขยายคอลัมน์พรีวิว
- **auto อัปเดตพรีวิว + นับจำนวนหน้า** เมื่อหยุดพิมพ์ ~5 วิ (ปุ่มกดเองยังอยู่)
- เอา "(ต่อ)" ออกจากหัวบทหน้าต่อ (continuation sheet ไม่ซ้ำหัว)

### 6. บันทึก/persist + export
- **แก้บั๊ก persist:** เพิ่ม `pageBreakBefore` ใน zod `RelationshipLineSchema` (`reading-sessions.ts`) — เดิมถูกตัดทิ้งตอน save → ตอนนี้บันทึก/เปิดกลับครบ (ยืนยัน save→DB→reopen)
- **ปุ่ม "บันทึกเป็น PDF (ฉบับที่แก้)" จากโหมดแก้คลิกเดียว** — สลับหน้าจริง A4 → paged.js เสร็จ (`PagedPreview onReady`) → เปิดหน้าต่างบันทึก PDF อัตโนมัติ
- `.docx (LLM)` รวมคำแก้ซินแส + ตารางบทเสริมที่แก้แล้ว

### 7. LLM = Gemini อย่างเดียว
- ลบ dropdown ค่าย LLM (OpenCode/Local Claude) + ปุ่ม "Gen ด้วย Local Claude" — เหลือช่อง Gemini API key

---

## ไฟล์หลัก
ใหม่: `ChapterEditor.tsx`, `ChapterPagePreview.tsx`, `ReadingEditPanel.tsx`, `reading-page-count.ts`,
`paged-runtime.ts`, `reading-markdown.ts`, `reading-inline.ts`, `reading-colors.ts`
แก้: `ReadingPathWorkspace.tsx`, `ReadingPrintDocument.tsx`, `PagedPreview.tsx`, `RelationshipLinesEditor.tsx`,
`TopicCard.tsx`, `lib/bazi/reading-docx.ts`, `lib/bazi/reading-sessions.ts`,
`styles/features/ylc-pdf.css`, `styles/features/path-reading.css`, `public/ylc/paged.js`

## เทสต์
- `tests/reading-markdown.test.ts` — round-trip markdown subset (indent / ช่องว่างนำหน้า / ขนาด / สี / pagebreak)
- `tests/reading-inline.test.ts` — tokenizer (หนา/แดง/สี/ขนาด ผสม)
- `tests/chapter-editor-schema.test.ts` — schema editor
- `tests/reading-sessions-route.test.ts` — เพิ่มเคส `pageBreakBefore` รอด zod save
- ทั้งหมดผ่าน · ESLint 0 errors

## Deploy
- งานอยู่บน branch **`pdf-dev`** (push แล้ว → Vercel preview deployment)
- production = `main` ยังตามหลัง → merge `pdf-dev → main` เมื่อทดสอบ preview ผ่าน

## หมายเหตุ / ค้างไว้
- ตัว auto-fit ของมินิพรีวิวคำนวณตอน mount (ไม่ฟัง resize) — เปลี่ยนขนาดจอแล้วกด "พอดีกรอบ"
- DOCX แตกหน้าบทเสริมตาม `pageBreakBefore` เฉพาะฉบับที่ override (LLM); ฉบับ engine ใช้ตารางจาก engine
