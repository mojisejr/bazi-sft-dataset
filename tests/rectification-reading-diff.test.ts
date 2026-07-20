// Hour Rectification v3 — domain/reading-diff (#hour-rectification-engine, สอบจากคำทำนาย lane).
// Pure-logic tests: จับกลุ่มคำทำนาย→คำถาม, filter 18+/soften สอเสียด, สรุปข้อความ, ให้คะแนน+shortlist,
// dayparts ครอบ 12 ยามพอดี — ไม่มี engine/DB/LLM
import { describe, expect, test } from "vitest";

import {
  buildReadingQuestions,
  DAYPARTS,
  daypartHours,
  DIMENSION_SKIP_LABEL_TH,
  isBlockedText,
  isDaypartId,
  scoreReadingAnswers,
  SKIP_OPTION_ID,
  softenText,
  summarizeReadingText,
  type HourReadingFacts,
} from "@/lib/bazi/hour-rectification/domain/reading-diff";
import { HOUR_BRANCHES, type HourBranch } from "@/lib/bazi/hour-rectification/domain/types";

function facts(
  hourBranch: HourBranch,
  texts: Partial<HourReadingFacts["texts"]>,
): HourReadingFacts {
  return {
    hourBranch,
    texts: { subordinate: null, hour_palace: null, subconscious: null, ...texts },
  };
}

describe("DAYPARTS — ช่วงกว้างของวัน", () => {
  test("4 ช่วง × 3 ยาม ครอบ 12 ยามพอดี ไม่ซ้ำ", () => {
    const all = DAYPARTS.flatMap((d) => d.hours);
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(12);
    expect([...all].sort()).toEqual([...HOUR_BRANCHES].sort());
  });

  test('isDaypartId: id จริง = true, "unknown"/มั่ว = false', () => {
    expect(isDaypartId("morning")).toBe(true);
    expect(isDaypartId("unknown")).toBe(false);
    expect(isDaypartId("banana")).toBe(false);
  });

  test("daypartHours: เช้า 05-11 = 卯辰巳", () => {
    expect(daypartHours("morning")).toEqual(["卯", "辰", "巳"]);
  });
});

describe("content filter — เลี่ยง 18+ / soften สอเสียด (คำสั่ง user + อาจารย์)", () => {
  test("ข้อความแตะเรื่องเตียง/เพศ = blocked", () => {
    expect(isBlockedText("ลีลาบนเตียงเร่าร้อน")).toBe(true);
    expect(isBlockedText("มีเสน่ห์เรื่องเพศสัมพันธ์")).toBe(true);
    expect(isBlockedText("บริวารซื่อสัตย์ ขยันขันแข็ง")).toBe(false);
  });

  test("softenText: คำแรง (เนรคุณ/โง่) ถูกแทนด้วยคำกลางๆ", () => {
    const softened = softenText("บริวารเนรคุณ และโง่เขลา");
    expect(softened).not.toContain("เนรคุณ");
    expect(softened).not.toContain("โง่");
    expect(softened).toContain("ไม่ค่อยสำนึกบุญคุณ");
  });
});

describe("summarizeReadingText", () => {
  test("ตัด markdown และจำกัดความยาว ≤161 ตัวอักษร (160 + …)", () => {
    const long = `**หัวข้อ** ${"ก".repeat(300)}`;
    const summary = summarizeReadingText(long);
    expect(summary.length).toBeLessThanOrEqual(161);
    expect(summary.endsWith("…")).toBe(true);
    expect(summary).not.toContain("**");
  });
});

const MORNING: HourBranch[] = ["卯", "辰", "巳"];

describe("buildReadingQuestions — คำถามเกิดเฉพาะมิติที่แยกยามได้", () => {
  test("2 กลุ่มข้อความ → 1 คำถาม 2 ตัวเลือก + ตัวเลือกข้ามต่อท้ายเสมอ", () => {
    const sets = [
      facts("卯", { subordinate: "บริวารขยันขันแข็ง ซื่อตรง" }),
      facts("辰", { subordinate: "บริวารขยันขันแข็ง ซื่อตรง" }),
      facts("巳", { subordinate: "บริวารเจ้าความคิด ชอบอิสระ" }),
    ];
    const questions = buildReadingQuestions(sets, MORNING);
    expect(questions).toHaveLength(1);
    const q = questions[0];
    expect(q.dimension).toBe("subordinate");
    expect(q.options).toHaveLength(3); // 2 กลุ่ม + skip
    expect(q.options[0].hours).toEqual(["卯", "辰"]);
    expect(q.options[1].hours).toEqual(["巳"]);
    const skip = q.options.at(-1)!;
    expect(skip.id).toBe(SKIP_OPTION_ID);
    expect(skip.label).toBe(DIMENSION_SKIP_LABEL_TH.subordinate);
    expect(skip.hours).toEqual([]);
  });

  test("ข้อความเหมือนกันทุกยาม → ไม่เกิดคำถาม (แยกไม่ได้ = noise)", () => {
    const sets = MORNING.map((h) => facts(h, { subordinate: "เหมือนกันหมด" }));
    expect(buildReadingQuestions(sets, MORNING)).toHaveLength(0);
  });

  test("คลังว่าง (null ทุกมิติ) → ไม่มีคำถาม", () => {
    const sets = MORNING.map((h) => facts(h, {}));
    expect(buildReadingQuestions(sets, MORNING)).toHaveLength(0);
  });

  test("ข้อความ 18+ ถูกตัดทั้งก้อน — เหลือกลุ่มเดียว → ไม่เกิดคำถาม", () => {
    const sets = [
      facts("卯", { subordinate: "ลีลาบนเตียงดุเดือด" }),
      facts("辰", { subordinate: "บริวารซื่อตรง" }),
      facts("巳", { subordinate: "บริวารซื่อตรง" }),
    ];
    expect(buildReadingQuestions(sets, MORNING)).toHaveLength(0);
  });

  test("ยามนอก candidate ไม่ถูกนับ (จำกัดตาม daypart)", () => {
    const sets = [
      facts("卯", { subconscious: "คิดวางแผนอนาคต" }),
      facts("辰", { subconscious: "คิดเรื่องคนรอบตัว" }),
      facts("午", { subconscious: "คิดเรื่องงานล้วนๆ" }), // นอกช่วงเช้า
    ];
    const questions = buildReadingQuestions(sets, MORNING);
    expect(questions).toHaveLength(1);
    const hours = questions[0].options.flatMap((o) => o.hours);
    expect(hours).not.toContain("午");
  });

  test("ถ้อยคำสอเสียดใน option label ถูก soften แล้ว", () => {
    const sets = [
      facts("卯", { subordinate: "บริวารเนรคุณ เอาแต่ใจ" }),
      facts("辰", { subordinate: "บริวารซื่อตรง น่ารัก" }),
      facts("巳", { subordinate: "บริวารซื่อตรง น่ารัก" }),
    ];
    const [q] = buildReadingQuestions(sets, MORNING);
    expect(q.options.some((o) => o.label.includes("เนรคุณ"))).toBe(false);
    expect(q.options.some((o) => o.label.includes("ไม่ค่อยสำนึกบุญคุณ"))).toBe(true);
  });
});

describe("scoreReadingAnswers — คะแนน + shortlist 3-4 ยาม", () => {
  const sets = [
    facts("卯", { subordinate: "แบบ ก", subconscious: "คิด ก" }),
    facts("辰", { subordinate: "แบบ ก", subconscious: "คิด ข" }),
    facts("巳", { subordinate: "แบบ ข", subconscious: "คิด ข" }),
  ];
  const questions = buildReadingQuestions(sets, MORNING);

  test("ตอบชี้กลุ่ม → ยามในกลุ่มได้ weight ของคำถาม · เรียงคะแนนถูก", () => {
    // subordinate "แบบ ก" (卯辰 +3) + subconscious "คิด ก" (卯 +2) → 卯 นำ
    const subQ = questions.find((q) => q.dimension === "subordinate")!;
    const midQ = questions.find((q) => q.dimension === "subconscious")!;
    const { ranked, shortlist, answeredCount } = scoreReadingAnswers(
      questions,
      [
        { questionId: subQ.id, optionId: subQ.options[0].id },
        { questionId: midQ.id, optionId: midQ.options[0].id },
      ],
      MORNING,
    );
    expect(answeredCount).toBe(2);
    expect(ranked[0]).toEqual({ hourBranch: "卯", score: 5 });
    expect(ranked[1]).toEqual({ hourBranch: "辰", score: 3 });
    expect(ranked[2]).toEqual({ hourBranch: "巳", score: 0 });
    // candidate แค่ 3 → shortlist ครบ 3 (อาจารย์: เหลือ 3-4 ยาม = ยอมรับได้)
    expect(shortlist).toHaveLength(3);
  });

  test("ข้ามทุกข้อ → answeredCount 0, ทุกยาม 0 คะแนน", () => {
    const { ranked, answeredCount } = scoreReadingAnswers(
      questions,
      questions.map((q) => ({ questionId: q.id, optionId: SKIP_OPTION_ID })),
      MORNING,
    );
    expect(answeredCount).toBe(0);
    expect(ranked.every((r) => r.score === 0)).toBe(true);
  });

  test("shortlist ไม่เกิน 4 แม้ candidate 12 ยามคะแนนเท่ากันหมด", () => {
    const { shortlist } = scoreReadingAnswers([], [], HOUR_BRANCHES);
    expect(shortlist.length).toBeLessThanOrEqual(4);
    expect(shortlist.length).toBeGreaterThanOrEqual(3);
  });

  test("optionId/questionId มั่ว → ถูกเมิน ไม่พังไม่ให้คะแนน", () => {
    const { ranked, answeredCount } = scoreReadingAnswers(
      questions,
      [{ questionId: "nonsense", optionId: "x" }],
      MORNING,
    );
    expect(answeredCount).toBe(0);
    expect(ranked.every((r) => r.score === 0)).toBe(true);
  });
});
