# แผนงาน: Narrative Composer สไตล์ "your life code" (deterministic ครบ 16 บท)

> อัปเดต 2026-06-08 — รีเซ็ตจาก plan.md เดิม (ประวัติยาวหลาย session) ให้เหลือสรุปสถานะปัจจุบัน + ข้อเสนอต่อ
> ประวัติงานเก่า (Step 6.2 ถ่ายเท, band classifier/从强, 60-กะจื่อ encoding, LLM rollout, DOCX export) ดูได้จาก git log / memory/

---

## เป้าหมาย
ให้ **engine แต่งคำทำนายเองแบบ deterministic** (ไม่พึ่ง LLM นอก) ออกมาเป็น **ร้อยแก้วลื่นสไตล์ your life code (YLC)** ครบทั้ง 16 บท
โดย **คงข้อเท็จจริง/marker ทุกตัวที่ test assert** และ **ไม่เพิ่ม claim โหราศาสตร์ใหม่** (เติมแค่คำเชื่อม + เรียบเรียง + แปลง fact ที่ engine มีอยู่แล้ว)

อ้างอิงสำนวน: `example/your life code_*.docx` (6 ไฟล์) + `example/1.docx`

---

## ✅ สิ่งที่ทำเสร็จแล้ว (session 2026-06-08)

ไฟล์หลัก: `src/lib/bazi/reading-phrases.ts`, `src/lib/bazi/topic-knowledge.ts`
สถานะ test ตลอดงาน: **516 passed / 7 skipped / 0 fail** · deterministic 100% · marker เดิมครบ

### รอบ 1 — ความลื่นพื้นฐาน (3 ชั้น)
- **ชั้น A — Narrative weaver กลาง** (`weaveNarrative` + `NARRATIVE_CONNECTORS`): เติมคำเชื่อมหมุนเวียน (`นอกจากนี้/อีกทั้ง/ในอีกด้านหนึ่ง/...`) หน้าย่อหน้า body ตาม index (stable) · เสียบจุดเดียวใน `buildTopicHumanReading` → ครอบทุกบท
- **ชั้น B — ประโยคเปิดเจาะดวง** (`buildChapterOpening`): พาดหัวบทสไตล์ YLC (`CHAPTER_HEADLINE_TH` 16 บท) + ภาพดิถี (simile `STEM_NATURE_TH`) + ขั้ว + กำลัง (`BAND_OPENING_TH`) + แกนบท (`CHAPTER_ASPECT_TH`)
- **ชั้น C — บท1 บุคลิก**: เรียบเรียง keyword (`ดิถี/ราศีล่างวัน/ธาตุ:เชี่ยงแซ`) เป็นประโยคลื่น โดยคง substring marker

### รอบ 2 — ดึงสำนวน YLC ทั้ง 6 ไฟล์
- `CHAPTER_HEADLINE_TH` = ชื่อบทชวนอ่านตรงจากเอกสาร (เช่น "โชคลาภที่ถูกทาง โอกาสรวยอยู่แค่เอื้อม")
- `BAND_OPENING_TH` ใช้คำว่า "ดิถีอ่อน/ดิถีแข็ง" + วลี "พลังส่งมาไม่ถึงตัว"/"ต้นทุนชีวิตหนักแน่น"
- เพิ่มคำเชื่อม YLC: `อีกประการหนึ่ง`, `ในแง่นี้`

### รอบ 3 — อุดช่องว่างเนื้อหา (4 กลุ่ม)
- **🔴 บท5 พรสวรรค์** — กรณีไม่มีดาวถ่ายเทในผัง: ออกชุด "เก่งแต่ไม่โชว์ / เรียนรู้เชิงลึก / ถ่ายทอดคือศักยภาพสูงสุด" + ช่วงวัยที่พรสวรรค์เด่นตามวัยจร (`findTimingByElement`)
- **🔴 บท4 ผู้อุปถัมภ์** — เพิ่ม "ใครคือผู้อุปถัมภ์" แปลธาตุส่งเสริม/อำนาจเป็นตัวบุคคล (`FAMILY_KINSHIP_TH`)
- **🟡 ลิสต์→ร้อยแก้ว** — `isWeavableParagraph` ให้บล็อกลิสต์ที่มีหัวบรรทัดนำได้คำเชื่อมด้วย
- **🟢 Flavor** — บท1 เพิ่ม "นิสัยที่ควรพัฒนาเพื่อเสริมดวง" (`RESOURCE_VIRTUE_TH`)

### รอบ 4 — ขัดเกลาบทที่แน่นอยู่แล้ว (4 จุด)
- **บท13 สุขภาพ** — มิตินิสัย→อาการ ตามธาตุดิถี (`ELEMENT_HEALTH_BEHAVIOR_TH`)
- **บท14 สี** — สรรพคุณของสี (`ELEMENT_COLOR_BENEFIT_TH`)
- **บท8 เพื่อน/ศัตรู** — insight ผลประโยชน์ตามกำลังดิถี ("ได้ชื่อเสียง vs ได้เงิน")
- **บท2 อาชีพ** — หมายเหตุบรรเทา ("ถ้าเลี่ยงสายต้องห้ามไม่ได้ ให้เติมไม้/ไฟ")

---

## โครงคำทำนายต่อบท (ปัจจุบัน)
```
CHAPTER_INTRO_TH[topic]            ← คอนเซ็ปต์ทั่วไป (ย่อหน้าแรกเสมอ; test assert startsWith)
buildChapterOpening(...)           ← พาดหัว YLC + ภาพดิถี + กำลัง (เจาะดวงนี้)
weaveNarrative(body)               ← เนื้อหา engine ร้อยด้วยคำเชื่อม (marker ครบ)
buildChapterAdvice = CHAPTER_SUMMARY_TH[topic]   ← "สรุป: ..." (test assert)
```

## กฎเหล็กที่ยึดตลอด
- เพิ่มแค่ **คำเชื่อม / เรียบเรียง / แปลง fact ที่ engine มี** — ห้ามเพิ่มข้อมูลโหราศาสตร์/ตัวเลขลอย (เคยปฏิเสธ "กำไร 20% / สัญญา 12 เดือน" ของ YLC เพราะไม่ได้มาจากดวงจริง)
- คง substring ที่ test ผูก (`ดิถี X`, `ราศีล่างวัน X`, `อาชีพธาตุX`, `[เฝ้าระวัง]`, qi labels, อายุ ฯลฯ)
- ประโยคเปิดเลี่ยงคำว่า "ธาตุ" หน้าธาตุดิถี (เช่นใช้ "ไม้พลังหยาง") เพื่อไม่ชน assertion ลำดับ useful-god ในเนื้อหา
- deterministic 100% — คำเชื่อมหมุนตาม index ไม่มีสุ่ม

---

## ▶ ข้อเสนอต่อ (BACKLOG เรียงตามความคุ้ม)

### R1 — Commit งาน narrative (ทำก่อน)
งาน 4 รอบนี้ยังไม่ commit → แยกเป็นชุด เช่น
1. `feat(reading): narrative weaver + YLC chapter opening (ชั้น A/B/C)`
2. `feat(reading): YLC headlines + connectors จาก 6 ไฟล์`
3. `feat(reading): enrich talent(เก่งเงียบ) + benefactor(ใครคือผู้อุปถัมภ์)`
4. `feat(reading): health behavior / color benefit / friend insight / career mitigation`

### R2 — ข้อมูลต้นฉบับยังขาด (กระทบความถูกต้องจริง)
- **‼️ 60-กะจื่อ ขาดเนื้อราศีล่าง 辰 (5 combos: 甲辰/丙辰/戊辰/庚辰/壬辰)** ใน `knownlage/ลักษณะนิสัย60แบบ_*.txt` — ปัจจุบัน `buildPersonalityReading` มี fallback ระดับก้านคุมไว้ แต่เนื้อราศีล่าง 辰 เติมไม่ได้จนกว่าจะได้เนื้อหาจากซินแส → **ขอเนื้อหา 5 combos แล้วเติมเข้าไฟล์**
  (เคยสรุปผิดว่า "ขาดเพราะ encoding U+F971" → ส่วน encoding แก้ใน parser แล้ว แต่เนื้อ 辰 จริง ๆ ในต้นฉบับยังต้องตรวจ — ดู memory `sixty-jiazi-chen-encoding`)

### R3 — ขัดเกลา presentation เพิ่ม (ทางเลือก, คุ้มปานกลาง)
- **comma-dump lists** (บท career/colors/education) ยังเป็นลิสต์ยาวคั่นด้วยจุลภาค — YLC ใส่ "ประโยคนำกลุ่ม" ก่อนแล้วขึ้นบุลเลต; ถ้าทำต้องเพิ่ม lead-clause รายธาตุในแต่ละ builder (เสี่ยง test ปานกลาง คงต้องคง substring)
- **ภาพเปรียบปิดบท** แบบ YLC (เช่น "มหาสมุทรในตัวคุณจะสะท้อนแสงไกลสุดสายตา") — ตอนนี้ simile วนอยู่ที่ "บทเปิด" ทุกบทแล้ว ถ้าจะเพิ่มที่ "บทปิด" ต้องระวังซ้ำซาก (แนะนำหมุนตาม topic)

### R4 — บทที่ "แน่นพอแล้ว" (แนะนำปล่อยไว้)
บท 3 โชคลาภ / 6 ครอบครัว / 12 วัยจร / 15 องค์เทพ — ข้อมูลเท่าหรือมากกว่า YLC; การเติมเสี่ยง "รก" หรือ "เพิ่ม claim ลอย" มากกว่าได้คุณค่า

### R5 — งานระบบที่ค้างเดิม (ไม่เกี่ยว narrative โดยตรง)
- **drainage / 官杀 penalty** (band ฝั่งลบ) — ต้องมี labeled dataset กว้างกว่านี้ก่อน กัน golden ดวงสมดุล/อ่อนพัง
- **test fail เดิม** (corpus `all_distilled` ENOENT + home-page SSR) — pre-existing, เสนอ skip-if-missing + await effect
- **LLM enrich (ถ้ายังต้องใช้)** — ปัจจุบัน narrative engine ลื่นพอจะเป็น ground/แทน LLM ได้ในหลายบท; ถ้าจะคง LLM ให้รัน `scripts/compare-llm-vs-aigen.ts` เป็น regression

---

## Verification
- `npx vitest run` — ต้องคง **516 passed / 7 skipped / 0 fail**
- เทียบสายตา: รัน reading ดวง YLC (เช่น 1980-06-28 壬 หญิง) + 1.docx (1988-06-08 甲 หญิง) ว่าโทนใกล้ต้นฉบับ
- เช็ค deterministic: รันซ้ำ output เหมือนเดิมเป๊ะ
- ยืนยัน "ไม่มี claim ใหม่": ทุกคำที่เพิ่มเป็นคำเชื่อม/เรียบเรียง/แปลง fact เดิม

วิธี preview เร็ว: เขียน temp test ใน `tests/` เรียก `buildTopicHumanReading(state, topicId, raw)` แล้ว `writeFileSync` (alias `@/` resolve เฉพาะใน vitest)
