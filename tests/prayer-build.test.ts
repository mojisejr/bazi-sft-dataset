/**
 * ทดสอบตัวสร้างคำอธิษฐาน (pure) — เลือกประตู/เทพตามเรื่อง + เสริมตามธาตุเสริมดวง, ตัด ward, ปิดท้าย สาธุ.
 */
import { describe, expect, it } from "vitest";

import { buildPrayer, PRAYER_TOPIC_TITLE } from "@/lib/bazi/prayer/build-prayer";

describe("buildPrayer", () => {
  it("เรื่องความรัก → มีเทพ 合 (คู่บุญ) และหัวเรื่องความรัก", () => {
    const p = buildPrayer({ topic: "love" });
    expect(p.title).toBe(PRAYER_TOPIC_TITLE.love);
    expect(p.used.gods).toContain("合");
    expect(p.text).toContain("สาธุ สาธุ สาธุ");
    expect(p.text).toContain("(ระบุชื่อ-นามสกุล)");
  });

  it("ตัด ward (พรกันภัย) ออกจากเรื่องทั่วไป แต่คงไว้ในเรื่องสะเดาะเคราะห์", () => {
    const general = buildPrayer({ topic: "general", maxWishes: 12 });
    // 蛇/玄/驚/傷 เป็น ward — ไม่ควรโผล่เป็นข้อพรในเรื่องทั่วไป
    expect(general.text).not.toContain("แคล้วคลาดจากการหลอกลวง");
    const fixluck = buildPrayer({ topic: "fixluck" });
    // สะเดาะเคราะห์คง 符 (ล้างคำสาป) ไว้
    expect(fixluck.used.gods).toContain("符");
  });

  it("ธาตุเสริมดวง (用神) → เสริมประตู/เทพที่ตรงธาตุ + ระบุในอารัมภบท", () => {
    const p = buildPrayer({ topic: "wealth", favorableElements: ["ไฟ"], maxWishes: 12 });
    expect(p.favorableElements).toEqual(["ไฟ"]);
    expect(p.text).toContain("ธาตุเสริมดวงชะตา");
    // มีประตู/เทพธาตุไฟ (景/雀) เพิ่มเข้ามา
    const all = [...p.used.gates, ...p.used.gods];
    expect(all.some((cn) => cn === "景" || cn === "雀")).toBe(true);
  });

  it("จำกัดจำนวนข้อพรตาม maxWishes", () => {
    const p = buildPrayer({ topic: "general", maxWishes: 3 });
    expect(p.text).toContain("๓.");
    expect(p.text).not.toContain("๔.");
  });

  it("ใส่สถานที่/องค์เทพ/วันเวลา ในหัวบท", () => {
    const p = buildPrayer({
      topic: "love",
      placeName: "จีจินเกาะ คลองสาน",
      deity: "เทพด้ายแดง เฒ่าจันทรา",
      dateTimeLabel: "วันเสาร์ที่ ๑๔ กุมภาพันธ์ ๒๕๖๙",
    });
    expect(p.text).toContain("ณ จีจินเกาะ คลองสาน");
    expect(p.text).toContain("เทพด้ายแดง เฒ่าจันทรา");
    expect(p.text).toContain("๑๔ กุมภาพันธ์ ๒๕๖๙");
  });
});
