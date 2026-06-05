# แผนงานระบบทำนายดวงจีน (Bazi) + Export DOCX

---
# 🧾 สรุปงาน session นี้ (ยังไม่ commit — review-driven 15 บท + LLM YLC rollout)

ผู้ใช้ review ทีละบทเทียบ engine vs ที่ต้องการ + ฝั่ง LLM เลียนสไตล์ "your life code"

## A) ตาราง DOCX — `reading-docx.ts` + `topic-knowledge.ts`
- ตารางดิถีประจำตัว **เรียงคอลัมน์ เสายาม→เสาวัน→เสาเดือน→เสาปี** (เดิม ปี→...→ยาม)
- ตารางวัยจร 5 ปี **เพิ่มคอลัมน์ "ปฏิกิริยา"** (คู่ธาตุ/ถ่ายเท/โชคลาภ/พิฆาต/ส่งเสริม) ผ่าน `buildDaYunTableRows` (map `resolveRelationRole`)
- บทเสริม (ตารางวัยจรหลังบท15) **ลบคอลัมน์ "เส้นขีดที่ทำงาน"** เหลือ ช่วงอายุ/เสาวัยจร/คำอธิบาย

## B) Engine แก้ตาม review รายบท — `topic-knowledge.ts`
- **บท1** เพิ่ม fallback นิสัยระดับก้านเมื่อไม่มี record คู่ ก้าน|กิ่ง (เช่น `甲辰` ที่ขาดในไฟล์ 60 กะจื่อ) → บท1 มีนิสัยพื้นฐานเสมอ
- **บท3 โชคลาภ:** อ่าน **2 เซียงแซต่อตำแหน่ง** — ตัวแรก(~80%)=เทียบดิถี (ก้านตำแหน่ง×กิ่งวัน / ก้านวัน×กิ่งตำแหน่ง), ตัวหลัง(~20%)=self-seat (ก้านเสา×กิ่งเสา) + ป้าย visibility (ปี/เดือน เห็นชัด, วัน/ยาม แอบซ่อน)
- **บท4 ผู้อุปถัมภ์:** ดาวอำนาจ→"ดาวอำนาจ-ตำแหน่ง (เหมาะมนุษย์เงินเดือน)" + แนวทางสร้างบารมีตามคุณธรรมประจำธาตุส่งเสริม (`RESOURCE_VIRTUE_TH` ครบ 5 ธาตุ)
- **บท5 พรสวรรค์:** ตัดน้ำ เหลือ ชนิดดาวถ่ายเท (食神/傷官) + ความหมาย 12 เซียงแซเชิงบวก (`QI_TALENT_POS_TH`)
- **บท6 ครอบครัว:** ลบ dump สัญลักษณ์ปฏิกิริยาดิบ → อ่านเสาเดือน(พ่อแม่)/เสาปี(ปู่ย่า) ตาม 12 เซียงแซ (`QI_FAMILY_TH`) + พ่อ=ราศีบนหลักเดือน แม่=ราศีล่างหลักเดือน
- **บท7 ความรัก:** + "ดาวคู่ครองหลายตำแหน่ง = คู่ครองเยอะ" + timing ก่อน 20 = รักวัยเรียน (youth labels)
- **บท8 เพื่อน/ศัตรู:** เพิ่มธาตุของแต่ละตำแหน่งใน output (qi sets ตรงสเปคอยู่แล้ว: ดี7/50-50:หมกยก,แป่/เสีย:ซวย,ซี่,เจ๊าะ)
- **บท10 ลูกน้อง:** แก้บรรทัดเสายามเป็นกลาง (เดิมพูดบวก "ฐานมั่นคง" ขัดเซียงแซหมกยก)
- **บท11 การเรียน:** อ่านเซียงแซดาวถ่ายเท (ดี=เรียนได้ใช้ / ซวย,เจ๊าะ=แก้ยาก) + แนะนำคณะ/สาขา/คอสจริง `FACULTY_BY_ELEMENT_TH` (สรุปจาก `docs/อาชีพของธาตุต่างเทียบการเรียนคณะ สาขา คอสเรียน.docx`)
- **บท12 วัยจร:** ตัดให้สั้น (lead + ช่วงวัยจร + ปีจรปัจจุบัน) — ตัด 8-ตัว breakdown + พยากรณ์รายปี 20 ปีออก (ฟังก์ชัน `buildDaYunCharacterBreakdown`/`buildLiuNianYearlyForecast` กลายเป็น dead code, เก็บไว้ re-enable)
- **บท14 สี:** fallback สีรถใช้ธาตุส่งเสริม (印) เมื่อตาราง Source7 ไม่มี
- **บท15 องค์เทพ:** เพิ่มความหมายตามบทบาทธาตุ (`DEITY_ROLE_BENEFIT_TH`: ลาภ→โชคลาภ/ลงทุน, ส่งเสริม→ผู้ใหญ่/สุขภาพ ฯลฯ)

## C) แก้ข้อมูล career + faculties — `knownlage/extracted/source7-enhancement.txt`
- **แก้ bug:** "การศึกษา" จัดผิดธาตุไม้ → ย้ายไปธาตุไฟ ("วิชาการ/ครู/การศึกษา") [ผู้ใช้ flag ตั้งแต่ต้น]
- **ขยายลิสต์อาชีพทั้ง 5 ธาตุ** ให้ครบตาม `career-business.txt` + docx คณะ (audit แล้วจัดธาตุถูกทุกตัว)
- เพิ่มไฟล์อ้างอิง `knownlage/extracted/education-faculty.txt` (→ ย้าย `docs/extracted-ref/`)

## D) LLM สไตล์ "Your Life Code" — `reading-llm.ts` + `ReadingPathWorkspace.tsx`
- **`ENGINE_ONLY_TOPIC_IDS`** (ReadingPathWorkspace) บังคับ engine บท 1-15 ใน doc export — **แก้บั๊ก: ใช้ TOPIC_PATH id ที่ถูกต้อง** (chart_foundation/career_potential/... ไม่ใช่ BAZI_TOPIC_IDS)
- เขียน **`buildSystemInstruction` ใหม่เป็นสไตล์ YLC** (ร้อยแก้วลื่น + bullet + ⚠️/❌, คงข้อเท็จจริงครบ, **ไม่มีฉายา**) แทนกฎ "≤150 คำ" เดิม · ใส่ `preserveDetail` ครบทุกบท
- **Faithfulness gate** `verifyReadingFaithful` — นับโทเคนธาตุ+อายุ+ป้าย (ไม่นับชื่อเซียงแซ เพราะ prompt สั่งแปลเป็นภาษาคน), threshold 0.5 + retry 1 ครั้ง → ถ้าตัดข้อเท็จจริง **fallback ใช้ engine** (การันตีไม่แย่กว่า engine)
- ทดสอบ flash-lite จริง (GEMINI_API_KEY ใน .env): บท 1,2,3,5,4,11,15 + eval 6 เคส YLC → YLC prose ครบ, ลิสต์ไม่ตัด, 0 fallback/ครับ/bleed

## E) Eval 6 เคส YLC (example/your life code*.docx)
- **เสา engine ถูก 6/6** — ตรง YLC 4/6; อีก 2 เป็น **error ในรายงาน YLC เอง**: กัญญารัตน์ (ตาราง header มั่ว: ยาม 壬午 เป็นไปไม่ได้, ปี辛亥 ทั้งที่ 2002=壬午 — แต่เนื้อหา YLC ใช้ 甲 ดิถีอ่อน ตรง engine), เกศสรินทร์ (เกิด 02:10=丑時→engine 乙丑 ถูก; YLC เอาลัคนา 丙寅 มาใส่ช่องยาม + เขียนเดือนขาล寅/ใบไม้ผลิผิด จริง=丑/หนาว ก่อน立春)
- บทเรียน: **รายงาน YLC ใช้เป็น ground truth 100% ไม่ได้** (เจอ error ผัง 2/6) — engine แม่นกว่า

## F) เทสต์
- อัปเดต `tests/source-integration.test.ts` (บท3 2-เซียงแซ, บท12 สั้น), `tests/liunian-series.test.ts` (บท12 ไม่มีพยากรณ์รายปี), `tests/topic-knowledge.test.ts`
- full suite: **499 passed / 14 failed** — 14 ทั้งหมด **pre-existing** (corpus `all_distilled` ภายนอกหาย/ENOENT + home-page SSR async) ยืนยันด้วย git stash · **0 fail ใหม่จาก session นี้**
- ⚠️ 14 fail ยังไม่แก้ (เสนอ A1 skip-if-missing + B1 await effect — ผู้ใช้ยังไม่สั่งทำ)

## ⏭️ ค้าง/เสนอต่อ
- เติม record 60-กะจื่อ ที่ขาด (เช่น `甲辰`) ในไฟล์นิสัย (ตอนนี้ fallback ระดับก้านคุมไว้แล้ว)
- เทียบเนื้อหาบทอื่น (2/3/5...) กับ YLC ครบ 6 เคส
- ถ้าต้องการ LLM นิ่ง 100% ทุกดวง → อัปเกรดโมเดลจาก flash-lite
- แก้ 14 fail (A1+B1)

---
# ▶ สรุปล่าสุด + แผนถัดไป (อัปเดตรอบก่อน)

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
- เทสต์: **499 passed / 14 failed** (14 = corpus pre-existing/ENOENT ไม่เกี่ยวงานนี้) — 0 regression ตลอด
- Verify จริง Gemini: `scripts/verify-reading-llm.ts` (ผ่านทุกเกณฑ์) + `scripts/compare-llm-vs-aigen.ts` (เทียบ ai gen M.docx ทีละบท) + เทียบ your life code 6 เคส

## 🧾 สรุปงาน session ล่าสุด (ยังไม่ commit — ดู N1)
1. **N2** strength profile coverage audit (live DB ครบ 30/30) — `scripts/audit-strength-state-coverage.ts`
2. **N3** 从强 dominance model (สิริกัญญา 6.25→7.0 แข็งมาก) — `symbolic-engine.strength.ts`, `operator-strength.ts`, `tests/strength-band-labeled.test.ts`
3. **N5** ฝัง source จริง 4 ไฟล์ + ซินแซ-corrections 15 บท (รายละเอียดด้านล่าง) — `topic-knowledge.ts`, `pillar-display.ts` (reuse), `reading-phrases.ts`, `scripts/extract-source-docs.py`, `knownlage/extracted/{love-day-pillar,source7-custom,kheangkhung-reference}.txt`
4. **structural บท 8/9/10/12** + **ตำราเคี้ยงคุง fallback** + **LLM prompt คงตารางบท 3/12**
5. เทสต์ใหม่ `tests/source-integration.test.ts` (11) · อัปเดต `tests/real-case-1993-11-24.test.ts` (subordinate)

### N5 — ฝัง Source จริง + ซินแซ-corrections (จาก example/ai gen M.docx) — ✅ DONE (รอบนี้)
ดึง source ต้นทางใน `docs/` + คำแก้ของซินแซในไฟล์ ai-gen เข้า engine deterministic:
- **Phase 0:** `scripts/extract-source-docs.py` → extract เป็น `knownlage/extracted/{love-day-pillar,source7-custom,kheangkhung-reference}.txt`
- **บท15 เทพ custom (Source7 §5):** `buildCustomDeities` — วน 8 ตัวอักษรในผังที่ขึ้นเชี่ยงแซดี (`GOOD_QI_ENHANCE`) → เทพประจำราศีบน/ล่าง (ตาราง 6/7) นำหน้า แล้วตามด้วยเทพรายธาตุเดิม
- **บท14 สีของใช้ (Source7 §3.1/§3.2):** `parseSource7ColorTable` — สีกระเป๋า=ดิถี×ราศีบนเดือน, สีรถ=ดิถี×ราศีบนยาม จากตารางจริง
- **บท7 ความรัก (xlsx หลักวันเท่านั้น):** `parseLoveDayPillar` — ดิถี×ราศีล่างวัน → คำทำนายคู่ครองตรงตำรา แทรกนำ
- **บท1 บุคลิก:** เติม keyword 12 เชี่ยงแซ (`TWELVE_QI_CONTEXT_MAP`, normalize สะกด เซ/เช) เน้นแก่นเชี่ยงแซ (พัฒนา/เกิดใหม่)
- **วิธีการทาย (structural):** บท2 Target/Market = 12 เชี่ยงแซเสาปี (`QI_MARKET_TH`) · บท3 โชคลาภหลายตำแหน่งตาม 12 เชี่ยงแซ (`QI_WEALTH_TH`) · บท13 ตำแหน่งเจ๊าะ/ซวย → อวัยวะตำแหน่งนั้น
- **structural บท 8/9/10/12 เชิงลึก (รอบนี้):** บท8 สแกน 7 ตำแหน่ง × 12 เชี่ยงแซ → มิตร/ศัตรู/ต้องประคอง ตามความหมายเสา (`scanPositionRelations`) · บท9 นำด้วยราศีล่างวัน × เชี่ยงแซ (มีได้/ไม่ได้) · บท10 หมกยก/แป่ ที่เสายาม = บริวารต้องขัดเกลา (แก้ที่ ai-gen ฟ้องว่าทายผิด) + สแกนดาวถ่ายเทรายตำแหน่ง · บท12 บทเสริม "8 ตัว" — วัยจรปัจจุบันเทียบทีละตัวอักษร (`buildDaYunCharacterBreakdown`: ภาพรวม/การงาน/ลูกค้า-ผู้ใหญ่/บริวาร)
- **ตำราเคี้ยงคุง runtime fallback:** `findKheangkhungReference(keywords)` (export) + `buildKheangkhungFallback(topicId)` + `KHEANGKHUNG_TOPIC_KEYWORDS` — wire ใน `buildTopicHumanReading`: ถ้า builder หลักคืน null (ขาดองค์ความรู้) ดึง excerpt จากตำราเคี้ยงคุงแทน (ยกเว้น love_partner ที่ null เพราะขาดเพศ)
- **เทสต์:** `tests/source-integration.test.ts` (11) ผ่าน + อัปเดต real-case-1993 (subordinate หมกยก→ขัดเกลา) · full suite **499 passed / 14 failed** (14 = corpus ENOENT เดิม, 0 regression) · export `out/M-check.docx` มีเนื้อหาใหม่ครบ
- **LLM prompt — คงตารางบท 3/12:** engine ไม่ต้องแก้ (ground ครบแล้ว) — แก้เฉพาะ `reading-llm.ts`: เพิ่ม `preserveDetail` ใน `ReadingTopicPrompt` + set ที่ wealth/turning_points → `buildSystemInstruction` ผ่อนเพดาน 150 คำ บังคับคงทุก bullet ของตาราง (บท3 โชคลาภ ปี/เดือน/ยาม, บท12 ตาราง 8 ตัว 4 มิติ + ป้าย [ยุคทอง]/[เฝ้าระวัง]) · gen ใหม่ยืนยันตารางครบ บทอื่นยังกระชับเดิม · เครื่องมือ verify: `scripts/compare-llm-vs-aigen.ts`

## ▶ แผนถัดไป (เสนอ) — เรียงตามความคุ้ม

### N1 — Commit + ความปลอดภัย (ทำก่อน, จำเป็น)
- งาน session ล่าสุด **ยังไม่ได้ commit** → สร้าง branch + commit เป็นชุดตามหัวข้อ กันหาย เสนอแยกเป็น:
  1. `feat(strength): 从强 dominance + coverage audit` (N2+N3)
  2. `feat(knowledge): ingest source7 §5/§3 + love day-pillar + 60-persona keyword` (N5 data + บท1/7/14/15)
  3. `feat(reading): position×12-qi structural บท2/3/8/9/10/12/13` (วิธีการทาย)
  4. `feat(knowledge): kheangkhung reference fallback`
  5. `feat(reading-llm): preserveDetail คงตารางบท3/12`
- **Revoke Gemini API key** เก่าถ้าเคยหลุดในแชต แล้วออกใหม่
- หมายเหตุ: `out/` gitignored แล้ว · `docs/Source7…docx` ที่ขึ้น modified เป็นการแก้ของผู้ใช้เอง (ไม่ใช่จากงานนี้)

### N2 — Production data backfill (กัน regression เงียบจาก A2) — ✅ DONE (รอบนี้)
- A2 ทำให้บางดวง reclassify (เช่น 己 → "แข็งแรง/สมดุล") → **DB ต้องมี profile ครบทุก (dayMaster × strengthState)** ใน `bazi_day_master_strength_states` ไม่งั้น narrative fallback เป็น "score X"
- ✅ สร้าง `scripts/audit-strength-state-coverage.ts` (`npm run db:audit:strength`) ตรวจ coverage จริงบน live DB ตาม resolver เดียวกับ repository
- ✅ **ผล: live DB ครบ 30/30 (10 ดิถี × 3 canonical state)** — ไม่มี combo ขาด, ไม่มี "score X" fallback แล้ว; script เป็น guard รัน reseed ครั้งถัดไป (exit 1 ถ้าขาด)

### N3 — A2 รอบสอง: band ระดับ "แข็งมาก" — ✅ DONE (รอบนี้)
- ✅ เพิ่มโมเดล **从强 dominance** (`resolveDominanceBonus` ใน `symbolic-engine.strength.ts` + `OPERATOR_DOMINANCE` ใน `operator-strength.ts`): นับสัดส่วนธาตุพวกพ้อง(比劫)+อุปถัมภ์(印) จาก 8 หน่วย (ราศีบน4 + 本气ราศีล่าง4) → ≥0.7 +0.75, ≥0.6 +0.5
- ✅ **gate ที่ baseScore ≥ 5.5** (ขอบล่าง band แข็ง) → ดวงสมดุล/อ่อน (locked golden ทุกตัว ≤4.65) ไม่ถูกแตะ = **0 regression by construction**
- ✅ ผล: สิริกัญญา 壬 **6.25 แข็ง → 7.0 แข็งมาก** (ตรง doc) · ดวงอื่นคงเดิมเป๊ะ
- ✅ labeled dataset `tests/strength-band-labeled.test.ts` (5 ดวง your life code) ผูก band + กัน dominance รั่ว
- (ยังไม่ทำ) **drainage/官杀 penalty** ด้านลบ — เลี่ยงไว้เพราะกระทบ golden ดวงสมดุล/อ่อนได้ ต้องมี dataset กว้างกว่านี้ก่อน; dominance ฝั่งบวกครอบเคสที่ doc ฟ้องแล้ว

### N4 — ขัดเกลาเพิ่ม (ทางเลือก)
- บท5 พรสวรรค์: เน้น 傷官=วาทศิลป์ ให้ชัดขึ้นในบาง doc (เล็ก, โครงดวงถูกอยู่แล้ว)
- DOCX: ฝังฟอนต์ Sarabun (OFL) จริง ถ้าจะแจกไฟล์ข้ามเครื่อง
- รัน verify/เทียบ your life code ทั้ง 6 เคสเป็น regression ประจำหลังแก้ prompt

### N6 — ข้อเสนอต่อยอด (จาก session ล่าสุด)
- **drainage/官杀 penalty** (N3 ฝั่งลบ) — ดวงถูกธาตุพิฆาตล้อมควรอ่อนลงแม้มีราก; ต้องมี labeled dataset กว้างก่อน กัน golden ดวงสมดุล/อ่อนพัง
- **บท1 keyword เชี่ยงแซใน LLM** — ground มี "แก่นเชี่ยงแซ" แล้ว แต่ LLM ยังพาราเฟรส; ถ้าต้องการให้คงคำ พิจารณาเพิ่ม instruction บท1 ใน `reading-llm.ts`
- **ซินแซ-corrections เชิงคำ (รายละเอียดปลีกย่อย)** ที่ยังไม่ลง: บท1 "ดิถีอ่อน=คิดได้แต่ทำไม่สำเร็จ/ไร้กำลัง" (ตอนนี้ยังมีคำว่า รักษาคำพูด/ซื่อสัตย์ ตาม source ธาตุดิน) — ปรับโทนตามดิถีอ่อนได้ถ้าต้องการ
- **wire `kheangkhung-reference.txt` ให้ลึกขึ้น** — ปัจจุบันเป็น fallback เมื่อ builder คืน null เท่านั้น; อนาคตอาจใช้ enrich ทุกบท (ระวัง prompt bloat) หรือทำ CLI ค้นตำราให้ผู้เขียน
- **regression LLM ประจำ** — รัน `scripts/compare-llm-vs-aigen.ts` หลังแก้ prompt ทุกครั้ง

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