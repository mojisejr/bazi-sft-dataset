---
name: doc-export-engine-vs-llm
description: doc export ใช้ engine หรือ LLM ราย topic — engine ครบ/ถูก, LLM polish มักย่อ-ตัด
metadata:
  type: project
---

ใน doc export (`reading-docx.ts` ← `/api/reading/export-docx`), แต่ละบทเลือกได้ว่าจะ render จาก **engine** (`buildTopicHumanReading` ใน topic-knowledge.ts) หรือจาก **LLM polish**. กลไก: route รับ `readings` เป็น map ราย topicId — บทไหนอยู่ใน map ใช้ LLM, บทไหนไม่อยู่ ใช้ engine.

**Why:** ผู้ใช้พบว่าคำทำนายในตัวอย่างผิด (อาชีพถูกตัด, "การศึกษา" จัดผิดเป็นธาตุไม้ ทั้งที่ source = ธาตุไฟ, นิสัยเป็น generic). ตรวจแล้ว engine **ถูกและครบ** — Market ใช้เซี่ยงแซเสาปี, Useful God ดึง string เต็มจาก source7, บทที่ 1 ดึงนิสัยราศีบน/ล่าง/เซี่ยงแซจาก `ลักษณะนิสัย60แบบ...csv`. ตัวที่ย่อ/ตัด/เพี้ยนคือชั้น **LLM** (gemini-draft-generator / orchestrator/prompt-builder).

**How to apply:** บทที่ข้อมูลต้องครบห้ามตัด → บังคับ engine โดยไม่ส่งเป็น override. ทำใน `ReadingPathWorkspace.tsx` ผ่าน `ENGINE_ONLY_TOPIC_IDS`.

⚠️ สำคัญ: override/`topicStates`/`readings` คีย์ด้วย **TOPIC_PATH id** (topic-path.ts) ไม่ใช่ BAZI_TOPIC_IDS (topic-types.ts) — สองระบบนี้ชื่อต่างกัน! แมป: บท1=`chart_foundation`, บท2=`career_potential`, บท3=`wealth_and_investment`, บท4=`benefactor`, บท5=`talent`, บท6=`family`, บท7=`love_partner`, บท8=`friends_foes`, บท9=`partnership`, บท10=`subordinates`, บท11=`education`, บท12=`turning_points`, บท14=`health`, บท13=`colors_directions`, บท15=`guardian_deities`. ปัจจุบัน engine-only = บท1-14. (บท11: เพิ่ม `FACULTY_BY_ELEMENT_TH` จาก `knownlage/extracted/education-faculty.txt`. บท12 turning_points: ตัดให้สั้น — `buildLuckCycleReading` คืนแค่ lead+windows+liuNian; `buildDaYunCharacterBreakdown`+`buildLiuNianYearlyForecast` ถูก unwire กลายเป็น dead code (เก็บไว้ re-enable ได้ มี eslint warning 2 จุด). บท14 สีรถ fallback ใช้ธาตุส่งเสริม 印 เมื่อตาราง Source7 ไม่มี. บท15 guardian_deities: `buildCustomDeities` เพิ่มความหมายตามบทบาทธาตุ `DEITY_ROLE_BENEFIT_TH` (ลาภ→โชคลาภ/ลงทุน, ส่งเสริม→ผู้ใหญ่/สุขภาพ ฯลฯ).)

**engine บท 1-15 ครบแล้ว.** (บท 2 อาชีพ: audit + ขยายลิสต์อาชีพทั้ง 5 ธาตุใน `source7-enhancement.txt` §2.3 ให้ครบตามไฟล์ `อาชีพของธาตุต่างเทียบการเรียนคณะ สาขา คอสเรียน.docx` — แก้ "การศึกษา" ไม้→ไฟ, จัดธาตุถูกต้องทุกตัว.) บทเสริม (ตารางวัยจรหลังบท15) ใน `reading-docx.ts` ลบคอลัมน์ "เส้นขีดที่ทำงาน" (relationLine) ออกแล้ว เหลือ ช่วงอายุ/เสาวัยจร/คำอธิบายดี-ร้าย. ขั้นต่อไป: งาน LLM ตาม [[llm-quality-plan]].

ถ้าจะแก้คุณภาพ LLM ต้องไปที่ prompt ของ generator ไม่ใช่ engine. ดู [[doc-export-table-changes]].

บทที่ 3 โชคลาภ อ่าน 2 เซียงแซต่อตำแหน่งดาวลาภ (implement แล้วใน `buildWealthReading`):
- **ตัวแรk ~80%** = เซียงแซเทียบดิถี — ช่องก้าน: `ก้านตำแหน่ง × กิ่งวัน`; ช่องกิ่ง: `ก้านวัน × กิ่งตำแหน่ง`
- **ตัวหลัง ~20%** = self-seat 自坐: `ก้านเสานั้น × กิ่งเสานั้น` (ขยาย/เสริมแรงตัวแรก; ถ้าซ้ำ = ตอกย้ำ)
ใช้ `resolveDisplayTwelveQiStage(stem, branch)` จาก pillar-display.ts. ตัวอย่างดวง 己酉(ดิถี): 癸×酉=แป่, 己×亥=ทอ, 壬×酉=หมกยก, 己×酉=เชี่ยงแซ.
