-- 0051 · activity_coupon.reward_kind รับค่า 'matching' (คูปองเครดิตแมทช์สมพงศ์ · #2 คูปอง)
-- CHECK เดิม (0050) = ('qi','chat','card','tier') → insert reward_kind='matching' ล้ม (CHECK violation).
-- ADDITIVE/idempotent: drop+recreate constraint เพิ่ม 'matching'. ไม่แตะข้อมูลเดิม.
-- 🔴 prod = Supabase เดียวกับ FE — ต้องรันด้วยมือ (ฟีม/เจ้าของ) เหมือน migration อื่น.
ALTER TABLE activity_coupon DROP CONSTRAINT IF EXISTS activity_coupon_reward_kind_check;
--> statement-breakpoint
ALTER TABLE activity_coupon ADD CONSTRAINT activity_coupon_reward_kind_check CHECK (reward_kind IN ('qi','chat','card','matching','tier'));
