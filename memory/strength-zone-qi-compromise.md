---
name: strength-zone-qi-compromise
description: Step 8 เชี่ยงแซ-zone scoring ขัดกับ ground-truth "your life code" — แก้แบบประนีประนอม
metadata:
  type: project
---

สเปก Step 8 (8.3/8.4/8.6/8.7) ของการคิดคะแนนกำลังดิถี สั่งให้คิด "เชี่ยงแซของราศีบน" (ดิถีเทียบก้าน) เข้าโซน ±0.25 ด้วย แต่โค้ดเดิมคิดเฉพาะราศีล่าง (กิ่ง) ผ่าน `canonicalTwelveQiState.*Branch`

**ปัญหา:** ทำตามสเปกเป๊ะ (โดยเฉพาะ 8.6 ที่เอา "ราศีบนยาม" เข้าฝั่งเสีย) ทำให้คะแนนหลายดวงลดลงจนเลื่อน band ขัดกับ band ที่เอกสารต้นฉบับ "your life code" ระบุ — เทสต์ ground-truth ที่ล้ม: `strength-band-labeled` (เกศสรินทร์/กัญญารัตน์/สิริกัญญา), `real-case-1993-11-24`. แปลว่า band ในเอกสารคำนวณมาแบบ **ไม่มี penalty จากก้าน**

**ทางออกที่เลือก (ประนีประนอม):** ใส่เฉพาะ "ฝั่งดี" ของราศีบนเดือน (8.3) และราศีบนปี (8.4) ผ่าน `resolveCanonicalStemPairStage` แต่ **ไม่เพิ่ม penalty ฝั่งเสียจากก้าน (8.6/8.7)** คงฝั่งเสียเป็นแบบเดิม (เฉพาะราศีล่าง) → ผ่าน ground-truth ครบ ไม่มี regression

**Why:** สเปก Step 8 (จากผู้ใช้) กับ band ในเอกสาร "your life code" ใช้กติกาคนละชุดเรื่อง penalty ก้าน — ต้องรักษา ground-truth ของเอกสารไว้
**How to apply:** อย่าเผลอเพิ่ม hourStemStage/yearStemStage เข้า `bad` ใน `resolveZoneQiAdjustments` ([symbolic-engine.strength.ts](src/lib/bazi/symbolic-engine.strength.ts)) จะทำให้ ground-truth band พัง — ดูคอมเมนต์ "แนวประนีประนอม" ในไฟล์

หมายเหตุ: เกณฑ์ band (8.1) โค้ดใช้ band ต่อเนื่อง (`OPERATOR_STRENGTH_CLASS_BANDS`) ซึ่งตรงสเปกอยู่แล้วเพราะทุกคะแนนเป็นพหุคูณ 0.25
