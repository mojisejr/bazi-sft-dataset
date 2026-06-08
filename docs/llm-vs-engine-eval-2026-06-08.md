# ประเมิน: deterministic engine แทน LLM enrich ได้ไหม (2026-06-08)

> รัน `npx tsx scripts/compare-llm-vs-aigen.ts` 1 ครั้ง (เคส M: 1993-11-24 15:09 ชาย, ดิถี 己 อ่อน, ผัง 癸酉 癸亥 己酉 壬申) เทียบ engine (ground หลัง R3) vs LLM (gemini-3.1-flash-lite) บน 9 บทที่ซินแสแก้เยอะ — เป็นการประเมินเชิงคุณภาพครั้งเดียว (LLM ไม่ deterministic)

## สรุปผลรวม
**engine แทน LLM ได้ในทุกบทที่ทดสอบ** — และในหลายมิติ engine **ปลอดภัยกว่า**

| บท | "คำแก้ที่ควรเห็น" อยู่ใน engine? | ข้อสังเกต LLM |
|---|---|---|
| chart_foundation | ✅ (แก่นเชี่ยงแซ 长生 = กำเนิดใหม่/เริ่มต้น) | ลื่นกว่าเล็กน้อย ไม่ drop |
| career_potential | ✅ (Target/Market เชี่ยงแซเสาปี แป่=ทางไกล/ออนไลน์/สุขภาพ/ทันสมัย) | ⚠️ ลงท้าย "...ครับ" (ผิดกฎ no honorific) |
| wealth_and_investment | ✅ (โชคลาภหลายตำแหน่ง ปี/เดือน/ยาม ครบ) | 🔴 **scope creep** — LLM เพิ่ม "คณะ/วิชา", "สีที่ส่งเสริมโชคลาภ", "องค์เทพ" ที่ไม่ใช่เรื่องของบทโชคลาภ |
| love_partner | ✅ (ตารางหลักวัน 己酉=เชี่ยงแซ ส่งเสริมเจริญรุ่งเรือง) | 🔴 **drop/แปลง marker** — LLM แปลง `酉` → "ระกา" ทำให้ marker จีนหาย |
| friends_foes | ✅ (มิตร/ศัตรู/ประคองตามตำแหน่ง × เชี่ยงแซ) | เทียบเท่า |
| partnership | ✅ (ราศีล่างวัน 酉 เชี่ยงแซ → มีหุ้นส่วนได้ + พี่เลี้ยง) | เทียบเท่า |
| subordinates | ✅ (หมกยกเสายาม = บริวารต้องขัดเกลา, น้ำขุ่นต้องกรอง) | เทียบเท่า |
| turning_points | ✅ (วัยจรเทียบทีละตัวอักษร, tag [ยุคทอง]/[เฝ้าระวัง] ครบ) | เทียบเท่า รักษา tag ได้ |
| guardian_deities | ✅ (เทพเฉพาะดวงจากตัวอักษรเชี่ยงแซดี) | เทียบเท่า · หมายเหตุ: expect ระบุ "พระสังกัจจายน์ 酉" แต่ทั้ง engine+LLM ออกองค์หลักธาตุดิน/ไฟ (ธาตุปรับดวง) ไม่ใช่ 酉(ทอง) — เป็นจุดที่ logic เลือกเทพของ engine ต่างจาก expect เดิม ไม่ใช่ปัญหา LLM |

## ข้อสรุปเชิงคุณภาพ
- **ข้อเท็จจริง/marker:** engine ครบทุกบท · LLM **ไม่เคยเพิ่ม fact ที่ engine ไม่มี** (ถูก ground ด้วย excerpt) แต่ **เผลอ drop/แปลง marker** (เช่น `酉`→ระกา ในบท love) และ **scope creep** (บท wealth เพิ่มสี/คณะ/เทพ)
- **โทนภาษา:** LLM ลื่น/ร้อยเรียงต่อเนื่องกว่าเล็กน้อย — แต่หลัง R3 (lead-clause + weaveNarrative) engine อ่านเป็นร้อยแก้วได้ดีพอแล้ว ช่องว่างแคบลงมาก
- **ความเสี่ยง LLM:** ไม่ deterministic · เผลอ honorific ("ครับ") · drop marker · scope creep · ต้อง API key + เน็ต + ต้นทุน
- **ความเสี่ยง engine:** ~0 (deterministic, marker ผูก test, ไม่หลอน)

## ข้อเสนอ
**ตัด LLM ออกจาก path หลักได้** — ประโยชน์ของ LLM (ลื่นขึ้นเล็กน้อย) ไม่คุ้มความเสี่ยง (drop marker / scope creep / honorific / ต้นทุน) โดยเฉพาะเมื่อ engine เป็น ground truth ที่ test คุมอยู่แล้ว

แนวทางที่แนะนำ (เลือกระดับ):
1. **คงสภาพปัจจุบัน** — engine เป็น default (`mode="engine"`) อยู่แล้ว, LLM เป็น opt-in ผ่าน apiKey → ไม่ต้องทำอะไรเพิ่ม ก็ปลอดภัย
2. **ตัด dependency ให้สะอาด (แนะนำ)** — ลบ/ปิด path `mode="llm"` ใน [route.ts](src/app/api/reading/topic/route.ts), เอา `reading-llm.ts` + สคริปต์ LLM ออกจาก surface หลัก, ลบ `GEMINI_API_KEY` ออกจาก runtime requirement → ลดความซับซ้อน + ตัดความเสี่ยง key/ต้นทุนถาวร

> ถ้าจะเก็บ LLM ไว้เป็น experimental ควรเพิ่ม guard กัน 2 จุดที่ LLM พลาด: (ก) ห้ามแปลงอักษรจีน (`酉` ฯลฯ) เป็นไทย, (ข) ห้ามขยายหมวดข้ามบท (scope creep) — แต่ถ้าตัดทิ้งก็ไม่ต้องดูแลส่วนนี้

## หมายเหตุความปลอดภัย
`GEMINI_API_KEY` รั่วผ่าน conversation (จาก agent รอบก่อน print ค่าจริง) → ควร **rotate key** ที่ Google Cloud Console (key อยู่แค่ใน local `.env` ที่ gitignore แล้ว ไม่อยู่ใน git)
