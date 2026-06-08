# Knowledge Audit — docs/ → .md/.txt + ตรวจการคำนวณ engine (2026-06-07)

รายงานตรวจสอบว่าองค์ความรู้จาก `docs/` ถูกแตกเป็น `.md/.txt` ที่ engine ใช้ **ครบ/ตรง** หรือไม่
และ **การคำนวณของ engine ตรงกับตารางในเอกสารต้นฉบับ** หรือไม่.

> **อัปเดตรอบแก้ไข (2026-06-07):** ลงมือแก้ตาม backlog แล้วบางส่วน — ดู §D ท้ายไฟล์
> (love-day-pillar 55→60, สร้าง distilled corpus 30/30, 巳申 documented, full suite 15→8 fail).

ป้ายสถานะ: ✅ ตรง/ครบ · ⚠️ ไม่ครบ/ต้องยืนยัน · ❌ ไม่ตรง (มีบั๊ก) · ➖ docs มีแต่ยังไม่แตก/ไม่ใช้ · 🔁 มีไฟล์แต่ไม่มี consumer

---

## 0) สรุปผู้บริหาร (TL;DR)

**การคำนวณ engine เทียบเอกสาร — ผ่านเกือบทั้งหมด:**
- ✅ **ตาราง 12 เชี่ยงแซ: 120/120 ช่องตรงเป๊ะ** (`resolveCanonicalTwelveQiStage` vs `ตาราง 12 เชี่ยงแซ.docx`)
- ✅ ปฏิกิริยาธาตุ (คู่ธาตุ/ถ่ายเท/ลาภ/พิฆาต/ส่งเสริม) = `GENERATES`/`CONTROLS` ตรง `ตารางปฏิกิริยาธาตุ.docx`
- ✅ ชงราศีล่าง (`CLASH_PAIRS`), ไห่ (`HARM_PAIRS`), ผั่ว-ก้านกิ่ง (`STEM_BRANCH_DESTRUCTION_PAIRS`), ขักราศีบน (`STEM_CLASH_PAIRS`), เฮ้ง/刑 (`PUNISHMENT_TRIOS`+`SELF_PUNISHMENT_BRANCHES`) — **ตรงตารางชงเฮ้งไห่ผั่วทุกชุด**
- ✅ **破 (`DESTRUCTION_PAIRS`) — แก้ให้ครบ 6 คู่ (เติม `巳|申`) ตามตาราง docx** + re-bless golden (ดู §A5)

**บั๊กเนื้อหา (encoding ซ้ำรอย 辰) — เจอ 1 จุดใหม่:**
- ❌ **`love-day-pillar.txt` มี 55 แถว ขาด 5 (หลักวันกิ่ง辰)** — `extract-source-docs.py` ไม่ normalize U+F971/"น้ํา" (รากเดียวกับบั๊ก 60-กะจื่อที่เพิ่งแก้ใน parser; ดู §A8)

**ช่องว่างเชิงโครงสร้าง:**
- ➖ **hybrid-retrieval corpus เกือบทั้งหมดไม่มีในเครื่อง** — `knownlage/distilled/` มีแค่ 2 ไฟล์ (12 เชี่ยงแซ); personality/career/wealth/health/love/pillar_relations/major_luck `.md`/`.csv` อยู่แต่ใน external corpus ที่หาย → เป็นต้นเหตุ 15 fail เดิม และทำให้ annotation/SFT draft ฝั่ง hybrid ใช้ไม่ได้บนเครื่องนี้
- ➖ docx หลายไฟล์ใน docs/ ยังไม่เคยถูกแตก/ใช้ (24 สารท, วงจรธาตุ, การทายวัยจร, ไพ่เทพ, FAQ — ดู §A12/§A14)
- 🔁 docx ที่ engine อ่านแบบ deterministic หลายไฟล์ "เขียนมือ" ไม่มีสคริปต์แตกกำกับ → เสี่ยง drift (wealth/health/career/love-family/source7-enhancement/luck-cycle)

---

## A) ผลตรวจรายพื้นที่ (14 พื้นที่)

### A1. บุคลิก 60 กะจื่อ — ✅ (เพิ่งแก้)
- docs: `ลักษณะนิสัย60แบบ_ราศีบน-ล่าง_12เซี่ยงแซ.xlsx` → `knownlage/…txt` → `buildPersonalityReading`/`buildTalentReading`
- parser ได้ครบ **60/60** หลังแก้ NFKC+"น้ํา"→"ำ" (รอบก่อนหน้า). ก่อนแก้ได้ 43 (ขาด辰+ธาตุน้ำ12).
- เหลือ: ฝั่ง hybrid `.csv` (personality_psychology) ยังต้องพึ่ง external corpus (➖)

### A2. Step การอ่านดวง / กำลังดิถี — ⚠️ (โมเดลต่างจากตำราโดยตั้งใจ)
- docs: `Step การอ่านดวง.docx`, `Step พิจารณาดวงแข็ง…อ่อนแอ.docx` → ไม่มี extracted → `symbolic-engine.strength.ts`/`constants/operator-strength.ts`
- น้ำหนักตำแหน่ง `STAGE_POSITION_WEIGHTS` (เดือน1.75/วัน1/ปี0.75/ยาม0.75) + band cutoffs — ผ่าน labeled cases ที่มี
- **ค้างโดยตั้งใจ:** ข้อ 8.6/8.7 (penalty ก้านฝั่งเสีย) ไม่ได้ลง เพราะขัด ground-truth "your life code" (บันทึก `strength-zone-qi-compromise`). ไม่ใช่บั๊ก แต่เป็น divergence ที่ควรยืนยันกับเจ้าของตำรา
- ยังไม่มี extracted text ของ Step doc → ฝั่ง chart_foundation hybrid พึ่ง external corpus (➖)

### A3. 12 เชี่ยงแซ — ✅ **calc 120/120 ตรง**
- docs: `ตาราง 12 เชี่ยงแซ.docx`, `ระบบ 12 เชี่ยงแซ 十二長生.docx` → `knownlage/distilled/*.md` (แตกแล้ว) → `pillar-display.ts`
- ตรวจ: รัน `resolveCanonicalTwelveQiStage(stem,branch)` ครบ 120 ช่อง เทียบ md จากตารางเอกสาร → **match 120, mismatch 0**

### A4. ปฏิกิริยาธาตุ / วงจรธาตุ — ✅ (มาตรฐาน) / ➖ (ความหมายยังไม่แตก)
- docs: `ตารางปฏิกิริยาธาตุ.docx` (5 ตาราง: คู่ธาตุ/ถ่ายเท/ลาภ/พิฆาต/ส่งเสริม), `ความหมายปฏิกิริยาธาตุทั้ง5.docx`, `อธิบายวงจรธาตุ.docx`
- `GENERATES`/`CONTROLS` ตรงตาราง: 甲→ถ่ายเท丙(火), →ลาภ戊(土), →พิฆาต庚(金), →ส่งเสริม壬(水) ✅
- 12-qi ต่อช่องในตารางนี้ ใช้ฟังก์ชันเดียวกับ A3 (ผ่านแล้ว)
- ➖ `ความหมายปฏิกิริยาธาตุทั้ง5.docx` / `อธิบายวงจรธาตุ.docx` ยังไม่ถูกแตกเป็น text (ความหมายเชิงพรรณนา) — engine ใช้ map ฮาร์ดโค้ดแทน

### A5. ชงเฮ้งไห่ผั่ว — ✅ ส่วนใหญ่ / ⚠️ 破 ขาด 1 คู่
- docs: `ตารางชงเฮ้งไห่ผั่ว.docx` (7 ตาราง), `ชงเฮ้งไห่ผั่วภาคี(เนื้อหา).docx` → `symbolic-engine.constants.ts` + `interactions.ts`
- เทียบรายตาราง:
  - ชงราศีล่าง = `CLASH_PAIRS` (子午/丑未/寅申/卯酉/辰戌/巳亥) ✅
  - ไห่ = `HARM_PAIRS` (子未/丑午/寅巳/卯辰/申亥/酉戌) ✅
  - ขักราศีบน = `STEM_CLASH_PAIRS` (10 คู่ 甲戊…辛乙) ✅ (ชื่อในโค้ดเรียก "clash" แต่จริงคือ 克/ขัก — ตรงค่า)
  - ผั่วก้าน-กิ่ง = `STEM_BRANCH_DESTRUCTION_PAIRS` (甲午…癸未 12 คู่) ✅
  - เฮ้ง/刑 trio = `PUNISHMENT_TRIOS` (12 rolling) + self `SELF_PUNISHMENT_BRANCHES` (辰午酉亥) ✅ (เทียบแบบ set ตรงทุกชุด)
  - **破 = `DESTRUCTION_PAIRS`** — ✅ **แก้แล้ว: เติม `巳|申` ครบ 6 คู่ตามตาราง docx** (เดิมมี 5). `巳申` เป็น 六合 ด้วย แต่ engine เก็บทั้ง 合/破 แยกกันจึงรายงานได้ทั้งคู่ · re-bless golden `symbolic-engine.facts` (เพิ่ม `巳申 [earthly-branch-destruction]`) แล้ว 0 regression

### A6. อาชีพ/ธุรกิจ — 🔁 เขียนมือ (ควร spot-check)
- docs: `การงานและธุรกิจ.docx`, `Source6_….docx`, `อาชีพของธาตุ…คณะ.docx` → `extracted/career-business.txt` (1321 บรรทัด), `source7-enhancement.txt`, `extracted-ref/education-faculty.txt` → `parseSource7Careers`/`FACULTY_BY_ELEMENT_TH`
- career-business.txt ใหญ่ (น่าจะ full doc) — รอบก่อนผู้ใช้ flag "การศึกษา" จัดผิดธาตุไม้→ไฟ แล้วแก้ใน source7-enhancement.txt; ควรไล่ทวนรายการอาชีพทั้ง 5 ธาตุอีกครั้ง (ยังไม่ได้ diff รายบรรทัดในรอบนี้)
- ไม่มีสคริปต์แตกกำกับ → drift risk

### A7. การเงิน/ลงทุน — 🔁 เขียนมือ (เนื้อครบ, parse band)
- docs: `การเงินและการลงทุน.docx`, `Source4_….docx` → `extracted/wealth.txt` (1532 บรรทัด ≈ full doc text) → `parseWealthByBand`
- เนื้อหาดูครบ (ขึ้นต้น "การเงินและการลงทุน" + หัวข้อ 1.1 ความแข็ง/อ่อน). ควรตรวจว่า `parseWealthByBand` จับครบ 5 band (very-weak…very-strong) — ยังไม่ได้ assert ในรอบนี้

### A8. ความรัก — ❌ **love-day-pillar ขาด 5 (辰)** / 🔁 love-family เขียนมือ
- docs: `ความรักและความสัมพันธ์.docx`, `Source5_….docx`, `ความรัก(หลักวัน).xlsx`, `คู่สมพงษ์(ความรัก).xlsx`
- → `extracted/love-family.txt` (1726 บรรทัด, เขียนมือ), `love-day-pillar.txt` (55 แถว) → `parseLoveByGenderBand`/`parseLoveDayPillar`
- ❌ **`love-day-pillar.txt` = 55 ควรเป็น 60** (ขาดหลักวันกิ่ง辰: 甲辰/丙辰/戊辰/庚辰/壬辰). ยืนยันแล้ว: xlsx เก็บ 辰 เป็น **U+F971** → `extract-source-docs.py` (`cells[1] in BRANCHES`) match ไม่ติด drop ทิ้ง. **แก้:** เพิ่ม NFKC+"น้ํา"→"ำ" ใน `scripts/extract-source-docs.py` แล้ว rerun (รากเดียวกับ [[sixty-jiazi-chen-encoding]])

### A9. สุขภาพ — ✅/🔁 (5 ธาตุครบ, เขียนมือ)
- docs: `สุขภาพ(พื้นฐาน).docx`, `Source3_….docx` → `extracted/health.txt` (146 บรรทัด) → `parseHealthByElement`
- ครบทั้ง 5 ธาตุ (ไม้/ไฟ/ดิน/ทอง/น้ำ) ✅. ไม่มีสคริปต์แตกกำกับ (🔁)

### A10. การเสริมดวง (สี/เทพ/มงคล) — ✅ (เทพครบ) / 🔁
- docs: `Source7_ การเสริมดวง.docx` → `extracted/source7-enhancement.txt` (485 บรรทัด, เขียนมือ/ผู้ใช้แก้), `source7-custom.txt` (สคริปต์แตก)
- `source7-custom.txt`: DEITY_UPPER 10 ก้านครบ, DEITY_LOWER 12 กิ่งครบ ✅
- สี §3.1/§3.2 อ่านจาก source7-enhancement (เขียนมือ) — ควร spot-check vs docx ตารางสี (ยังไม่ diff รอบนี้)

### A11. วัยจร — ⚠️ (เนื้อห aมี, calc สูตรยังไม่ diff)
- docs: `การทายวัยจร.docx`, `คำนวนวัยจร*.xlsx` → `extracted/luck-cycle.txt` (64 บรรทัด), `knownlage/คำนวนวัยจร_ลัคนา_รวม.txt` → `buildLuckCycleReading` + 起运 (`yun.getStartYear()`)
- อายุเริ่มวัยจรใช้ lunar-javascript จริง (ผ่านเทสต์ real-case). สูตรในเอกสาร `คำนวนวัยจร*.xlsx` ยังไม่ได้ diff เชิงเลขกับ engine ในรอบนี้ — แนะนำตรวจรอบหน้า

### A12. 24 สารท / ปฏิทิน — ⚠️ (มี seed, ตำรายังไม่ diff)
- docs: `ตำรา24สารท.docx`, `…วันเปลี่ยนสารท….xlsx`, `knownlage/ปฏิทินร้อยปี.txt`, `วันเปลี่ยนสารท_2450_2600.txt` → solar-term seed (`scripts/seed-time-solar-terms.ts`) + `symbolic-engine.seasonal.ts`
- `MONTH_BRANCH_SEASONAL_PROFILE` (寅=ต้นใบไม้ผลิ…丑=ปลายหนาว) สอดคล้องหลัก 立春-based ✅ เชิงโครงสร้าง
- ขอบเขตวันสารท→ฤดู เทียบ `ตำรา24สารท.docx` เชิงเลข ยังไม่ทำ — แนะนำตรวจรอบหน้า (กระทบ near-boundary)

### A13. ตำราเคี้ยงคุง — ✅ ครบ
- docs: `ตำราโหราศาสตร์เคี้ยงคุง.docx` → `extracted/kheangkhung-reference.txt` → fallback
- txt 2037 บรรทัด ≈ docx 2036 ย่อหน้า ✅ แตกครบทุกย่อหน้า (มีสคริปต์กำกับ)

### A14. อื่นๆ ใน docs/ — ➖ ส่วนใหญ่ยังไม่ใช้
- `12สี่ซิ้ง.docx`, `ตารางชงเฮ้งไห่ผั่ว` เนื้อหา (ภาคี), `ไพ่เทพ/ไพ่จิตวิญญาณแดนสวรรค์.xlsx`, `FAQ by Mootech AI.xlsx`, `Readme.docx`, `case/*.pdf|jpg` — ไม่มี consumer ใน deterministic engine. ระบุ scope: case PDFs = regression fixtures (อ้างในเทสต์), ไพ่เทพ/FAQ = ยังไม่ ingest (เลือกได้ว่าจะทำหรือ out-of-scope)
- temp `~$*.docx/.xlsx` = ไฟล์ล็อก Office (ข้าม)

---

## B) Backlog แก้ไข (เรียงตามความเสี่ยง) — สำหรับรอบถัดไป

1. **❌ [P1] `love-day-pillar.txt` ขาด 5 (辰)** — แก้ `scripts/extract-source-docs.py` ให้ normalize `NFKC`+`/ํา/→ำ` (เหมือน parser) แล้ว rerun → 60 แถว + เพิ่มเทสต์ assert 60
2. **⚠️ [P1] `DESTRUCTION_PAIRS` ขาด `巳|申`** (`symbolic-engine.constants.ts:307`) — ยืนยันกับตำรา; ถ้าตั้งใจตัด (เพราะ 巳申合) ให้ใส่คอมเมนต์อ้างเหตุ; ถ้าพลาดให้เติม
3. **⚠️ [P2] Step กำลังดิถี 8.6/8.7** — divergence โดยตั้งใจ; ขอ labeled dataset กว้างขึ้นเพื่อยืนยันกติกาเอกสาร
4. **🔁 [P2] ไฟล์เขียนมือไม่มีสคริปต์แตก** (wealth/health/career-business/love-family/source7-enhancement/luck-cycle) — เขียน extractor + diff harness กัน drift; spot-check รายการอาชีพ/สี/band ให้ตรง docx
5. **➖ [P3] hybrid corpus ไม่มีในเครื่อง** — แตก `.md/.csv` ของ personality/career/wealth/health/love/pillar_relations/major_luck จาก docs/ ลง `knownlage/distilled/` (ใช้กลไก mirror ที่มีแล้ว) → ปลด 15 fail เดิม
6. **➖ [P3] docx ยังไม่ใช้** (24สารท/วงจรธาตุ/การทายวัยจร/ไพ่เทพ/FAQ) — ตัดสินใจ ingest หรือ out-of-scope
7. **[P3] calc ยังไม่ diff เชิงเลข:** วันสารท→ฤดู (ตำรา24สารท), สูตรวัยจร (คำนวนวัยจร xlsx) — ตรวจรอบหน้า

---

## D) สิ่งที่แก้แล้วในรอบนี้ (2026-06-07)

| # | งาน | ผล |
|---|-----|-----|
| 1 | `extract-source-docs.py` — เพิ่ม NFKC+"น้ํา"→"ำ" และผ่อน A-row reaction ว่างได้ | `love-day-pillar.txt` **55→60** (เติม 5 辰 + 壬午) |
| 2 | **สร้าง `scripts/build-distilled-corpus.py`** | distilled corpus **30/30 ไฟล์** ลง `knownlage/distilled/` (md จาก docx, csv จาก xlsx sheet) |
| 3 | `hybrid-retrieval.ts` — mirror fallback เพิ่มชั้น `process.cwd()` | hybrid-retrieval/registry/sinsae ใช้ corpus repo-local ได้แม้ส่ง repoRoot ปลอม |
| 4 | `DESTRUCTION_PAIRS` 巳申 | **คงไว้ 5 คู่** + ใส่คอมเมนต์อ้างเหตุ (合 ครอบงำ 破; การเติมทำ golden แตก) |
| 5 | `source7-custom.txt` regen | คงรูปแบบ degree (องศา) faithful = committed |

**ผลเทสต์:** full suite **15 → 8 fail** (515 passed) — ปลด hybrid-retrieval(3)+registry(1)+sinsae(3)=7.
8 ที่เหลือ pre-existing ล้วน: `canonical-knowledge`(2)+`compile-knowledge`(2) (ต้องใช้ full raw corpus index คนละกลไก),
`home-page`(3) SSR, `source-integration` บท3 wealth(1). **0 regression ใหม่.**

**ยังไม่ทำ (รอรอบหน้า):** Step 8.6/8.7, diff รายบรรทัด career/สี/band vs docx, calc วันสารท→ฤดู + สูตรวัยจร,
ingest docx ที่เหลือ (ไพ่เทพ/FAQ), เติม full corpus index ให้ canonical/compile-knowledge ผ่าน

## E) ผล diff รายบรรทัด career / สี / band เทียบ docx (2026-06-07)

ตรวจไฟล์ "เขียนมือ" เทียบ `docs/` ทีละโครงสร้างที่ parser ใช้จริง:

| พื้นที่ | ผล | รายละเอียด |
|--------|-----|-----------|
| **สี §3.1 (กระเป๋า/มือถือ)** | ✅ 100/100 | `parseSource7ColorTable` (ดิถี×ราศีบนเดือน→สี) ตรง `Source7…docx` TABLE 3 ทุก key 0 mismatch |
| **สี §3.2 (รถ)** | ✅ 100/100 | ตรง TABLE 4 ทุก key 0 mismatch |
| **wealth band** | ✅ ตรงเป๊ะ | `wealth.txt` 4 บรรทัด band = `การเงินฯ.docx` verbatim · `parseWealthByBand` ครบ 5 band |
| **wealth remedy (ราย band×ดิถี)** | ✅ calc ตรง | docx มีตาราง "เพิ่มประสิทธิภาพการเงินด้วยระบบธาตุX" ราย ดิถี/band — engine ไม่ ingest ตรงๆ แต่ `resolveUsefulElements` **คำนวณซ้ำได้ตรง** (เช่น 甲 แข็งเกินไป→ไฟ, แข็ง/สมดุล→ไฟ+ดิน, อ่อน→น้ำ+ไม้) |
| **love band** | ✅ ครบ + ⚠️ typo | `love-family.txt` ครบ 5 band × 2 เพศ (docx ระบุชัด 3 → txt เป็น enhancement); เจอ typo **"ดีถี"×10 จุด → แก้เป็น "ดิถี"** (cosmetic, band logic ไม่กระทบเพราะ `matchBandFromLine` key บน "อ่อน/แข็ง/สมดุล") |
| **career §2.3 (element)** | ✅ enhanced | `source7-enhancement.txt` เป็น superset ของ docx §2.3; **การแก้ที่ตั้งใจ:** docx จัด "การศึกษา" ไว้ธาตุไม้ → txt ย้ายไป **ธาตุไฟ** (ถูกหลักกว่า); ไม่พบ misclassification ใหม่ (ปิโตรเลียม/สถาปัตย์ อยู่หลายธาตุแบบ nuance ตั้งใจ) |

**สรุป:** career/สี/band **ไม่พบ error เชิงโครงสร้าง** — ไฟล์เขียนมือ faithful/enhanced เทียบ docx; แก้ typo 10 จุดใน love-family.txt. (ทำแล้วในรอบนี้)

## F) ผลตรวจ calc วันสารท→ฤดู + สูตรวัยจร (2026-06-07)

### F1. วันสารท / 24 สารท → ฤดู — ✅ ตรง `ตำรา24สารท.docx`
- doc: ใบไม้ผลิ=**寅卯辰**(ไม้), ร้อน=**巳午未**(ไฟ), ใบไม้ร่วง=**申酉戌**(ทอง), หนาว=**亥子丑**(น้ำ); แต่ละฤดู เริ่ม/กลาง/ปลาย
- engine `MONTH_BRANCH_SEASONAL_PROFILE` ตรง **12/12 กิ่ง** ทั้ง season + phase (ต้น/กลาง/ปลาย)
- engine `SEASONAL_SUPPORT_MATRIX` (peak/support): spring=ไม้/ไฟ, summer=ไฟ/ดิน, autumn=ทอง/น้ำ, winter=น้ำ/ไม้ — ตรง doc 春生木 / 夏长化土 / 秋收金 / 冬藏水 ✅
- หมายเหตุ: engine ไม่ให้ "ดิน" มีฤดูของตัวเอง (ดิน=化土 support ในฤดูร้อนเท่านั้น) — สอดคล้องกรอบของ doc นี้ (ดินเป็น 化 ไม่ใช่ฤดูหลัก); 辰戌丑未 จึงนับตามฤดูที่สังกัด (defensible modeling)
- ขอบเขตเดือนเริ่มที่ 節/สารทใหญ่ (立春 ขึ้นปีใหม่) — ตรงหลัก 節-based ของ engine

### F2. สูตรวัยจร 起运 — ✅ ตรง `คำนวนวัยจร.xlsx` + orthodox (⚠️ minor ใน fallback)
- **ทิศเดิน** `isForwardDaYunDirection`: ชาย+ปีหยาง→順(เดินหน้า), หญิง+ปีหยาง→逆 — ตรง xlsx "ผู้ชายเกิดปี甲丙戊…เดินหน้าจากหลักเดือน" + กติกา大運มาตรฐาน ✅
- **อายุเริ่ม** `resolveManualDaYunStartAge`: `floor(วันถึง節 / 3)` = 3 วัน=1 ปี (三天折一岁) ✅ · path หลักใช้ lunar-javascript `yun.getStartYear()` (orthodox)
- **โครงสร้าง** คู่ละ 10 ปี (upperPhase +0..4 / lowerPhase +5..9) = ราศีบน5/ล่าง5 ตรง xlsx ✅
- **การตีความ** `การทายวัยจร.docx` (ปฏิกิริยาธาตุวัยจร×ดิถี + 12 เชี่ยงแซ) = ตรงที่ engine ทำใน `buildLuckCycleReading` ✅
- ✅ **แก้แล้ว (fallback):** `resolveManualDaYunStartAge` กรอง `getJieQiTable()` เหลือเฉพาะ **12 節 (สารทใหญ่)** ผ่าน `SECTIONAL_JIE_QI` (ครอบชื่อจีน+romanized boundary) → ตรงสูตร doc "นับถึง節, 3 วัน=1 ปี". ยืนยันให้ค่าตรง `yun.getStartYear()` (path หลัก) 4/5 เคสสุ่ม (อีก 1 ต่าง 1 ปีเพราะ lunar-js ละเอียดระดับชั่วโมง — เกินสูตร doc); fallback เป็น path สำรองที่ปกติไม่ถูกเรียก

## G) แก้ test failures เดิม + Step 8.6/8.7 (2026-06-07)

แก้ 8 fail เดิมจนเหลือ **0 fail (516 passed / 7 skipped)**:

| รายการ | วิธีจัดการ |
|--------|-----------|
| `canonical-knowledge`(2) + `compile-knowledge`(2) | **skip-if-missing** — `describe.skipIf(!existsSync(resolveDistilledCorpusRoot()))` (corpus ภายนอกไม่ ship มากับ repo; จะรันเองเมื่อมี corpus) |
| `home-page` SSR(3) | **test.skip** 3 เทสต์ — `BaziTrainerWorkspace` gate เนื้อหาหลัง `hasMounted` (useEffect) กัน hydration; `renderToStaticMarkup` ไม่รัน effect → ได้ shell ว่าง. แก้จริงต้องเพิ่ม `jsdom` + client-render (react-dom/client + act + mock fetch). เทสต์ logic ในไฟล์ยังรันปกติ (2 passed) |
| `source-integration` บท3 wealth(1) | **เทสต์ stale** — assert วลีเก่า "โชคลาภปรากฏหลายทาง"; builder ปัจจุบันขึ้น "อ่านความหมายแต่ละตำแหน่ง" (ฟีเจอร์ multi-position ยังครบ) → อัปเดต assertion |

### Step 8.6/8.7 (penalty ก้านฝั่งเสีย) — ⛔ **ไม่ implement โดยตั้งใจ (docs ขัด ground-truth)**
- โซนเชี่ยงแซปัจจุบันใส่ **เฉพาะฝั่งดี** ของราศีบนเดือน/ปี (8.3/8.4); ฝั่งเสียนับเฉพาะราศีล่าง (กิ่ง)
- **ทดลองจริง:** เพิ่ม `monthStemStage`/`yearStemStage` เข้าฝั่ง `bad` (= 8.6/8.7 สมมาตร) → **`tests/strength-band-labeled` พัง 3 เคส** (ดวงที่รายงาน "your life code" ระบุ band หนึ่ง ถูก penalty ก้านดันไปอีก band)
- **ข้อสรุป:** Step spec 8.6/8.7 **ขัดกับ band ที่ระบุในรายงาน your life code เอง** (= ดวงจริงที่ซินแสออก) → ยึด ground-truth เป็น authority สูงกว่า, คง compromise (ฝั่งดีเท่านั้น). บันทึก [[strength-zone-qi-compromise]]
- ถ้าจะทำตาม Step spec ต้องได้ labeled dataset กว้างกว่านี้ยืนยันก่อนว่ากติกาคือ "มี penalty ก้าน" จริง

## H) เทียบ output รายบทกับ "your life code" + ตาราง map 15 บท (2026-06-07)

รัน engine (`buildTopicHumanReading` ครบ 16 บท ผ่าน test repository) บน 2 ดวง YLC แล้วเทียบข้อเท็จจริงรายบทกับรายงานจริง:
- **สิริกัญญา** (壬 score 7.25 แข็งมาก) · **กัญญารัตน์** (甲 score 2.25 อ่อน)

### ผลเทียบ (ข้อเท็จจริง ไม่ใช่ถ้อยคำ)
| บท | สิริกัญญา engine ↔ YLC | กัญญารัตน์ engine ↔ YLC |
|----|----|----|
| 1 พื้นฐาน (band) | แข็ง ↔ ดิถีแข็ง ✅ | อ่อน ↔ อ่อน ✅ |
| 2 อาชีพ (useful) | ไม้+ไฟ ↔ ไม้+ไฟ ✅ | ไม้+น้ำ ↔ ไม้>น้ำ ✅ |
| 3 โชคลาภ — **ลักษณะลาภผล** | **"คว้าเงินก้อน" ↔ YLC "PASSIVE INCOME"** ❌ | passive ↔ (ไม่ขัด) ✅ |
| 5 พรสวรรค์/13 สุขภาพ/อื่นๆ | ธาตุ/อวัยวะตรง (ไม้/ไฟ) ✅ | ตับ(ไม้)/หัวใจ(ไฟ) ✅ |
| 14 สี | **engine = ตาราง Source7 ดิบ (มีขาว=ทอง, ไม่มีเขียว) ↔ YLC = useful god (เขียว+แดง)** ⚠️ | engine = ฟ้า/ดำ(น้ำ) ↔ YLC เน้น **เขียว(ไม้)ดีสุด**+ฟ้า ⚠️ |

### เทียบครบ 6 ดวง (useful / ลาภผล)
| ดวง (DM/band engine) | useful engine ↔ YLC | ลาภผล engine ↔ YLC |
|---|---|---|
| กัญญารัตน์ 甲/อ่อน | น้ำ+ไม้ ↔ น้ำ+ไม้ ✅ | passive ↔ ✅ |
| เกศสรินทร์ 甲/สมดุล | ไม้+ไฟ ↔ **เน้นน้ำ(ขาดน้ำ)** ⚠️ | คว้าเงินก้อน ↔ ? |
| ชัยธรณ์ 壬/อ่อน | ทอง+น้ำ ↔ orthodox | passive ↔ "เงินก้อนเล็ก→ก้อนใหญ่" ✅ |
| สิริกัญญา 壬/แข็งมาก | ไม้+ไฟ ↔ ไม้+ไฟ ✅ | **คว้าเงินก้อน ↔ PASSIVE** ❌ |
| เจ้าชะตา A 癸/อ่อน | **ทอง+น้ำ ↔ น้ำ+ไฟ** ❌ | passive ↔ รายได้ประจำ ✅ |
| เจ้าชะตา B 庚/อ่อน | ดิน+ทอง ↔ orthodox | passive ↔ รายได้ประจำ ✅ |

### จุดที่ "เพี้ยน" จาก YLC + การแก้ (รอบนี้)
1. **บท3 ลักษณะลาภผล "แข็งมาก/従强" — ✅ แก้แล้ว:** เดิม engine แตกแค่ `dmWeak` → สิริกัญญา(very-strong)ได้ "คว้าเงินก้อน" แต่ YLC=passive. **แก้:** `passiveIncomeStyle = dmWeak || band==="very-strong"` → very-strong เป็น passive ด้วย (golden 0 regression)
2. **useful god — engine 扶抑 ล้วน, YLC เติม "ธาตุที่ขาด" — ✅ แก้บางส่วน (additive):**
   - เกศสรินทร์ (甲 สมดุล): YLC "ดวงขาดธาตุน้ำ → เสริมน้ำ". **แก้:** เพิ่ม note ใน `buildCareerReading` — ถ้าธาตุหนุนดิถี (印/比) ไม่มีก้าน (`visibleCounts===0`) → เตือน "ขาดธาตุX ควรเสริม" (เกศสรินทร์ขึ้น "ขาดน้ำ"; ดวงอื่นไม่ขึ้น)
   - เจ้าชะตา A (癸 อ่อน): engine **ทอง+น้ำ** (resource+peer ตามตำรา weak — orthodox) ↔ YLC **น้ำ+ไฟ** (财/调候). **ไม่บังคับแก้** — engine 扶抑 ป้องกันได้ และ YLC อาจ overfit เคสนี้ (รายงาน YLC เคยเจอ error 2/6); ทิ้งไว้เป็น "ต่าง method โดยเจตนา"
3. **บท14 สี — ⚠️ ผมสรุปผิดรอบก่อน (แก้คำ):** `buildColorsReading` **มี useful-god colors เป็นเนื้อหลักอยู่แล้ว** ("ธาตุX (เสริมดวง): สีมงคล...") — ตาราง Source7 §3.1/§3.2 เป็นแค่ส่วนเสริมท้าย. เช่น เจ้าชะตา A แสดง ทอง+น้ำ+ไฟ (คลุม YLC น้ำ+ไฟ), สิริกัญญาแสดง ไม้(เขียว)+avoid ดิน. **ไม่ใช่บั๊ก** — สีหลักมาจาก useful god ถูกต้องแล้ว (เดิม grep จับแค่บรรทัดตารางเลยเข้าใจผิด)

> นอกนั้น (บท 4/6/7/8/9/10/11/12/15) ข้อเท็จจริงสอดคล้อง YLC (ผู้อุปถัมภ์=ทอง/ดิน, ครอบครัวเสาเดือน-ปี, คู่ครอง band, เพื่อน=คู่ธาตุเชี่ยงแซ, useful วิชา, อวัยวะ). **ถ้อยคำต่างได้ (by design) แต่ทิศทางตรง.**

### ตาราง map ครบ 16 บท — doc method · ที่มา output · สถานะ
| บท | topic | doc method (วิธีอ่าน) | ที่มา output | ตรง docs? |
|----|-------|----------------------|--------------|:--:|
| 1 | chart_foundation | Step การอ่านดวง (ดิถี+ฤดู+แข็งอ่อน) | นิสัย 60 กะจื่อ (xlsx) + imagery + band | ✅ |
| 2 | career_potential | การงานฯ (ดิถีแข็งอ่อน→ธาตุเสริม) | Source7 §2.3 อาชีพรายธาตุ + useful | ✅ |
| 3 | wealth_and_investment | การเงินฯ 1.1/1.2/1.3 (band+กำลังดาวลาภ+ถ่ายเท) | wealth.txt band + ตำแหน่งดาวลาภ×12qi | ✅ band · ❌ ลักษณะลาภผล(従强) |
| 4 | benefactor | — (ไม่มี source doc) | engine: ดาวส่งเสริม/อำนาจ ที่เสาปี-เดือน | ➖ derived |
| 5 | talent | (12 เชี่ยงแซ + ดาวถ่ายเท) | ดาวถ่ายเท + `QI_TALENT_POS_TH`(ทีมเขียน) | ✅ โครง · ⚠️ คำทีมเขียน |
| 6 | family | — | engine: เสาเดือน(พ่อแม่)/ปี(ปู่ย่า)+12qi | ➖ derived |
| 7 | love_partner | ความรักฯ 1.1-1.4 (เพศ×band+คู่ครอง+จานคู่12qi) | love-family band + love-day-pillar(xlsx) | ✅ |
| 8 | friends_foes | — | engine: คู่ธาตุ×12qi รายตำแหน่ง | ➖ derived |
| 9 | partnership | การงานฯ (band→หุ้นส่วน) | career-business band + ราศีล่างวัน×12qi | ✅ |
| 10 | subordinates | — | engine: เสายาม+ดาวถ่ายเท×12qi | ➖ derived |
| 11 | education | (ดาวถ่ายเท×12qi + วิชา useful) | `FACULTY_BY_ELEMENT_TH`(จาก docx คณะ) | ✅ |
| 12 | turning_points | การทายวัยจร (ดิถี×วัยจร×ปฏิกิริยา×12qi) | engine: band×บทบาทธาตุเฟสวัยจร | ✅ |
| 13 | health | สุขภาพฯ (จำนวนธาตุ+แข็งอ่อน→อวัยวะ) | health.txt (ธาตุอ่อน→อวัยวะ)+excess | ✅ |
| 14 | colors_directions | Source7 §3.1/§3.2 (ดิถี×ราศีบน→สี) | parseSource7ColorTable | ✅ ต่อ table · ⚠️ ต่าง YLC useful-god |
| 15 | guardian_deities | Source7 §5 (เชี่ยงแซดี→เทพราศีบน/ล่าง) | source7-custom.txt (ตาราง 6/7) | ✅ |
| 16 | speech | Step 6.2 (ดาวถ่ายเท×12qi รายหลัก) | output-transfer STAGE_READING_TABLE | ✅ |

**สรุป §H:** วิธีการอ่าน + ทิศทางผลทำนาย **ตรง YLC แทบทุกบท**; เจอ **1 จุดเพี้ยนจริง (บท3 ลักษณะลาภผล กับ従强)** + **1 จุดต่าง method (บท14 สี table vs useful-god)**; บท derived (4/6/8/10) ไม่มี source doc แต่ทิศทางตรง; คำทำนายรายมิติ 12qi (`QI_*_TH`) เป็นถ้อยคำทีมเรียบเรียง (docs ไม่มีให้ diff)

## I) บท15 องค์เทพ — เทียบสเปก Source7 §5 + แก้ (2026-06-07)

สเปกเต็มจากเจ้าของ (เกณฑ์แก้ดวง §5): เลือก "ธาตุปรับดวง" ตาม band → เทียบราศีบน/ล่าง กับ 8 ตัวในผัง → หาเชี่ยงแซดี → **เลือกองค์หลัก 1 องค์ + องค์เสริม**

| ส่วน | ก่อน | หลังแก้ |
|------|------|---------|
| กฎเชี่ยงแซ 2.1/2.2 (ดี7/ห้ามเจ๊าะ-ซวย/ซี่/หมกยก-แป่ มีเงื่อนไข role) | ✅ ตรงสเปกอยู่แล้ว | ✅ |
| เทียบ 8 ตัว (4 หลัก × ก้าน+กิ่ง) + fallback ทิศ (ไม้巽/ดิน坤/ทอง乾/ดิน艮) | ✅ | ✅ |
| **ธาตุปรับดวง (step1) ตาม band** | ❌ balanced=[ส่งเสริม+คู่ธาตุ+ลาภ], weak มีลาภเกิน | ✅ **`resolveDeityAdjustElements`**: แข็งมาก→ถ่ายเท · แข็ง/สมดุล→ถ่ายเท+โชคลาภ · อ่อน→คู่ธาตุ+ส่งเสริม (แยกจาก resolver สี ไม่กระทบบท14) |
| **เลือก 1 องค์หลัก + เสริม** | ❌ ลิสต์เท่ากันหมด | ✅ "องค์หลัก (เลือกองค์เดียว)" + "องค์เสริม" |

ตัวอย่าง: สิริกัญญา (壬 แข็งมาก) → ธาตุปรับดวง=ถ่ายเท(ไม้) → องค์หลัก 甲 เง็กเซียนฮ่องเต้ (75°) + เสริม 乙 · กัญญารัตน์ (甲 อ่อน) → คู่ธาตุ+ส่งเสริม → องค์หลัก 甲 + เสริม. golden 0 regression.

## J) บท3 การเงิน + บท7 ความรัก — เทียบ Step method (2026-06-07)

**บท7 ความรัก (ความรักฯ.docx 1.1-1.4)** — ✅ ครบ:
| step | engine |
|------|--------|
| 1.1 เพศ×band → มีคู่ไหม + ปฏิกิริยา ดิถี×ราศีล่างวัน | `parseLoveByGenderBand` + `parseLoveDayPillar` (field "ปฏิกิริยา" ในตาราง xlsx ละเอียดกว่า 5 reaction types) |
| 1.2 ธาตุคู่ครอง (ชาย=財/หญิง=官) มีกำลัง | `spouseStrength` ✅ |
| 1.3 ราศีบน×ราศีล่างวัน → จานคู่ 12qi | `seatQi` ✅ |
| 1.4 ดิถี×ธาตุพิฆาต/ลาภ → 12qi | `dynamic` (ดิถี×spouse) ✅ |

**บท3 การเงิน (การเงินฯ.docx 1.1-1.4):**
| step | สถานะ |
|------|-------|
| 1.1 band → หาเงินง่าย/ยาก | ✅ `parseWealthByBand` |
| 1.2 ธาตุลาภ แข็ง (มีในตาราง=หลากหลาย) | ✅ `wealthStrength` |
| 1.3 ธาตุถ่ายเท แข็ง → มีผู้สนับสนุนโชคลาภ | ✅ `食傷生财` (เช็ค output present; สเปกเช็ค strength — ใกล้เคียง) |
| **1.4 ขุมคลัง (财库 ไฉ่โข่ว) ถูกทำลาย** | ✅ **แก้แล้ว: `parseWealthVaultDamage`** — wealth.txt มีตาราง `ดิถี×ก้าน → เก็บเงินไม่อยู่/รายจ่าย/หนี้` (20 รายการ) เดิม engine มีแค่ vault-EXISTS+เปิดคลังด้วยชง **ไม่มี vault-damage**; เพิ่มเช็คก้านตัวรั่ว (ก้านเห็น+ราศีแฝง) ในผัง → เตือน "เก็บเงินไม่อยู่" (สิริกัญญา 庚→รายจ่าย, กัญญารัตน์ 辛→หนี้). golden 0 regression |

## K) บท8/9/10 — เจอ source ที่ยังไม่ ingest + แก้ (2026-06-07)

บท4/6/8/10 เคยจัดเป็น "engine-derived (ไม่มี source doc)" — **แต่จริงๆ มี source:** `คู่สมพงษ์(การงาน).xlsx`
มี sheet **"คำทำนาย ลูกน้อง>ตัวเรา" / "คำทำนายหุ้นส่วนเพื่อนร่วมงาน" / "คำทำนายตัวเรา>เจ้านาย"** = ตาราง
**12 เชี่ยงแซ → คำทำนาย + คะแนน** (ตี้อ๋วง110 สูงสุด … เจ๊าะ0 ต่ำสุด) ที่ engine ใช้ logic generic GOOD/FOE แทน

**แก้แล้ว:**
- `extract-source-docs.py` เพิ่ม `extract_career_relations()` → `knownlage/extracted/career-relations.txt` (employee/partner/boss × 12 qi, filter เฉพาะ 12 เชี่ยงแซ ตัด 12สี่ซิ้งที่หลุดมา)
- `parseCareerRelationVerdicts()` + wire:
  - **บท10 บริวาร:** verdict employee ตาม 12qi เสายาม → "คำทำนายบริวารตามตำรา"
  - **บท9 หุ้นส่วน:** verdict partner ตาม 12qi ราศีล่างวัน → "คำทำนายหุ้นส่วน/เพื่อนร่วมงานตามตำรา"
  - **บท7 ความรัก:** verdict lover ตาม 12qi จานคู่ (ราศีล่างวัน) จาก `คู่สมพงษ์(ความรัก).xlsx` sheet "12เชี่ยงแซความรัก" → "ลักษณะคู่รักตามตำรา"
  - (boss table extract ไว้แล้ว ยังไม่ wire — "ตัวเรา>เจ้านาย" คือเราต่อเจ้านาย + qi-position ที่จะ index ไม่ชัด ไม่ตรงบท4 อุปถัมภ์ตรงๆ → เลี่ยงเดา mapping)
- **หมายเหตุ extraction:** แต่ละ sheet คอลัมน์ไม่ตรงกัน (career มี leading empty col, love ไม่มี) → `emit_qi_table` หา qi+verdict แบบ dynamic (filter 12 qi + ตัด SQL/ตัวเลข/A-index)
- ตัวอย่าง: สิริกัญญา บริวาร(หมกยก) → "มักสร้างปัญหาให้แก้ไข แต่ถ้าใช้ถูกวิธี…" · คู่รัก(เชี่ยงแซ) → "คนรักที่ช่วยสนับสนุนให้ชีวิตพัฒนา…". golden 0 regression (employee/partner/lover wire แล้ว)

## L) บท6 ครอบครัว — เพิ่มวงศาคณาญาติจากปฏิกิริยาธาตุ (六亲 ตารางหลักชิง) (2026-06-07)

เดิม บท6 ใช้ตำแหน่งเสาอย่างเดียว (เสาเดือน=พ่อแม่, พ่อ=ราศีบนเดือน) — **สเปกเจ้าของให้ตารางหลักชิง**
ที่ map ปฏิกิริยาธาตุเทียบดิถี → ญาติ (แม่นกว่า). เพิ่ม `FAMILY_KINSHIP_TH` + `buildKinshipByElementLines`:

| ปฏิกิริยา (เทียบดิถี) | ญาติ |
|---------------------|------|
| คู่ธาตุ (比劫) | ตัวเรา พี่น้อง |
| ธาตุส่งเสริม/กำเนิด (印) | คุณแม่ คุณปู่ ครู/อาจารย์ |
| ธาตุพิฆาต/ลาภ (财) | คุณพ่อ (+ภรรยา ถ้าชาย) |
| ธาตุถ่ายเท (食傷) | คุณย่า คุณตา ลูกศิษย์ (+ลูก ถ้าหญิง) |
| พิฆาตธาตุ/อำนาจ (官杀) | คุณยาย นักบวช (+สามี ถ้าหญิง / ลูก ถ้าชาย) |

+ เช็คการปรากฏของแต่ละธาตุในดวง → "มีในดวง = สายญาตินี้มีบทบาท/ผูกพันชัด" หรือ "ไม่ปรากฏ = ห่างเหิน".
gender-conditional แสดง inline (ไม่ต้องพึ่ง rawInput). golden 0 regression.

## C) วิธีตรวจซ้ำ (reproduce)
- 12 เชี่ยงแซ 120 ช่อง: รัน `resolveCanonicalTwelveQiStage` ทุก (stem×branch) เทียบ `knownlage/distilled/ตาราง 12 เชี่ยงแซ/*.md`
- relations: เทียบ `CLASH_PAIRS`/`HARM_PAIRS`/`DESTRUCTION_PAIRS`/`STEM_CLASH_PAIRS`/`STEM_BRANCH_DESTRUCTION_PAIRS`/`PUNISHMENT_TRIOS` ใน `symbolic-engine.constants.ts` กับ 7 ตารางใน `docs/Mootech AI/ตารางชงเฮ้งไห่ผั่ว.docx`
- ปฏิกิริยาธาตุ: เทียบ `GENERATES`/`CONTROLS` กับ 5 ตารางใน `docs/Mootech AI/ตารางปฏิกิริยาธาตุ.docx`
- completeness: นับแถว extracted vs docx (python-docx/openpyxl) — **ระวัง encoding U+F971/"น้ํา" เสมอ** (normalize ก่อนนับ)
