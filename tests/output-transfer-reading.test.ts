import { describe, expect, test } from "vitest";

import { buildOutputTransferReading } from "@/lib/bazi/output-transfer-reading";

// ดิถี 甲 (ไม้) → ธาตุถ่ายเท = ไฟ ; 食神 ขั้วหยางเดียวกับดิถี = 丙
const WOOD_STATE = {
  dayMaster: "甲",
  fourPillars: {
    year: { stem: "癸", branch: "酉", hiddenStems: ["辛"] },
    month: { stem: "丙", branch: "午", hiddenStems: ["丁", "己"] },
    day: { stem: "甲", branch: "寅", hiddenStems: ["甲", "丙", "戊"] },
    hour: { stem: "庚", branch: "子", hiddenStems: ["癸"] },
  },
};

describe("buildOutputTransferReading (Step 6.2)", () => {
  test("ดิถีไม้ถ่ายเทเป็นไฟ ใช้ราศีบนตัวแทน 丙 (食神 ขั้วหยาง)", () => {
    const reading = buildOutputTransferReading(WOOD_STATE);

    expect(reading.dayMasterElement).toBe("wood");
    expect(reading.outputElement).toBe("fire");
    expect(reading.outputStem).toBe("丙");
    expect(reading.pillars).toHaveLength(4);
  });

  test("เชี่ยงแซของธาตุถ่ายเทคำนวณจากราศีบนตัวแทนเทียบราศีล่างแต่ละหลัก", () => {
    const reading = buildOutputTransferReading(WOOD_STATE);
    const byPillar = Object.fromEntries(reading.pillars.map((p) => [p.pillarKey, p]));

    // 丙 เทียบ 午 = 帝旺 (ตี้อ๋วง) → ปริญญาเอก
    expect(byPillar.month.stageChinese).toBe("帝旺");
    expect(byPillar.month.education).toContain("ปริญญาเอก");
    // 丙 เทียบ 寅 = 长生 (เชี่ยงแซ)
    expect(byPillar.day.stageChinese).toBe("长生");
    // 丙 เทียบ 子 = 胎 (ทอ)
    expect(byPillar.hour.stageChinese).toBe("胎");
  });

  test("ตรวจจับว่าหลักนั้นมีธาตุถ่ายเทปรากฏหรือไม่", () => {
    const reading = buildOutputTransferReading(WOOD_STATE);
    const byPillar = Object.fromEntries(reading.pillars.map((p) => [p.pillarKey, p]));

    // เดือน: ราศีบน 丙 (ไฟ) → มีธาตุถ่ายเท
    expect(byPillar.month.carriesOutputElement).toBe(true);
    // ยาม: 庚子 ไม่มีไฟ → ไม่มีธาตุถ่ายเท
    expect(byPillar.hour.carriesOutputElement).toBe(false);
  });

  test("ประโยคคำทำนายผสมบริบทของหลักเข้ากับความหมายเชี่ยงแซ", () => {
    const reading = buildOutputTransferReading(WOOD_STATE);
    const month = reading.pillars.find((p) => p.pillarKey === "month");

    expect(month?.sentence).toContain(month?.context ?? "");
    expect(month?.sentence).toContain("ตี้อ๋วง");
  });

  test("ดิถีขั้วหยินใช้ราศีบนตัวแทนขั้วหยิน (己 → 辛 ทอง)", () => {
    const reading = buildOutputTransferReading({
      dayMaster: "己",
      fourPillars: {
        year: { stem: "癸", branch: "酉", hiddenStems: ["辛"] },
        month: { stem: "癸", branch: "亥", hiddenStems: ["壬", "甲"] },
        day: { stem: "己", branch: "酉", hiddenStems: ["辛"] },
        hour: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
      },
    });

    expect(reading.outputElement).toBe("metal");
    expect(reading.outputStem).toBe("辛");
  });
});
