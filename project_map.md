# Bazi SFT Dataset Collector - Project Map

## 1. 🧠 Philosophy (The Vibe)
**Bazi AI Annotation & Inference System**
โปรเจกต์นี้คือ Neuro-Symbolic AI Application เชิงลึกสำหรับทำ Data Annotation ด้านโหราศาสตร์จีน (Bazi) เพื่อนำ Dataset ที่ได้ไปทำ Supervised Fine-Tuning (SFT) ให้กับ LLM 
*   **Safety First**: ฐานข้อมูลและการ Migration มี Guardrails สูงสุด (Deterministic, Preflight Checks) ห้ามลบข้อมูลทิ้งโดยไม่จำเป็น
*   **Contract Driven**: การเชื่อมต่อระหว่าง AI Engine, Database, และ UI ถือครอง Truth ไว้ที่ Zod Schema อย่างเข้มงวด

## 2. 🗺️ Key Landmarks (The Territory)
*   `src/db/`:
    *   `schema.ts`: Drizzle Schema Definition (Single Source of Truth สำหรับ Database)
*   `src/styles/`:
    *   `tokens/reference.css`: reference tokens สำหรับ raw visual values และ brand material
    *   `tokens/system.css`: semantic tokens สำหรับ surface, line, state, text roles
    *   `foundation.css`: app-wide base rules และ shell defaults
    *   `primitives.css`: reusable structural recipes เช่น surface, section heading, action, badge, field, case rail
    *   `bazi-spillover.css`: migration inventory สำหรับ selector ที่ยังเป็น feature-local หรือยังไม่ reusable พอจะ promote ขึ้น primitive layer
*   `src/components/bazi/primitives/`:
    *   React primitive layer สำหรับ `Surface`, `SectionHeading`, `Action`, `Badge`, `StatusChip` และ helper ที่ reusable ข้ามหลาย surface
*   `src/lib/bazi/`:
    *   `schema-types.ts`: Zod Contracts สำหรับ 15-Dimension Annotation, Raw Input, และ Calculated State (Single Source of Truth สำหรับ API และ UI)
    *   `symbolic-engine.ts`: Phase 2 service layer สำหรับผูกดวง, ดึง canonical knowledge, และสร้าง `calculated_state`
    *   `timezone.ts`: utility สำหรับ parse เวลา local ของผู้ใช้, แปลงเป็น UTC เมื่อจำเป็น, และคำนวณ HKT boundary truth สำหรับ solar-term context
*   `src/app/api/bazi/calculate/route.ts`:
    *   API endpoint สำหรับรับ Raw Input แล้วคืน `calculated_state` จาก Symbolic Engine
*   `scripts/`:
    *   แหล่งรวม Safety Scripts & Guards สำหรับ Migration (เช่น `generate-phase16-migration.ts`, `apply-phase16-migration.ts`, `check-phase16-db-state.ts`) เพื่อหลีกเลี่ยงข้อจำกัดของ tooling (non-TTY, websocket limitations)
    *   `generate-random-bazi.ts`: Queue master สำหรับ pre-generate deterministic raw input + calculated state ลง pending queue ก่อนส่งให้ Copilot persona ตีความ
    *   `import-agent-drafts.ts`: importer สำหรับ validate และบันทึก AI draft batches เป็น `draft` records พร้อม prune queue ที่ประมวลผลแล้ว
    *   `export-sft-dataset.ts`: local-only headless exporter สำหรับดึง `reviewed` records ออกมาเป็น `.jsonl` โดยไม่สร้าง UI export บนหน้าเว็บ
*   `drizzle/`:
    *   SQL Migrations ที่ generate ออกมาแบบ Deterministic
*   `tests/`:
    *   ชุดทดสอบสำหรับการทำ Hard Gate ในแต่ละ Phase อย่างเคร่งครัด
*   `docs/oracle-ui-exemplar.md`:
    *   Canonical frontend layer map ของ Bazi ที่อธิบายว่า token, foundation, primitive, feature, และ spillover ต้องอยู่ตรงไหน

## 3. 🔄 Data Flow (The Pulse)
1. **Human/UI** -> (Raw Input) -> `POST /api/bazi/calculate`
2. **Symbolic Engine** -> ผูก 4 เสาจากเวลา local ของผู้ใช้โดยตรง -> แปลงเวลาเดียวกันไปเป็น HKT เฉพาะตอน lookup `bazi_time_solar_terms` และ canonical context -> อ้างอิง `bazi_twelve_qi_stages`, `bazi_sixty_jiazi_narratives` -> (Calculated State) -> **Human/UI**
3. **Local Queue Master** -> `scripts/generate-random-bazi.ts` -> สร้าง pending queue ที่มี Raw Input + Calculated State จาก symbolic engine เท่านั้น
4. **Copilot Sinsae Pipeline** -> `.github/agents/sinsae.agent.md` + `.github/skills/bazi-data-gen/SKILL.md` -> อ่าน queue ทีละ batch เล็ก -> สร้าง 15-Dimension draft annotations -> `scripts/import-agent-drafts.ts`
5. **API / Import Layer** -> Validate ด้วย Zod (`DraftAnnotationDataSchema` / `AnnotationDataSchema`) -> บันทึก `draft` หรือ `reviewed` ลง `bazi_dataset_records.annotation_data` (JSONB) ใน Neon DB
6. **Human Proofing Flow** -> ซินแสมนุษย์แก้ CoT/Prediction และเพิ่ม `sinsaeProofNote` ก่อนอนุมัติเป็น `reviewed`
7. **Local Operator Script** -> `scripts/export-sft-dataset.ts` -> ดึงเฉพาะ `status='reviewed'` -> แปลงเป็น ShareGPT/Alpaca-compatible JSONL บน Local Disk

## 4. 🐉 Challenges & Known Dragons
*   **ORM Tooling Limitations**: `drizzle-kit push` / `migrate` มีปัญหากับ Neon serverless driver และ TTY prompt ใน environment นี้ -> *Solution*: ใช้ Deterministic migration pipeline และ direct `psql` apply.
*   **Deep Reasoning Validation**: การรับประกันโครงสร้าง JSONB 15 มิติที่ถูกต้อง -> *Solution*: ผูก `Zod` validation เข้ากับ `CHECK` constraint ในระดับ DB
*   **Conflict Resolution**: ความรู้ Bazi มีความขัดแย้ง (เช่น ฮะแก้ชง) -> *Solution*: ใช้ Precedence Fixtures เป็นกฎให้ Symbolic Engine ใน Phase 2.
*   **Timezone Normalization**: เวลาสารทใน canonical tables ถูกเก็บเป็น HKT แต่หลักเวลาในดวงต้องยึด local time ของผู้เกิด -> *Solution*: ผูก 4 เสาจาก local time ก่อน แล้วค่อยแปลง timestamp เดียวกันไปเทียบ HKT boundary สำหรับ context เพิ่มเติมเท่านั้น
*   **Dataset Privacy**: งาน export training data ไม่ควรโผล่บน UI ของซินแส -> *Solution*: ย้าย phase 4 ไปเป็น headless local script และ ignore generated output artifacts ใน repo
*   **Agent Draft Integrity**: AI draft ห้ามสร้าง calculated state เองและห้าม bypass human proof note ตอน review -> *Solution*: บังคับ symbolic-engine-first queue, จำกัด skill contract, และ require `sinsaeProofNote` เมื่อ record เปลี่ยนเป็น `reviewed`
*   **Style Ownership Drift**: ถ้า selector ใหม่ถูกโยนลง global/spillover โดยไม่ classify ก่อน สถาปัตยกรรม frontend จะย้อนกลับไปเป็นกองเดียว -> *Solution*: ใช้ layer map ใน `docs/oracle-ui-exemplar.md` เป็นกฎตัดสินก่อนเพิ่ม style ใหม่ทุกครั้ง
