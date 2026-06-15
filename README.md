# ระบบทำนายดวงจีน (Bazi) + ชุดข้อมูล SFT

> เว็บแอปสำหรับ **ทำนายดวงจีนปาจื่อ (八字 / Bazi)** ด้วย **เครื่องมือเชิงสัญลักษณ์ (deterministic engine)** ที่แต่งคำทำนายเองครบ 16 บท
> พร้อมเครื่องมือ **annotate ข้อมูล** และ **export ชุดข้อมูล SFT** สำหรับเทรนโมเดล รวมถึง **export รายงาน .docx**

ชื่อแพ็กเกจ: `bazi-sft-dataset`

---

## ภาพรวม (โปรเจกต์นี้คืออะไร)

ผู้ใช้กรอก **วัน–เวลา–สถานที่เกิด** → ระบบ
1. คำนวณ **ผังดวง (สี่เสา / 四柱)** + กำลังดิถี (แข็ง–อ่อน) + 12 เชี่ยงแซ + วัยจร ด้วย engine เชิงสัญลักษณ์
2. **แต่งคำทำนายเป็นร้อยแก้วลื่น ๆ ครบ 16 บท** แบบ deterministic (ไม่พึ่ง LLM ภายนอก) โดยเลียนสำนวนเอกสารต้นฉบับ "your life code"
3. **export เป็นไฟล์ .docx** ที่มีหน้าปก สารบัญ ตารางดวง และคำทำนายครบทุกบท

จุดเด่นคือ **"แต่งคำเองจากข้อเท็จจริงของ engine เท่านั้น"** — ไม่ดึงศาสตร์อื่นมาปน ไม่แต่งเกิน ทำให้คำทำนายคงความถูกต้องและทำซ้ำได้ผลเดิมเป๊ะ (deterministic 100%)

นอกจากนี้ยังเป็น **เครื่องมือสร้าง dataset** สำหรับ supervised fine-tuning (SFT): มีระบบ annotate, จัดคิว generate, และ export เป็นชุดข้อมูล

นอกเหนือจากคำทำนายดวงหลัก ยังมี **โหมดเสี่ยงทายเสริม** อีก 2 โหมด:
- **โหมดเซียน — ไพ่จิตวิญญาณแดนสวรรค์ (Divine Cards)** จั่วไพ่ 3 ใบ (สำรับ 80 ใบ) แล้วให้ LLM ร้อยคำทำนาย พร้อมรูปไพ่ที่ generate/เก็บไว้บน Supabase Storage
- **เซียนเสี่ยงทาย (Fortune Sage)** เสี่ยงทายสไตล์เซียมซี สุ่ม 1 หัวเซี่ยงแซ (60 หัว/กะจื่อ) แสดงคำทำนายดิบตามตำรา 5 หัวข้อ (การงาน/การเงิน/สุขภาพ/ความรัก/ครอบครัว)

---

## แนวคิดหลัก (Neuro-Symbolic)

ระบบยึด **องค์ความรู้โหราศาสตร์เป็น "กฎ + ข้อมูลที่มีโครงสร้าง"** ไม่ใช่ free-text:

- **ดิถีแข็ง–อ่อน → useful god**: ดิถีอ่อนต้องการ 印 (ส่งเสริม) + 比 (คู่ธาตุ); ดิถีแข็งต้องการ 食傷 (ถ่ายเท) / 财 (ลาภ)
- **12 เชี่ยงแซ 3 ระดับ**: รุ่งเรือง (长生/冠带/临官/帝旺) / ผันผวน (沐浴/胎/养) / ถดถอย (衰/病/死/墓/绝)
- **ตำแหน่งเสา**: ปี = สังคม/บรรพบุรุษ · เดือน = การงาน/พ่อแม่ · วัน = ตัวเอง/คู่ครอง · ยาม = บริวาร/บั้นปลาย
- **คู่ครอง**: ดวงชาย = 财 (ดาวลาภ) · ดวงหญิง = 官杀 (ดาวอำนาจ)
- **สุขภาพ**: ธาตุอ่อน = อวัยวะนั้นป่วย · ธาตุล้นเกิน = กดทับร่างกาย
- **imagery 调候**: 10 ดิถี × 4 ฤดู → ภาพธรรมชาติ (เช่น 壬 = ทะเลกว้าง, 甲 = ต้นไม้ใหญ่)

ทุกบทประกอบจากกฎเหล่านี้ + คลังถ้อยคำ (`reading-phrases.ts`) แล้วร้อยเป็นร้อยแก้ว

---

## คำทำนาย 16 บท

1 พื้นฐานดวงชะตา · 2 อาชีพ/ธุรกิจ · 3 โชคลาภ · 4 ผู้อุปถัมภ์ · 5 พรสวรรค์ · 6 ครอบครัว · 7 ความรัก/คู่ครอง · 8 เพื่อน/ศัตรู · 9 หุ้นส่วน · 10 ลูกน้องบริวาร · 11 การเรียน · 12 ช่วงวัย (วัยจร) · 13 สุขภาพ · 14 สี/ทิศมงคล · 15 องค์เทพ · 16 การพูด/การสื่อสาร

**โครงแต่ละบท:**
```
intro (คอนเซ็ปต์ทั่วไป)  →  พาดหัวเจาะดวง + ภาพดิถี/กำลัง  →  เนื้อหา engine (ร้อยด้วยคำเชื่อม)  →  สรุป/คำแนะนำ
```

รายละเอียดงาน narrative composer + ข้อเสนอต่อ ดูที่ [`plan.md`](plan.md)

---

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Neon PostgreSQL** ผ่าน `@neondatabase/serverless` + **Drizzle ORM**
- **Supabase Storage** (เก็บรูปไพ่ Divine Cards / Fortune Sage)
- **Vitest** (เทสต์ deterministic)
- **Zod** (validate env/schema)
- `lunar-javascript` (ปฏิทินจีน/สุริยคติ) · `docx` (export Word) · `@google/genai` (LLM เสริม + generate รูปไพ่) · `@line/bot-sdk` (LINE bot) · `@clerk/nextjs` (auth)

---

## โครงสร้างโฟลเดอร์

| โฟลเดอร์ | หน้าที่ |
|---|---|
| `src/lib/bazi/` | หัวใจระบบ — engine คำนวณดวง + ตัวแต่งคำทำนาย |
| `src/components/bazi/` | UI (annotate, อ่านดวง, workspace) |
| `src/app/` | หน้าเว็บ + API routes (Next.js) |
| `knownlage/` | องค์ความรู้โหราศาสตร์ที่ extract แล้ว (.txt) — ตำราต้นทาง |
| `example/` | เอกสารอ้างอิงสำนวน (`your life code_*.docx`, `1.docx`) |
| `scripts/` | สคริปต์ build knowledge / export / dataset / db |
| `tests/` | เทสต์ (รวม golden / real-case 6 ดวงอ้างอิง) |
| `docs/`, `drizzle/`, `memory/` | เอกสาร / migration / บันทึกความรู้ |

**ไฟล์สำคัญใน `src/lib/bazi/`:**
- `symbolic-engine.*` — คำนวณผังดวง สี่เสา กำลังดิถี วัยจร 12 เชี่ยงแซ
- `topic-knowledge.ts` — ตัวแต่งคำทำนาย 16 บท (`buildTopicHumanReading`)
- `reading-phrases.ts` — คลังถ้อยคำ + ตัวร้อยร้อยแก้ว (`weaveNarrative`, headlines, connectors)
- `reading-docx.ts` — สร้างไฟล์ .docx
- `divine-cards/` — โหมดเซียน: `deck.ts` (สำรับ 80 ใบ), `reading-engine.ts`, `reading-llm.ts`, `image-gen.ts`, `image-repository.ts`
- `fortune-sage/` — เซียนเสี่ยงทาย: `deck.ts` (60 หัวเซี่ยงแซ + 5 หัวข้อ)
- `data/divine-cards.json`, `data/fortune-sage.json` — ข้อมูลไพ่/หัวเซี่ยงแซ (extract จาก `knownlage/`)

---

## เริ่มต้นใช้งาน

```bash
# 1) ติดตั้ง dependencies
npm install

# 2) ตั้งค่า env — คัดลอก .env.example แล้วใส่ DATABASE_URL (Neon)
cp .env.example .env.local

# 3) รันเว็บ
npm run dev

# 4) ตรวจ gate หลักก่อน commit
npm run gate:default
```

**export รายงาน .docx (CLI):**
```bash
npm run export:docx -- 1988-06-08 12:08 female "Bangkok" out/report.docx
```

---

## เทสต์

```bash
npm run test            # รันทั้งหมด (vitest)
npm run gate:default    # build + lint + เทสต์ runtime-critical (ใช้ก่อน commit)
npm run gate:heavy-lane # เทสต์หนัก (แตะ corpus/build) — รันต่อจาก gate:default
```

- งานคำทำนายต้องคง **516 passed / 7 skipped / 0 fail** และ **deterministic** (รันซ้ำได้ผลเดิม)
- มีเทสต์ real-case 6 ดวงอ้างอิง (your life code) กัน overfit
- รายละเอียด lane matrix: `docs/testing-gates.md`

> วิธี preview คำทำนายเร็ว ๆ: เขียน temp test ใน `tests/` เรียก `buildTopicHumanReading(state, topicId, raw)` แล้ว `writeFileSync` (path alias `@/` resolve เฉพาะตอนรันผ่าน vitest)

---

## สคริปต์ฐานข้อมูล / ชุดข้อมูล (ย่อ)

```bash
npm run db:migrate            # apply migration (Drizzle)
npm run db:studio            # เปิด Drizzle Studio
npm run db:seed:canonical    # seed องค์ความรู้ canonical
npm run db:audit:strength    # ตรวจ coverage โปรไฟล์กำลังดิถี

npm run dataset:export:sft   # export ชุดข้อมูล SFT

npm run divine:gen-images    # generate รูปไพ่ Divine Cards (ผ่าน @google/genai)
npm run divine:import-images # อัปโหลดรูปไพ่ขึ้น Supabase Storage
npm run fortune:import-images # อัปโหลดรูป Fortune Sage ขึ้น Supabase Storage
```

ดูสคริปต์ทั้งหมดได้ใน `package.json` (กลุ่ม `db:*`, `dataset:*`, `divine:*`, `fortune:*`)

---

## หลักการพัฒนา (กฎเหล็ก)

1. **แต่งคำจาก fact ของ engine เท่านั้น** — ห้ามเพิ่มข้อมูลโหราศาสตร์/ตัวเลขลอย
2. **คง marker ที่เทสต์ผูกไว้** — เพิ่มร้อยแก้ว "รอบ ๆ" ไม่ลบ/ไม่แปลงค่า
3. **deterministic 100%** — ไม่มีสุ่ม คำเชื่อมหมุนตาม index
4. **ไม่ overfit ดวงเดียว** — ยึดหลักทั่วไป ยืนยันด้วย 6 ดวงอ้างอิง
