# Reading Knowledge Coverage — บล็อก "ผลการทำนายภาษามนุษย์" (/reading)

สรุปว่าหัวข้อใดมี "องค์ความรู้ภาษามนุษย์" (deterministic จาก `knownlage/`) แล้ว และหัวข้อใดยังขาด
แหล่งความจริงของโค้ดคือ `getTopicKnowledgeCoverage()` ใน [topic-knowledge.ts](../src/lib/bazi/topic-knowledge.ts)

## สถานะปัจจุบัน (รอบ Rev 4 / Batch 1)

✅ = มีคำทำนายภาษามนุษย์แล้ว (deterministic จาก knownlage) · ❌ = ยังขาด (รอ ingest)

| บท | หัวข้อ | มีคำทำนายภาษามนุษย์ | แหล่ง / คีย์ |
|----|--------|:--:|------|
| 1 | พื้นฐานดวงชะตา (chart_foundation) | ✅ | `ลักษณะนิสัย60แบบ...txt` (ดิถี+กิ่ง+ธาตุ:เชี่ยงแซ) |
| 5 | พรสวรรค์ (talent) | ✅ | `ลักษณะนิสัย60แบบ...txt` |
| 13 | สุขภาพ (health) | ✅ | `extracted/health.txt` (ธาตุอ่อนแอ→อวัยวะ) |
| 3 | โชคลาภ (wealth_and_investment) | ✅ | `extracted/wealth.txt` (strength band) |
| 2 | อาชีพ/ธุรกิจ (career_potential) | ✅ | `extracted/source7-enhancement.txt` 2.3 (useful element) |
| 14 | สี/ทิศมงคล (colors_directions) | ✅ | `extracted/source7-enhancement.txt` 2.1 (useful element) — *มีสี/อัญมณี/วัตถุมงคล ยังไม่มี "ทิศ" ในแหล่งนี้* |
| 15 | องค์เทพ (guardian_deities) | ✅ | `extracted/source7-enhancement.txt` 2.2 (useful element) |
| 7 | ความรัก/คู่ครอง (love_partner) | ✅ | `extracted/love-family.txt` 1.1 (เพศ × strength band) |
| 9 | หุ้นส่วน (partnership) | ✅ | `extracted/career-business.txt` 1.1 (strength band → ควรทำธุรกิจ) |
| 4 | ผู้อุปถัมภ์ (benefactor) | ✅ | engine-derived: ดาวส่งเสริม/อำนาจ ที่เสาปี-เดือน + PILLAR_CONTEXT_MAP |
| 6 | ครอบครัว (family) | ✅ | engine-derived: เสาเดือน(พ่อแม่)+เสาปี(ปู่ย่า)+interactionState |
| 8 | เพื่อน/ศัตรู (friends_foes) | ✅ | engine-derived: คู่ธาตุ + 12 เชี่ยงแซ (ดี→เพื่อน/เสีย→ศัตรู) |
| 10 | ลูกน้อง/บริวาร (subordinates) | ✅ | engine-derived: เสายาม + ดาวถ่ายเท + 12 เชี่ยงแซ |
| 11 | การเรียน (education) | ✅ | engine-derived: ดาวถ่ายเท + วิชา useful element |
| 12 | ช่วงอายุ/วัยจร (turning_points) | ✅ | `extracted/luck-cycle.txt` (band × บทบาทธาตุของเฟสวัยจรปัจจุบัน) |

> Batch 1: บท 1, 2, 3, 5, 13, 14, 15 (knownlage txt)
> Batch 2: บท 12 วัยจร (knownlage txt)
> Batch 3: บท 7 ความรัก, บท 9 หุ้นส่วน (knownlage txt)
> Batch 4: บท 4, 6, 8, 10, 11 (engine-derived ตามกฎ — ground จาก engine ไม่ใช่วลีสำเร็จรูป)
>
> **ครบทั้ง 15 บท** ✅ — บทที่เป็น engine-derived ให้ผลแบบ "อ่านตามกฎ"; ใช้โหมด LLM เพื่อขัดเกลาเป็นสำนวนแบบ 1.docx ได้

## วิธีเพิ่มองค์ความรู้ของหัวข้อที่ยังขาด
1. แตกไฟล์ `.docx` ที่ระบุข้างต้นเป็น `.txt` (จัดรูปแบบคีย์ให้ค้นได้ เช่น ตามธาตุ/ดิถี/ราศี/เชี่ยงแซ)
2. เพิ่ม parser + lookup ใน [topic-knowledge.ts](../src/lib/bazi/topic-knowledge.ts) และใส่ topicId ลงชุดที่รองรับ
3. อัปเดตตารางนี้ + เพิ่มเทสต์ใน `tests/topic-knowledge.test.ts`
