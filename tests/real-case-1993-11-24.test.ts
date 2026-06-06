import { describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { buildRelationshipLinesMapping, buildTopicHumanReading } from "@/lib/bazi/topic-knowledge";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

const BIRTH_INPUT = {
  birthDate: "1993-11-24",
  birthTime: "15:09",
  gender: "male",
  province: "Chiang Rai",
  calendarSystem: "solar",
  timezone: "Asia/Bangkok",
} as const;

describe("Real-world test case: 24 November 1993, 15:09, Chiang Rai, male", () => {
  test("computes the expected four pillars and weak day-master profile", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1993-11-24",
        birthTime: "15:09",
        gender: "male",
        province: "Chiang Rai",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    expect(result.fourPillars.year).toMatchObject({ stem: "癸", branch: "酉" });
    expect(result.fourPillars.month).toMatchObject({ stem: "癸", branch: "亥" });
    expect(result.fourPillars.day).toMatchObject({ stem: "己", branch: "酉" });
    expect(result.fourPillars.hour).toMatchObject({ stem: "壬", branch: "申" });
    expect(result.dayMaster).toBe("己");
    expect(result.strengthScore).toBe(0.25);
    expect(result.dayMasterStrengthProfile).toMatchObject({
      strengthState: "อ่อนแอ",
      displayLabel: "ดิถีอ่อนเกินไป",
    });
  });

  test("freezes the active branch reactions and visible doctrine markers", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1993-11-24",
        birthTime: "15:09",
        gender: "male",
        province: "Chiang Rai",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    const reading = result.baseChartReading;
    expect(reading).toBeDefined();

    expect(reading!.branchInteractionBadges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schoolLabel: "ไห่",
          label: expect.stringContaining("申亥"),
          semanticKind: "branch-harm",
          doctrineKey: "interaction:branch-harm",
          status: "active",
        }),
        expect.objectContaining({
          schoolLabel: "เฮ้ง",
          label: expect.stringContaining("酉酉"),
          semanticKind: "branch-punishment-self",
          doctrineKey: "interaction:branch-punishment-self",
          tier: "tertiary",
        }),
        expect.objectContaining({
          schoolLabel: "ผั่ว",
          label: expect.stringContaining("壬申"),
          semanticKind: "intra-pillar-destruction",
          doctrineKey: "interaction:intra-pillar-destruction",
        }),
      ]),
    );

    const noblemanMarker = reading!.markerBadges.find((badge) => badge.doctrineKey === "marker:nobleman");
    const wenChangMarkers = reading!.markerBadges.filter((badge) => badge.doctrineKey === "marker:wenchang");
    expect(noblemanMarker).toBeDefined();
    expect(wenChangMarkers.length).toBeGreaterThanOrEqual(1);
  });

  // เทียบตาราง Da Yun (บทเสริม Relationship Lines) กับตำรา M.docx "โครงสร้างดวงชะตาพื้นฐาน"
  // ดิถี 己 อ่อนแอ → คู่ธาตุ/ส่งเสริม = ตัวช่วย, ถ่ายเท/ลาภ/อำนาจ = ตัวดูดพลัง
  test("relationship-lines (Da Yun) match M.docx role × 12-เชี่ยงแซ table", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);
    const rows = buildRelationshipLinesMapping(result);

    // ช่วงอายุ + เส้นขีด (บทบาทธาตุ → 12 เชี่ยงแซ) ตามตำรา ทุกช่อง 5 ปี
    const actual = rows.map((row) => `${row.ageRange} | ${row.relationLine}`);
    expect(actual).toEqual([
      "5-9 ปี | ลาภ (ดิถีพิฆาต) → หมกยก",
      "10-14 ปี | คู่ธาตุ → เอี้ยง",
      "15-19 ปี | ถ่ายเท → เจ๊าะ",
      "20-24 ปี | ถ่ายเท → เชี่ยงแซ",
      "25-29 ปี | ถ่ายเท → ตี้อ๋วง",
      "30-34 ปี | ถ่ายเท → หมกยก",
      "35-39 ปี | คู่ธาตุ → เชี่ยงแซ",
      "40-44 ปี | คู่ธาตุ → กวงตั่ว",
      "45-49 ปี | คู่ธาตุ → ซี่",
      "50-54 ปี | ส่งเสริม → ลิ่มกัว",
      "55-59 ปี | ส่งเสริม → เชี่ยงแซ",
      "60-64 ปี | ส่งเสริม → ตี้อ๋วง",
      "65-69 ปี | ส่งเสริม → ซี่",
      "70-74 ปี | คู่ธาตุ → ซวย",
      // ตำราใส่ "เจ๊าะ(?)" ที่ราศีบน 乙 อย่างไม่มั่นใจ — engine คำนวณ ลิ่มกัว (己 ที่ 长生 ของ 乙 = 午)
      "75-79 ปี | อำนาจ (พิฆาตดิถี) → ลิ่มกัว",
      "80-84 ปี | อำนาจ (พิฆาตดิถี) → แป่",
      "85-89 ปี | อำนาจ (พิฆาตดิถี) → ทอ",
      "90-94 ปี | อำนาจ (พิฆาตดิถี) → ซี่",
    ]);

    const byAge = (age: string) => rows.find((row) => row.ageRange === age)!;

    // 45-49 (戊 คู่ธาตุ → ซี่): ตำรา = [จุดเฝ้าระวัง] ตัวช่วยหมดสภาพ → engine ต้องเตือน ไม่ใช่บวก
    expect(byAge("45-49 ปี").deepNote).toContain("[เฝ้าระวัง]");
    // 65-69 (丙 ส่งเสริม → ซี่): ตำรา = มีของดีแต่ส่งให้ดิถีไม่ไหว → เตือนเช่นกัน
    expect(byAge("65-69 ปี").deepNote).toContain("[เฝ้าระวัง]");
    // 50-54 (午 ส่งเสริม → ลิ่มกัว): ตำรา = ยุคทอง → ต้องเป็นบวก ไม่ใช่คำเตือน
    expect(byAge("50-54 ปี").deepNote).toContain("สนับสนุนเต็มที่");
    expect(byAge("50-54 ปี").deepNote).not.toContain("[เฝ้าระวัง]");
  });

  // บท3 โชคลาภ (M.docx): ดาวลาภ(น้ำ)แข็งแรง ล้อมรอบหลายตำแหน่ง + ดิถีอ่อนต้องโฟกัส
  test("wealth reading reflects strong water wealth star across pillars (M.docx)", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);
    const wealth = buildTopicHumanReading(result, "wealth_and_investment", RawInputSchema.parse(BIRTH_INPUT))!;
    expect(wealth).toContain("ดาวโชคลาภ (ธาตุน้ำ)"); // 己 → ลาภ = น้ำ (土克水)
    expect(wealth).toContain("หลักปี");
    expect(wealth).toContain("โฟกัส");
  });

  // ดิถี 己 อ่อนเกินไป (very-weak) → useful god = ไฟ (ส่งเสริม) ก่อน แล้วดิน (คู่ธาตุ)
  // ตำรา M.docx บท 11/14/15 ระบุไฟเป็นหลัก ห้ามตัดไฟทิ้งเหลือแต่ดิน
  test("knownlage useful-god readings lead with ธาตุไฟ then ดิน (M.docx)", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);

    const colors = buildTopicHumanReading(result, "colors_directions", RawInputSchema.parse(BIRTH_INPUT));
    expect(colors).toContain("ธาตุไฟ");
    expect(colors).toContain("ธาตุดิน");
    // ไฟต้องมาก่อนดิน (เป็น useful god หลัก)
    expect(colors!.indexOf("ธาตุไฟ")).toBeLessThan(colors!.indexOf("ธาตุดิน"));

    const deities = buildTopicHumanReading(result, "guardian_deities", RawInputSchema.parse(BIRTH_INPUT));
    expect(deities).toContain("ธาตุไฟ");
    expect(deities).toContain("เจ้าพ่อพระเพลิง");

    const education = buildTopicHumanReading(result, "education", RawInputSchema.parse(BIRTH_INPUT));
    expect(education).toContain("ไฟ");
  });

  // วัยเรียน (≤20 ปี): การงาน(ถ่ายเท)/โชคลาภ(ลาภ) ต้องตีความเป็น "การเรียน" (ตำรา M.docx)
  test("relationship-lines reframe career/wealth as study for ages under 20", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);
    const rows = buildRelationshipLinesMapping(result);
    const byAge = (age: string) => rows.find((row) => row.ageRange === age)!;

    // 5-9 (壬 ลาภ): โชคลาภวัยเด็ก = เรื่องการเรียน
    expect(byAge("5-9 ปี").deepNote).toContain("การเรียน");
    // 15-19 (辛 ถ่ายเท): ถ่ายเท = การเรียน
    expect(byAge("15-19 ปี").deepNote).toContain("การเรียน");
    // 20-24 (酉 ถ่ายเท): เกิน 20 ปีแล้ว → กลับเป็นบริบทการงาน ไม่ใช่ "การเรียนในวัยนี้"
    expect(byAge("20-24 ปี").deepNote).not.toContain("การเรียนในวัยนี้");
  });

  // หมกยก (沐浴) ที่เสายาม = บริวารที่ต้องคอยขัดเกลา (ตามที่ซินแซแก้ใน ai gen M.docx) ไม่ใช่ "มีคุณภาพ/ฐานมั่นคง"
  test("subordinate reading reads หมกยก at hour pillar as needing-management, not good", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);
    const subordinates = buildTopicHumanReading(result, "subordinates", RawInputSchema.parse(BIRTH_INPUT));
    expect(subordinates).toContain("ขัดเกลา");
    // เสายาม 申 หมกยก ต้องไม่ตีว่าบริวารมีคุณภาพ (ดาวถ่ายเทเสาวันไม่ถูกนับเป็นบริวาร)
    expect(subordinates).not.toContain("มีคุณภาพ");
  });

  // บท5 พรสวรรค์ = ดาวถ่ายเท (ทอง 酉/申) ไม่ใช่บุคลิกทั่วไป และต้องไม่ซ้ำกับบท1
  test("talent reading is output-star based and differs from personality (M.docx บท5)", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);
    const raw = RawInputSchema.parse(BIRTH_INPUT);
    const talent = buildTopicHumanReading(result, "talent", raw);
    const personality = buildTopicHumanReading(result, "chart_foundation", raw);
    expect(talent).toContain("ดาวถ่ายเท");
    expect(talent).toContain("申"); // เสายาม ถ่ายเท
    expect(talent).toContain("หมกยก"); // 申 = รับฟัง/วิเคราะห์
    expect(talent).not.toEqual(personality);
  });

  // บท7 ความรัก = ดิถีอ่อน + ดาวคู่ครอง(ลาภ/น้ำ)แรง → ดึงดูดคู่เก่งแต่ถูกกดดัน (M.docx บท7)
  test("love reading adds spouse-star dynamic for weak DM + strong wealth star", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);
    const love = buildTopicHumanReading(result, "love_partner", RawInputSchema.parse(BIRTH_INPUT));
    expect(love).toContain("ดาวคู่ครอง");
    expect(love).toContain("ธาตุน้ำ"); // ชาย → คู่ครอง = ดาวลาภ = น้ำ
    expect(love).toContain("จานคู่");
  });

  // บท13 สุขภาพ = ธาตุอ่อน + ธาตุล้นเกิน (น้ำเยอะ → อ้วน/บวมน้ำ) + วิธีแก้ (M.docx บท13)
  test("health reading includes excess-element dimension and remedy", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);
    const health = buildTopicHumanReading(result, "health", RawInputSchema.parse(BIRTH_INPUT));
    expect(health).toContain("ธาตุไฟอ่อนแอ");
    expect(health).toContain("น้ำมากเกินไป");
    expect(health).toContain("แนวทางดูแล");
  });
});
