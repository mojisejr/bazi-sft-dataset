# โค้ชฮีลใจ — แชทบอตสไตล์ Louise Hay (extraction + RAG pipeline)

ฟีเจอร์นี้ "ถอด" น้ำเสียงและคำสอนจากหนังสือ Louise Hay (ฉบับแปลไทย) ออกมาเป็นแชทบอต
ให้กำลังใจแยกต่างหาก (`/louise-hay`) ที่ตอบด้วยน้ำเสียงรัก–เยียวยาตัวเอง และ **grounded**
ด้วยคำสอนจริงจากหนังสือผ่าน RAG (ค้นคำสอนที่เกี่ยวข้องมาเป็นบริบท ไม่ใช่ท่องทั้งเล่ม).

## แหล่งข้อมูล
`Louise Hay/` มี PDF 5 ไฟล์ = **3 เล่มจริง** (01≡02, 03≡04 เป็นไฟล์ซ้ำ, 05 แยก)
ทั้งหมดเป็นหนังสือ **สแกนภาพ** (ไม่มี text layer) → ต้อง OCR
- `power` = "พลังแห่งการรักตัวเอง" (The Power Is Within You) — `01.LouiseHayThepowerIsWithinU.pdf`
- `book03` = `03LH.pdf`
- `book05` = `05LH.pdf`

## Pipeline (3 ขั้น)

```bash
# 1) OCR รายหน้าด้วย Gemini vision (resumable — รันซ้ำได้ ข้ามหน้าที่ทำแล้ว)
python scripts/louise-hay/ocr_books.py            # ทั้ง 3 เล่ม
#   → scripts/louise-hay/ocr-out/<slug>/pNNN.txt

# 2) ประกอบเป็น corpus JSON ต่อเล่ม (ตัดหน้า [BLANK] ออก, ติดเลขหน้าไว้อ้างอิง)
python scripts/louise-hay/assemble_corpus.py
#   → scripts/louise-hay/corpus/<slug>.json

# 3) chunk + embed (gemini-embedding-001, 768 มิติ, L2-normalized) เป็น index เดียว
python scripts/louise-hay/build_index.py
#   → src/lib/louise-hay/data/louise-hay-index.json   (แอปโหลดตอน runtime)
```

ต้องมี `GEMINI_API_KEY` ใน `.env` (อ่านอัตโนมัติ). ต้องมี `pymupdf` + `requests` (มีอยู่แล้ว).

## Runtime (แชทบอต)
- Persona/น้ำเสียง: `src/lib/louise-hay/persona.ts` — "โค้ชฮีลใจ" (ตอบตรงคำถามก่อน แล้วห่อด้วย
  น้ำเสียงรักตัวเอง/พลังในตัว/ปัจจุบันขณะ/ให้อภัย/ปิดท้ายด้วยคำยืนยัน) + กติกาความปลอดภัย
  (ไม่ใช่แพทย์, ภาวะวิกฤต → 1323)
- Retrieval (น้ำเสียง): `src/lib/louise-hay/retrieval.ts` — embed คำถาม (RETRIEVAL_QUERY) แล้ว cosine
  top-K จาก index; โหลด index แบบ lazy; ถ้ายังไม่มีไฟล์ index แชทยังตอบได้ (แค่ไม่มี grounding หนังสือ)
- **Router เลือกศาสตร์ (ground truth):** `src/lib/louise-hay/grounding-router.ts` — classify คำถาม
  (Gemini) แล้วดึงคำตอบจากศาสตร์ที่ถูกต้อง reuse engine เดิมทั้งหมด:
  | route | เมื่อ | แหล่ง (engine เดิม) |
  |---|---|---|
  | `chart` | ถามดวงพื้นฐาน/ชะตา | อ่านดวงใหม่ NewData (`resolveChapterBoxes`) บทที่ตรงหัวข้อ |
  | `day` | ถามเจาะจงเรื่องวัน | ศาสตร์ปฏิทิน/ดวงกับวัน (`buildManVsDay`) |
  | `card` | ขอคำแนะนำอื่น ๆ | จั่วไพ่ออราเคิลเคี้ยงคุง (`drawRandom`+`buildOracleReading`) |
  | `chat` | ทักทาย/คุยเล่น | ไม่ใช้ศาสตร์ ตอบจากใจ |
  `chart`/`day` ต้องผูกวันเกิด — ถ้าไม่ผูกจะ fallback ไปจั่วไพ่ พร้อมชวนให้ผูกดวง
- Route: `POST /api/louise-hay/chat` — body `{ messages, birth? }` → stream คำตอบ (text/plain)
  + header `X-LH-Sources` (อ้างอิงหนังสือ), `X-LH-Route` (ศาสตร์ที่ใช้), `X-LH-Source` (ป้ายศาสตร์)
- UI (mockup): `/louise-hay` — หน้าแชทธีมชมพู, ปุ่ม "คำยืนยันวันนี้", แผง "🔮 ผูกดวง" (วันเกิด),
  badge บอกศาสตร์ที่ใช้ (🔮/📅/🃏) และแหล่งอ้างอิงหนังสือ (ยังไม่ต่อ LINE)

## หมายเหตุลิขสิทธิ์
เนื้อหาหนังสือเป็นลิขสิทธิ์ของผู้เขียน/สำนักพิมพ์ — ใช้เป็น "ฐานอ้างอิงภายใน" ให้บอทเรียบเรียงใหม่
persona บังคับให้ **paraphrase** ไม่ลอกทั้งย่อหน้า และหน้าจอแสดง snippet อ้างอิงสั้น ๆ เท่านั้น
