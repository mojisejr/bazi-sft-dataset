-- 0050 — activity_coupon (#2 คูปอง Phase 2 · ซินแสนุ้ย 2026-09-14): คูปองกิจกรรม user กรอกโค้ด → รับ QI/เครดิต/tier.
-- แยกจาก discount_code (ฝั่ง FE, ลดราคาจ่ายเงิน) — อันนี้แจกสิทธิ์ตรง ๆ. ADDITIVE ONLY. รันซ้ำได้ (IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS activity_coupon (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL,
  reward_kind   text NOT NULL CHECK (reward_kind IN ('qi','chat','card','tier')),
  reward_qi     integer NOT NULL DEFAULT 0,
  credit_count  integer NOT NULL DEFAULT 0,
  tier_sku      text,
  tier_days     integer NOT NULL DEFAULT 0,
  starts_at     timestamptz,
  ends_at       timestamptz,
  max_use_total integer,
  used_count    integer NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','EXPIRED')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_coupon_lower_code ON activity_coupon (lower(code));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS activity_coupon_redemption (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id      uuid NOT NULL REFERENCES activity_coupon(id),
  anon_id        text NOT NULL,
  reward_summary text NOT NULL,
  redeemed_at    timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- กันรับซ้ำ: 1 คูปองต่อ 1 บัญชี
CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_coupon_redemption ON activity_coupon_redemption (coupon_id, anon_id);
