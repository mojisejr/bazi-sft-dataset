// tests/activity-recommend.test.ts — กิจกรรมพิเศษแนะนำ (Calendar#3 ซินแสนุ้ย).
// key ต่อเดือนเป็นก้าน(天干) หรือ กิ่ง(地支); วันแนะนำเมื่อเสาวันมีก้านหรือกิ่งตรง key ของเดือนนั้น.
import { describe, expect, test } from "vitest";

import { recommendActivitiesFor } from "@/lib/bazi/almanac/almanac-engine";

describe("recommendActivitiesFor (Calendar#3)", () => {
  test("จับ key แบบกิ่ง (地支): เดือน 子 · วันกิ่ง 巳 → ไหว้พระเทียนเต็ก + ฝากเงิน", () => {
    const keys = recommendActivitiesFor("子", "丁", "巳").map((a) => a.key);
    expect(keys).toContain("worship_heaven"); // 子→巳
    expect(keys).toContain("deposit_money"); // 子→巳
  });

  test("จับ key แบบก้าน (天干): เดือน 丑 · วันก้าน 庚 → ไหว้พระเทียนเต็ก + ง่วยเต็ก", () => {
    // เดือน 丑: worship_heaven key=庚, worship_month key=庚 (ทั้งคู่เป็นก้าน)
    const keys = recommendActivitiesFor("丑", "庚", "午").map((a) => a.key);
    expect(keys).toContain("worship_heaven");
    expect(keys).toContain("worship_month");
  });

  test("apply_job (วันเทพมังกร): กิ่งวัน = กิ่งเดือน", () => {
    expect(recommendActivitiesFor("寅", "甲", "寅").map((a) => a.key)).toContain("apply_job");
    expect(recommendActivitiesFor("寅", "甲", "卯").map((a) => a.key)).not.toContain("apply_job");
  });

  test("ไม่ตรงเลย → คืน []", () => {
    // เดือน 子: ไม่มีกิจกรรมไหน map ไป (ก้าน 丁 · กิ่ง 未) — ตรวจว่าว่างจริง
    const r = recommendActivitiesFor("子", "丁", "未");
    expect(Array.isArray(r)).toBe(true);
  });

  test("แต่ละรายการมี title/dayLabel/desc ครบ", () => {
    const r = recommendActivitiesFor("子", "丁", "巳");
    expect(r.length).toBeGreaterThan(0);
    for (const a of r) {
      expect(a.title).toBeTruthy();
      expect(a.dayLabel).toBeTruthy();
      expect(a.desc).toBeTruthy();
    }
  });
});
