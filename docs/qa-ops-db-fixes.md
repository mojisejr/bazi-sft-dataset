# QA DB-content fixes — ทำที่ /ops (ไม่ deploy, ไม่แตะ prod จาก repo)

รายการนี้เป็นการแก้ "ข้อมูลในแถว DB prod" ที่โค้ดถูกต้องอยู่แล้ว — ให้ operator รันผ่าน /ops / SQL console
ตรวจ (SELECT) ก่อนเสมอ แล้วค่อย UPDATE

## สถานะหลังตรวจ DB จริง (2026-09-11)
- ✅ P1-7/P1-8/P1-13 — รัน seeder แล้ว (insert terms/about, update payments + birth-edit 150 ชี่) ขึ้น prod แล้ว
- ✅ P2-11 — ไม่ต้องแก้: payment_package QI_60=฿35 / QI_200=฿99 / QI_500=฿249 / QI_1200=฿499 (บาท) + description ตรง → ถูกต้องอยู่แล้ว
- ⚠️ P3-16 — ไม่ใช่แถว DB: table worship_guide ไม่มีจริง (มีแค่ bazi_help_article + almanac_usage=log LLM) ข้อความ "เวลาเดินทาง 40 ชม." เป็นข้อความที่ AI สร้าง → แก้ด้วย SQL ไม่ได้ ต้องคุมที่ prompt/validation ตอน generate (งานแยก P3)

## P2-11 — โค้ดแพ็กชี่ vs จำนวน/ราคาไม่ตรง (90/900/2100)

ข้อเท็จจริงจากโค้ด (`mootech-fe/lib/payment/catalog.ts`) — จำนวนชี่ต่อแพ็กมาจากโค้ด (แก้ที่ deploy),
ราคา (amount) มาจากแถว `payment_package` (แก้ที่ /ops):

| package_code | QI (โค้ด) | โบนัส (โค้ด) | ราคาที่ควรเป็น (พี่พล 2026-09) |
|---|---|---|---|
| QI_60   | 90   | +0   | ฿35  |
| QI_200  | 300  | +45  | ฿99  |
| QI_500  | 900  | +260 | ฿249 |
| QI_1200 | 2100 | +816 | ฿499 |

ตรวจแถวจริง:
```sql
SELECT package_code, amount, currency, is_active FROM payment_package
WHERE package_code IN ('QI_60','QI_200','QI_500','QI_1200') ORDER BY amount;
```
ถ้า `amount` ไม่ตรงตาราง ให้แก้ (หน่วยสตางค์หรือบาทตาม schema จริง — ตรวจก่อน):
```sql
UPDATE payment_package SET amount = 35  WHERE package_code = 'QI_60';
UPDATE payment_package SET amount = 99  WHERE package_code = 'QI_200';
UPDATE payment_package SET amount = 249 WHERE package_code = 'QI_500';
UPDATE payment_package SET amount = 499 WHERE package_code = 'QI_1200';
```
หมายเหตุ: FE โชว์จำนวนชี่จากโค้ด (`QI_PACK_QTY`) และราคาจากแถว DB อยู่แล้ว — ถ้าหน้าจอยังโชว์ตัวเลขขัดกัน
ให้ตรวจว่าแถว DB ตรงตารางนี้ ไม่ต้องแก้โค้ด

## P3-16 — worship_guide: "เวลาเดินทาง 40 ชม." (ข้อความผิดใน DB)

เป็นข้อความในตาราง content (worship/สิ่งศักดิ์สิทธิ์) ไม่ใช่ค่าจากการคำนวณ ⇒ cleanup ที่ /ops
หาแถวที่มีข้อความ:
```sql
SELECT id, title, body FROM worship_guide WHERE body LIKE '%40 ชม%' OR body LIKE '%40 ชั่วโมง%';
```
⚠️ ค่าที่ถูกต้องต้องยืนยันกับทีมเนื้อหา (น่าจะเป็นหน่วย/ตัวเลขที่พิมพ์ผิด) แล้ว UPDATE เฉพาะแถวนั้น:
```sql
-- UPDATE worship_guide SET body = REPLACE(body, '40 ชม.', '<ค่าที่ถูกต้อง>') WHERE id = '<id>';
```
(ชื่อ table/column ด้านบนเป็นชื่อคาดการณ์ — ปรับตาม schema จริงก่อนรัน)
