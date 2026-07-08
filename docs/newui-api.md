# Mumate UI ใหม่ — Backend API Reference

> ทุก endpoint เป็น JSON · ยังไม่มี auth — ระบุตัวผู้ใช้ด้วย `anonId` (สตริงจาก localStorage ฝั่ง client, สร้างครั้งเดียวเก็บถาวร เช่น `crypto.randomUUID()`)
> วันที่ทุกที่ = `"YYYY-MM-DD"` โซนเวลาไทย · `RawInput` (ข้อมูลเกิด) = `{ birthDate, birthTime?, gender?, province? }` — เวลาเกิดไม่รู้ให้เว้น (ระบบใช้เที่ยงวัน), gender: `female|male|unspecified`

---

## 1. Onboarding

### POST `/api/user/intent` — เก็บด้านที่อยากเน้น (จอ 02-intent-check)
```json
{ "anonId": "u1", "focus": ["love", "work", "self_development"] }
```
ค่า focus: `love | work | wealth | health | family | self_development` · GET `/api/user/intent?anonId=u1` อ่านกลับ

### POST `/api/bazi/element-summary` — ธาตุของคุณ (จอ 05-aha-moment)
```json
{ "person": { "birthDate": "1994-07-07", "birthTime": "18:15", "gender": "male" } }
```
→ `{ elementTh: "ไม้", dayGanzhi: "甲午", tagline, traits: [3 บรรทัดนิสัย], advice: [{label, text}] }`

## 2. Home

### POST `/api/home` — ทุกการ์ดหน้าแรกในครั้งเดียว
```json
{ "anonId": "u1", "person": { "birthDate": "1996-01-12", "birthTime": "09:30" } }
```
→ `{ fortune: { percent, verdict: good|ok|caution, summary, dayGanzhi, facets[] } | null, manifest: { goals: [{id,title,affirmation,imageUrl,percent}], streak: {current,best}, todayEntryDone }, wallet: { coins, xp, level, nextLevelXp }, missions: { done, total }, intent: [] }`
(ไม่ส่ง `person` → `fortune: null`)

## 3. Manifestation

### `/api/manifest/goals`
- **GET** `?anonId=u1` → `{ goals: [{...goal, tasks: [{...task, doneCount}], progress: {done,target,percent}}] }`
- **POST** สร้าง (active สูงสุด 5): `{ anonId, title, affirmation?, imageUrl?, tasks: [{title, targetCount, isDaily}] }` → 201
- **PATCH** `{ anonId, id, title?/affirmation?/imageUrl?/status?(active|done|archived)/ordinal? }`
- **DELETE** `{ anonId, id }` — ลบพร้อม tasks/checkins

### POST `/api/manifest/checkin` — ติ๊กงานรายวัน (ย้อนหลังได้)
```json
{ "anonId": "u1", "taskId": "uuid", "date": "2026-07-07", "done": true }
```
`done:false` = ถอนติ๊ก · ไม่ส่ง date = วันนี้ · idempotent

### `/api/manifest/entry` — บันทึกประจำวัน + สตรีค
- **POST** `{ anonId, date?, mood?(1-5), note? }` → `{ rewarded, streak: {current,best} }` — บันทึก**แรก**ของวันแจก 10 เหรียญ+50 XP อัตโนมัติ; วันเดิมเรียกซ้ำ = แก้ไข ไม่แจกซ้ำ
- **GET** `?anonId=u1&from=&to=` → `{ entries[], streak }`

### POST `/api/manifest/insights` — Behavior Insights (LLM)
```json
{ "anonId": "u1" }
```
→ `{ quote, insights: [3-4 ข้อ], encouragement, basedOn: {days,entries,goals,streak}, model }`
วิเคราะห์จากข้อมูลจริง 45 วัน · ไม่มีข้อมูล → 404 · มี rate-limit/บัดเจ็ตรายวัน (429/503 + Retry-After)

## 4. เกม/แต้ม (ทุกอย่างวิ่งผ่าน ledger เดียว)

### `/api/wallet`
- **GET** `?anonId=u1&history=20` → `{ coins, xp, level, nextLevelXp, history: [txn] }` (level = xp/1000+1)
- **POST** `{ anonId, coinDelta?, xpDelta?, reason, ref? }` — บวก=ได้ ลบ=ใช้ · ยอดไม่พอ → **409**

### `/api/missions`
- **GET** `?anonId=u1` → ภารกิจ 4 อัน + `count/target/completed/claimedAt` (daily รีเซ็ตทุกวัน)
- **POST** `{ anonId, missionId, increment? }` → เพิ่มความคืบหน้า · **ครบเป้าจ่ายรางวัลอัตโนมัติครั้งเดียว** → `{ rewarded: true }`
- missionId: `checkin_mu`(1/วัน,50c) · `send_energy`(5/วัน,120c) · `write_wish`(1/วัน,30c) · `streak_7`(ครั้งเดียว,500c)

### GET `/api/achievements?anonId=u1`
คิดสถิติจริง + **auto-unlock** เหรียญที่เข้าเงื่อนไข (จ่ายรางวัลครั้งเดียว) → `{ stats, wallet, badges: [{id,title,unlocked}], newlyUnlocked }`

### `/api/referral`
- **GET** `?anonId=u1` → `{ code: "MUMATE389", inviteUrl, invitedCount }` (สร้างอัตโนมัติครั้งแรก)
- **POST** `{ anonId: "คนใหม่", code }` → ผู้ชวน +250c/+100xp, คนใหม่ +100c/+50xp · ใช้ซ้ำ/โค้ดตัวเอง → 409

### GET `/api/karma?anonId=u1` — จอ Karma Dashboard
→ `{ wallet+level, stats: {missionsDone, activeDays, friendsInvited}, missionsInProgress[], recentTxns[] }`

## 5. ดูดวง

### POST `/api/bazi/pair-match` — ดวงสมพงษ์ (wizard)
```json
{ "relationship": "love", "personA": { "birthDate": "1996-01-12", "birthTime": "09:30", "displayName": "สิริวรรณ" }, "personB": { "birthDate": "1994-07-07" } }
```
relationship: `love | partner | boss | subordinate | family` (family = เกณฑ์ความรักชั่วคราว มี `note`)
→ `{ overall: {percent, grade("C-"), gradeLabel("ต้องปรับเข้าหากัน"), hearts(0-5), ratingText}, dimensions: [{label, pairingLabel, percent, grade, isMain, sising}], persons: {a,b: {dayGanzhi, elementTh, nisai[], timeKnown}}, elementInteraction }`

### GET `/pair-match/report?...&print=1` — หน้า PDF (เปิดลิงก์ → dialog พิมพ์อัตโนมัติ)
`/pair-match/report?relationship=love&aDate=1996-01-12&aTime=09:30&aName=สิริวรรณ&bDate=1994-07-07&bTime=18:15&bName=ธนกร&print=1`

### POST `/api/bazi/life-timeline` — วัยจรชีวิต
```json
{ "person": { "birthDate": "1996-01-12", "birthTime": "09:30", "gender": "female" } }
```
→ `{ currentAge, stages: [{startAge,endAge,ganzhi,isCurrent,overallGrade(0-3),domains:{career,finance,love: high|medium|low}}], current, years: [{year,age,ganzhi,grade,clash,sixCombine,harm}], cautionYears[], favorableElementsTh, note }`
⚠️ `domains` เป็นค่าประเมินเบื้องต้น — รอซินแสรีวิว

### อื่น ๆ ที่มีอยู่แล้ว (ของเดิม ใช้ได้เลย)
- `POST /api/bazi/man-vs-day` — ดวง×วัน/เดือน/ปี (ปฏิทินส่วนตัว)
- `GET/POST /api/sacred-map` — แผนที่ศักดิ์สิทธิ์ (POST = ผู้ใช้/พาร์ทเนอร์เสนอสถานที่ เข้าคิว pending)
- `POST /api/bazi/pair/rephrase` — เกลาข้อความ engine เป็นร้อยแก้วด้วย LLM

---

## Error convention
400 = payload ผิด (มี `details` จาก zod) · 404 = ไม่พบ · 409 = ขัดกติกา (ยอดไม่พอ/ใช้โค้ดซ้ำ/เป้าเกิน 5) · 429/503 = LLM rate-limit (ดู `Retry-After`) · 500 = อื่น ๆ `{ error }`

## Demo
เปิด **`/mvp`** — หน้า MVP สไตล์แอปมือถือ กดเล่นได้ทุกระบบข้างบน
