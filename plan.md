# แผนงาน: คำทำนาย BaZi — engine deterministic + LLM ขัดเกลา + ตรงซินแส

> อัปเดต 2026-06-08 (รอบใหญ่) — สรุปสถานะปัจจุบันหลังทำ consumer render, Gemini A/B tuning, R5 (调候+band+เทพ), ปรับการแสดงผลหน้าอ่าน
> ประวัติเก่าดูได้จาก git log / memory/ · เอกสารวิเคราะห์อยู่ใน docs/*-2026-06-08.md

## เป้าหมาย
ให้ engine แต่งคำทำนายเอง deterministic (ครบ 16 บท) ลื่นสไตล์ your life code / gptCase **คงข้อเท็จจริง/marker** ที่ test ผูก และ **ไม่เพิ่ม claim โหราศาสตร์ใหม่** · LLM (Gemini) เป็น layer ขัดเกลาให้ใกล้ gptCase · ทิศทางความถูกต้อง = **ตรงซินแส**

สถานะ test: **532 passed / 7 skipped / 0 fail** · deterministic 100%

---

## ✅ เสร็จแล้ว (session 2026-06-08)

### A. Narrative engine (เดิม) — ลื่นสไตล์ YLC ครบ 16 บท
`reading-phrases.ts`, `topic-knowledge.ts`: weaveNarrative + chapter opening/headline + closing simile (`ELEMENT_CLOSING_SIMILE_TH`/`TOPIC_CLOSING_SIMILE_TH`) + หัวข้อ temper + bulletize · ดู [[gptcase-style-enhancements]]

### B. Consumer render (ถอด scaffolding) — `humanizeConsumerProse`
ถอด qi%, รหัส hanzi→qi, ผั่ว/ชง, Step 6.2 ออกเป็นร้อยแก้วผู้บริโภค · `buildTopicConsumerReading` · เปิดผ่าน API `mode="consumer"` + docx `variant`

### C. Gemini prompt A/B tuning — [docs/gemini-prompt-tuning-2026-06-08.md]
- prompt profile สลับได้ (`reading-prompt-profiles.ts`: baseline / **gptcase-tuned** (ใช้จริง))
- scoring (embedding cosine + LLM-judge) + A/B harness (`scripts/ab-prompt-tester.ts`)
- ผู้ชนะ = **gptcase-tuned + consumer ground** → ตั้ง default ของ Gemini path ใน route.ts
- หลังแก้ engine (R5) A/B subset ขยับ 77.4 → **81.0** (corpus เต็ม 8 เคส = 76.7)

### D. R5 — strength/useful-god ตรงซินแส — [docs/r5-strength-useful-divergence-2026-06-08.md]
- **diagnostic** (`scripts/r5-strength-diagnostic.ts` + `scripts/lib/sinsae-ground-truth.ts`, 14 ดวง)
- **2a 调候 layer** (`applyTiaohou`): ร้อน→เติมน้ำ / หนาว→เติมไฟ (มี officer-guard กันเติม 官杀)
- **2b band calibration**: เพดาน very-weak 2 → −2 (1988/ภวรัญชน์/1993 = weak) — ซินแสยืนยันวาจา M(1993)="ดินอ่อน"
- **2c เทพองค์หลัก** อิง useful god (ดวงอ่อน → เทพธาตุเสริมตัว ไม่ใช่ธาตุดิถี)
- ผล: band match 10/10, useful match 12/13 (เหลือ ภวรัญชน์ ขาด 财-ไฟ) · ดู [[strength-1988-divergence]]

### E. ปรับการแสดงผลหน้าอ่าน (TopicCard)
- ตารางความสัมพันธ์ → **แตกรายเสาจริง** (เพิ่ม `carriers` ใน relationSummary)
- วิธีการอ่าน → ละเอียดรายหัวข้อ (auditFocus + evidenceLines + per-relation)
- คำอ่าน → **ข้อความ knownlage ตรง ๆ** (`getTopicKnownlageExcerpt`)
- deepNote วัยจร (A) ไม่พูดซ้ำสภาวะ qi (B) verdict เจาะจงราย role (`ROLE_OUTCOME`/`VERDICT_FRAME`) — รายช่วงในตัวเอง ไม่ข้ามปี

---

## กฎเหล็กที่ยึด
- เพิ่มแค่ **คำเชื่อม/เรียบเรียง/แปลง fact ที่ engine มี** — ห้ามเพิ่ม claim/ตัวเลขลอย
- คง substring marker ที่ test ผูก (`ดิถี X`, `ราศีล่างวัน X`, `อาชีพธาตุX`, qi labels, `[เฝ้าระวัง]`/`[ยุคทอง]`, อายุ)
- deterministic 100% · LLM ground จาก engine เท่านั้น ห้าม invent (faithfulness guard)
- ทิศทางความถูกต้อง = ตรงซินแส (มี ground truth labeled chart เป็นหลักฐาน)

---

## ▶ BACKLOG (เรียงตามคุ้ม)

### R5.2c+ — เทพ "องค์เดียว" เจาะจง (ทางเลือก)
ซินแส M บอก "เฉพาะเทพเตาไฟ" — ตอนนี้ engine นำด้วย "ธาตุไฟ" ถูกแล้ว แต่ตัวแรกเป็นเทพสุริยัน ไม่ใช่เตาไฟ · ถ้าจะเป๊ะต้อง rank เทพในธาตุเดียวกัน (ละเอียด)

### R5.2b/C — band + dynamic strength (รอข้อมูล)
- band ฝั่ง strong: DNA3 (丙 summer) engine=balanced แต่ซินแส=strong → ต้องการ labeled chart เพิ่ม (เป้า 15-20) ก่อนขยับ threshold ฝั่งสูง
- deepNote **dynamic band ข้ามวัยจร** (C) — ปรับ support/drain ตามกำลังสะสม ไม่ใช่ natal คงที่ (งานใหญ่ ต้องมี ground truth)

### R6 — 流年 รายปี
gptCase มีคำเตือนปีปฏิทิน (เช่น "ปี 2569") ที่ engine ยังไม่ผูก liunian เข้าบทวัยจร — เป็น fact ต้องต่อ liunian ไม่ใช่แต่งคำ

### R2 — 60-กะจื่อ ขาดเนื้อราศีล่าง 辰 (5 combos)
`knownlage/ลักษณะนิสัย60แบบ_*.txt` — ขอเนื้อจากซินแสแล้วเติม (มี fallback ระดับก้านคุมอยู่)

---

## Verification
- `npx vitest run` — ต้องคง **532 passed / 7 skipped / 0 fail**
- `npx tsx scripts/r5-strength-diagnostic.ts` → out/r5/divergence.md (band/useful/调候)
- `npx tsx scripts/ab-prompt-tester.ts --variants gptcase-tuned --ground consumer ...` (ต้องมี GEMINI_API_KEY)
- เช็ค deterministic: รันซ้ำ output เท่าเดิม
