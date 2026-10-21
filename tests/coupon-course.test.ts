import { describe, expect, test } from "vitest";

import { validateCreate } from "@/lib/bazi/qi/coupon";

// เอ็ม 2026-10-21: โค้ด/ลิงก์รับคอร์ส = คูปองชนิด course (slug ใน tierSku)
describe("coupon course", () => {
  test("course + slug ที่รู้จัก = ผ่าน (ไม่ต้องมีจำนวน)", () => {
    const r = validateCreate({ code: "WTD-ABC123", rewardKind: "course", tierSku: "calendar" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.rewardKind).toBe("course");
      expect(r.value.tierSku).toBe("calendar");
    }
    expect(validateCreate({ code: "BLM-1", rewardKind: "course", tierSku: "life-matrix" }).ok).toBe(true);
  });
  test("slug ไม่รู้จัก = ไม่ผ่าน", () => {
    const r = validateCreate({ code: "X1", rewardKind: "course", tierSku: "destiny" });
    expect(r.ok).toBe(false);
  });
  test("ชนิดเดิมยังทำงาน", () => {
    expect(validateCreate({ code: "Q1", rewardKind: "qi", amount: 10 }).ok).toBe(true);
    expect(validateCreate({ code: "T1", rewardKind: "tier", tierSku: "plus", amount: 30 }).ok).toBe(true);
  });
});
