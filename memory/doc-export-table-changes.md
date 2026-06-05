---
name: doc-export-table-changes
description: ตารางใน doc export — ลำดับเสา และคอลัมน์ปฏิกิริยาวัยจร
metadata:
  type: project
---

ใน `reading-docx.ts`:
- **ตารางดิถีประจำตัว** (`pillarTable`) เรียงคอลัมน์ เสายาม→เสาวัน(ดิถี)→เสาเดือน→เสาปี (ไม่ใช่ ปี→เดือน→วัน→ยาม)
- **ตารางวัยจร** (`daYunTable`) มีคอลัมน์ "ปฏิกิริยา" = บทบาทธาตุวัยจรเทียบดิถี (คู่ธาตุ/ถ่ายเท/โชคลาภ/พิฆาต/ส่งเสริม) ดึงจาก `buildDaYunTableRows` ใน topic-knowledge.ts ซึ่ง map จาก `resolveRelationRole` (logic เดียวกับบทเสริมหลังบทที่ 15) ผ่าน `RELATION_ROLE_REACTION`.

ดู [[doc-export-engine-vs-llm]].
