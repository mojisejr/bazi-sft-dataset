# Bazi SFT Dataset Collector - Project Map

## 1. 🧠 Philosophy (The Vibe)
**Bazi AI Annotation & Inference System**
โปรเจกต์นี้คือ Neuro-Symbolic AI Application เชิงลึกสำหรับทำ Data Annotation ด้านโหราศาสตร์จีน (Bazi) เพื่อนำ Dataset ที่ได้ไปทำ Supervised Fine-Tuning (SFT) ให้กับ LLM 
*   **Safety First**: ฐานข้อมูลและการ Migration มี Guardrails สูงสุด (Deterministic, Preflight Checks) ห้ามลบข้อมูลทิ้งโดยไม่จำเป็น
*   **Contract Driven**: การเชื่อมต่อระหว่าง AI Engine, Database, และ UI ถือครอง Truth ไว้ที่ Zod Schema อย่างเข้มงวด

## 2. 🗺️ Key Landmarks (The Territory)
*   `src/db/`:
    *   `schema.ts`: Drizzle Schema Definition (Single Source of Truth สำหรับ Database)
*   `src/lib/bazi/`:
    *   `schema-types.ts`: Zod Contracts สำหรับ 15-Dimension Annotation, Raw Input, และ Calculated State (Single Source of Truth สำหรับ API และ UI)
*   `scripts/`:
    *   แหล่งรวม Safety Scripts & Guards สำหรับ Migration (เช่น `generate-phase16-migration.ts`, `apply-phase16-migration.ts`, `check-phase16-db-state.ts`) เพื่อหลีกเลี่ยงข้อจำกัดของ tooling (non-TTY, websocket limitations)
*   `drizzle/`:
    *   SQL Migrations ที่ generate ออกมาแบบ Deterministic
*   `tests/`:
    *   ชุดทดสอบสำหรับการทำ Hard Gate ในแต่ละ Phase อย่างเคร่งครัด

## 3. 🔄 Data Flow (The Pulse)
1. **Human/UI** -> (Raw Input) -> `POST /api/bazi/calculate`
2. **Symbolic Engine** -> อ้างอิง Canonical Knowledge ตาม Precedence Rules -> (Calculated State) -> **Human/UI**
3. **Human/UI** -> ตรวจสอบและกรอก 15-Dimension Annotation & CoT -> `POST /api/dataset/save`
4. **API** -> Validate ด้วย Zod `AnnotationDataSchema` -> บันทึกลง `bazi_dataset_records.annotation_data` (JSONB) ใน Neon DB

## 4. 🐉 Challenges & Known Dragons
*   **ORM Tooling Limitations**: `drizzle-kit push` / `migrate` มีปัญหากับ Neon serverless driver และ TTY prompt ใน environment นี้ -> *Solution*: ใช้ Deterministic migration pipeline และ direct `psql` apply.
*   **Deep Reasoning Validation**: การรับประกันโครงสร้าง JSONB 15 มิติที่ถูกต้อง -> *Solution*: ผูก `Zod` validation เข้ากับ `CHECK` constraint ในระดับ DB
*   **Conflict Resolution**: ความรู้ Bazi มีความขัดแย้ง (เช่น ฮะแก้ชง) -> *Solution*: ใช้ Precedence Fixtures เป็นกฎให้ Symbolic Engine ใน Phase 2.
