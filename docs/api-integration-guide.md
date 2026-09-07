# Mumate / Bazi API — คู่มือเชื่อมต่อสำหรับทีมภายนอก (UX/UI)

> เอกสารนี้ให้ทีมภายนอกที่จะเรียก API ของเราไปประกอบหน้า UX/UI เอง
> ครอบคลุม 5 กลุ่มฟีเจอร์: **ดวงรายคน · ดวงงาน · ดวงสมพงษ์ · ไพ่ · แชทฮีลใจ**

- **Base URL (production):** `https://bazi-sft-dataset.vercel.app`
- **รูปแบบ:** REST + JSON (ยกเว้นแชทที่เป็น streaming text)
- **เวอร์ชันเอกสาร:** 2026-09-07

---

## 0. สิ่งที่ต้องรู้ก่อนเริ่ม (อ่านก่อน)

### 0.1 การยืนยันตัวตน (Authentication)
ปัจจุบัน endpoint เหล่านี้ **เปิดสาธารณะ ไม่ต้องแนบ API key / token** เพื่อเรียกใช้
> ⚠️ **หมายเหตุถึงทีมเรา:** เนื่องจากยังไม่มีชั้น auth หากเปิดให้ partner ภายนอกยิงตรง
> ควรพิจารณาเพิ่มหนึ่งในนี้ก่อน production: API key header, allow-list origin (CORS),
> หรือ reverse-proxy ฝั่ง partner จำกัด rate เพิ่ม

### 0.2 การจำกัดการใช้งาน (Rate limit & Quota)
- **Rate limit ต่อ IP** — ยิงรัวเกินจะได้ `429 Too Many Requests` พร้อม header `Retry-After` (วินาที)
- **โควตา Qi (optional)** — ถ้าส่งฟิลด์ `anonId` มา ระบบจะนับโควตาต่อผู้ใช้ (ฟรีรายวัน → เครดิต → 402 เมื่อหมด)
  ถ้า **ไม่ส่ง `anonId`** = ไม่ตัดโควตา (แต่ยังโดน rate-limit ตาม IP อยู่)
- **เพดานต้นทุน LLM รายวัน** — ฝั่งที่ใช้ AI (แชท/ไพ่โหมด llm/narrate) อาจได้ `503` เมื่อระบบถึงเพดานต้นทุนของวันนั้น
- **ใช้คีย์ Gemini ของตัวเอง** — endpoint ฝั่ง LLM รับฟิลด์ `apiKey` (คีย์ Gemini) ถ้าส่งมาจะ **ไม่ถูกจำกัดโควตา/เพดานต้นทุน** ของเรา

### 0.3 อินพุตวันเกิดมาตรฐาน (ใช้ซ้ำเกือบทุก endpoint)
```jsonc
{
  "birthDate": "1990-05-21",   // ค.ศ. รูปแบบ YYYY-MM-DD (บังคับ)
  "birthTime": "13:45",         // HH:mm — ไม่ทราบเวลาให้เว้น (บาง endpoint จะใช้เที่ยงวันแทน)
  "gender": "female",           // "female" | "male" | "unspecified"
  "province": "กรุงเทพมหานคร"    // ชื่อจังหวัดไทย — ไม่ส่งบาง endpoint ใช้ค่าเริ่มต้น กรุงเทพฯ
}
```

### 0.4 รูปแบบ Error
ทุก endpoint คืน HTTP status ตามมาตรฐาน + body JSON:
```jsonc
{ "error": "ข้อความอธิบาย" }
// หรือฝั่ง LLM
{ "error": { "message": "ข้อความอธิบาย" } }
```
- `400` อินพุตไม่ถูกต้อง (มักมี `details` เป็น Zod issues)
- `402` โควตา Qi หมด · `429` ยิงถี่เกิน · `502` LLM ปลายทางล่ม · `503` ถึงเพดานต้นทุนรายวัน

---

## 1. ดวงรายคน (อ่านดวงบุคคล)

การอ่านดวงคนแยกเป็น 2 ชั้น: **(A) engine คำนวณผังดวง** และ **(B) LLM เกลาเป็นคำทำนายร้อยแก้ว** (จะใช้ชั้น B หรือไม่ก็ได้)

### 1.A `POST /api/bazi/public-calc` — คำนวณผังดวง (ไม่มี AI, เร็ว)
คืนสี่เสา + วัยจร(daYun) + ปีจร(liuNian) + คะแนนกำลัง + badge จุดเด่น — ไม่มีเกรด/ไม่มีคำทำนาย

**Request**
```jsonc
{
  "birthDate": "1990-05-21",
  "birthTime": "13:45",
  "gender": "female",
  "province": "กรุงเทพมหานคร"
}
```

**Response 200 (ย่อ)**
```jsonc
{
  "dayMaster": "庚",
  "dayMasterElement": "ทอง",
  "strengthScore": 42,
  "strengthBand": { "id": "balanced", "displayLabel": "สมดุล" },
  "pillars": {
    "ascendant": { "stem": "...", "branch": "...", "stemElement": "...", "branchElement": "...", "sittingStage": "...", "upperStageDisplay": "...", "lowerStageDisplay": "..." },
    "hour":  { /* เหมือน ascendant */ },
    "day":   { "stem": "庚", "branch": "午", "stemElement": "ทอง", "branchElement": "ไฟ", "lowerStageDisplay": "..." }, // ดิถี: ไม่มี sittingStage/upperStage
    "month": { /* ... */ },
    "year":  { /* ... */ }
  },
  "daYun":  [ { "symbol": "...", "element": "...", "qi": "...", "reaction": "...", "place": "ราศีบน|ราศีล่าง" }, ... ],
  "liuNian":[ { "year": 2024, "age": 34, "stem": "...", "branch": "...", "element": "...", "qi": "...", "reaction": "...", "clash": false, "harm": false }, ... ],
  "badges": [ { "point": "pillar-hour|decade-2|annual-34", "role": "wealth|power", "element": "...", "qi": "...", "clash": false } ]
}
```
> `badges` = จุดที่ระบบไฮไลต์ว่าเด่น (โชคลาภ/อำนาจ) ใช้ทำ visual highlight บน UI ได้เลย

### 1.B `POST /api/bazi/narrate` — เกลาเป็นคำทำนายร้อยแก้ว (ใช้ AI)
Narrate เป็น endpoint **กลาง** ใช้ร่วมได้หลายฟีเจอร์ — ป้อน "ข้อเท็จจริงจาก engine" เข้าไป แล้วได้ร้อยแก้วภาษาคนกลับมา

**Request**
```jsonc
{
  "engineText": "<ข้อความสรุปผลจาก engine เช่นเอาจาก public-calc มาเรียบเรียง>",
  "domainLabel": "ภาพรวมชีวิต",       // ป้ายหมวด (optional)
  "feature": "person_reading",         // ใช้แยกสถิติ/rate-limit (optional)
  "apiKey": "<Gemini key ของคุณ>"      // optional — ส่งมาเพื่อไม่จำกัดโควตา
}
```
**Response 200:** `{ "text": "คำทำนายร้อยแก้ว 2-4 ย่อหน้า..." , "model": "...", "usage": {...} }`

> ทางเลือกอื่นสำหรับ "อ่านดวงคน" ที่มี AI ในตัว: `POST /api/bazi/phone-reading` (อ่านจากเบอร์โทร)

---

## 2. ดวงงาน (เทียบผู้สมัคร/ลูกน้อง)

### `POST /api/bazi/work`
เทียบ "ตัวเรา" กับ **ผู้สมัคร 1–3 คน** — เลือก **บทบาท** ของอีกฝ่ายได้ (เพิ่ม 2026-09-07)

**Request**
```jsonc
{
  "self":       { "birthDate": "1985-01-10", "birthTime": "08:00", "gender": "male", "province": "กรุงเทพมหานคร" },
  "candidates": [
    { "birthDate": "1995-07-02", "birthTime": "10:30", "gender": "female", "province": "เชียงใหม่" }
    // ... สูงสุด 3 คน
  ],
  "relationship": "boss"   // optional: "boss" | "partner" | "subordinate" — อีกฝ่ายเป็นอะไรกับเรา
                           //   boss = เขาเป็นเจ้านายเรา · partner = หุ้นส่วน/เพื่อนร่วมงาน · subordinate = เขาเป็นลูกน้องเรา
                           //   ค่าอื่น → 400 · ไม่ส่ง → โหมดเดิม (จัดอันดับด้วยคะแนนรวม domain งาน)
}
```

**เมื่อส่ง `relationship`** ระบบคำนวณ **แยกตามบทบาท**: ใช้มิติของบทบาทนั้นจากสี่เสาครบ (ชุดเดียวกับ `/api/bazi/pair-match`)
และจัดอันดับด้วย **มิติหลักของบทบาท** (ไม่ใช่คะแนนรวม) — `comparison` จะมีเพิ่ม:
```jsonc
{
  "comparison": {
    "relationship": "boss",
    "relationshipLabel": "เจ้านาย",
    "ranking": [1, 0],                 // index ของ candidates เรียงดีสุด→น้อยสุด
    "candidates": [
      {
        "index": 0,
        "rankScore": 28.33,              // = roleFacet.percent
        "roleFacet": { "key": "business", "label": "🏢 ส่งเสริมธุรกิจเจ้านาย", "percent": 28.33, "grade": "D-", "ratingText": "...", "isMain": true },
        "facets":    [ /* ทุกมิติของบทบาท (4 รายการ) รูปแบบเดียวกับ roleFacet */ ],
        "roles":     [ /* คำอ่าน 3 มุมมอง (เจ้านาย/ลูกน้อง/หุ้นส่วน) เหมือนโหมดเดิม */ ],
        "match": { /* forward/reverse ของ domain งาน (คงไว้เพื่อ backward-compat) */ }
      }
    ]
  }
}
```
> ⚠️ ห้ามรวม 3 บทบาทเป็นคำขอเดียวแล้วแยกเองฝั่ง client — คะแนน/อันดับของแต่ละบทบาทมาจากคนละมิติ ต้องยิงแยกต่อบทบาท

### ตารางดวงจีน (`chart`) — แนบมากับผลสมพงษ์ทุกแบบ (เพิ่ม 2026-09-07)
ทั้ง `POST /api/bazi/pair-match` (ที่ `persons.a.chart` / `persons.b.chart`) และ `POST /api/bazi/work`
(ที่ `comparison.charts.self` / `comparison.charts.candidates[i]`) คืนก้อนเดียวกันสำหรับวาด "ตารางดวงจีน":
```jsonc
{
  "birthDate": "1989-03-02", "birthTime": "10:00",   // birthTime = null เมื่อไม่ทราบเวลา
  "dayElement": "ทอง",                                // ธาตุดิถี (ไทย)
  "pillars": {
    "year":  { "stem": "己", "branch": "巳", "stemElement": "ดิน", "branchElement": "ไฟ", "animal": "มะเส็ง" },
    "month": { /* เหมือน year */ }, "day": { /* … */ }, "hour": { /* … */ },
    "ascendant": { /* ลัคนา — null ถ้าคำนวณไม่ได้ */ }
  },
  "daYun":   [ { "ageRange": "1–10", "startAge": 1, "endAge": 10, "stem": "乙", "branch": "亥", "stemElement": "ไม้", "branchElement": "น้ำ", "animal": "กุน" }, /* ×~9 */ ],
  "liuNian": [ { "year": 2026, "yearBE": 2569, "age": 38, "stem": "丙", "branch": "午", "stemElement": "ไฟ", "branchElement": "ไฟ", "animal": "มะเมีย" }, /* ×15 นับจากปีปัจจุบัน */ ]
}
```
> ใช้ `stemElement`/`branchElement` ลงสีก้าน/กิ่งแยกกัน (ธาตุไม้ เขียว · ไฟ แดง · ดิน น้ำตาล · ทอง เทา · น้ำ ฟ้า) — ไม่ต้องคำนวณก้านกิ่งฝั่ง client

**Response 200**
```jsonc
{
  "self":       { /* ผังดวงเต็มของเรา */ },
  "candidates": [ { /* ผังดวงเต็มของแต่ละคน */ } ],
  "comparison": { /* ผลเปรียบเทียบความเข้ากันด้านการงาน */ }
}
```
> เกิน 3 คน หรือไม่ส่ง candidates → `400`

---

## 3. ดวงสมพงษ์ (จับคู่ 2 คน) ⭐ ตัวหลักสำหรับ UI จับคู่

### `POST /api/bazi/pair-match`
Response ถูกออกแบบให้ "ผอม ตรงกับจอผลลัพธ์" — เกรดรวม + คะแนนรายมิติ + โปรไฟล์ย่อ (ไม่ต้อง parse ผังดวงเต็ม)

**Request**
```jsonc
{
  "relationship": "love",   // "love" | "partner" | "boss" | "subordinate" | "family"
  "personA": {
    "birthDate": "1992-03-15", "birthTime": "07:20",   // birthTime optional → เที่ยงวัน
    "gender": "female", "province": "กรุงเทพมหานคร",     // province optional → กรุงเทพฯ
    "displayName": "สิริวรรณ"                            // optional — echo กลับ
  },
  "personB": { "birthDate": "1990-11-02", "gender": "male" }
}
```

**Response 200**
```jsonc
{
  "relationship": "love",
  "relationshipLabel": "คู่รัก",
  "ourLabel": "ฝ่ายเรา", "partnerLabel": "ฝ่ายเขา",
  "domain": "love",
  "note": null,                       // family ยังไม่มีสเปกซินแส → มี note เตือน
  "persons": {
    "a": { "displayName": "สิริวรรณ", "dayGanzhi": "甲子", "elementTh": "ไม้", "stageTh": "...", "nisai": "...", "timeKnown": true,
           "fourPillars": { "year": {"stem":"..","branch":"..","element":".."}, "month": {...}, "day": {...}, "hour": {...} } },
    "b": { /* เหมือน a */ }
  },
  "overall": { "percent": 78, "grade": "A", "gradeLabel": "ดีมาก", "hearts": 4, "emoji": "💕", "ratingText": "..." },
  "dimensions": [
    { "key": "...", "label": "...", "pairingLabel": "...", "percent": 80, "grade": "A", "gradeLabel": "ดีมาก",
      "emoji": "...", "ratingText": "...", "isMain": true,
      "sising": { "code": "...", "nameTh": "...", "summary": "..." } }
  ],
  "elementInteraction": {
    "aElementTh": "ไม้", "bElementTh": "ไฟ", "summaryTh": "...",
    "aToB": { "relation": "...", "labelTh": "...", "meaningTh": "..." },
    "bToA": { "relation": "...", "labelTh": "...", "meaningTh": "..." }
  }
}
```
> `overall` = การ์ดสรุปหัวจอ · `dimensions` = คะแนนรายมิติ · `elementInteraction` = ปฏิกิริยาธาตุสองทิศ (เรา→เขา / เขา→เรา)

---

## 4. ไพ่ (Card readings)

มี 3 สำรับ โครงเหมือนกัน — เลือกใช้ตามธีม UI:
| ฟีเจอร์ | Predict | รายการไพ่ | รูปไพ่ |
|---|---|---|---|
| ไพ่เซียน (Divine) | `POST /api/divine-cards/predict` | `GET /api/divine-cards/predict` | `GET /api/divine-cards/image/{no}` |
| ไพ่ออราเคิล | `POST /api/oracle-cards/predict` | `GET /api/oracle-cards/predict` | `GET /api/oracle-cards/image/{no}` |
| เซียมซี (Fortune Sage) | `POST /api/fortune-sage/predict` | `GET /api/fortune-sage/predict` | `GET /api/fortune-sage/image/{no}` |

### `POST /api/divine-cards/predict` (ตัวอย่างตัวแทน)
**Request**
```jsonc
{
  "mode": "engine",           // "engine" (เร็ว ไม่มี AI) | "llm" (เกลาคำด้วย AI)
  "random": true,             // จั่วสุ่ม 3 ใบ ... หรือ
  "cardNos": [4, 27, 61],     // เลือกเอง 3 ใบ (ห้ามซ้ำ)
  "question": "เรื่องการงานปีนี้",   // optional
  "anonId": "<id ผู้ใช้>",     // optional — ตัดโควตา Qi
  "apiKey": "<Gemini key>"     // optional (โหมด llm) — ไม่จำกัดโควตา
}
```
**Response 200 (mode=engine)**
```jsonc
{
  "source": "engine",
  "cards": [ { "no": 4, "name": "...", "imageUrl": "https://.../card.webp", /* + ฟิลด์ไพ่ */ } ],
  "slots": [ { "position": 1, "weight": "...", "role": "...", "no": 4 } ],
  "engineProse": "คำอ่านจาก engine",
  "qi": { "source": "free|credit", "cost": 1 } | null
}
```
**Response 200 (mode=llm)** — เพิ่ม `"llmProse": "...", "model": "..."` และ `source: "llm"`

### `GET /api/divine-cards/predict` — ดึงรายการไพ่ทั้งสำรับ (สำหรับหน้าเลือกไพ่)
`{ "cards": [ { "no": 1, "name": "...", ... } ] }`

---

## 5. แชทฮีลใจ (โค้ชสไตล์ Louise Hay) ⭐ Streaming

### `POST /api/louise-hay/chat`
**สำคัญ: response เป็น streaming `text/plain`** (ไม่ใช่ JSON) — อ่านทีละ chunk แล้วต่อสตริง

**Request**
```jsonc
{
  "messages": [
    { "role": "user", "content": "ช่วงนี้เหนื่อยกับงานมาก ทำไงดี" }
    // ประวัติแชทได้สูงสุด 40 ข้อความ, แต่ละอันยาวไม่เกิน 4000 ตัวอักษร
  ],
  "birth": { "birthDate": "1990-05-21", "birthTime": "13:45", "gender": "female", "province": "กรุงเทพมหานคร" }, // optional — ให้ตอบอิงดวง
  "anonId": "<id ผู้ใช้>",         // optional — ตัดโควตา Qi (chat)
  "apiKey": "<Gemini key>",        // optional — ไม่จำกัดโควตา
  "personaGender": "female",       // optional — คุมคำลงท้าย ค่ะ/ครับ
  "prevRoute": "<route ก่อนหน้า>"  // optional — คุมความต่อเนื่องของหมวด
}
```

**Response:** สตรีมข้อความไทยล้วน + header สำคัญ:
| Header | ความหมาย |
|---|---|
| `X-LH-Sources` | base64(JSON) รายการอ้างอิงที่ใช้ (n/title/page/snippet) |
| `X-LH-Route` / `X-LH-Source` | หมวดศาสตร์ที่ใช้ตอบ + ป้ายแหล่งที่มา |
| `X-LH-Grounded` | `"1"` = มีคลังอ้างอิง, `"0"` = ไม่มี |
| `X-LH-Crisis` | `"1"` = ตรวจพบสัญญาณวิกฤต → ระบบ **หยุดบท** คืนข้อความส่งต่อสายด่วนแทน (UI ควรแสดงเบอร์ช่วยเหลือ ไม่ใช่ข้อความปกติ) |
| `X-LH-Alerts` | base64(JSON) วันที่ตั้งเตือนได้ (ถ้ามี) → ทำปุ่มเตือนได้ |

> ⚠️ ทีม UI ต้องจัดการเคส `X-LH-Crisis: 1` เป็นพิเศษ (แสดงสายด่วนสุขภาพจิต ไม่ปิดบัง)

---

## 6. Endpoint เสริมที่มักใช้ประกอบ UI
- `GET /api/health` — health check
- `GET /api/home` — ข้อมูลหน้าแรก
- `GET /api/almanac?...` — ปฏิทินฤกษ์รายวัน
- `POST /api/bazi/man-vs-day` — ดวงเทียบกับเสาวันปฏิทิน ("ดวงกับวัน")
- `POST /api/bazi/pair` — เวอร์ชันเต็มของสมพงษ์ (คืน BaziState เต็ม — หนักกว่า pair-match)
- ระบบแต้ม Qi: `GET /api/qi/catalog`, `GET /api/qi/wallet?anonId=...`, `POST /api/qi/earn`, `POST /api/qi/spend`

---

## 7. เอกสาร/สิ่งที่ควรส่งให้ทีมภายนอกทั้งชุด
1. **เอกสารนี้** (API integration guide)
2. **Base URL + สภาพแวดล้อม** (prod / staging ถ้ามี)
3. **นโยบาย rate-limit & โควตา** (ตัวเลขจริงต่อ IP/วัน) — ให้เขาวางแผน retry/caching
4. **ข้อตกลงเรื่อง auth** — ถ้าจะเพิ่ม API key/CORS allow-list ต้องแจ้ง header/origin ที่ต้องใช้
5. **Postman collection / ตัวอย่าง cURL** (แนะนำทำเพิ่ม — ลดคำถาม)
6. **SLA + ช่องทางแจ้งปัญหา** (error code, ติดต่อใคร)
