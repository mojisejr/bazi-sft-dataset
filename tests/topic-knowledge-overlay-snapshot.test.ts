import { describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import {
  buildTopicConsumerReading,
  buildTopicHumanReading,
  getTopicKnownlageExcerpt,
} from "@/lib/bazi/topic-knowledge";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

/**
 * Safety net สำหรับ "เฟส 2: knowledge overlay" — ล็อกผล buildTopic* ของหลายดวง × ทุกบท
 * ก่อนเริ่ม thread overlay param เข้า builders. หลัง refactor (default = EMPTY_OVERLAY)
 * ผลต้องตรง snapshot เป๊ะ → พิสูจน์ว่า "ไม่แก้อะไรเมื่อไม่มี override"
 *
 * ถ้าตั้งใจเปลี่ยนพฤติกรรม ค่อยอัปเดต snapshot ด้วย `vitest -u` อย่างจงใจ
 */
const CHARTS = [
  { birthDate: "1966-09-29", birthTime: "11:44", gender: "female" as const },
  { birthDate: "1988-05-17", birthTime: "07:20", gender: "male" as const },
  { birthDate: "1993-11-24", birthTime: "15:09", gender: "male" as const },
];

const PREDICT_TOPICS = TOPIC_PATH.filter((topic) => topic.kind === "predict");

describe("topic-knowledge baseline snapshot (overlay safety net)", () => {
  for (const chart of CHARTS) {
    test(`${chart.birthDate} ${chart.birthTime} ${chart.gender}`, async () => {
      const repo = createTestKnowledgeRepository();
      const raw = RawInputSchema.parse({
        ...chart,
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      });
      const state = await calculateBaziChart(raw, repo);

      const out: Record<
        string,
        { human: string | null; consumer: string | null; excerpt: string[] | null }
      > = {};
      for (const topic of PREDICT_TOPICS) {
        out[topic.id] = {
          human: buildTopicHumanReading(state, topic.id, raw),
          consumer: buildTopicConsumerReading(state, topic.id, raw),
          excerpt: getTopicKnownlageExcerpt(state, topic.id, raw),
        };
      }
      expect(out).toMatchSnapshot();
    });
  }
});
