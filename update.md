# สถานะงาน "อ่านดวง 15 บท (NewData)" — อัปเดต 2026-06-22

> ทุกอย่างอยู่ใน NewData (box เดียว) แล้ว · แอดมินแก้ที่ `/reading/newdata` (บันทึก = ลง DB ทันที) · อ่านที่ `/reading/newdata-reading`
> ความครอบคลุมปัจจุบัน: **engine เติมครบทุกบท ยกเว้น 3 บทที่ doc มาร์ก "กำลังแก้" (13 บางส่วน/14/15) + กล่อง "ข้อเสนอแนะ" ที่ตั้งใจให้พิมพ์เอง**

---

## ✅ ทำเพิ่มรอบล่าสุด (2026-06-24, บน `pdf-dev`) — แก้บั๊ก + format จากการเทียบซินแส 4 ดวง (庚/辛/甲/丁)

> ขอบเขต: กระทบ **เฉพาะ `/reading/newdata-reading`** · ไม่แตะ `/reading` หลัก, strength engine กลาง, domain power
> ฐานก่อนแก้: commit `5b5617e`

**โค้ด (3 ไฟล์):**
- **得令 (เกิดถูกฤดู)** `newdata-lookup.ts` — `isInSeason`/`seasonalStrengthId`/`seasonalCareerBand`: ยก band +1 เมื่อกิ่งเดือน=ธาตุดิถี (丁 ใน 午: สมดุล→แข็ง) ใช้ใน `matchCareer`+`matchDayMasterStrength` → "ควรทำ" ตรงซินแส
- **avoidElementsTh** `career-finance-table.ts` — "ไม่ควรทำ": 官杀 อันดับ 1 เสมอ + 印 อันดับ 2 (ดวงไม่อ่อน) · เพิ่ม `careerBandFromId` → ตรง 4/4
- **benefactor 印** — เพิ่ม role `"resource"` ใน `matchElementRoleState` (หาเสาที่ธาตุ印นั่งจริง โทนตามเสา) แทน hardcode เสาเดือน
- **friends มิตรแท้** — อ่านเสาปี (ผู้ใหญ่หนุน) แทนเสาวัน
- **ตัด daYunTransfer** (ก็อปซ้ำ "X ถ่ายเท Y") ออกจาก turning_points
- **turning_points** — `matchDaYun` ใหม่ + `LuckPhase`: วัยจรช่วงละ 5 ปี รูป "อายุ X-Y ปี[ ช่วงปัจจุบัน] (สัญลักษณ์ บทบาทธาตุ → เชี่ยงแซ)"
- **รูปแบบป้ายสไตล์ซินแส** — helper `pillarLabel` + `toBlock(labelOverride)` → `เสา{ตำแหน่ง} {กะจื่อ} ({เชี่ยงแซ})` (คงอักษรจีน) ทั้ง 5 matcher · พ่อ/แม่ แยก qi กันแล้ว

**ข้อมูล DB (`bazi_newdata`) seed เพิ่ม:**
- `health_by_element` 5 ธาตุ (จาก `knownlage/extracted/health.txt` §5.1) → บท 13 เติม
- `auspicious_by_element` 28 เซลล์ `{หมวด}|{ธาตุ}` (harvest คำซินแส 4 ดวง) → บท 14 เติม

**↩️ วิธี revert กลับก่อนแก้รอบนี้:**
```bash
git checkout 5b5617e -- src/lib/bazi/newdata-lookup.ts src/lib/bazi/chapter-newdata-map.ts src/lib/bazi/constants/career-finance-table.ts
```
ลบ seed (ถ้าต้องการ): `DELETE /api/reading/newdata?groupKey=health_by_element&itemKey=<ธาตุ>` และ `groupKey=auspicious_by_element&itemKey=<หมวด|ธาตุ>` (ไม่ลบก็ได้ — ถ้า revert โค้ดแล้ว resolver ยังเรียกใช้กลุ่มเดิมตามปกติ)

**ยังไม่ทำ (รอซินแส/ต้นฉบับ):** `deity_by_element`, `subordinate_60`, เกรด 0-3 + คำทำนายรายช่วง + ปีจร (turning_points), `auspicious_by_element` ที่ขาด (สี|ไฟ/ไม้/น้ำ, สัตว์มงคล)

---

## ✅ ทำเพิ่มรอบก่อน (2026-06-22, บน `pdf-dev`)

- **บท 6 พ่อ/แม่** — พ่อ=เชี่ยงแซราศีบนหลักเดือน · แม่=เชี่ยงแซราศีล่างหลักเดือน (matchPillarState tier upper/lower)
- **บท 7 ลักษณะชีวิตคู่ 60 box** — สกัด xlsx → `love-base-60.json` · group `love_base_60` · wire ganzhiOf หลักวัน (เลิกใช้สูตร 5 ธาตุ)
- **บท 5 พรในราศีแฝง** — matchHiddenTransfer (ดิถีถ่ายเท→ราศีแฝง 藏干 หลักยาม)
- **บท 8 มิตรแท้/ศัตรู** — +หลักวันเชี่ยงแซ · +ผั่วไฉ่โข่ว
- **UI** — ช่องเวลาเกิดเปลี่ยนเป็น dropdown 24 ชม. (ชม.00–23 : นาที)
- ⚠️ บท 5/6/8 เป็น interpretive — รอซินแสตรวจกลไก (ดู `questions-for-sinsae.md` A1)

---

## ✅ ทำเสร็จก่อนหน้า (push บน `pdf-dev`)

- **ย้าย 3 ตารางเก่า → NewData box แล้วลบระบบเก่าทิ้ง** (แท็บ "ข้อมูลหลักแบบใหม่"/CoreDataPanel)
  - `daymaster_strength` (50 ช่อง ดิถี/กำลัง — **ว่าง รอซินแสกรอก**)
  - `zodiac_nisai` (12 นักษัตร) · `ganzhi_nisai` (60 กะจื่อ) — seed จาก knownlage แล้ว
- **บท 2 อาชีพ/ธุรกิจ** — ตารางหาอาชีพ (ธาตุดิถี×กำลัง×ธาตุเดือน) + อาชีพ 5 ธาตุ
- **บท 1/3/5/12 ดิถีถ่ายเท** — group `dithi_transfer` (118 คีย์)
- **บท 7 ความรัก** — ลักษณะชีวิตคู่ + ลักษณะคู่ครอง + โอกาสมีคู่ (เพศ×กำลัง)
- **บท 9/10** — ทรัพย์ (ผั่วไฉ่โข่ว) + ลักษณะบริวาร (เสายาม)
- **บท 15 ทำบุญเสริมดวง** — ตารางทำบุญ 5 ธาตุ
- ร้อย **gender** เข้าระบบการอ่าน (ใช้บทความรัก)

---

## ⏳ เหลือทำ — แบ่งตามว่าใครต้องส่งข้อมูล/ตัดสินใจ

### 🟡 รอซินแสกรอก/ส่งข้อมูล (dev ทำเองไม่ได้ ไม่มีไฟล์)
- [ ] **บท 1 · กล่อง "กำลังดิถี" (50 ช่อง)** — เปิดแอดมิน `/reading/newdata` กลุ่ม `daymaster_strength` กรอกได้เลย (กล่องพร้อม รอเนื้อ)
- [x] **บท 7 · "ลักษณะชีวิตคู่ 60 box"** — ไฟล์ครบแล้ว → สกัด xlsx → `knownlage/NewData/love-base-60.json` (60 กะจื่อ) · group `love_base_60` · wire box[0] ด้วย ganzhiOf หลักวัน · seed ลง DB แล้ว (เลิกใช้สูตร 5 ธาตุ love_base)
- [ ] **บท 14 · สี/ทิศมงคล (9 box)** — ยังไม่มีไฟล์เลย
- [ ] **บท 15 · องค์เทพ (3 box แรก: คุ้มครอง/ขอพรงาน/ขอพรโชคลาภ)** — ยังไม่มีไฟล์
- [ ] **box "ข้อเสนอแนะ / จิตวิทยาฮีลใจ" ทุกบท** — รอแนวคำของซินแส

### 🔴 รออาจารย์คอนเฟิร์ม
- [ ] **Matching เจ้านาย / หุ้นส่วน / บริวาร** — ซินแสบอกได้ข้อมูลไม่ตรงกัน 2 รอบ (บท 10 ลักษณะบริวารพื้นดวงทำแล้ว แต่ "matching ดวงลูกน้อง 60 กะจื่อ" ยังรอ)

### 🟠 ต้องตัดสินใจ/คอนเฟิร์มก่อน (interpretive — dev เดาได้แต่ควรให้ซินแสตรวจ)
- [x] **บท 5 · box "พรในราศีแฝง"** — wire แล้ว: ดิถีถ่ายเทไปยังราศีแฝง(藏干)ของหลักยาม (reuse dithi_transfer) ⚠️ รอตรวจ
- [x] **บท 8 · มิตรแท้/ศัตรู** — มิตรแท้ +หลักวันเชี่ยงแซ · ศัตรู +ผั่วไฉ่โข่ว (reuse) ⚠️ รอตรวจ ("คู่ธาตุเชี่ยงแซ" ยังไม่ทำ ไม่มีกลไกชัด)
- [x] **บท 6 · ลักษณะพ่อ/แม่** — wire แล้วด้วย reuse เชี่ยงแซ: **พ่อ = เชี่ยงแซราศีบนหลักเดือน · แม่ = เชี่ยงแซราศีล่างหลักเดือน** (matchPillarState tier upper/lower) ⚠️ รอซินแสตรวจว่ากลไกถูก
- [ ] **บท 7 box "ข้อเสนอแนะ"** — เดาแนวได้
- [ ] **บท 4 · box "ธาตุถ่ายเท(บริวาร)" + "ธาตุโชคลาภ(ลูกค้า)"** — ⚠️ ซินแสเขียน **"ลบทิ้ง"** ใน docx → **อย่าเติม** รอยืนยันว่าจะลบ bullet หรือเก็บ

### ✅ ทำแล้วแต่ขึ้นกับดวง (ไม่ต้องทำเพิ่ม)
- บท 13 สุขภาพ: wire แล้ว (ชง/จื่อเฮ้ง/ซำเฮ้ง/ไห่) — ดวงที่ไม่มีปฏิกิริยาเหล่านี้จะว่างตามจริง

---

## หมายเหตุเทคนิค
- เพิ่มกลุ่ม/บทใหม่ → seed: `node --env-file=.env --import tsx scripts/seed-reading-newdata.ts` (ON CONFLICT DO NOTHING ไม่ทับงานซินแส, `--force` ทับ, `--dry-run` ดูผล)
- matcher ที่มีให้ reuse: `dithiTransfer · daYunTransfer · career · merit · loveBase · loveChance · spouseStar · dayMasterStrength · branchOf · ganzhiOf · phua · state · branchPairs · stemPairs · selfPunish · samHeng · trinity · daYun`
- ต้องยืนยันกับซินแส: heuristic "อาชีพไม่ควรทำ" (เดาจากความสัมพันธ์ธาตุ ไม่มีในไฟล์) + จุดพิมพ์เพี้ยนในตารางหาอาชีพ (บล็อกธาตุทอง)
