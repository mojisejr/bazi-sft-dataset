# Mumate — Product Blueprint (UX/UI)

> จัดทำ 2026-07-03 — ตอบ deliverable ในPRD `Mumate_Product_Requirements_Document_2026.pdf`
> ขอบเขต: LINE LIFF Mini App · Mood & Tone มินิมอล/ฮีลใจ · mobile-first · โหลดเบา
> อ้างอิง engine ที่มีจริง (ดู `Goal/Mumate-Plan.md` ตาราง Asset) — API: `calculate` / `reading/topic` / `mascot` / `man-vs-day` / `pair` / `work`

**ข้อจำกัด LIFF ที่ยึดตลอดทั้งเอกสาร**
- พื้นที่แคบ → ใช้ **bottom sheet / การ์ดเลื่อนแนวนอน** แทน modal เต็มจอ, ปุ่มหลักอยู่ล่างระยะนิ้วโป้ง
- แชร์ผ่าน **LIFF `shareTargetPicker` + Flex Message** (ไม่ใช่ screenshot)
- โหลดเบา: skeleton loader, lazy รูป Mascot, เรียก engine แบบ on-demand ทีละบท
- ปุ่มระบบใช้ **LINE UI native** ที่ทำได้ (login, share, close)

---

# ส่วนที่ 1 — User Flow Journey

## Flow A — ผู้ใช้ใหม่ (Onboarding → เห็นหน้า Home "The Cosmos")

| # | ขั้น | ผู้ใช้ทำ | ระบบทำ (เบื้องหลัง) |
|---|---|---|---|
| A1 | เปิดแอปจาก LINE | แตะลิงก์ LIFF / Rich menu | LIFF init → เช็ค `lineUserId` มีใน `mumate_user` ไหม |
| A2 | Splash | เห็นโลโก้ + ข้อความฮีลใจ 1 ประโยค | preload theme + ตรวจ session; ถ้าเคยสมัคร → ข้ามไป Home |
| A3 | Intent Check | เลือกความกังวลหลัก (การงาน/เงิน/รัก/สุขภาพ/ใจ) 1–3 ข้อ | เก็บ `intent[]` ไว้ปรับ default tab ของ My Destiny + จูน AI Chat |
| A4 | กรอกวันเกิด | วัน–เดือน–ปี, เวลา, เพศ, จังหวัด | validate; เตรียม `RawInput` (calendarSystem=solar, tz=Asia/Bangkok) |
| A5 | PDPA | อ่านสรุป + กดยินยอม | บันทึก consent + timestamp; ถ้าไม่ยินยอม → หยุด (ทำต่อไม่ได้) |
| A6 | MBTI (ข้ามได้) | ใส่ 4 ตัวอักษร หรือกด SKIP | เก็บ `mbti?`; ไม่บังคับ |
| A7 | ประมวลผล | เห็น loading ฮีลใจ | `POST /api/bazi/calculate` → `CalculatedState`; upsert `baziSavedChart` |
| A8 | ผลลัพธ์แรก | เห็น "ธาตุประจำตัว + นิสัยเชิงบวก" + CTA "ไปต่อที่ดวงเรา" | ดึงบทแรกจาก `POST /api/reading/topic` (consumer mode, topic แนะนำตัว) |
| A9 | เข้า Home | แตะ "ไปต่อ" | เข้า The Cosmos (โหลด Mascot + Today's Energy พร้อมกัน) |

**จุดสำเร็จ (success):** ผู้ใช้เห็น Mascot ประจำตัว + การ์ดพลังงานวันนี้ + รู้ธาตุ/นิสัยเชิงบวกของตัวเอง

## Flow B — ผู้ใช้เครียด → ใช้ "พื้นที่รับฟัง (Healing Circles)" แบบไม่ระบุตัวตน

| # | ขั้น | ผู้ใช้ทำ | ระบบทำ |
|---|---|---|---|
| B1 | อยู่หน้า Home รู้สึกแย่ | แตะการ์ด/เมนู "พื้นที่รับฟัง" | เข้า The Connect → แท็บ Healing Circles |
| B2 | เลือกโหมด | เลือก "ระบายปัญหา (Create Request)" | เตรียมฟอร์มแบบ **นิรนาม** (ไม่แสดงชื่อจริง/รูป) |
| B3 | เลือกอารมณ์/ธาตุ | แตะ chip อารมณ์ (เศร้า/เหนื่อย/สับสน…) + ธาตุ | ใช้ tag จับคู่กับ "ผู้รับฟัง (Hold Space)" ที่ว่าง |
| B4 | เขียนระบาย | พิมพ์ข้อความ (มี prompt ช่วยเริ่ม) | สร้าง request นิรนาม; ไม่ผูก `lineUserId` ที่แสดงผล |
| B5 | จับคู่ผู้รับฟัง | รอ/เห็นผู้รับฟังเข้ามา | match ตาม tag; เปิดห้องแชท private ในแอป |
| B6 | สนทนา | แชทระบาย 1:1 นิรนาม | ข้อความชั่วคราว/มีปุ่มปิดห้อง; มีปุ่มขอความช่วยเหลือฉุกเฉิน |
| B7 | จบ | กด "ขอบคุณ / ปิดพื้นที่" | ปิดห้อง; เสนอบันทึกความรู้สึกลง Manifest Journal |

**หลักการ Flow B:** ความปลอดภัย + นิรนามเป็นอันดับแรก, ลดแรงเสียดทานในการเริ่มพิมพ์, มี safety net (สายด่วน/รายงาน)

---

# ส่วนที่ 2 — Screen-by-Screen UI/UX Blueprint

> คอลัมน์: ชื่อหน้าจอ · เป้าหมายหลัก · UI Elements (เหมาะ LIFF) · การโต้ตอบ · Empty/Edge State

## Section 0 — Onboarding & Identity

| หน้าจอ | เป้าหมายหลัก | Key UI Elements | User Interactions | Empty / Edge State |
|---|---|---|---|---|
| Splash | สร้าง first impression + ตรวจ session | โลโก้กลางจอ, คำฮีล 1 บรรทัด, spinner บาง | auto-redirect เมื่อโหลดเสร็จ | offline → "เชื่อมต่อไม่ได้ ลองใหม่"; เคยสมัคร → ข้ามไป Home |
| Intent Check | รู้ความกังวลเพื่อปรับจูน | chip เลือกได้หลายอัน (5 หัวข้อ), ปุ่ม "ถัดไป" ล่าง | แตะ chip toggle; ต้องเลือก ≥1 | ไม่เลือก → ปุ่มถัดไป disabled + hint |
| Bazi Data Input | ได้ข้อมูลเกิดที่ถูกต้อง | date picker (พ.ศ./ค.ศ.), time wheel + "ไม่ทราบเวลา", dropdown จังหวัด, toggle เพศ | เลือกค่า → validate inline | เวลาไม่ทราบ → ใช้ default + เตือนความแม่นยำลด |
| PDPA Consent | ขอความยินยอมถูกกฎหมาย | สรุป bullet สั้น, ลิงก์ฉบับเต็ม (sheet), checkbox, ปุ่ม "ยินยอม" | ต้องติ๊กก่อนจึงกดต่อได้ | ปฏิเสธ → อธิบายว่าใช้แอปต่อไม่ได้ + ปุ่มออก |
| First Result | โชว์คุณค่าทันที (aha) | การ์ดธาตุ (ไอคอน+สี), bullet นิสัยเชิงบวก 3 ข้อ, ปุ่ม CTA "ไปต่อที่ดวงเรา" | แตะ CTA → Home; ปุ่มแชร์ | engine ล้มเหลว → retry + ข้อความปลอบใจ |
| MBTI (optional) | เสริมความแม่น (ไม่บังคับ) | ช่อง 4 ตัวอักษร หรือ 4 คำถามสั้น, ปุ่ม SKIP เด่น | ใส่/ข้าม | ข้าม = ค่าว่าง ไม่บล็อก flow |

## Section 1 — Home (The Cosmos)

| หน้าจอ | เป้าหมายหลัก | Key UI Elements | User Interactions | Empty / Edge State |
|---|---|---|---|---|
| Home Dashboard | ศูนย์รวมประจำวัน + ทางลัด | greeting แปรตามเวลา, Mascot การ์ตูน + คำทำนาย 1 ประโยค, Today's Energy Card (สี/ฤกษ์/กิจกรรม), ปุ่ม Daily Oracle, ปุ่มลัด AI Chat, bottom nav | ดึงลง refresh; แตะการ์ด → ปฏิทินรายวัน; แชร์ Mascot/การ์ด | ก่อนโหลด → skeleton; Mascot ไม่มีรูป → placeholder |
| Today's Energy (ราย detail) | ดูพลังงานวันแบบเต็ม | เสาวัน, สีมงคล, ฤกษ์ดี/ควรเลี่ยง, กิจกรรมแนะนำ, ปุ่มไปปฏิทินเดือน | เลื่อนดูวันอื่น; เพิ่มเข้า Calendar | วันไม่มีข้อมูล overlay → ใช้ค่า engine ล้วน |
| Daily Oracle | ให้กำลังใจ 1 ครั้ง/วัน | การ์ดไพ่คว่ำ, อนิเมชันเปิด, คำทำนายสั้น, ปุ่มแชร์ | แตะเปิดไพ่ (ล็อกหลังเปิด) | เปิดแล้ววันนี้ → โชว์ผลเดิม + countdown ถึงพรุ่งนี้ |
| AI Chat ("เพื่อนที่ดูดวงเป็น") | ปรึกษาแบบรู้ดวงเรา | ห้องแชท, quick-reply chips, พิมพ์อิสระ | ส่งข้อความ → ตอบโดย ground ผังดวง | ยังไม่เคยคุย → คำทักทาย + คำถามตัวอย่าง |

## Section 2 — Manifest & Tracking

| หน้าจอ | เป้าหมายหลัก | Key UI Elements | User Interactions | Empty / Edge State |
|---|---|---|---|---|
| Manifest Journal | บันทึกเป้าหมาย+ลงมือ | รายการเป้าหมาย, quote ประจำวัน, ปุ่ม "+เป้าหมาย", ช่องให้คะแนนความรู้สึก (สไลเดอร์/emoji) | เพิ่ม/ติ๊กสำเร็จ; ตั้งเวลาเตือน | **ยังไม่มีเป้าหมาย → ภาพ + "เริ่มเขียนสิ่งที่อยากให้เกิด"** + ปุ่มเริ่ม |
| Set Reminder | เตือนทำ manifest | เลือกโหมด: manual/auto-ดวง(ปฏิทิน)/auto-จากแชท, เวลา | ตั้งเวลา, เปิด/ปิด | ไม่ตั้ง → default เตือนเช้า |
| Streak View | สร้างนิสัยต่อเนื่อง | ปฏิทิน streak, ไฟ/เปลวจำนวนวัน | แตะวันดูบันทึก | streak = 0 → "เริ่มวันแรกวันนี้" |
| Achievement Summary | ภูมิใจ + แชร์ | กราฟิกสรุปสวย, Badge, Level bar, ปุ่มแชร์ | แตะ badge ดู detail; แชร์โซเชียล | ยังไม่มี badge → โชว์ badge ถัดไปที่ปลดล็อกได้ |

## Section 3 — My Destiny

| หน้าจอ | เป้าหมายหลัก | Key UI Elements | User Interactions | Empty / Edge State |
|---|---|---|---|---|
| Basic Chart (Free) | เข้าใจผัง 4 เสา ง่ายๆ | กราฟิก 4 เสา (สีตามธาตุ), ดิถีแข็ง/อ่อน, สรุปสั้น | แตะเสา → คำอธิบาย sheet | โหลด engine ช้า → skeleton |
| Deep Dive (Freemium) | เจาะราย งาน/เงิน/รัก | แท็บ 3 เรื่อง (default = intent), เนื้อบท, **ส่วนล่างเบลอ + ปุ่มปลดล็อก Premium** | สลับแท็บ (`reading/topic` ทีละบท); แตะปลดล็อก → paywall | ยังไม่ Premium → เบลอ + preview 1 ย่อหน้า |
| วัยจร/ปีจร | เห็นจังหวะชีวิตตามช่วง | timeline แนวนอน, ช่วงอายุ, ไฮไลต์ปีปัจจุบัน | เลื่อน timeline → รายละเอียดช่วง | — |
| Life Code Book | เชื่อม/ถามเนื้อเล่ม | ถ้ามีเล่ม: ปุ่มเปิดหัวข้อ + ถาม AI ในเล่ม; ถ้าไม่มี: ปุ่มซื้อ 1890/2390 (Hard Copy) | เปิดหัวข้อ; ถาม AI; ซื้อ | ไม่มีเล่ม → โหมดขาย + ตัวอย่างเนื้อหา |

## Section 4 — The Connect

| หน้าจอ | เป้าหมายหลัก | Key UI Elements | User Interactions | Empty / Edge State |
|---|---|---|---|---|
| Compatibility Matching | ดูสมพงษ์ 3 หัวข้อ | เลือกเรื่อง (รัก/งาน 3 แบบ/เสริม), เลือกคน, ผลคะแนน + facets | เลือกคู่ → `pair`/`work`; ดูผล | ยังไม่มีคู่ → เชิญเพิ่มเพื่อน |
| Friends | เชื่อมเพื่อน | รายการเพื่อน, ช่อง @user, ปุ่ม Invite | เพิ่มด้วย @; เชิญคนนอก | ไม่มีเพื่อน → ปุ่ม Invite เด่น + explain |
| World Discovery | เจอคน compatible | filter (เรื่อง/ธาตุ), การ์ดโปรไฟล์ public, ปุ่ม match/chat | filter → match → chat | ไม่มีผล → คลาย filter |
| Healing Circles | รับฟัง/ระบายนิรนาม | tab: Explore/Create/Hold Space, chip อารมณ์+ธาตุ, ปุ่มสร้างห้อง | สร้าง request นิรนาม; เข้ารับฟัง; แชท | ไม่มี request → "สร้างพื้นที่แรก" + safety note |
| In-App Chat (นิรนาม) | คุย 1:1 ปลอดภัย | ห้องแชท, ปุ่มปิดห้อง, ปุ่ม report/สายด่วน | ส่ง/รับ; ปิด; รายงาน | อีกฝ่ายออก → แจ้ง + เสนอจับคู่ใหม่ |

## Section 5 — Astro-Ecosystem

| หน้าจอ | เป้าหมายหลัก | Key UI Elements | User Interactions | Empty / Edge State |
|---|---|---|---|---|
| Sacred Map | หาสถานที่มู verified | แผนที่, pin (admin/ลูกค้า), filter ธาตุ/ความต้องการ, sheet รายละเอียด + ทิศ + Google Map + ปุ่ม Check-in/Save + โพยการมู | แตะ pin → sheet; check-in; save; ตั้ง noti deadline | ไม่มีสถานที่ในรัศมี → ขยายรัศมี/แนะนำเพิ่ม |
| Mumate Treasures | ตลาดของสายมูคัดตามดวง | grid สินค้า (physical/digital), Etsy widget, การ์ด collab | แตะสินค้า → sale page → ลิงก์เว็บ | ไม่มีสินค้าตรงดวง → แสดงทั่วไป |

## Section 6 — Mu Commissions Centre

| หน้าจอ | เป้าหมายหลัก | Key UI Elements | User Interactions | Empty / Edge State |
|---|---|---|---|---|
| Mission Board | ทำภารกิจรับรางวัล | รายการภารกิจ (เช็คอิน/ฮีลใจ/แมนิเฟสต์), progress, daily login | ทำภารกิจ → เคลม; daily login 7 วัน = เหรียญ x2 | ทำครบวันนี้ → "กลับมาพรุ่งนี้" |
| Companion Referral | ชวนเพื่อนได้รางวัล | ลิงก์เชิญ + ปุ่มแชร์, สถานะรางวัล | แชร์ลิงก์; ติดตามผล | ยังไม่มีคนกด → โชว์รางวัลที่จะได้ |

## Section 7 — Profile, Integrations & Settings

| หน้าจอ | เป้าหมายหลัก | Key UI Elements | User Interactions | Empty / Edge State |
|---|---|---|---|---|
| Personal Settings | แก้ข้อมูล + ความเป็นส่วนตัว | ฟอร์มแก้ดวง, toggle แจ้งเตือนสีมงคล, toggle Public | บันทึก; สลับ public/private | — |
| Calendar Integration | ซิงค์ฤกษ์เข้าปฏิทิน | ปุ่มเชื่อม Google/Apple, สถานะเชื่อม | เชื่อม/ยกเลิก | ยังไม่เชื่อม → อธิบายประโยชน์ |
| Smart Reminder | เตือนคำทำนายสำคัญ | รายการเตือน, ตั้งล่วงหน้า | เพิ่ม/ปิด | ไม่มี → เสนอ template เตือน |
| Premium Store | อัปเกรด/ซื้อ | การ์ด Subscription, ขายหนังสือเล่มจริง, ขาย Token (ราคาชัด) | เลือกแพ็ก → ชำระ | — |
| Settings | ตั้งค่าระบบ | เลือกภาษา (หลายภาษา), เกี่ยวกับ, ออกจากระบบ | เปลี่ยนภาษา | — |

---

## หมายเหตุการนำไปสร้าง
- **หน้าที่สร้าง Phase 1 ได้ทันที** (มี API รองรับ): Onboarding ทั้งชุด, Home Dashboard, Today's Energy, Daily Oracle, Basic Chart, Deep Dive — ดู mapping ใน `Goal/Mumate-Plan.md`
- **หน้าที่ต้อง backend ใหม่**: Manifest, Streak, Social/Healing, Sacred Map, Marketplace, Premium/Token, Calendar sync
- เอกสารนี้เป็น **Blueprint ก่อนลงโค้ด** — แผนเทคนิคเป็นเฟสอยู่ใน `Goal/Mumate-Plan.md`
