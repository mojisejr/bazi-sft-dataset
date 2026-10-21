-- 0056 · activity_coupon.reward_kind รับค่า 'course' (คูปอง/ลิงก์รับสิทธิ์คอร์สออนไลน์ · เอ็ม 2026-10-21)
-- slug คอร์ส (calendar | life-matrix) เก็บใน tier_sku · แลกแล้ว = bazi_entitlement kind='course' sku=<slug>
ALTER TABLE activity_coupon DROP CONSTRAINT IF EXISTS activity_coupon_reward_kind_check;
ALTER TABLE activity_coupon ADD CONSTRAINT activity_coupon_reward_kind_check CHECK (reward_kind IN ('qi','chat','card','matching','tier','course'));
