import { describe, expect, it } from "vitest";

import { computeDestiny, computeDestinyFromChart, toCeYear } from "@/lib/bazi/what-if/destiny";
import { extractStoryJson } from "@/lib/bazi/what-if/story-llm";

describe("what-if destiny engine", () => {
  it("แปลง พ.ศ. → ค.ศ. อัตโนมัติ (เกิน 2400 = พ.ศ.)", () => {
    expect(toCeYear(2531)).toBe(1988);
    expect(toCeYear(1988)).toBe(1988);
  });

  it("คำนวณธาตุ/นักษัตรของเสาปีถูกต้อง (เทียบปีอ้างอิง)", () => {
    // 1988 = 戊辰 ดินหยาง ปีมะโรง
    const d1988 = computeDestiny(1988, "วิศวกร");
    expect(d1988.element).toBe("ดิน");
    expect(d1988.polarity).toBe("หยาง");
    expect(d1988.animal).toBe("มะโรง");

    // 1984 = 甲子 ไม้หยาง ปีชวด
    const d1984 = computeDestiny(2527, "ครู"); // ส่งเป็น พ.ศ.
    expect(d1984.yearCe).toBe(1984);
    expect(d1984.element).toBe("ไม้");
    expect(d1984.polarity).toBe("หยาง");
    expect(d1984.animal).toBe("ชวด");

    // 1995 = 乙亥 ไม้ยิน ปีกุน
    const d1995 = computeDestiny(1995, "พนักงานบัญชี");
    expect(d1995.element).toBe("ไม้");
    expect(d1995.polarity).toBe("ยิน");
    expect(d1995.animal).toBe("กุน");
  });

  it("deterministic — input เดิมได้อาชีพเดิมทุกครั้ง", () => {
    const a = computeDestiny(2531, "พนักงานบัญชี");
    const b = computeDestiny(2531, "พนักงานบัญชี");
    expect(a.destinedCareer).toBe(b.destinedCareer);
  });

  it("อาชีพที่ฟ้าลิขิตไม่ซ้ำกับงานปัจจุบัน", () => {
    // ลองงานปัจจุบันที่คำไปพ้องกับ pool (เช่น "เชฟ" กับธาตุไฟ) หลาย ๆ ปี
    for (const year of [1980, 1985, 1990, 1995, 2000]) {
      for (const job of ["เชฟ", "นักเขียน", "วิศวกร", "ซีอีโอ"]) {
        const d = computeDestiny(year, job);
        expect(d.destinedCareer.replace(/\s+/g, "")).not.toBe(job.replace(/\s+/g, ""));
        expect(d.destinedCareer.length).toBeGreaterThan(5);
        expect(d.careerReason.length).toBeGreaterThan(10);
      }
    }
  });
});

describe("what-if destiny from full chart (ตาราง B NewData)", () => {
  it("ดิถี戊(ดิน) สมดุล เดือน甲(ไม้) → ตาราง B ให้ [ไฟ,ดิน,น้ำ] → อาชีพธาตุไฟ", () => {
    const d = computeDestinyFromChart({
      dayStem: "戊",
      monthStem: "甲",
      band: "balanced",
      birthYear: 2531,
      currentJob: "พนักงานบัญชี",
    });
    expect(d).not.toBeNull();
    expect(d!.dayElement).toBe("ดิน");
    expect(d!.doElements).toEqual(["ไฟ", "ดิน", "น้ำ"]);
    expect(d!.element).toBe("ไฟ"); // ธาตุอาชีพ = อันดับ 1 ของตาราง
    expect(d!.polarity).toBe("หยาง"); // 戊 เป็นก้านหยาง
    expect(d!.animal).toBe("มะโรง"); // 1988
    expect(d!.careerReason).toContain("ธาตุไฟ");
  });

  it("ดิถี辛(ทองยิน) ดวงอ่อน เดือน丙(ไฟ) → ควรทำธาตุทอง · ขั้วยิน", () => {
    const d = computeDestinyFromChart({
      dayStem: "辛",
      monthStem: "丙",
      band: "weak",
      birthYear: 1995,
      currentJob: "ครู",
    });
    expect(d!.element).toBe("ทอง");
    expect(d!.polarity).toBe("ยิน");
  });

  it("ก้านไม่รู้จัก → คืน null (ให้ caller fallback เสาปี)", () => {
    expect(
      computeDestinyFromChart({
        dayStem: "X",
        monthStem: "甲",
        band: "balanced",
        birthYear: 1990,
        currentJob: "ครู",
      }),
    ).toBeNull();
  });

  it("deterministic — ดวงเดิม+อาชีพเดิม ได้ผลเดิม", () => {
    const input = {
      dayStem: "丙",
      monthStem: "壬",
      band: "veryStrong" as const,
      birthYear: 2528,
      currentJob: "วิศวกร",
    };
    expect(computeDestinyFromChart(input)!.destinedCareer).toBe(
      computeDestinyFromChart(input)!.destinedCareer,
    );
  });
});

describe("what-if story JSON parsing", () => {
  it("ดึง JSON จากคำตอบที่มี code fence ครอบ", () => {
    const raw = '```json\n{"shift": "วันหนึ่ง", "peak": "วันนี้", "future": "สิบปี"}\n```';
    expect(extractStoryJson(raw)).toEqual({ shift: "วันหนึ่ง", peak: "วันนี้", future: "สิบปี" });
  });

  it("คืน null เมื่อ field ไม่ครบ", () => {
    expect(extractStoryJson('{"shift": "a"}')).toBeNull();
    expect(extractStoryJson("ไม่มี json")).toBeNull();
  });
});
