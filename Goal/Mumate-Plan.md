# แผนงาน (ร่าง): แอป "Mumate" บน LINE LIFF

> ร่างวันที่ 2026-07-03 — แปลง PRD `Goal/Mumate_Product_Requirements_Document_2026.pdf` เป็นแผนสร้างจริง
> หลักคิด: **นำ engine/ความรู้ปาจื่อที่มีอยู่แล้ว (สมอง) มาห่อด้วยเปลือกแอป consumer LIFF (ร่างกาย)**
> โปรเจกต์ปัจจุบัน = engine + admin tooling + SFT dataset (ไม่ใช่แอปผู้ใช้จริง) → ต้องสร้างชั้น consumer ใหม่

---

## 0. ข้อสรุปความเป็นไปได้

**ทำได้** — backend ปาจื่อพร้อม ~70–80% สำหรับ Section 0,1,3,4 บางส่วน
งานหลัก = สร้าง **เปลือก LIFF ผู้บริโภค** (auth, onboarding, home dashboard, freemium, ระบบเงิน)
และ **โมดูลใหม่ล้วน** (Manifest, Social/Forum, Sacred Map, Marketplace, Gamification)

**หลักการคุมสโคป:** อย่าสร้าง consumer app ในโปรเจกต์ engine เดิมจนปนกัน — แยกเป็น
- คงโปรเจกต์นี้เป็น **"Engine + Admin API"** (backend)
- แอป Mumate LIFF เรียกใช้ผ่าน API เดิม (calculate / reading/topic / mascot / man-vs-day / pair / work)

---

## 1. Asset ที่ reuse ได้ทันที (ของมีค่า — อย่าเขียนใหม่)

| ความสามารถ | API/ไฟล์ที่มีอยู่ | ป้อนเข้า Section ไหนของ PRD |
|---|---|---|
| คำนวณผังดวง 4 เสา + กำลังดิถี | `POST /api/bazi/calculate` → `CalculatedState` | 0 (ผลลัพธ์แรก), 3 (Basic Chart) |
| คำทำนายเชิงลึกราย topic (16 บท, deterministic) | `POST /api/reading/topic` (`buildTopicConsumerReading`) | 3 (Deep Dive งาน/เงิน/รัก), 0 (นิสัยเชิงบวก) |
| Mascot 60 แบบตามเสาวัน | `GET /api/bazi/mascot/{ganzhi}` | 1 (Mascot ประจำตัว) |
| ปฏิทินพลังงานรายวัน/เดือน/ปี (สีมงคล/ฤกษ์) | `POST /api/bazi/man-vs-day` | 1 (Today's Energy Card), 7 (Calendar) |
| จับคู่สมพงษ์ คู่รัก/การงาน | `POST /api/bazi/pair`, `POST /api/bazi/work` | 4 (Compatibility Matching) |
| เสี่ยงทาย 3 แบบ (divine 80 / oracle 120 / เซียมซี 60) | `/api/divine-cards`, `/api/oracle-cards`, `/api/fortune-sage` | 1 (Daily Oracle) |
| LINE mapping + chat history table | `userLineMappings`, `baziChatHistories`, webhook | 1 (AI Chat), auth |
| เก็บดวง | `baziSavedChart` | 0/7 (จำผู้ใช้) |

**หมายเหตุ engine:** ทุก route เป็น **public ไม่มี auth** และ input ใช้ `RawInput`
(`birthDate` `birthTime` `gender` `province` `calendarSystem="solar"` `timezone="Asia/Bangkok"`) — timezone hardcode กรุงเทพฯ

---

## 2. สิ่งที่ต้องสร้างใหม่ (ยังไม่มีเลย)

**พื้นฐาน consumer (blocker ของทุก section):**
- [ ] `@line/liff` SDK + LIFF init + LINE Login (ตอนนี้มีแต่ `@line/bot-sdk` ฝั่ง server, ไม่มี LIFF, ไม่มี middleware auth)
- [ ] ตาราง `mumate_user` (profile ผู้ใช้จริง ผูก `lineUserId`) + session/JWT จาก LIFF idToken
- [ ] Design system มินิมอล/healing (mobile-first, น้ำหนักเบา) — ตอนนี้ UI เป็นสไตล์ admin
- [ ] ระบบ PDPA consent + เก็บ log ความยินยอม
- [ ] i18n (หลายภาษา) — Section 7

**โมดูลใหม่ล้วน:**
- [ ] Manifest Journal + Streak + Reminder + Badge/Level (Section 2, 6)
- [ ] Social graph: เพื่อน @, invite, public profile, World discovery (Section 4)
- [ ] In-app chat + Healing Circles (แชทนิรนาม, hold space) (Section 4)
- [ ] Sacred Map: สถานที่ verified + check-in + พิกัด google map + noti deadline (Section 5)
- [ ] Marketplace "Mumate Treasures" + Etsy widget + collab/commission (Section 5)
- [ ] Premium/Freemium: paywall + subscription + token store + ขายหนังสือ Life Code Book (Section 3, 7)
- [ ] Calendar sync Google/Apple + Smart Reminder (Section 7)
- [ ] AI Chat จริงใน LINE (ตอนนี้ webhook เป็น echo เปล่า ยังไม่ต่อ LLM ในเส้นทางแชท — แต่มี Gemini/Anthropic adapter ใน `reading-llm.ts` reuse ได้)

---

## 3. แผนเป็นเฟส

### Phase 1 — MVP "ดูดวงได้จริงบน LIFF" (คุ้มสุด, ใช้ของเดิม ~80%)
เป้า: ผู้ใช้เข้า LIFF → onboarding → เห็น Home + ดูดวงพื้นฐานได้
ครอบ PRD: **Section 0 + 1 (แกน) + 3 (free)**

1. ตั้งโครง LIFF app (Next.js route กลุ่มใหม่ `/(liff)` หรือแยก sub-app) + `@line/liff` + LINE Login
2. ตาราง `mumate_user` + upsert จาก LIFF idToken → ผูก `lineUserId` (ต่อยอด `userLineMappings`)
3. Onboarding flow (Section 0): Splash → Intent Check → ฟอร์มวันเกิด → PDPA consent → เรียก `/api/bazi/calculate` → หน้า "ธาตุ + นิสัยเชิงบวก" (ดึงจาก `buildTopicConsumerReading` topic แรก) → save `baziSavedChart`
4. Home "The Cosmos" (Section 1): dynamic greeting + Mascot (`/api/bazi/mascot`) + Today's Energy Card (`/api/bazi/man-vs-day` วันนี้) + Daily Oracle (จำกัด 1/วัน, reuse fortune-sage/oracle) + ปุ่มลัด AI Chat
5. My Destiny free (Section 3): Basic Chart กราฟิก 4 เสา + Deep Dive งาน/เงิน/รัก (`/api/reading/topic`) — **ยังไม่ทำ paywall** (โชว์ครบก่อน)
6. ปุ่มแชร์ (LIFF shareTargetPicker / flex message)

**Deliverable Phase 1 = แอปที่ผู้ใช้เข้าดูดวงตัวเองได้ครบ loop** — ขายได้/เก็บ feedback ได้

### Phase 2 — สร้างรายได้ (Freemium + Store)
ครอบ: **Section 3 (freemium) + 7 (Premium Store)**
- Paywall: เบลอ Deep Dive → ปลดล็อก Premium
- ระบบเงิน (เลือก provider: LINE Pay / Stripe) + subscription state ในตาราง `mumate_entitlement`
- ขาย Life Code Book (1890/2390) + flow ให้ AI อ่านเล่ม (RAG บนเนื้อหาเล่ม)
- Token store

### Phase 3 — Engagement (Manifest + Gamification)
ครอบ: **Section 2 + 6**
- Manifest Journal + mood score + Streak + Reminder (manual + auto จากปฏิทิน/แชท)
- Mission Board + daily login x2 (7 วัน) + referral
- Badge/Level + กราฟิกสรุปแชร์

### Phase 4 — Social & Community (สร้างใหม่หนัก, network effect)
ครอบ: **Section 4**
- Friends (@, invite), public profile toggle, World matching + filter
- In-app chat + Healing Circles (นิรนาม, hold space) + group (Openchat/Telegram deep link)

### Phase 5 — Ecosystem
ครอบ: **Section 5**
- Sacred Map (สถานที่ + check-in + พิกัด + noti) — admin & user submitted
- Marketplace + Etsy widget + collab/commission

### ตลอดทุกเฟส
- Calendar sync + Smart Reminder (Section 7) — เริ่ม Phase 2/3
- i18n (Section 7) — วางโครงตั้งแต่ Phase 1

---

## 4. ความเสี่ยง / จุดต้องตัดสินใจ

1. **สถาปัตยกรรม:** แยก consumer app ออกจาก repo engine นี้ หรือทำใน monorepo เดียว? (แนะนำแยก frontend, เรียก engine ผ่าน API)
2. **Auth:** ใช้ LIFF idToken ล้วน หรือคง Clerk (มี config อยู่แล้วแต่ไม่บังคับใน route)?
3. **AI Chat:** webhook ปัจจุบัน echo เปล่า — ต้องต่อ LLM (reuse `reading-llm.ts` gemini-3.1-flash-lite/claude) + ground ด้วย engine reading
4. **ระบบเงิน:** LINE Pay (native ใน LIFF) vs Stripe — กระทบ Phase 2
5. **timezone:** engine hardcode Asia/Bangkok → ถ้ารองรับ Global (Section 4 World) ต้องแก้ engine
6. **สโคป PRD ใหญ่มาก (8 section):** อย่าทำพร้อมกัน — ยึด Phase 1 MVP ให้จบก่อน

---

## 5. งานที่ PRD ขอจริง (deliverable ตามเอกสาร)
PRD ปิดท้ายขอ **Blueprint** ไม่ใช่โค้ด:
- ส่วนที่ 1: User Flow A (Onboarding→Home) + Flow B (Healing Circles นิรนาม)
- ส่วนที่ 2: ตาราง UI/UX รายหน้าจอ (ชื่อ/เป้าหมาย/UI elements/interaction/empty state)
→ ถ้าต้องการ ทำ Blueprint นี้แยกได้ (เป็น design doc ก่อนลงมือ Phase 1)
