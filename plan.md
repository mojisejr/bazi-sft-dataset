# แผนงานระบบทำนายดวงจีน (Bazi) + Export DOCX

---
# ▶ สรุปล่าสุด + แผนถัดไป (อัปเดตรอบนี้)

## ✅ สถานะล่าสุด — เสร็จครบทั้งหมด (อัปเดตรอบนี้)

**Engine + Knowledge (deterministic 15 บท)** — `topic-knowledge.ts`, `reading-phrases.ts`, `symbolic-engine.*`
- หลักวิชาฝังครบ: ดิถีแข็ง-อ่อน→useful god, 病药/食傷制杀, 12 เชี่ยงแซ 3 ระดับ, imagery ดิถี×ฤดู, ตำแหน่งเสา, คู่ครอง(ชาย=ลาภ/หญิง=อำนาจ), สุขภาพขาด-ล้น, ดาวเอี้ยม่า/ดอกท้อ, กฎอายุ <20
- **กำลังดิถี (band) ครบ 3 เสาตามตำรา**: 得令 (A2:ฤดู), 得地 (A2:ราก通根), 得势 (favorable ผิวบน) → band ต่อเนื่องไม่มีช่องว่าง
- **วัยจรอิงอายุเริ่มจริง 起运** (A1: `yun.getStartYear()`) — บท 7/9/12 + ตารางวัยจร 5 ปี + พยากรณ์รายปี (liu nian 20 ปี) แม่นตามอายุจริง
- **timing หลายปัจจัย** (A3): หุ้นส่วน = คู่ธาตุ + ดาวส่งเสริม(ผู้ใหญ่/ทุน) + **ดาวลาภ(เงินก้อนจากร่วมลงทุน)**
- **พรสวรรค์แยก 食神/傷官 + 印** (A4) · **โชคลาภ: มรดก/ลูกค้าอายุน้อย/นายหน้า/เสน่ห์** (A5) · **mapping ลูกค้า/ช่องทาง** หลายดาว

**LLM (เรียบเรียง)** — `reading-llm.ts`
- สไตล์ **กระชับ scannable = กรอบสั้น + bullet + ปิด 1 บรรทัด** (เหมือน your life code) โทนข้อมูลล้วน
- กฎเหล็ก: ห้ามเติมนิสัยนอก ground (B1), imagery เฉพาะบท1 (B2), **บท1 เรียงจุดบวกก่อน ระวัง ≤1 ข้อท้าย**, คงป้าย/อายุ/ตัวเลข/ธาตุเป๊ะ, ไม่อ้างแหล่ง, โทนตรงกำลังดิถี, ไม่ลงท้าย ครับ/ค่ะ
- provider Gemini + OpenCode Zen; `DEFAULT_MODEL = gemini-3.1-flash-lite`

**Export .docx** — ปกกรอบสีมงคล + สารบัญ(TOC) + เลขหน้า + ตารางวัยจร 5 ปี + บทเสริม(LLM แต่งคำ) + รับ override ฉบับ LLM

**ตรวจสอบ**
- เทสต์: **483 passed / 14 failed** (14 = corpus pre-existing ไม่เกี่ยวงานนี้) — 0 regression ตลอด
- Verify จริง Gemini: `scripts/verify-reading-llm.ts` (ผ่านทุกเกณฑ์) + เทียบ your life code 6 เคสทีละบท (`out/ylc-compare/`)

## ▶ แผนถัดไป (เสนอ) — เรียงตามความคุ้ม

### N1 — Commit + ความปลอดภัย (ทำก่อน, จำเป็น)
- งานทั้ง session **ยังไม่ได้ commit เลย** → สร้าง branch + commit เป็นชุด (engine A1-A5 / prompt B1-B2+กระชับ / docx / liu nian) กันหาย
- **Revoke Gemini API key** เก่าถ้าเคยหลุดในแชต แล้วออกใหม่

### N2 — Production data backfill (กัน regression เงียบจาก A2)
- A2 ทำให้บางดวง reclassify (เช่น 己 → "แข็งแรง/สมดุล") → **DB ต้องมี profile ครบทุก (dayMaster × strengthState)** ใน `bazi_day_master_strength_states` ไม่งั้น narrative fallback เป็น "score X"
- ตรวจ/เติม profile ที่ขาด (เริ่มจาก state "แข็งแรง/สมดุล" ของดิถีที่พบบ่อย)

### N3 — A2 รอบสอง: band ให้แม่นระดับ "แข็งมาก" (ทางเลือก, ต้องมี dataset)
- ตอนนี้ band ถูกระดับหลัก แต่สิริกัญญาได้ "แข็ง" (doc "แข็งมาก") ต่าง 1 ระดับ
- ต้องมี: **labeled dataset ครอบ "สมดุล/แข็งมาก" 3-5 ดวง** + เพิ่ม **โมเดล drainage/官杀 pressure** (ดวงถูกธาตุพิฆาตล้อมควรอ่อนแม้มีราก) — ดูรายละเอียด P2 → A2 ด้านล่าง

### N4 — ขัดเกลาเพิ่ม (ทางเลือก)
- บท5 พรสวรรค์: เน้น 傷官=วาทศิลป์ ให้ชัดขึ้นในบาง doc (เล็ก, โครงดวงถูกอยู่แล้ว)
- DOCX: ฝังฟอนต์ Sarabun (OFL) จริง ถ้าจะแจกไฟล์ข้ามเครื่อง
- รัน verify/เทียบ your life code ทั้ง 6 เคสเป็น regression ประจำหลังแก้ prompt

---

## บันทึกรายละเอียดงานที่ทำแล้ว (history)

### P-A: prompt LLM — ✅ ทำ + VERIFIED
- ยึด excerpt/ห้าม archetype, คงป้าย/อายุ/ธาตุเป๊ะ, โทนกลาง, ตรงกำลังดิถี, ไม่อ้างแหล่ง + ภายหลังปรับเป็น **กระชับ bullet** (สไตล์ your life code) + บท1 เรียงบวกก่อน
- ✅ VERIFIED (`scripts/verify-reading-llm.ts`): บท1 ไม่ drift archetype, ไม่มี ครับ/ค่ะ, ไม่อ้างแหล่ง, กระชับมี bullet, คงป้าย

### P-B: liu nian รายปีแบบเต็ม — ✅ ทำแล้ว (รอบล่าสุด)
- `buildLiuNianSeries` ใน `symbolic-engine.birth.ts` — แบนปีจรจากทุกเสาวัยจร กรอบ [อายุปัจจุบัน, +20 ปี]
- schema `liuNianSeries` (`LiuNianYearSchema`: year/age/stem/branch/twelveQiDisplay) — serialize ใน `symbolic-engine.ts` พร้อม 12 เชี่ยงแซของกิ่งปี
- `buildLiuNianYearlyForecast` ใน `topic-knowledge.ts` — คิดบทบาทธาตุ+12เชี่ยงแซรายปี แล้ว**จับกลุ่มปีคุณภาพคล้ายกันเป็นช่วง** (เช่น "อายุ 52-53 ดาวลาภ → เฝ้าระวัง") แสดง พ.ศ./ค.ศ. ต่อท้ายบท 12; ไหลเข้า DOCX + เป็น ground ของ LLM อัตโนมัติ
- เทสต์ `tests/liunian-series.test.ts`; full suite คงที่ 14 fail corpus เดิม (0 regression)

### P-C: ขัดเกลาเพิ่ม (ทางเลือก) — ✅ ทำแล้ว (รอบล่าสุด)
- ✅ **DOCX สวยขึ้น**: หน้าปกกรอบสีมงคล + สารบัญ (TOC field, Word เติมเลขหน้าเอง) + footer เลขหน้า + ขึ้นหน้าใหม่แต่ละหมวด (ฟอนต์ฝัง = ข้าม เพราะ Tahoma ลิขสิทธิ์ MS; ใช้ Sarabun OFL ได้ถ้าจะฝังจริง)
- ✅ **band classifier แก้ที่ต้นเหตุ (เพิ่มน้ำหนักฤดู 得令)**: เพิ่ม `resolveSeasonalCommand` ใน `symbolic-engine.strength.ts` (+2 เมื่อดิถีเกิดตรงฤดูธาตุตัวเอง, บวกล้วนไม่ลงโทษ) → case3 丙 4.25→6.25 "ดิถีแข็ง" ถูกต้อง; + ปรับ `roleMap` band strong = [output, wealth] (食傷生财) ให้ตรง doc; **0 regression ใหม่** (full suite คงที่ 14 fail corpus เดิม)
- ✅ **mapping ลูกค้า/ช่องทาง ละเอียดขึ้น**: เพิ่มกลุ่มที่นำเงินเข้า (ดาวลาภ財), ช่องทางสื่อสาร (ดาวถ่ายเท食傷 → `OUTPUT_CHANNEL_TH`), ช่องทางเสน่ห์ (ดาวดอกท้อ桃花) — เสริมจากเดิมที่ดูแค่เสาปี
- ✅ **DOCX ตารางวัยจร 5 ปี** (เดิม 10 ปี) + ✅ **LLM แต่งคำตารางบทเสริม** + ✅ **score พื้นดวงใช้ engine score ให้ตรง band**
- (deferred) resource-season bonus (印当令) — ข้ามเพราะกระทบ locked test 2018-12-08; ทำภายหลังพร้อมอัปเดต golden value

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
- ✅ **case3 4.25→6.25 "ดิถีแข็ง"** แก้แล้วด้วย seasonal command (得令 +2) ใน `symbolic-engine.strength.ts`

#### ✅ A2 (band นับราก 通根/得地) — DONE (รอบล่าสุด)
ปิดเสาที่ 3 ของกำลังดิถีแล้ว: `resolveRootContributions` ใน `symbolic-engine.strength.ts` นับ hidden stems (本气 0.3 / 中气 0.15 / 余气 0.1, 比劫根 เต็ม / 印根 ครึ่ง) + ทำ band ต่อเนื่องไม่มีช่องว่างใน `constants/operator-strength.ts` (รองรับคะแนนเศษ): very-weak≤2 / weak(2,4] / balanced(4,5.5] / strong(5.5,6.75] / very-strong(6.75,∞)

**ผล — ดวง labeled ทุกตัวถูกหลักตำรา:** สิริกัญญา 壬 5.5→**6.25 แข็ง** (doc แข็งมาก) · dna3 丙 6.95 แข็งเกินไป · case1 辛 3.95 อ่อน (ดิน+น้ำ) · เจ้าชะตาB 庚 3.67 อ่อน (ดิน+ทอง) · กัญญา 甲 2.75 อ่อน

**Re-bless แล้ว (มีหลักฐานจากคะแนนใหม่):** orthodox/e2e 4.5→4.65 · pinned 1992 己 3.75→4.58 (weak→balanced, รากดิน 未/巳/申 หลายตำแหน่ง) · real-case-1993 0.25→0.35 · เพิ่ม profile `己|แข็งแรง/สมดุล` ใน test repo กัน undefined
**เทสต์อัปเดต:** orthodox-twelve-qi, symbolic-engine(.facts), e2e, real-case-1993, symbolic-engine (profile block + trace result), orchestrator-prompt-builder · full suite 14 fail corpus เดิม (0 regression)

**หมายเหตุ/ข้อควรรู้รอบหน้า:**
- 1992 己 ถูก reclassify weak→balanced (รากดินจริงหลายตำแหน่ง — defensible) → **production DB ต้องมี profile `己|แข็งแรง/สมดุล`** ไม่งั้น narrative fallback เป็น "score X"
- สิริกัญญาได้ "แข็ง" (doc "แข็งมาก") — ต่าง 1 band ยอมรับได้; ถ้าจะให้ตรงเป๊ะอาจเพิ่ม drainage model + label dataset เพิ่ม
- ยังไม่มีโมเดล drainage/官杀 pressure (case1 ไฟล้อมโลหะผ่านได้เพราะ root น้อย+ฤดูไม่หนุน พอดี) — ถ้าเจอเคส over-strengthen ในอนาคต ค่อยเพิ่ม

### P3 — DOCX ให้สวยใกล้ต้นฉบับ
- เพิ่มตารางวัยจร 8 ช่วง (Da Yun) บนแผ่นดวง, หน้าปกมีกราฟิก, ฟอนต์ไทยฝังในไฟล์, สารบัญ 15 หมวด
- (ปัจจุบันใช้ฟอนต์ Tahoma ผ่าน styles)

### P4 — ไล่เทียบถ้อยคำรายบท 4-15 ทั้ง 4 ดวง
ทำเป็น checklist ทีละบท เทียบ engine vs doc แล้วเพิ่ม knowledge ที่ขาด (เช่น บท12 turning points เจาะลึก 20 ปีข้างหน้าแบบ doc)

### P5 — UI ครบวงจร — ✅ ทำแล้ว
✅ เพิ่ม progress bar (วิช่วล) ตอนทำนาย/LLM polish รวมทุกบท + ปุ่ม "ดูตัวอย่างรายงาน" (preview เรียงตามลำดับไฟล์ .docx รวมตารางบทเสริม) ก่อนดาวน์โหลด — ใน `ReadingPathWorkspace.tsx` + CSS `path-reading.css`

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