import { describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { buildTopicHumanReading } from "@/lib/bazi/topic-knowledge";
import { CHAPTER_INTRO_TH } from "@/lib/bazi/reading-phrases";
import { TOPIC_PATH } from "@/lib/bazi/topic-reading";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

// ทุกบท predict ต้องเป็นร้อยแก้วเรียบเรียง: intro (คอนเซ็ปต์) + เนื้อหา + advice (≥3 ย่อหน้า)
describe("reading narrative composer (15 chapters)", () => {
  const CASES = [
    { d: "2002-12-02", t: "11:30", g: "female" as const },
    { d: "1949-06-25", t: "12:00", g: "female" as const },
    { d: "1993-11-24", t: "15:09", g: "male" as const },
  ];

  test.each(CASES)("$d every chapter has intro + body + advice", async (c) => {
    const repository = createTestKnowledgeRepository();
    const raw = RawInputSchema.parse({
      birthDate: c.d, birthTime: c.t, gender: c.g,
      province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
    });
    const state = await calculateBaziChart(raw, repository);

    // ทุกบทเปิดด้วยส่วน "## บทนำ" (คอนเซ็ปต์บท + พาดหัวดิถี YLC) ตามด้วยกล่องหัวข้อย่อยตาม docx
    // และปิดท้ายด้วยส่วน "## สรุป" — โครงบทนำ/สรุปเป็นส่วนมีสไตล์ทุกบท
    for (const topic of TOPIC_PATH.filter((x) => x.kind === "predict")) {
      const reading = buildTopicHumanReading(state, topic.id, raw);
      expect(reading, `${topic.id} ควรมีคำทำนาย`).toBeTruthy();
      // อย่างน้อย 3 ย่อหน้า (บทนำ + เนื้อหา + สรุป)
      expect(reading!.split("\n\n").length).toBeGreaterThanOrEqual(3);
      // เริ่มด้วยหัวข้อ "## บทนำ" และมีคอนเซ็ปต์บท (CHAPTER_INTRO_TH) + ปิดด้วย "## สรุป"
      expect(reading!.startsWith("## บทนำ"), `${topic.id} ต้องเริ่มด้วยส่วนบทนำ`).toBe(true);
      expect(reading!).toContain(CHAPTER_INTRO_TH[topic.id]);
      expect(reading!.includes("## สรุป"), `${topic.id} ต้องมีส่วนสรุป`).toBe(true);
    }
  });
});
