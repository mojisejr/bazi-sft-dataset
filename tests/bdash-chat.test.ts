// bdash แชตถามอะไร (mumate-bdash-v2-001 slice 4) — the parts that need no database: topic card shape, previous range,
// question filter. The SQL itself runs against Postgres in tests/bdash-chat-pg.test.ts.
import { describe, expect, it } from "vitest";

import {
  CHAT_FROM,
  consentSubjects,
  parseQuestionFilter,
  previousRange,
  SEARCH_MAX,
  shapeQuestionCard,
  shapeTopicCard,
  topicTh,
  type TopicSqlRow,
} from "@/lib/bdash/chat";
import { subjectFor } from "@/lib/bazi/ai-question-log";
import { parseRange } from "@/lib/bdash/range";

const t = (topic: string, questions: number, people: number, paidQ: number, paidP: number): TopicSqlRow => ({
  topic,
  questions: String(questions),
  people: String(people),
  paid_questions: String(paidQ),
  paid_people: String(paidP),
});

describe("previousRange", () => {
  it("is the range of equal length just before, or null when it starts before chat recorded topics", () => {
    expect(previousRange({ from: "2026-11-01", to: "2026-11-07" })).toEqual({ from: "2026-10-25", to: "2026-10-31" });
    expect(previousRange({ from: "2026-10-22", to: "2026-10-28" })).toBeNull();
    expect(previousRange({ from: "2026-10-28", to: "2026-11-03" })).toEqual({ from: CHAT_FROM, to: "2026-10-27" });
  });
});

describe("shapeTopicCard", () => {
  const range = parseRange({ range: "7" }, "2026-11-07");
  const topics = [t("love_partner", 6, 4, 2, 1), t("off_topic", 2, 2, 0, 0), t("career_potential", 10, 5, 2, 1), t("chit_chat", 2, 1, 0, 0)];
  const totals = { questions: "20", people: "9", paid_people: "2" };
  const buckets = [
    { topic: "career_potential", bucket: "2026-11-01", questions: "4" },
    { topic: "career_potential", bucket: "2026-11-07", questions: "6" },
    { topic: "love_partner", bucket: "2026-11-03", questions: "6" },
    { topic: "off_topic", bucket: "2026-11-03", questions: "2" },
  ];
  const timeframes = [
    { timeframe: "today", questions: "4" },
    { timeframe: "tomorrow", questions: "2" },
    { timeframe: "this_year", questions: "8" },
    { timeframe: "weird", questions: "2" },
  ];

  it("sorts reading topics by questions and keeps off topic and chit-chat last", () => {
    const card = shapeTopicCard(range, topics, totals, buckets, timeframes, null);
    // equal counts fall back to the Thai label: คุยเล่น before นอกเรื่อง
    expect(card.rows.map((r) => r.topic)).toEqual(["career_potential", "love_partner", "chit_chat", "off_topic"]);
    expect(card.rows[0]).toMatchObject({ label: "งาน/อาชีพ", questions: 10, people: 5, paidQuestions: 2, freeQuestions: 8, previous: null });
    expect(card).toMatchObject({ questions: 20, people: 9, paidPeople: 2, paidQuestions: 4, asideShare: 0.2, compared: false, partial: false });
  });

  it("splits paying and free members as shares of each group's questions", () => {
    const card = shapeTopicCard(range, topics, totals, buckets, timeframes, null);
    const career = card.rows[0];
    expect(career.paidShare).toBeCloseTo(2 / 4);
    expect(career.freeShare).toBeCloseTo(8 / 16);
  });

  it("charts only reading topics, with zero on days without questions", () => {
    const card = shapeTopicCard(range, topics, totals, buckets, timeframes, null);
    expect(card.series.map((s) => s.topic)).toEqual(["career_potential", "love_partner"]);
    expect(card.series[0].values).toEqual([4, 0, 0, 0, 0, 0, 6]);
    expect(card.buckets[0]).toBe("2026-11-01");
  });

  it("groups timeframes and counts unknown values as no time given", () => {
    const card = shapeTopicCard(range, topics, totals, buckets, timeframes, null);
    expect(Object.fromEntries(card.timeframes.map((g) => [g.key, g.questions]))).toEqual({ near: 6, month: 0, year: 8, long: 0, none: 2 });
    expect(card.timeframes.find((g) => g.key === "near")?.share).toBeCloseTo(6 / 16);
  });

  it("compares with the previous range when there is one, a missing topic counting as zero", () => {
    const card = shapeTopicCard(range, topics, totals, buckets, timeframes, [t("career_potential", 7, 3, 0, 0)]);
    expect(card.compared).toBe(true);
    expect(card.rows.find((r) => r.topic === "career_potential")?.previous).toBe(7);
    expect(card.rows.find((r) => r.topic === "love_partner")?.previous).toBe(0);
  });

  it("marks a range that starts before recording began", () => {
    const early = parseRange({ range: "30" }, "2026-11-07");
    expect(shapeTopicCard(early, [], { questions: 0, people: 0, paid_people: 0 }, [], [], null)).toMatchObject({ partial: true, questions: 0, asideShare: null });
  });
});

describe("question card", () => {
  it("reads a known topic and a trimmed search from the link, and drops anything else", () => {
    expect(parseQuestionFilter({ topic: "health", q: "  งาน  " })).toEqual({ topic: "health", q: "งาน" });
    expect(parseQuestionFilter({ topic: "drop table", q: "" })).toEqual({ topic: null, q: null });
    expect(parseQuestionFilter({ topic: ["love_partner", "x"], q: "ก".repeat(200) }).q).toHaveLength(SEARCH_MAX);
  });

  it("computes subjects the same way the question log stores them, and never returns a member id", () => {
    const [s] = consentSubjects([{ anon_id: "U-1", since: "2026-10-23T00:00:00.000000Z" }]);
    expect(s).toEqual({ subject: subjectFor("U-1"), since: "2026-10-23T00:00:00.000000Z" });
    expect(JSON.stringify(s)).not.toContain("U-1");
  });

  it("shows question, topic label and time only", () => {
    const card = shapeQuestionCard(
      3,
      { questions: "120", people: "3" },
      [{ question: "ปีหน้างานจะดีไหม", topic_id: "career_potential", at: "2026-10-23 09:15" }],
      [{ topic: "career_potential", questions: "120" }],
      { topic: null, q: null },
    );
    expect(card).toMatchObject({ consenters: 3, questions: 120, people: 3, more: true });
    expect(card.rows[0]).toEqual({ question: "ปีหน้างานจะดีไหม", topic: "career_potential", label: "งาน/อาชีพ", at: "2026-10-23 09:15" });
    expect(topicTh(null)).toBe("ไม่ระบุ");
    expect(topicTh("new_topic")).toBe("new_topic");
  });
});
