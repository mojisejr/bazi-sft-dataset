# แผนงานระบบทำนายดวงจีน (Bazi) + Export DOCX

---
# ▶ สรุปล่าสุด + แผนถัดไป (อัปเดตรอบนี้)

## สิ่งที่ทำเสร็จแล้ว (ภาพรวมทั้งหมด)
- **Engine คำทำนาย deterministic ครบ 15 บท** (`src/lib/bazi/topic-knowledge.ts` + `reading-phrases.ts`): โครง intro → เนื้อหา engine → บทสรุปเฉพาะบท
- **หลักวิชาที่ฝัง**: ดิถีแข็ง-อ่อน→useful god, 病药/食傷制杀, 12 เชี่ยงแซ 3 ระดับ, imagery ดิถี×ฤดู, ตำแหน่งเสา, คู่ครอง(ชาย=ลาภ/หญิง=อำนาจ), สุขภาพธาตุขาด-ล้น
- **หัวข้อย่อยครบตาม your life code**: อาชีพไม่ควรทำ, สีเลี่ยง/กระเป๋า/รถ/ทิศ/สัญลักษณ์, สรรพคุณเทพรายธาตุ, ช่วงอายุพบคู่(≥20)/หุ้นส่วน, ป้ายยุคทอง/เฝ้าระวัง, ลาภผล(passive/ก้อน)+ช่วงวัยโชคลาภ, ช่วงเสี่ยงสุขภาพ
- **ความสามารถใหม่ (ข้อ 4)**: ดาวเอี้ยม่า(驿马)→ช่องทางออนไลน์/ต่างประเทศ, liu nian ปีจรปัจจุบัน, mapping ธาตุเสาปี→กลุ่มลูกค้า
- **กฎอายุ**: <20 ปี เรื่องคู่ไม่ดู / การเงิน-การงาน = การเรียน/สอบ/ติดโรงเรียนดัง
- **บทสรุปต่อบทไม่ซ้ำกัน** (`CHAPTER_SUMMARY_TH`)
- **Export .docx**: module + API route + CLI + ปุ่มใน UI (รับ override ฉบับ LLM)
- **LLM**: provider Gemini + OpenCode Zen; `DEFAULT_MODEL = gemini-3.1-flash-lite` (แก้จาก preview เก่า)
- **ทดสอบจริง 12 ดวงอ้างอิง** (M/1.docx, DNA 4, your-life-code 6) + LLM เจนผ่าน gemini-3.1-flash-lite เทียบ 2 เคส
- **เทสต์**: 481 passed / 14 failed (14 เป็น corpus pre-existing ไม่เกี่ยวงานนี้)

## ผล LLM เทียบ doc (gemini-3.1-flash-lite) — ช่องว่างที่เหลือ = ที่ prompt ล้วน
1. บท1 บุคลิก **drift เป็น archetype** ("ผู้นำ") ทิ้งนิสัยจาก excerpt (เมตตา/ยอมคน)
2. ยาวเกิน (4 ย่อหน้าใหญ่ทุกบท)
3. คำลงท้าย "...ครับ" ทุกบท (ควรเป็นกลาง)
4. บางครั้งอ้างตำราแข็งทื่อ

## ▶ แผนถัดไป (เสนอ)

### P-A: แก้ prompt LLM (ทำก่อน — คุ้มสุด)
แก้ `buildSystemInstruction` + `buildUserPrompt` ใน `src/lib/bazi/reading-llm.ts`:
- บังคับ **ยึดข้อเท็จจริง/นิสัยจาก excerpt เท่านั้น ห้ามเติม archetype ธาตุ**
- คุมความยาว **2-3 ย่อหน้า กระชับ**
- อ้างแหล่งครั้งเดียวแบบแนบเนียน (ห้ามขึ้นต้น "อย่างที่ตำรา...")
- **คงป้าย [ยุคทอง]/[เฝ้าระวัง] + ช่วงอายุ/ตัวเลข/ธาตุ ตามที่ให้มาเป๊ะ**
- โทน/คำลงท้ายเป็นกลาง (ไม่ผูกเพศ), โทนตรงกำลังดิถี (อ่อนอย่าเขียนให้ดูแข็ง)
- Verify: เจนซ้ำ 2-3 ดวง เทียบว่า บท1 ตรง book, ≤3 ย่อหน้า, ป้าย/อายุไม่เพี้ยน (ต้องมี Gemini API key)

### P-B: liu nian รายปีแบบเต็ม (deferred — engine feature ใหญ่)
ปัจจุบันคิดปีปัจจุบัน 1 ปี. การพยากรณ์เหตุการณ์แม่นรายปีหลายปี ("อายุ 48-52 เห็นเงินก้อน") ต้องวนคำนวณเสาปีทุกปี + ปฏิสัมพันธ์รายปี (ใช้ lunar-javascript) — แยกเป็น engine module ใหม่

### P-C: ขัดเกลาเพิ่ม (ทางเลือก)
- band classifier จูน threshold (case3 丙 score 4.25 ควร "แข็งมาก")
- DOCX: ปกกราฟิก, ฝังฟอนต์ไทย, สารบัญ
- mapping กลุ่มลูกค้า/ช่องทาง ละเอียดขึ้น (จากดาวหลายตำแหน่ง)

### ความปลอดภัย (ต้องทำ)
**Revoke Gemini API key ที่เผยในแชต** แล้วออกใหม่ก่อนทดสอบ LLM รอบถัดไป

---

## Context

เป้าหมายสุดท้าย: ผู้ใช้กรอกวันเกิด → ระบบทำนายครบ 15 มิติ → **export เป็นไฟล์ .docx** ที่คุณภาพใกล้เคียงเอกสารต้นฉบับ "DNA ดวงจีน" (gold standard 4 ฉบับ) และ M.docx / 1.docx

ปัญหาเดิมที่แก้ไปแล้ว: คำทำนายจาก knownlage ไม่ตรงตำรา, ตารางวัยจรไม่คิด 12 เชี่ยงแซ, useful god เพี้ยนเมื่อดิถีอ่อนมาก, ฯลฯ — แก้โดยยึด "หลักการทั่วไป" ไม่ overfit ดวงเดียว (ยืนยันด้วย 6 ดวงอ้างอิง)

---

## สิ่งที่ทำเสร็จแล้ว (DONE)

### A. แก้ความถูกต้องของคำทำนาย (`src/lib/bazi/topic-knowledge.ts`)
1. **ตารางวัยจร (Relationship Lines) คิด 3 มิติ** — `buildLuckPhaseVerdict`: บทบาทธาตุ × 12 เชี่ยงแซ (rising/transitional/falling) × ดิถีแข็ง-อ่อน → ช่วง `ซี่/แป่` ขึ้น `[เฝ้าระวัง]` ถูกต้อง (เดิมคิดแค่ role)
2. **age-aware** — อายุ ≤ 20 ปี: การงาน/โชคลาภ ตีความเป็น "การเรียน" (`ROLE_INFLOW_SCHOOL_TH`)
3. **useful god — `resolveUsefulElements`**
   - `very-weak` ใช้ `[resource, peer]` (เดิมตัดเหลือ peer ทำให้ขาดธาตุหลัก)
   - **病药/食傷制杀**: ดิถีอ่อน + ดาวอำนาจ(杀)ล้นเกิน + output ยังไม่ล้น → ใช้ `[resource, output]` (output คุม officer เสมอตามวงจร 5 ธาตุ)
4. **บท5 พรสวรรค์** — `buildTalentReading` อิงดาวถ่ายเท + 12 เชี่ยงแซ (เดิมซ้ำบท1)
5. **บท7 ความรัก** — เพิ่มชั้นดาวคู่ครอง (ชาย=ลาภ/หญิง=อำนาจ) × กำลัง × จานคู่
6. **บท13 สุขภาพ** — เพิ่มมิติ "ธาตุล้นเกิน" (`EXCESS_HEALTH_TH`) + วิธีแก้ด้วย useful god
7. **บท3 โชคลาภ** — `buildWealthReading` คิดจากตำแหน่งดาวลาภ × กำลัง × ดิถี
8. **imagery บท1** — `buildDayMasterImagery`: ภาพดิถี×ฤดู×ธาตุล้อมรอบ (穷通宝鉴 style) + ตรวจ "ธาตุดิถีล้นเกิน" (ไม่พึ่ง band classifier)
9. **หมกยก (沐浴)** ออกจาก `GOOD_QI` (ตำราถือว่าผันผวน ไม่ใช่เชี่ยงแซดี)

### B. Provider LLM (`src/lib/bazi/reading-llm.ts`, route, workspace)
- เพิ่ม OpenCode Zen (OpenAI-compatible) ข้าง Gemini + dropdown เลือก provider; API key ช่องเดียวด้านบน

### C. Export DOCX (เป้าหมายหลัก)
- `src/lib/bazi/reading-docx.ts` — `buildReadingDocument/Buffer` (ปก + แผ่นดวง + 15 บท + บทเสริม), รับ `readings` override (ฉบับ LLM)
- `src/app/api/reading/export-docx/route.ts` — POST → คืน .docx
- `scripts/export-reading-docx.ts` + npm `export:docx` — CLI
- ปุ่ม "ดาวน์โหลด .docx" ใน `ReadingPathWorkspace.tsx` (ใช้คำอ่านบนจอ รวมฉบับ LLM)

### D. Regression tests (กัน overfit)
- `tests/real-case-1993-11-24.test.ts` (己 ดิน ชาย — M.docx)
- `tests/real-case-1988-06-08.test.ts` (甲 ไม้ หญิง — 1.docx)
- `tests/real-case-dna-4-charts.test.ts` (4 ดวง DNA: ดิถี+เสา+useful god+imagery)
- `tests/topic-knowledge-generalization.test.ts` (invariant 3 ดวง)
- `tests/reading-docx.test.ts`, `tests/reading-export-docx-route.test.ts`
- สถานะ: **469 passed / 14 failed** (14 เป็น corpus-dependent เดิม ไม่เกี่ยวกับงานนี้)

---

## องค์ความรู้ (doctrine) ที่ฝังในระบบ

- **ดิถีแข็ง-อ่อน → useful god**: อ่อน=印(resource)+比(peer); แข็ง=食傷(output)/财(wealth)
- **病药/食傷制杀**: output ของดิถีควบคุม officer เสมอ (金→水ดับ火) → ใช้คุมเมื่อ官杀ล้น
- **12 เชี่ยงแซ 3 ระดับ**: rising(长生/冠带/临官/帝旺) / transitional(沐浴/胎/养) / falling(衰/病/死/墓/绝)
- **ตำแหน่งเสา**: ปี=สังคม/บรรพบุรุษ, เดือน=การงาน/พ่อแม่, วัน=ตัวเอง/คู่, ยาม=บริวาร/บั้นปลาย
- **คู่ครอง**: ชาย=财(ลาภ), หญิง=官杀(อำนาจ)
- **สุขภาพ**: ธาตุอ่อน=อวัยวะนั้นป่วย + ธาตุล้นเกินกดทับร่างกาย
- **调候 imagery**: 10 ดิถี × 4 ฤดู → ภาพธรรมชาติ
- **อายุวัยเรียน (≤20)**: การงาน/โชคลาภ = การเรียน

---

## ข้อเสนอแนะ / งานที่ยังเหลือ (BACKLOG)

### P1 — LLM polish style เลียน DNA ดวงจีน (คุ้มค่าสุด)
ปรับ prompt ใน `reading-llm.ts` (`READING_TOPIC_PROMPTS`/`buildSystemInstruction`) ให้:
- เปิดด้วยภาพธรรมชาติ (ใช้ imagery จาก engine เป็น ground)
- โทนซินแสเล่าเรื่อง ยาวขึ้น แบ่งย่อหน้า
- ground จาก engine truth เท่านั้น (ห้าม invent เสา/ธาตุ/ตัวเลข)
เพราะ doc เป็นร้อยแก้วยาว — ต้องใช้ LLM ปิด gap "ถ้อยคำรายบท" (กลไก override พร้อมแล้ว)

### P2 — band classifier ละเอียดขึ้น
`classifyOperatorStrengthScore` จัด score 4.25 (case3) เป็น "balanced" ทั้งที่ควร "แข็งมาก" — ปัจจุบันเลี่ยงผลกระทบด้วยการเช็ค `resolveExcessElements` ใน imagery แต่ระยะยาวควรจูน threshold (เสี่ยง: ใช้ทั่ว codebase ต้องมี test ครอบหนาแน่นก่อน)

### P3 — DOCX ให้สวยใกล้ต้นฉบับ
- เพิ่มตารางวัยจร 8 ช่วง (Da Yun) บนแผ่นดวง, หน้าปกมีกราฟิก, ฟอนต์ไทยฝังในไฟล์, สารบัญ 15 หมวด
- (ปัจจุบันใช้ฟอนต์ Tahoma ผ่าน styles)

### P4 — ไล่เทียบถ้อยคำรายบท 4-15 ทั้ง 4 ดวง
ทำเป็น checklist ทีละบท เทียบ engine vs doc แล้วเพิ่ม knowledge ที่ขาด (เช่น บท12 turning points เจาะลึก 20 ปีข้างหน้าแบบ doc)

### P5 — UI ครบวงจร
ปุ่ม export อยู่แล้ว; ควรเพิ่ม progress ตอน LLM polish ทั้ง 15 บทก่อน export + preview

---

---

# งานใหม่: Narrative Composer ทั้ง 15 บท (สไตล์ "your life code") — deterministic

## Context
ตอนนี้คำทำนายฝั่ง engine เป็น "ข้อความสั้นเชิงโครงสร้าง" (1-3 ประโยค/บท) แต่เอกสารต้นฉบับ your life code / DNA ดวงจีน เป็น **ร้อยแก้วเรียบเรียง 3-6 ย่อหน้า/บท** (เปิดด้วยคอนเซ็ปต์/ภาพ → เจาะจงดวงนี้ → ดี-ร้าย → คำแนะนำลงมือ)
เป้าหมาย: ให้ **engine (deterministic, ไม่ต้องใช้ LLM/API)** ออกคำทำนายยาว-เรียบเรียงครบทั้ง 15 บท โดย**คงความถูกต้องจาก engine truth** และต่อยอด knowledge เดิม (ไม่ทิ้ง knownlage)
แนวทางที่เลือก: **Template Composer + คลังถ้อยคำ (curated phrase library)** — เพิ่มองค์ความรู้เป็น "ข้อมูล TS ที่มีโครงสร้าง" ไม่ใช่ free-text docx

## โครงสร้างคำทำนายต่อบท (เลียนเอกสาร)
1. **Intro (คอนเซ็ปต์)** — ข้อความตั้งต้นต่อบท (เช่น บท2 "อาชีพดูที่ดิถีแข็ง/อ่อน...")
2. **Body** — สร้างจาก engine facts (ดาว/ตำแหน่งเสา/แข็ง-อ่อน/12 เชี่ยงแซ) ร้อยด้วยคลังถ้อยคำ → 1-3 ย่อหน้า
3. **Advice (คำแนะนำ)** — ผูกกับ useful god + band → ย่อหน้าปิดเชิงปฏิบัติ

## ไฟล์
- **NEW `src/lib/bazi/reading-phrases.ts`** (knowledge เพิ่ม): คลังถ้อยคำ deterministic
  - `CHAPTER_INTRO_TH: Record<topicId,string>` (15 คอนเซ็ปต์เปิดบท)
  - `ELEMENT_PERSONA_TH`, `ROLE_NARRATIVE_TH`, `QI_NARRATIVE_TH`, `USEFUL_GOD_ADVICE_TH`, `BAND_LIFE_TH` (ขยายจากของเดิม)
  - `composeChapter(intro, bodyParagraphs[], advice)` helper รวมย่อหน้า
- **EDIT `src/lib/bazi/topic-knowledge.ts`**: refactor 15 builder ให้ compose intro+body+advice
  - **กฎสำคัญ: คงวลี/มาร์กเกอร์ที่เทสต์ assert ไว้** (เช่น `[เฝ้าระวัง]`, `ดาวโชคลาภ (ธาตุX)`, `หลักปี`, `แนวทางดูแล`, `ดาวคู่ครอง`, `จานคู่`, `ดาวถ่ายเท`, `อาชีพธาตุX`, `เมตตา`/`อิสระ`) → เพิ่มร้อยแก้วรอบ ๆ ไม่ลบของเดิม
- DOCX/LLM: ไม่ต้องแก้ — `buildReadingDocx` กับ LLM ground ใช้ `buildTopicHumanReading` อยู่แล้ว ได้ข้อความยาวอัตโนมัติ

## Reuse (มีอยู่แล้วใน topic-knowledge.ts)
`resolveUsefulElements`, `resolveStrengthBand`, `resolveRelationRole`, `dayMasterElement`, `pillarBranchQi`, `buildDayMasterImagery`, `RELATION_ROLE_SHORT`, `EXCESS_HEALTH_TH`, `classifyQiTier`/`VERDICT_MATRIX`, `ROLE_INFLOW_TH`, `parseSource7Careers`, `parseSource7ElementSection`, `parseLoveByGenderBand`, `getPersonalityIndex`; `TOPIC_PATH` (`topic-path.ts`)

## Phasing
- **A. Scaffolding** — สร้าง `reading-phrases.ts` + `CHAPTER_INTRO_TH` 15 บท + `composeChapter` + advice ตาม band/useful god; ครอบทุก builder ด้วย intro+advice (ยกระดับทันที ความเสี่ยงต่ำ)
- **B. Enrich body รายกลุ่ม** (คงคีย์เวิร์ดเทสต์):
  - กลุ่ม 1 บุคลิก/พรสวรรค์ (1,5)
  - กลุ่ม 2 อาชีพ/โชคลาภ/หุ้นส่วน (2,3,9)
  - กลุ่ม 3 ความสัมพันธ์ (6,7,8,10)
  - กลุ่ม 4 อุปถัมภ์/เรียน/วัยจร/สุขภาพ/สี/เทพ (4,11,12,13,14,15)
- **C. จูนความยาว + อัปเดตเทสต์** — เพิ่ม assertion "มี intro/หลายย่อหน้า" ใน reference tests; รัน 12 ดวงอ้างอิงให้ผ่านครบ

## Verification (งานใหม่)
```
npx vitest run tests/real-case-1993-11-24.test.ts tests/real-case-1988-06-08.test.ts \
  tests/real-case-dna-4-charts.test.ts tests/real-case-yourlifecode-6-charts.test.ts \
  tests/topic-knowledge.test.ts tests/topic-knowledge-generalization.test.ts \
  tests/reading-docx.test.ts
npx eslint src/lib/bazi/reading-phrases.ts src/lib/bazi/topic-knowledge.ts
```
- ตรวจ: ทุกบทของดวงตัวอย่างมี ≥3 ย่อหน้า (intro+body+advice), คีย์เวิร์ด ground truth ยังอยู่ครบ, export .docx ยาวขึ้นและเปิดได้
- เทียบสายตากับ your life code 2-3 ดวง (กัญญารัตน์/สิริกัญญา/เจ้าชะตา B) ว่าโทน/โครงใกล้เคียง

---

## Verification (ของที่ทำแล้ว — งานเดิม)
```
npx vitest run tests/real-case-1993-11-24.test.ts tests/real-case-1988-06-08.test.ts \
  tests/real-case-dna-4-charts.test.ts tests/topic-knowledge-generalization.test.ts \
  tests/reading-docx.test.ts tests/reading-export-docx-route.test.ts
npm run export:docx -- 1966-09-29 11:44 female "Bangkok" out/case1.docx   # ต้องมี DATABASE_URL ใน .env
```
เปิด out/*.docx ตรวจ: ปก + แผ่นดวง + 15 บท (บท1 ขึ้น imagery) + บทเสริมตารางวัยจร