# แผนความปลอดภัยสำหรับเปิด API แบบ B2B (Partner)

> เป้าหมาย: เปิดให้ partner ภายนอกเรียก API ไปประกอบ UX/UI ได้อย่างปลอดภัย ควบคุมได้ และเก็บเงินได้
> โดยไม่กระทบหน้าเว็บ consumer เดิม
> จัดเป็นเฟสตามลำดับความเสี่ยง — ทำ Phase 1–3 ก่อน production, Phase 4–6 ตามมาได้

---

## สภาพปัจจุบัน (Baseline) — จุดเสี่ยงที่ต้องแก้

| # | จุดเสี่ยง | สภาพตอนนี้ | ผลถ้าไม่แก้ (B2B) |
|---|---|---|---|
| R1 | **ไม่มี auth เลย** | ไม่มี `src/middleware.ts` — endpoint เปิดสาธารณะทั้งหมด | แยก/ปิด/เก็บเงิน partner ไม่ได้ ใครก็ยิงได้ |
| R2 | **Rate-limit เชื่อถือไม่ได้บน serverless** | `src/lib/rate-limit.ts` เป็น **in-memory (fixed window)** นับแยกต่อ instance | บน Vercel หลาย instance → ลิมิตจริง = ลิมิต × จำนวน instance กันไม่อยู่ |
| R3 | **ต้นทุน LLM ผูกกับ IP ไม่ใช่ partner** | เพดาน `LH_DAILY_BUDGET_THB` (ดีฟอลต์ 100฿/วัน) เป็นก้อนรวมทั้งระบบ | partner รายเดียวยิงหนักจนเพดานเต็ม → ผู้ใช้จริงใช้ AI ไม่ได้ |
| R4 | **ไม่มี attribution / audit** | log usage มีเฉพาะฝั่ง LLM (`logUsage`) ผูก anonId ไม่ใช่ partner | ตามไม่ได้ว่าใครยิงเท่าไร คิดเงิน/สืบสวนไม่ได้ |
| R5 | **ข้อมูลส่วนบุคคล (PDPA)** | รับ วันเกิด/เวลา/จังหวัด/ชื่อ = personal data ส่งข้ามไป partner | ต้องมีข้อตกลงประมวลผลข้อมูล ไม่งั้นเสี่ยงกฎหมาย |

---

## Phase 1 — ชั้นยืนยันตัวตน Partner (API Key) 🔴 ต้องทำก่อน production

**หลักการ:** อย่าไปแตะ path ที่หน้าเว็บ consumer ใช้ (มันเปิดสาธารณะโดยธรรมชาติอยู่แล้ว)
เปิด **path ใหม่สำหรับ partner โดยเฉพาะ** ที่บังคับ API key

### 1.1 โครง path
- เพิ่ม prefix ใหม่ `/api/partner/v1/...` ที่ห่อ (proxy/re-export) ตัว handler เดิม
- ทุก route ใต้นี้บังคับ header `Authorization: Bearer <partner_key>` (หรือ `X-API-Key`)
- ข้อดี: consumer เดิมไม่ต้องแก้, contract partner ชัด, เวอร์ชัน (`v1`) แยกเปลี่ยนได้ในอนาคต

### 1.2 เก็บคีย์ (DB)
ตารางใหม่ เช่น `partner_api_keys`:
```
id | partner_name | key_hash (เก็บ hash เท่านั้น ไม่เก็บ plaintext)
   | scopes (['pair-match','work','card','chat',...])
   | rate_per_min | daily_quota | monthly_quota
   | llm_mode ('own_key' | 'billed')   -- partner ต้องส่งคีย์ Gemini เองไหม
   | status ('active'|'revoked') | created_at | last_used_at
```
- ออกคีย์: สุ่ม token → เก็บเฉพาะ hash (SHA-256) → ให้ plaintext แก่ partner ครั้งเดียว
- ตรวจ: hash header ที่รับมาแล้ว lookup → ไม่เจอ/revoked = `401`

### 1.3 บังคับผ่าน middleware หรือ helper
- ทำ `requirePartnerKey(req)` เป็น helper กลาง (คล้าย `guardServerLlm`) เรียกต้น handler ของ `/api/partner/v1/*`
- แนบ `partner` (id/scopes/quota) ลง context ส่งต่อให้ rate-limit/logging ใช้

**Definition of Done:** ยิง `/api/partner/v1/*` โดยไม่มีคีย์ = 401, คีย์ผิด/revoked = 401, คีย์ถูก scope ไม่ครอบ = 403

---

## Phase 2 — Rate-limit ที่เชื่อถือได้ (แก้ R2) 🔴 ต้องทำก่อน production

**ปัญหา:** `src/lib/rate-limit.ts` เป็น in-memory → บน Vercel นับแยกต่อ instance กันไม่อยู่จริง

### 2.1 ย้าย store เป็น Redis (Upstash)
- แทน `Map` ด้วย Upstash Redis (มี free tier, พร้อม `@upstash/ratelimit`)
- คงสัญญา `hit(key, limit, windowMs)` เดิมไว้ → เปลี่ยนแค่ back-end store ข้างใน (ของเดิมมีคอมเมนต์แนะนำ Upstash อยู่แล้ว)

### 2.2 คีย์ rate-limit ต่อ partner (ไม่ใช่ต่อ IP)
- สำหรับ path partner: key = `partner:<partnerId>:<feature>` แทน `<ip>`
- ดึง `rate_per_min` / `daily_quota` จากตาราง partner (ต่อรายไม่เท่ากันได้)
- คง IP-based limit ไว้บน path consumer เดิม (ยังมีประโยชน์กัน bot)

**Definition of Done:** partner เกินลิมิตได้ 429 + `Retry-After` ตรง แม้ deploy หลาย instance

---

## Phase 3 — คุมต้นทุน LLM ต่อ Partner (แก้ R3) 🔴 ความเสี่ยงจริงที่สุด

Endpoint ที่ใช้คีย์ Gemini กลาง = `louise-hay/chat`, `bazi/narrate`, `*/predict` โหมด llm

**เลือกนโยบายต่อ partner (ฟิลด์ `llm_mode`):**

- **แบบ A — partner ใช้คีย์ Gemini ของตัวเอง (`own_key`)** ← แนะนำเป็นค่าเริ่มต้น
  - บังคับ partner ส่ง `apiKey` มาทุก request ฝั่ง LLM ไม่งั้น 400
  - ต้นทุนไม่ตกที่เรา, ไม่ต้องแยกเพดาน — งานน้อยสุด
- **แบบ B — เราแบกต้นทุนแล้วคิดเงิน (`billed`)**
  - ต้องมี **เพดานต้นทุน LLM แยกต่อ partner** (ไม่ใช่ก้อนรวม `DAILY_BUDGET_THB`)
  - ต่อยอดจาก `logUsage` ที่มี token/cost อยู่แล้ว → รวมยอดต่อ partner/วัน → เกินเพดานตัด 402/503
  - เก็บ usage ต่อ partner ไว้ออกบิล

**Definition of Done:** partner แบก own_key ไม่มีทางแตะเพดานเราได้เลย; partner billed มีเพดานแยกตัดได้จริง ต้นทุนผู้ใช้จริงไม่กระทบ

---

## Phase 4 — Hardening อินพุต/ขอบเขต (แก้ผิวโจมตีทั่วไป) 🟡

- **จำกัดขนาด payload** — เพิ่ม guard body size (เช่น work/pair รับหลายคน, chat รับ 40 ข้อความ×4000 ตัว) กัน payload bomb
- **CORS allow-list** — บน path partner ตั้ง `Access-Control-Allow-Origin` เป็น origin ที่ลงทะเบียนไว้ต่อ partner (เฉพาะกรณีเขาเรียกจาก browser; เรียกจาก server ไม่ต้อง)
- **Zod ครบทุก partner route** — บางตัว (`bazi/work`, `bazi/narrate`) ยัง validate หลวม (เช็ค `self`/`candidates` ด้วยมือ) → รัด schema ให้เข้ม
- **ปิด verbose error** — อย่าคาย stack/`error.message` ดิบให้ partner (ตอนนี้บาง route คืน `error.message` ตรงๆ) → map เป็นโค้ด/ข้อความกลาง, log รายละเอียดฝั่งเรา
- **Secrets** — ยืนยันว่า `GEMINI_API_KEY`/DB URL อยู่ใน env เท่านั้น ไม่หลุดใน response

---

## Phase 5 — Observability, Audit & Kill-switch 🟡

- **Audit log ต่อ partner** — บันทึกทุก request บน path partner: partnerId, feature, status, latency, token/cost (ต่อยอด `logUsage`)
- **last_used_at + สถิติ** — โชว์บนแดชบอร์ด (มี `/api/stats` อยู่แล้ว) แยกยอดต่อ partner
- **Kill-switch** — ตั้ง `status='revoked'` แล้วคีย์ตายทันที (ทดสอบว่าตัดได้จริง)
- **Alert ต้นทุน** — เตือนเมื่อ partner ใด ๆ ทะลุ X% ของเพดาน

---

## Phase 6 — สัญญา/กฎหมาย/ปฏิบัติการ (แก้ R5) 🟢 คู่ขนานได้

- **PDPA / ข้อตกลงประมวลผลข้อมูล** — วันเกิด/เวลา/จังหวัด/ชื่อ = ข้อมูลส่วนบุคคล ต้องมี DPA กับ partner (ใครเป็น controller/processor, เก็บได้นานแค่ไหน, ลบเมื่อไร)
- **ToS / Rate & Fair-use policy** — ระบุลิมิต, การใช้ที่ห้าม, การ revoke
- **SLA + ช่องทางแจ้งปัญหา** — uptime, error code reference, ผู้ติดต่อ
- **ทางเลือกลดภาระเรา** — กำหนดในสัญญาให้ partner ทำ reverse-proxy + cache ฝั่งตัวเอง (ใช้เป็นข้อกำหนด ไม่ใช่ชั้น security หลักของเรา)

---

## ลำดับลงมือ (แนะนำ)

```
Sprint 1 (ก่อนเปิด partner จริง):
  Phase 1  Partner API key + /api/partner/v1
  Phase 3  บังคับ own_key บน endpoint LLM        ← แก้ความเสี่ยงสูงสุดด้วยงานน้อยสุด
  Phase 2  ย้าย rate-limit → Upstash Redis

Sprint 2:
  Phase 4  hardening อินพุต + CORS + ซ่อน error
  Phase 5  audit log ต่อ partner + kill-switch

คู่ขนานตลอด:
  Phase 6  DPA/ToS/SLA (งานเอกสาร-กฎหมาย)
```

**ทำน้อยสุดที่ยังปลอดภัยพอเปิด B2B ได้ = Phase 1 + Phase 3(แบบ A) + Phase 2**
(มี auth + partner แบกต้นทุน LLM เอง + ลิมิตกันจริง) — ที่เหลือทยอยเสริมได้

---

## ภาคผนวก — รีวิวแผน (2026-09-07) : จุดที่ต้องปรับ / เพิ่ม

ตรวจกับโค้ดจริงอีกรอบ (`fortune-sage/predict`, `louise-hay/chat`, `bazi/narrate`, `qi/quota.ts`, `rate-limit.ts`) เจอช่องที่แผน 6 เฟสยังไม่ครอบ:

| # | ช่องโหว่ / ข้อปรับ | ทำไมสำคัญ | ใส่ที่เฟส |
|---|---|---|---|
| A1 | **`anonId` รับจาก body และ "เชื่อ" ทันที** (`z.string()` ใน sage/chat/cards) → ใครก็ส่ง anonId ของคนอื่นมาเผาโควตาฟรี/หัก QI ของเขาได้ | เป็นช่องของ consumer อยู่แล้ว และจะโดนหนักขึ้นเมื่อ partner ส่ง end-user id เข้ามาเอง | **Phase 1 (ใหม่ 1.4)**: บน path partner ให้ **namespace** เป็น `p:<partnerId>:<endUserId>` ฝั่ง server (partner ห้ามส่ง anonId ดิบ) · consumer path ให้ BFF (`mootech-fe`) ส่ง anonId ผ่าน header ลับ `X-Internal-Key` + ไม่รับจาก body |
| A2 | **Partner ข้าม `/api/partner/v1` ไปยิง path public ตรงได้** เพราะ path เดิมยังเปิด → Phase 3 (own_key) กันไม่ได้จริง | เพดาน LLM กลางยังถูกเผาได้จาก path เดิม | **Phase 1 (ใหม่ 1.5)**: path เดิมฝั่ง LLM ให้รับเฉพาะ (ก) request ที่มี `X-Internal-Key` จาก BFF หรือ (ข) Origin ใน allow-list ของเว็บเราเอง; นอกนั้น 401. ต้องเคาะว่า `bazi-sft-dataset.vercel.app` (หน้าเว็บทดสอบ) ยังต้องยิงตรงจาก browser ไหม |
| A3 | **`apiKey` (Gemini ของ partner) รับใน body** → เสี่ยงหลุดใน log/ error/ request dump | คีย์ partner รั่ว = เราต้องรับผิด | Phase 3: ย้ายไป header `X-LLM-Key`, ห้าม log body ฝั่ง LLM, redact ก่อน `console.*` |
| A4 | **คีย์ partner ไม่มี prefix/หมดอายุ/หมุนคีย์** | revoke อย่างเดียวไม่พอ ตอนหมุนคีย์ partner จะดาวน์ | Phase 1.2: รูปแบบ `mm_live_<32 chars>` / `mm_test_…`, ฟิลด์ `expires_at`, อนุญาต **2 คีย์ active ต่อ partner** ช่วงหมุน |
| A5 | **Sandbox mode** — partner ทดสอบ UI แล้วต้องเผา LLM/โควตาจริง | ต้นทุน + ข้อมูลทดสอบปนของจริง | Phase 1: คีย์ `mm_test_` คืน fixture (ไพ่คงที่/ข้อความตัวอย่าง) ไม่แตะ LLM, ไม่แตะ ledger |
| A6 | **โควตารายวันไม่จำเป็นต้องใช้ Redis** — ตาราง `bazi_feature_quota` (periodKey/used, atomic update) ใช้แนวเดียวกันนับต่อ partner ได้เลย; Redis จำเป็นเฉพาะ **per-minute burst** | ลด dependency, เริ่มได้ทันที | Phase 2: แยกเป็น 2a daily/monthly quota = Postgres (ทำก่อน) · 2b per-min = Upstash (ทำเมื่อมี partner จริง) |
| A7 | **ตัด early ที่ `src/middleware.ts` (edge)** ก่อนถึง handler: ไม่มี header → 401 ทันที ไม่กิน function invocation | กัน bot ยิงถล่มโดยไม่เสีย compute | Phase 1.3: middleware matcher `/api/partner/:path*` เช็ครูปแบบ header + hash lookup (cache 60s) แล้วค่อยให้ handler เช็ค scope |
| A8 | **PDPA ฝั่งเก็บข้อมูล** — ยืนยันว่า path partner **ไม่ persist** payload วันเกิด/ชื่อ (ตอนนี้ chat/pair/work ไม่ insert DB — ดีอยู่แล้ว) แต่ `logUsage`/console ต้องไม่ติด PII; ระบุ retention ของ audit log (เช่น 90 วัน) | ต้องตอบ partner ได้ในสัญญา DPA | Phase 5/6 |
| A9 | **Error contract เดียว** — ตอนนี้มี 2 ทรง (`{error:"..."}` และ `{error:{message}}`) | partner เขียน client ยาก | Phase 4: บน partner path map เป็น `{ error: { code, message, requestId } }` เดียว + ส่ง `X-Request-Id` ทุก response |
| A10 | **Cron routes** — มีเช็ค `CRON_SECRET` แล้ว ✅ แต่ควรอยู่ในเช็คลิสต์ secrets รอบเดียวกัน (rotate พร้อม partner key) | — | Phase 4 |
| A11 | **เทสต์ DoD อัตโนมัติ** — เพิ่ม `tests/partner-auth.test.ts` (ไม่มีคีย์ 401 · revoked 401 · scope 403 · quota 429 + Retry-After · sandbox ไม่แตะ ledger) | แผนมี DoD แต่ยังไม่ผูกกับ CI | ทุกเฟส |

**ลำดับใหม่ที่แนะนำ (แก้จาก "ลำดับลงมือ" ข้างบน):**

```
Sprint 1  Phase 1 (1.1–1.5 รวม A1 namespace + A2 ปิด path เดิมสำหรับ LLM + A4 prefix/rotation + A7 middleware)
          Phase 3 แบบ A (own_key ผ่าน header — A3)
          Phase 2a daily quota บน Postgres (A6)
Sprint 2  Phase 4 (A9 error contract) · Phase 5 audit + kill-switch · A5 sandbox · A11 tests
เมื่อมี partner จริงยิงหนัก  Phase 2b Upstash per-minute
คู่ขนาน  Phase 6 DPA/ToS/SLA (+ A8 retention)
```

**ต้องเคาะก่อนลงมือ:** (1) หน้าเว็บ `bazi-sft-dataset.vercel.app` ยังต้องยิง API ตรงจาก browser ไหม (ถ้าไม่ → ปิด path public ฝั่ง LLM ได้เต็มที่) · (2) partner แบก Gemini เอง (own_key) ใช่ไหม · (3) จะเริ่ม Upstash เลยหรือใช้ Postgres ไปก่อน
