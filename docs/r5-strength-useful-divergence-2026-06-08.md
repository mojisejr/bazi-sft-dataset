# R5 เฟส 1 — Diagnostic: engine vs ซินแส (strength band + useful-god)

> 2026-06-08 · เครื่องมือ: [scripts/r5-strength-diagnostic.ts](../scripts/r5-strength-diagnostic.ts) + ground truth [scripts/lib/sinsae-ground-truth.ts](../scripts/lib/sinsae-ground-truth.ts) (9 ดวง: 6 gptCase + 3 YLC) → `out/r5/divergence.md`
> วิธี: engine คำนวณด้วย `calculateBaziChart` (deterministic, ไม่พึ่ง DB) · useful จาก `getEngineUsefulElements` · band จาก `getEngineStrengthBand`

## ผลวัด (9 ดวง)

| chart | ดิถี | ฤดู | score | engine band | ซินแส band | Δband | engine useful | ซินแส useful | ขาด | 调候 |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 癸 | ร้อน | 3.25 | weak | weak | 0 | ไฟ,ทอง | น้ำ,ไฟ | น้ำ | ร้อน→ขาดน้ำ |
| B | 庚 | ร้อน | 2.75 | weak | weak | 0 | ดิน,ทอง | ดิน,ทอง,น้ำ | น้ำ | ร้อน→ขาดน้ำ |
| กัญญารัตน์ | 甲 | หนาว | 2.25 | weak | weak | 0 | น้ำ,ไม้ | ไม้,น้ำ | - | - |
| วรรัตน์ 1988 | 甲 | ร้อน | −1.25 | **very-weak** | weak | **−1** | น้ำ,ไม้ | น้ำ,ไม้ | - | - |
| ประภา 1986 | 癸 | ใบไม้ร่วง | 2.75 | weak | weak | 0 | ไฟ,ทอง | ไฟ,ทอง | - | - |
| ภวรัญชน์ | 壬 | ใบไม้ผลิ | 0.25 | **very-weak** | weak | **−1** | ทอง,น้ำ | น้ำ,ทอง,ไฟ | ไฟ | - |
| เกศสรินทร์ | 甲 | หนาว | 4 | balanced | balanced | 0 | ไม้ | ไม้,ไฟ | ไฟ | หนาว→ขาดไฟ |
| สิริกัญญา | 壬 | ร้อน | 7.25 | very-strong | very-strong | 0 | ไม้,ไฟ | ไม้,ไฟ | - | - |
| ชัยธรณ์ | 壬 | ใบไม้ผลิ | 2.5 | weak | weak | 0 | ทอง,น้ำ | (n/a) | - | - |

## ข้อสรุป

### 1. 调候 (climate) — แพทเทิร์นชัด, แก้ได้ ✅
useful-god ต่างซินแส **4/8 ดวง** และ **3 ใน 4 เป็น 调候**: ฤดูร้อนซินแสเติม **น้ำ** (A, B), ฤดูหนาวเติม **ไฟ** (เกศสรินทร์) — engine (扶抑 ล้วน) ไม่มี layer นี้
- ที่เหลือ 1 ดวง (ภวรัญชน์ ขาด **ไฟ**) = ซินแสรวม 财 (wealth) ที่ engine สาย weak มาตรฐานไม่ใส่
- **เคส A ซ้อน 2 ปัญหา:** กฎ wealth-leverage จุดเป็น [ไฟ(财),ทอง(印)] แทนที่ [น้ำ(比),ไฟ] ที่ซินแสให้ → ทั้งทิ้ง 比劫(น้ำ) และไม่มี 调候

### 2. strength band — กดแรง 1 ขั้น 2 ดวง แต่ **แก้ด้วย threshold ไม่ได้** ⚠️
- engine very-weak แต่ซินแส weak: **วรรัตน์ 1988 (−1.25)** และ **ภวรัญชน์ (0.25)**
- **ตัวบล็อก:** ภวรัญชน์ score = **0.25** → ซินแสว่า weak · แต่ golden `real-case-1993-11-24` score = **0.25** ตรึงเป็น very-weak (ดิถีอ่อนเกินไป) → **คะแนนเท่ากันแต่ band ที่ต้องการต่างกัน** ⇒ ขยับ threshold อย่างเดียวแก้ไม่ได้ ต้องแก้ "สูตรคะแนน" หรือยอมรับว่า ground truth ยังก้ำกึ่ง
- ซ้ำร้าย label ของ 1993 เองก็ก้ำกึ่ง (docs/strength-labeled-dataset-candidates: structural=ดวงอ่อน, AI gen=อ่อนเกินไป)
- → **แนะนำเลื่อน band calibration** จนมี labeled charts เพิ่ม (memory [[strength-1988-divergence]] เตือนไว้ถูก) · ห้ามเพิ่ม drainage penalty (ยิ่งกดลง)

## ข้อเสนอเฟส 2 (รออนุมัติ)

### 2a — เติม 调候 layer ใน `resolveUsefulElements` (คุ้มสุด, เสี่ยงคุมได้)
หลังได้ useful จาก 扶抑 แล้ว ปรับตามฤดู:
- เดือนร้อน (巳午未) + ดิถีไม่ร้อนล้น → ดัน **น้ำ** เข้า useful (ถ้ายังไม่มี)
- เดือนหนาว (亥子丑) + ดิถีไม่เย็นล้น → ดัน **ไฟ** เข้า useful
- ทดสอบกับ ground truth 9 ดวงนี้: คาดว่าปิด gap A/B/เกศสรินทร์ (3/4) โดยไม่ทำดวง autumn/spring (1986, สิริกัญญา, กัญญา) เพี้ยน
- **golden ที่อาจกระทบ → re-baseline ตามซินแส:** ตรวจ `topic-knowledge.test` (sample score 2.1 weak), `topic-knowledge-generalization`, `real-case-*` ว่ามี assert ลำดับ/เซ็ต useful ของดวงฤดูร้อน-หนาวไหม · 1986/1988 career = ซินแสอยู่แล้ว (ไม่ต้องแก้)

### 2b — band calibration (เลื่อน)
รอ labeled charts เพิ่ม (เป้า 15-20) โดยเฉพาะดวง score ~0–1 ที่ซินแสฟันธง weak/very-weak ชัด เพื่อแก้ความก้ำกึ่ง score 0.25 → คนละ band

## ✅ เฟส 2 — ทำแล้ว (2026-06-08)

### 2a 调候 layer ([topic-knowledge.ts](../src/lib/bazi/topic-knowledge.ts) `applyTiaohou`)
หลัง 扶抑: เดือนร้อน (巳午未) + ดวงไม่แข็งล้น → เติม **น้ำ**; เดือนหนาว (亥子丑) + ดวงสมดุลขึ้นไป → เติม **ไฟ** (append, กัน reorder; ดวงอ่อนหน้าหนาวยังเน้น 扶抑 ก่อน เพื่อไม่ทำ กัญญารัตน์ เพี้ยน)

### 2b band calibration ([operator-strength.ts](../src/lib/bazi/constants/operator-strength.ts))
เพดาน very-weak **2 → −2** → 1988 (−1.25), ภวรัญชน์ (0.25), 1993 (0.25) = **weak** · re-baseline golden `real-case-1993` (displayLabel → "ดิถีอ่อน") + `operator-phase2-constants` (probe very-weak → −2.5)

### ผลหลังแก้ (diagnostic 9 ดวง)
| metric | ก่อน | หลัง |
|---|---|---|
| band mismatch | 2 | **0** |
| 调候 gap | 3 | **0** |
| useful mismatch | 4/8 | **1/8** (เหลือ ภวรัญชน์ ขาด 财-ไฟ — นอกขอบ 调候) |

- **test คง 532 passed / 7 skipped / 0 fail** (กระทบ golden แค่ 2 ไฟล์ → re-baseline ตามซินแส)
- ผลข้างเคียงที่คาด: LLM ground (engine useful) ดีขึ้น → A/B similarity น่าจะขยับขึ้น (ยังไม่รันซ้ำ)

### ⚠️ caveat (ข้อมูลบาง)
- band threshold −2 อิงดวงที่ต้องการ shift แค่ 2 ใบ (1988, ภวรัญชน์) + 1993 ที่ label ก้ำกึ่ง → very-weak แทบไม่จุดแล้ว · ถ้าได้ labeled charts เพิ่มที่ซินแสฟันธง very-weak จริง ให้ทบทวน threshold อีกครั้ง
- 调候 winter→fire อิงดวง 甲 หนาว 2 ใบ (กัญญา weak ไม่เติม / เกศ balanced เติม) — ระวัง overfit ถ้าเจอธาตุอื่นหน้าหนาว

## ✅ เฟส 2 รอบเสริม (2026-06-08)

### R5.2c — เทพองค์หลัก อิง useful god ✅ (แก้แล้ว)
[topic-knowledge.ts](../src/lib/bazi/topic-knowledge.ts) `resolveDeityAdjustElements` weak/very-weak: `[dm, resource]` → **`[resource, dm]`** (ส่งเสริม印 นำ คู่ธาตุ比劫 ตาม) → ดวง M (己 อ่อน) เทพองค์หลัก = **ธาตุไฟ** (ตรงซินแส "เสริมไฟ/เทพเตาไฟ") ไม่ใช่ธาตุดิน · สอดคล้อง `resolveUsefulElements` + colors §2.1 · test 532 ผ่าน (deity test ใช้ contains ไม่ใช่ลำดับ)

### R5.2b — เพิ่ม labeled data (14 ดวง) + ปรับ 2a guard
- เพิ่ม DNA 4 ดวง + M(1993 ซินแสยืนยันวาจา) → ground truth **14 ดวง**
- **2a officer-guard:** ห้ามเติมธาตุ 调候 ที่เป็น "ดาวอำนาจ官杀" ของดิถี (ดิถีไฟ + น้ำ=官杀 → ห้ามเติมน้ำหน้าร้อน) — แก้ DNA3 (丙) ที่ 2a เคยเติมน้ำผิด
- ผล 14 ดวง: **band mismatch 1, useful ขาด 2/13, 调候 gap 0**
- **finding ใหม่ (ทิศตรงข้าม):** DNA3 (丙 summer) engine = **balanced (4.5)** แต่ซินแส = **strong** (Δ−1 ฝั่งสูง) → band ก็ "ต่ำเกิน" ได้ ไม่ใช่แค่ "กดแรงเกิน" · ทำให้ useful ขาด ดิน (strong ควรระบายด้วย output ดิน) — **ยืนยันว่า band calibration ต้องมีข้อมูลมากกว่านี้ก่อนขยับ threshold ฝั่ง strong** (เลื่อนตามเดิม)

## 🔎 finding เพิ่ม — deity primary-selection (แก้แล้วใน R5.2c ข้างบน)
ดวง M (1993, 己 weak) ซินแสบอก useful=ไฟ, **เทพ "เฉพาะเทพเจ้าเตาไฟ" (ไฟ), ทิศไฟ/ใต้** · engine บท 14 (สี) ใช้ useful ถูก (ไฟนำ) แต่ **บท 15 (เทพ) เลือก "องค์หลัก" เป็นธาตุดิถีเอง (己=ดิน → พระกษิติครรภ์/พระพรหม)** แทน useful (ไฟ) → เทพเตาไฟตกไปอยู่ "องค์เสริม ธาตุไฟ"
- root: logic เลือกองค์หลักในบทเทพใช้ธาตุดิถี (ที่ขึ้นเชี่ยงแซดี) ไม่ใช่ useful god — ดวงอ่อนควรชี้เทพ "ธาตุเสริมตัว" เป็นหลัก
- เป็นงานแยก (มี golden test เทพผูก ต้อง validate) — เสนอ R5.2c: ให้ "องค์หลัก" บทเทพอิง `resolveUsefulElements` (ตัวแรก) สำหรับดวง weak/very-weak

## ✅ เฟส 2 รอบเสริม 2 (2026-06-08 ต่อเนื่อง)

### R5.2c+ — เทพ "องค์เดียว" เจาะจง ✅
[topic-knowledge.ts](../src/lib/bazi/topic-knowledge.ts): เปลี่ยน `isAdjustCharUsable` (boolean) → `scoreAdjustChar` (น้ำหนักเชี่ยงแซ: 帝旺=6, 临官/长生=5, 冠带=4, 养/胎/墓=2, เงื่อนไข ซี่/หมกยก/แป่=1) แล้ว rank candidate ในธาตุเดียวกันใน `buildCustomDeities` (สูง→ต่ำ, เสมอ=คงลำดับตำรา stable)
- ผล: ดวง M (己) องค์หลัก = **ธาตุไฟ (ราศีบน 丁): เทพเจ้าเตาไฟ** (丁 ขึ้น 长生/เชี่ยงแซ ที่ 酉 สองตำแหน่ง) นำหน้าเทพสุริยัน (丙 ไม่มีเชี่ยงแซดี) — ตรงซินแส "เฉพาะเทพเจ้าเตาไฟ"
- lock: `real-case-1993-11-24` (เตาไฟ before สุริยัน + ข้อความองค์หลักเป๊ะ)

### R5.2b — band ฝั่ง strong: กฎ 得令 เฉพาะจุด ✅
[topic-knowledge.ts](../src/lib/bazi/topic-knowledge.ts): `isSeasonalCommand` (ธาตุดิถี = ธาตุกิ่งเดือน = 月令旺) + `resolveStrengthBand` ยก **balanced→strong เฉพาะดวงถูกฤดู** ชดเชย 得令(+2) ที่ตัดจากสูตร (strength-scoring-spec ห้ามเติมกลับทั้งระบบ)
- **ไม่แตะ `strengthScore`/`classifyOperatorStrengthScore`** → golden ทั้งหมด + displayLabel ราย score ไม่เปลี่ยน · ไม่ดัน global threshold (กัน overfit ดวงที่ไม่ 得令)
- ผล diagnostic 14 ดวง: **band ต่าง 0** (DNA3 丙 summer 4.5 → strong, useful [ดิน,ทอง] ตรงซินแส) · useful ขาด **1/13** (เหลือ ภวรัญชน์ ขาด 财-ไฟ นอกขอบ) · 调候 gap 0 · เกศสรินทร์ (ไม่ถูกฤดู) ยัง balanced
- lock: `real-case-dna-4-charts` (case3 → strong, case2 ไม่ถูกฤดู → weak)

### R5.2C — dynamic band ข้ามวัยจร: เลื่อน (ตามมติเจ้าของ)
`buildLuckPhaseVerdict` ยังใช้ band natal คงที่ · dynamic ต้องมี ground truth trajectory ที่ยังไม่มี → ทำไปเสี่ยง invent claim

## หมายเหตุ (เฟส 1)
- diagnostic เพิ่ม export wrapper (`getEngineUsefulElements`/`getEngineStrengthBand`) — รันซ้ำได้ผลเท่าเดิม: `npx tsx scripts/r5-strength-diagnostic.ts`
