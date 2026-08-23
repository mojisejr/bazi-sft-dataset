# ระบบกิจกรรม — Qi Point System (แต้ม Qi)

ระบบสะสม/ใช้ "แต้ม Qi" แบบ gamification. อ้างอิงเอกสาร MuMate Qi Point System.
ต่อยอดบน ledger เดิม (`bazi_wallet` / `bazi_ledger_txn` / `applyLedger`) โดยเพิ่ม **คอลัมน์ `qi` แยกจาก coins/xp**.

> **ข้อจำกัดที่ยอมรับ (รอบนี้):** ตัวตนผู้ใช้เป็น `anonId` จาก localStorage ซึ่งรีเซ็ตได้ (เคลียร์ localStorage = ได้ id ใหม่) → **ฟาร์มแต้ม/สิทธิ์ได้** โดยเฉพาะเส้น referral. ยังไม่ทำ OTP/identity/device-throttle. ควรผูก identity จริงก่อนเปิดใช้เชิงพาณิชย์.

## แหล่งความจริง (source of truth)
ทุก "เส้น" นิยามในโค้ดที่ [`src/lib/bazi/qi/catalog.ts`](../src/lib/bazi/qi/catalog.ts) (แก้ตัวเลข/เพิ่มเส้นที่นี่ที่เดียว). API `GET /api/qi/catalog` คืน catalog นี้พร้อม `note` ต่อเส้น.

## เส้นได้แต้ม (EARN)

| code | +Qi | เพดาน | เส้นนี้คืออะไร |
|---|---|---|---|
| `signup` | 50 | once | โบนัสตั้งต้นครั้งแรกที่สมัคร |
| `daily_login` | 5 | daily | เข้าใช้งานรายวัน (วันละครั้ง) |
| `share` | 10 | daily | แชร์คอนเทนต์ (วันละครั้ง) |
| `referral_free` | 50 | per_referral | ผู้ถูกชวนสมัครฟรี — ผู้ชวนได้ต่อ 1 คน |
| `referral_plus` | 500 | per_referral | ผู้ถูกชวนอัปเกรด PLUS (รอ flow อัปเกรดจริงยิง trigger) |
| `referral_pro` | 1000 | per_referral | ผู้ถูกชวนอัปเกรด PRO (รอ flow อัปเกรดจริงยิง trigger) |
| `wuxing_matrix` | 1000 | once | แจ็กพอตแคมเปญครบ 5 ธาตุ |

**เพดานทำงานอย่างไร:** ตาราง `bazi_qi_claim (anon_id, code, period_key)` PK ร่วม — จ่ายครั้งแรกได้, จ่ายซ้ำในรอบเดิม = `capped`. `period_key` = `all` (once) / วันไทย (daily) / `ref` = anonId ผู้ถูกชวน (per_referral).

## เส้นใช้แต้ม (SPEND / REDEEM)

| code | −Qi | มอบสิทธิ์ (grant) | ปลายทางที่ตัดจริง |
|---|---|---|---|
| `card_use` | 10 | credit `card_use` +1 | โควตาเปิดการ์ด (divine/oracle/fortune-sage) |
| `chat_question` | 30 | credit `chat_question` +1 | โควตาถาม AI (louise-hay + open-webui\*) |
| `matching_slot` | 150 | credit `matching_slot` +1 | เพดานช่องจับคู่ (saved-charts) |
| `course_destiny` | 500 | owned `course:destiny` | สิทธิ์คอร์ส (helper `hasEntitlement`) |
| `plus_month` | 1000 | tier `plus` 30 วัน | ยกโควตาฟรี card/chat + base slot |
| `book_lifecode` | 3000 | owned `book:lifecode` | สิทธิ์หนังสือ (helper `hasEntitlement`) |

\* open-webui ปิดการ gate เป็นค่าเริ่มต้น (กันกระทบแชทหลัก) — เปิดด้วย env `QI_GATE_OPENWEBUI=1`.

**auto-refund:** ถ้าหักแต้มสำเร็จแต่ `grantEntitlement` ล้ม → คืนแต้มอัตโนมัติ (`qi:refund:<code>`).

## Entitlement store (1 ตารางกลาง)
`bazi_entitlement (anon_id, kind, sku, credits, expires_at)` — 2 ทรงในตารางเดียว:
- **credit-based** (`card_use`/`chat_question`/`matching_slot`): `credits` = คงเหลือ, `sku=''`
- **owned/expiry** (`course`/`book`/`tier`): มีแถว = เป็นเจ้าของ; `tier` ใช้ `expires_at`

Helper: [`src/lib/bazi/qi/entitlements.ts`](../src/lib/bazi/qi/entitlements.ts) — `grantEntitlement` / `consumeCredit` / `getCredits` / `hasEntitlement` / `getTier` / `getEntitlementSummary`.

## โมเดลโควตาฟรี + tier
[`src/lib/bazi/qi/quota.ts`](../src/lib/bazi/qi/quota.ts) — `consumeUse(anonId, feature)` ตัด **โควตาฟรีรายวันก่อน → หมดแล้วตัด credit ที่แลกด้วย Qi**. โควตาฟรีต่อวันขึ้นกับ tier:

| feature | free | plus | pro |
|---|---|---|---|
| card | 1 | 5 | 20 |
| chat | 3 | 30 | 100 |
| matching slot (เพดานรวม) | 3 | 10 | 50 |

โควตาฟรีเก็บที่ `bazi_feature_quota (anon_id, feature, period_key=วันไทย, used)` — reset โดยธรรมชาติเมื่อขึ้นวันใหม่.

`qiGate(anonId, feature)` = ตัวช่วยใน route: ส่ง `anonId` มา → ตัดโควตา, หมด → `402`; ไม่ส่ง → ปล่อยผ่าน (backward-compat).

## API

| method | path | ทำอะไร |
|---|---|---|
| GET | `/api/qi/catalog` | ดึงทุกเส้น + note (เอกสารในตัว) |
| GET | `/api/qi/wallet?anonId=` | ยอด Qi + ประวัติธุรกรรม Qi |
| GET | `/api/qi/entitlements?anonId=` | credit คงเหลือ / owned / tier / freeLimit |
| POST | `/api/qi/earn` `{anonId, code, ref?}` | จ่ายเส้น earn (capped ถ้าซ้ำรอบ) |
| POST | `/api/qi/spend` `{anonId, code, ref?}` | หัก Qi + มอบสิทธิ์ (409 ถ้าไม่พอ) |

การผูกโควตากับฟีเจอร์: ส่ง `anonId` เข้า route เดิม —
`POST /api/{divine-cards,oracle-cards,fortune-sage}/predict` (+`anonId`),
`POST /api/louise-hay/chat` (มี `anonId` อยู่แล้ว, เฉพาะ free tier),
`POST /api/bazi/saved-charts` (+`ownerId` → เพดาน slot; `GET ?ownerId=` กรองต่อ user).

## Cron
`/api/cron/qi-quota-reset` (`vercel.json`: `0 17 * * *` = 00:00 น. ไทย) — bearer `CRON_SECRET`. งาน: ล้างแถว `bazi_feature_quota` + `bazi_qi_claim` (เส้น daily) ของวันก่อน ๆ (housekeeping; โควตาฟรี reset โดย period_key อยู่แล้ว).

## Migration
`drizzle/0038_qi_point_system.sql` — additive/idempotent. รันเอง:

```bash
npm run db:apply:qi-point-system
```

เพิ่ม: `bazi_wallet.qi`, `bazi_ledger_txn.qi_delta`, ตาราง `bazi_entitlement` / `bazi_qi_claim` / `bazi_feature_quota`, index `bazi_saved_chart(owner_id)`.

## ยังไม่ทำ (out of scope)
- identity/OTP/device-throttle กัน referral farming (ดูข้อจำกัดด้านบน)
- หน้า UI ร้านแลกแต้ม / หน้าคอร์ส / หน้าหนังสือ (มีแค่ backend + entitlement + helper)
- flow อัปเกรด tier ที่จ่ายเงินจริง ซึ่งจะเป็นตัวยิงเส้น `referral_plus` / `referral_pro`
