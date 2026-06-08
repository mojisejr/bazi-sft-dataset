import { describe, expect, test } from "vitest";

import { humanizeConsumerProse } from "@/lib/bazi/reading-phrases";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import {
  buildTopicConsumerReading,
  buildTopicHumanReading,
} from "@/lib/bazi/topic-knowledge";
import { TOPIC_PATH } from "@/lib/bazi/topic-reading";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

// consumer render = technical ที่ถอด scaffolding เทคนิคออก (deterministic, idempotent)
describe("humanizeConsumerProse (unit)", () => {
  test("ลบ qi% / arrow code-dump / Step / parenthetical เทคนิค", () => {
    const input = [
      "ดิถีประจำตัวคือ สายฝน (癸 ธาตุน้ำพลังหยิน) เกิดในฤดูร้อน",
      "• หลักยาม ราศีล่าง 午 → เจ๊าะ (~80%) ขยายด้วยเซียงแซ ตี้อ๋วง (~20%) / แอบซ่อน ไม่ชัดเจน: ลาภผันผวน ได้มาเสียไป",
      "อายุ 3-7 ปี (丙 — ลาภ (ดิถีพิฆาต) → หมกยก): การเรียนมีจังหวะขึ้นลง",
      "ระดับการศึกษา (Step 6.2): จบปริญญาตรี",
      "การภาคีราศีบน (天干合) 癸戊: มีแรงดึงดูด",
    ].join("\n");
    const out = humanizeConsumerProse(input);
    // ถอดออก
    expect(out).not.toContain("~80%");
    expect(out).not.toContain("~20%");
    expect(out).not.toContain("→");
    expect(out).not.toContain("Step 6.2");
    expect(out).not.toContain("天干合");
    expect(out).not.toContain("เซียงแซ");
    // คง identity + เนื้อความ
    expect(out).toContain("(癸 ธาตุน้ำพลังหยิน)");
    expect(out).toContain("ลาภผันผวน ได้มาเสียไป");
    expect(out).toContain("การเรียนมีจังหวะขึ้นลง");
    expect(out).toContain("จบปริญญาตรี");
    // วงเล็บสมดุล
    expect((out.match(/\(/g) || []).length).toBe((out.match(/\)/g) || []).length);
  });

  test("idempotent — รันซ้ำผลเท่าเดิม", () => {
    const input = "อายุ 3-7 ปี (丙 — ลาภ (ดิถีพิฆาต) → หมกยก): x (~80%) / y: z";
    const once = humanizeConsumerProse(input);
    expect(humanizeConsumerProse(once)).toBe(once);
  });
});

describe("buildTopicConsumerReading (integration)", () => {
  const CASES = [
    { d: "2001-07-29", t: "12:00", g: "female" as const }, // 癸 / น้ำ
    { d: "1988-06-08", t: "12:08", g: "female" as const }, // 甲 / ไม้
  ];

  test.each(CASES)("$d ทุกบทสะอาด ไม่มี scaffolding และคง 'สรุป:'", async (c) => {
    const repository = createTestKnowledgeRepository();
    const raw = RawInputSchema.parse({
      birthDate: c.d, birthTime: c.t, gender: c.g,
      province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
    });
    const state = await calculateBaziChart(raw, repository);

    for (const topic of TOPIC_PATH.filter((x) => x.kind === "predict")) {
      const technical = buildTopicHumanReading(state, topic.id, raw);
      const consumer = buildTopicConsumerReading(state, topic.id, raw);
      if (technical == null) {
        expect(consumer).toBeNull();
        continue;
      }
      expect(consumer).toBeTruthy();
      // ไม่มี scaffolding เทคนิคหลงเหลือ
      expect(consumer!).not.toContain("→");
      expect(consumer!).not.toMatch(/~\d/);
      expect(consumer!).not.toContain("Step 6.2");
      // คงโครงสร้างคำทำนาย
      expect(consumer!).toContain("สรุป:");
      // วงเล็บสมดุล (ไม่มีเศษค้างจากการ strip)
      expect((consumer!.match(/\(/g) || []).length).toBe(
        (consumer!.match(/\)/g) || []).length,
      );
      // deterministic
      expect(buildTopicConsumerReading(state, topic.id, raw)).toBe(consumer);
    }
  });
});
