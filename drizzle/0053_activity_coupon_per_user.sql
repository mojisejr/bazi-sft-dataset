-- 0053 · reward coupon (activity_coupon): จำกัดจำนวนครั้งต่อคน + ลบได้
-- เดิม 1 คูปอง/บัญชี (UNIQUE couponId+anonId ล็อกตายตัว). เพิ่ม max_use_per_user (null = 1 = พฤติกรรมเดิม)
-- แล้ว "นับ" ฝั่งโค้ดแทน (redeemCoupon) → ต้อง DROP unique เดิมเพื่อให้ >1 ต่อคนได้.
-- ADDITIVE column + DROP index (ปลอดภัย idempotent). ฟีม/เจ้าของรัน prod.
ALTER TABLE activity_coupon ADD COLUMN IF NOT EXISTS max_use_per_user integer;
--> statement-breakpoint
DROP INDEX IF EXISTS uq_activity_coupon_redemption;
