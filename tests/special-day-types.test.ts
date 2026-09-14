import { describe, expect, test } from "vitest";

import { matchSpecialDayTypes } from "@/lib/bazi/almanac/almanac-engine";

// เอกสารซินแส FIXเงื่อนไขปฏิทิน — ตรึงว่าตาราง JSON ถอดถูกต้อง (กันพิมพ์ผิด → ให้คำแนะนำวันมงคลผิด).
describe("วันพิเศษตามกิ่งเดือน (love/heavenWealth/doctor/forgiveness)", () => {
  test("วันความรัก: เดือน 子 + วัน 酉 = เข้าเงื่อนไข", () => {
    const hits = matchSpecialDayTypes("子", "酉", "癸酉");
    expect(hits.map((h) => h.id)).toContain("love");
    expect(hits.find((h) => h.id === "love")?.name).toBe("วันความรัก");
  });

  test("วันลาภสวรรค์: เดือน 卯 + วัน 午 = เข้าเงื่อนไข", () => {
    expect(matchSpecialDayTypes("卯", "午", "甲午").map((h) => h.id)).toContain("heavenWealth");
  });

  test("วันหมอเทพ: เดือน 寅 + วัน 戌 = เข้าเงื่อนไข", () => {
    expect(matchSpecialDayTypes("寅", "戌", "甲戌").map((h) => h.id)).toContain("doctor");
  });

  test("วันฟ้าอภัย: จับเสาวันเต็ม (gānzhī) ไม่ใช่แค่กิ่ง — เดือน 寅 + วัน 戊寅 = เข้า, แต่ 甲寅 ไม่เข้า", () => {
    expect(matchSpecialDayTypes("寅", "寅", "戊寅").map((h) => h.id)).toContain("forgiveness");
    expect(matchSpecialDayTypes("寅", "寅", "甲寅").map((h) => h.id)).not.toContain("forgiveness");
  });

  test("วันที่ไม่เข้าเงื่อนไขใดเลย → []", () => {
    // เดือน 子: ความรัก=酉, ลาภสวรรค์=子, หมอเทพ=申, ฟ้าอภัย=甲子 → วัน 丑 ไม่ตรงอันไหน
    expect(matchSpecialDayTypes("子", "丑", "乙丑")).toEqual([]);
  });
});
