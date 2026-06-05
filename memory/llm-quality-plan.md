---
name: llm-quality-plan
description: แผนทำให้ LLM polish ทำนายดี (รอทำหลังแก้ engine บท 1-15 ครบ)
metadata:
  type: project
---

ผู้ใช้อยากให้ "โหมด LLM" ทำนายดีด้วย (ไม่ใช่แค่ engine-only). ตกลงไว้ว่า **ทำหลังแก้ engine ครบบท 1-15 ก่อน** แล้วค่อยกลับมาทำ.

**Why LLM แย่ตอนนี้ (วินิจฉัยจาก `reading-llm.ts` + `api/reading/topic/route.ts`):** ท่อ ground LLM ด้วย engine `humanKnowledge`+`engineSignals` อยู่แล้ว และมีกฎเหล็กห้ามแต่ง แต่:
1. โมเดล default = `gemini-3.1-flash-lite` (reading-llm.ts:13) เล็กไป → สรุป/ตัด/มั่ว (เช่นจัด "การศึกษา" ผิดทั้งที่ engine ถูก)
2. เพดานคำ "~150 คำ/8 bullet" (reading-llm.ts:194) บังคับตัด; **career_potential ไม่มี `preserveDetail`** → ลิสต์อาชีพถูกบีบทิ้ง
3. ไม่มีด่านตรวจความซื่อสัตย์หลัง LLM ตอบ (ต่างจาก polishRelationshipLinesLlm ที่มี fallback)

**How to apply (แผนที่แนะนำ B+C ก่อน, A ถ้าไม่พอ):**
- **B (ฟรี):** ใส่ `preserveDetail` ให้ `career_potential` (+ chart_foundation นิสัย) ใน `READING_TOPIC_PROMPTS` เพื่อปลดเพดานคำและบังคับคงลิสต์ครบ
- **C (ปลอดภัย):** เพิ่ม faithfulness gate — หลัง `generateReadingTopicLlm` เช็คว่า token สำคัญจาก engine (อาชีพแต่ละตัว/เซียงแซแต่ละตำแหน่ง/สี) อยู่ครบ ถ้าหาย → retry หรือ fallback ใช้ engine humanReading
- **A (มีค่าใช้จ่าย):** เปลี่ยน default model เป็น Gemini ตัวเต็ม/Pro หรือ provider `opencode` (claude-sonnet-4-5 ตั้งไว้แล้ว) อย่างน้อยเฉพาะบทลิสต์หนัก

**เป้าหมายสไตล์ = "Your Life Code"** (6 ไฟล์ใน `example/your life code*.docx`) — รายงานร้อยแก้วลื่น 15 บท โครงเดียวกับ TOPIC_PATH มีภาพเปรียบธาตุ/bullet/⚠️/❌/บรรทัดสังเคราะห์ (ผู้ใช้ยืนยันให้อ้างอิงทั้ง 6). **ไม่เอาฉายา/archetype.**

**Pilot (ทำแล้ว):** บท chart_foundation + talent (+ career_potential ใส่ preserveDetail). ใน `reading-llm.ts`:
- `buildSystemInstruction` เขียนใหม่เป็นสไตล์ YLC (ร้อยแก้ว+bullet+⚠️/❌, คงข้อเท็จจริงครบ, ห้ามฉายา) แทนกฎ "ไม่เกิน 150 คำ" เดิม
- เพิ่ม `verifyReadingFaithful(engineText, llmText, 0.85)` + retry 1 ครั้ง → ถ้ายังตัดข้อเท็จจริง (ธาตุ/เซียงแซ/อายุ/ป้าย) ไม่ครบ **fallback ใช้ engine text** (การันตีไม่แย่กว่า engine)
- default model ยังเป็น flash-lite (ผู้ใช้เลือกลองก่อน)
- ทดสอบสไตล์จริงต้องมี API key (รัน LLM mode ใน workspace) — ผมรันเองไม่ได้

**Pilot ผ่านแล้ว (รัน flash-lite จริงด้วย GEMINI_API_KEY ใน .env):** chart_foundation + talent ออกมาเป็น YLC prose สวย ซื่อสัตย์ ไม่มีฉายา — flash-lite เพียงพอ ไม่ต้องอัปเกรดโมเดล. ปรับ gate: `verifyReadingFaithful` normalize สะกด เซี่ยงแซ/เชี่ยงแซ + threshold = 0.6 (0.85/0.7 เข้มเกิน ตี prose ดีตก เพราะ prose เลี่ยงคำ methodology "12 เชี่ยงแซ"). gate ยังจับการตัดหนัก→fallback engine ได้.

**Pilot บท 2+3 ผ่านแล้ว:** career_potential คงลิสต์อาชีพครบ + wealth_and_investment คง 2-เซียงแซรายตำแหน่งครบ, สไตล์ YLC, gate pass. **เจอ+แก้ bug ข้อมูล:** `source7-enhancement.txt` บรรทัดธาตุไม้เคยมี "การศึกษา" (ผิด — ควรเป็นธาตุไฟ ตามที่ผู้ใช้ flag ตั้งแต่แรก) → ย้ายไป "วิชาการ/ครู/การศึกษา" ในธาตุไฟ. ยืนยัน flash-lite ตาม engine ที่แก้แล้วเป๊ะ (ไม่ re-hallucinate). บทเรียน: gate จับ element/qi ได้แต่ไม่จับ miscategorization ของ list item — ต้องแก้ที่ source/engine.

**Rollout เสร็จครบ 15 บทแล้ว:** ใส่ `preserveDetail` ครบทุกบท (4,6-15) ใน `READING_TOPIC_PROMPTS` + system instruction เป็น global สไตล์ YLC. ทดสอบ flash-lite จริงผ่าน 7 บทหลากหลาย (1,2,3,5,4,11,15) — ผ่าน gate + YLC prose + ลิสต์ครบทุกบท (เช่น บท11 ลิสต์คณะเต็ม, บท15 เทพครบ). อัปเดต turning_points preserveDetail ให้ตรงบท12 ฉบับสั้น (ป้าย [ยุคทอง]/[เฝ้าระวัง] รายช่วง ไม่ใช่ 8-ตัว).

**Eval 6 เคส YLC (รัน flash-lite จริง):** (1) **เสา engine ถูก 6/6** — เทียบ YLC ตรง 4/6, อีก 2 เป็น error ของรายงาน YLC เอง (กัญญารัตน์ผังสับสน/ปีผิด, เกศสรินทร์ยามคลาดเวลา). (2) บท1 ทั้ง 6 ได้ YLC prose ซื่อสัตย์ หลังปรับ: **gate เปลี่ยนเป็นนับเฉพาะธาตุ+อายุ+ป้าย (ไม่นับชื่อเซียงแซ เพราะ prompt สั่งแปลเป็นภาษาคน) threshold 0.5**, และเข้ม prompt บท1 ห้าม bleed อาชีพ/คณะ/สี/อายุ/เทพ + ห้ามลงท้ายครับ/ค่ะ. (3) **ข้อจำกัด:** flash-lite แปรปรวนกับดวงที่ธาตุเยอะ (บางรอบ bleed/ครับ) gate+fallback กันได้แต่ถ้าอยากนิ่งกว่านี้ควรอัปโมเดล. (4) **data gap (แก้แล้ว):** บางหลักวัน (เช่น 甲辰) ไม่มี record ใน 60-กะจื่อ personality → `buildPersonalityReading` เพิ่ม fallback ใช้ `index.stemText.get(ดิถี)` เมื่อไม่มีคู่ ก้าน|กิ่ง → บท1 มีนิสัยก้านเสมอ.

**กัญญารัตน์ + เกศสรินทร์ "ไม่ตรง YLC" = error ในรายงาน YLC เอง ไม่ใช่ engine:** กัญญารัตน์ ตาราง header ใน docx มั่ว (ยาม 壬午 เป็นไปไม่ได้, ปี辛亥 ทั้งที่ 2002=壬午) แต่เนื้อ บท1 ของ YLC ใช้ 甲 ดิถีอ่อน = ตรง engine. เกศสรินทร์ เกิด 02:10=丑時 → engine 乙丑 ถูก, YLC เอาลัคนา 丙寅 มาใส่ช่องยาม + เนื้อหาเขียนเดือนขาล寅/ใบไม้ผลิผิด (จริง=丑/หนาว ก่อน立春). engine ไม่ต้องแก้.

**การใช้ LLM ใน doc export จริง:** เอา topicId ออกจาก `ENGINE_ONLY_TOPIC_IDS` (ReadingPathWorkspace.tsx) แล้วผู้ใช้เลือกโหมด LLM — gate จะ fallback engine อัตโนมัติถ้า LLM ตัดข้อเท็จจริง. ปัจจุบันยังตั้ง engine-only บท1-15 ไว้ (ปลอดภัย) รอผู้ใช้ตัดสินใจเปิด LLM ทีละบท.

ดู [[doc-export-engine-vs-llm]].
