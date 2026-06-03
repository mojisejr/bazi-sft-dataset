# แผนงานระบบทำนายดวงจีน (Bazi) + Export DOCX

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

## Verification (ของที่ทำแล้ว)
```
npx vitest run tests/real-case-1993-11-24.test.ts tests/real-case-1988-06-08.test.ts \
  tests/real-case-dna-4-charts.test.ts tests/topic-knowledge-generalization.test.ts \
  tests/reading-docx.test.ts tests/reading-export-docx-route.test.ts
npm run export:docx -- 1966-09-29 11:44 female "Bangkok" out/case1.docx   # ต้องมี DATABASE_URL ใน .env
```
เปิด out/*.docx ตรวจ: ปก + แผ่นดวง + 15 บท (บท1 ขึ้น imagery) + บทเสริมตารางวัยจร