// Hour Rectification v3 — run-reading use-case (#hour-rectification-engine, สอบจากคำทำนาย lane).
//
// Stateless แบบเดียวกับ run-step/run-events: client ถือ trail ทั้งหมด (birth data + daypart +
// คำตอบ) แล้วส่งกลับมาทั้งก้อนทุก step — server คำนวณดวง 12 ยาม + สร้างคำถามใหม่จาก scratch ทุก
// request (deterministic → คำถามชุดเดิมเสมอ) ไม่มี server session
//
// Flow ตามหลักอาจารย์:
//   1. ไม่ระบุ daypart → need_daypart (ถามช่วงกว้างของวันก่อน)
//   2. daypart = "unknown" → unknown_daypart (ไม่ไปต่อ — แนะนำโหมดสอบจากเหตุการณ์ v2 แทน)
//   3. ตอบคำถามจากคำทำนายทีละข้อ (ข้ามได้ทุกข้อ)
//   4. ครบทุกข้อ → shortlist 3-4 ยาม + เวลาโดยประมาณ (ข้ามหมดทุกข้อ → ผลระดับ daypart เท่านั้น)
import type { NewdataMap } from "@/lib/bazi/newdata-repository";
import { buildHourReadingFacts } from "./adapters/reading-facts-adapter";
import type { ChartProfileBaseInput } from "./adapters/chart-profile-adapter";
import {
  buildReadingQuestions,
  daypartHours,
  DAYPARTS,
  isDaypartId,
  scoreReadingAnswers,
  type ReadingAnswer,
  type ReadingQuestion,
  type ScoredHour,
} from "./domain/reading-diff";
import { buildTimeEstimate, yamWindow, type TimeEstimate } from "./domain/time-mapper";
import { HOUR_BRANCH_LABELS_TH, type HourBranch } from "./domain/types";

export type RunReadingInput = ChartProfileBaseInput & {
  daypart?: string; // DaypartId | "unknown" | undefined (ยังไม่ตอบ)
  answers: ReadingAnswer[];
};

export type ShortlistEntry = {
  hourBranch: HourBranch;
  hourLabel: string;
  score: number;
  window: { start: string; end: string; mid: string };
};

export type RunReadingResult =
  | { status: "need_daypart"; dayparts: { id: string; label: string }[] }
  | { status: "unknown_daypart"; message: string }
  | {
      status: "question";
      questionId: string;
      question: string;
      options: { id: string; label: string }[];
      questionNumber: number;
      totalQuestions: number;
    }
  | {
      status: "result";
      shortlist: ShortlistEntry[];
      timeEstimate: TimeEstimate | null;
      answeredCount: number;
      totalQuestions: number;
      daypartLabel: string;
      // ข้ามทุกข้อ → แม่นได้แค่ระดับช่วงของวัน (ซื่อสัตย์ ไม่มโนยาม)
      daypartOnly: boolean;
      confidence: "beta";
    };

function toShortlistEntry(scored: ScoredHour): ShortlistEntry {
  return {
    hourBranch: scored.hourBranch,
    hourLabel: HOUR_BRANCH_LABELS_TH[scored.hourBranch],
    score: scored.score,
    window: yamWindow(scored.hourBranch),
  };
}

// รับ loader แทน map ตรงๆ — สอง step แรก (need_daypart / unknown_daypart gate) ไม่ต้องแตะคลัง/DB เลย
export async function runRectificationByReading(
  input: RunReadingInput,
  loadMap: () => Promise<NewdataMap>,
): Promise<RunReadingResult> {
  const { daypart, answers, ...baseInput } = input;

  // 1) gate ช่วงกว้างของวัน
  if (!daypart) {
    return {
      status: "need_daypart",
      dayparts: DAYPARTS.map((d) => ({ id: d.id, label: d.label })),
    };
  }
  if (!isDaypartId(daypart)) {
    return {
      status: "unknown_daypart",
      message:
        "หากไม่ทราบแม้แต่ช่วงกว้างของวัน (เช้า/บ่าย/เย็น/ดึก) การสอบยามด้วยคำถามจะเสี่ยงคลาดเคลื่อนสูง " +
        "แนะนำให้สอบถามคนในครอบครัวก่อน หรือใช้โหมด 'สอบยามจากเหตุการณ์ชีวิต' แทน",
    };
  }

  const candidates = daypartHours(daypart);
  const map = await loadMap();
  const factSets = await buildHourReadingFacts(baseInput, map);
  const questions: ReadingQuestion[] = buildReadingQuestions(factSets, candidates);

  // 2) หา "คำถามแรกที่ยังไม่ตอบ" (ตอบตามลำดับ deterministic)
  const answeredIds = new Set(answers.map((a) => a.questionId));
  const nextQuestion = questions.find((q) => !answeredIds.has(q.id));
  if (nextQuestion) {
    const questionNumber = questions.findIndex((q) => q.id === nextQuestion.id) + 1;
    return {
      status: "question",
      questionId: nextQuestion.id,
      question: nextQuestion.question,
      options: nextQuestion.options.map((o) => ({ id: o.id, label: o.label })),
      questionNumber,
      totalQuestions: questions.length,
    };
  }

  // 3) ครบทุกข้อ (หรือไม่มีคำถามที่แยกยามได้เลย) → สรุปผล
  const { ranked, shortlist, answeredCount } = scoreReadingAnswers(questions, answers, candidates);
  const daypartOnly = answeredCount === 0;
  const daypartLabel = DAYPARTS.find((d) => d.id === daypart)?.label ?? daypart;
  const timeEstimate = daypartOnly ? null : buildTimeEstimate(ranked);

  return {
    status: "result",
    shortlist: shortlist.map(toShortlistEntry),
    timeEstimate,
    answeredCount,
    totalQuestions: questions.length,
    daypartLabel,
    daypartOnly,
    confidence: "beta",
  };
}
