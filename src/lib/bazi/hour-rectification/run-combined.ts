// Hour Rectification — run-combined use-case (#hour-rectification-engine, unified lane).
//
// ตามซินแส: "ต้องเป็นคำถามที่ต่อเนื่องกัน ไม่ใช่แยกถาม" — flow เดียวถามครบทุกชั้นแล้วรวมคะแนน:
//   1. ช่วงกว้างของวัน (เช้า/บ่าย/เย็น/ดึก) → จำกัด candidate เหลือ 3 ยาม
//      · "ไม่ทราบเลย" ไปต่อได้ก็ต่อเมื่อมีเหตุการณ์ ≥2 (สัญญาณจากวันที่จริงชดเชยได้) ไม่งั้น gate
//   2. เหตุการณ์ชีวิตพร้อมปี 0-4 อย่าง (มี = คะแนนกฎ v2 มารวม, ไม่มี = ข้ามชั้นนี้)
//   3. คำถามจากคำทำนายจริงของดวง 12 ยาม (v3) เฉพาะข้อที่แยก candidate ได้
//   คะแนนรวมต่อยาม = คะแนนคำทำนาย (v3) + คะแนนกฎเหตุการณ์ (v2) → จัดอันดับ + shortlist ซื่อสัตย์
//
// Stateless เหมือนทุก lane: client ถือ trail (daypart + events + answers) ส่งทั้งก้อนทุก step
import type { NewdataMap } from "@/lib/bazi/newdata-repository";
import {
  extractHourBoxFacts,
  extractHourReadingFacts,
} from "./adapters/reading-facts-adapter";
import { buildHourChartFacts } from "./adapters/timeline-adapter";
import {
  buildHourChartProfiles,
  type ChartProfileBaseInput,
} from "./adapters/chart-profile-adapter";
import type { LifeEvent } from "./domain/events";
import type { RuleContext } from "./domain/rules";
import { ruleScorer, type RankedYam } from "./domain/scorer";
import {
  buildReadingQuestions,
  daypartHours,
  DAYPARTS,
  isDaypartId,
  scoreReadingAnswers,
  type ReadingAnswer,
  type ScorableQuestion,
} from "./domain/reading-diff";
import {
  buildDetailedQuestions,
  questionPartitionSignature,
} from "./domain/reading-diff-detailed";
import { buildTimeEstimate, yamWindow, type TimeEstimate } from "./domain/time-mapper";
import { HOUR_BRANCHES, HOUR_BRANCH_LABELS_TH, type HourBranch } from "./domain/types";

export const MIN_EVENTS_WHEN_DAYPART_UNKNOWN = 2;
// เพดานจำนวนคำถามรวม (curated + ชั้นละเอียด) — กัน quiz ยาวจนผู้ตอบล้า
export const MAX_TOTAL_QUESTIONS = 8;

export type RunCombinedInput = ChartProfileBaseInput & {
  daypart: string; // DaypartId | "unknown"
  events: LifeEvent[]; // 0-4 (ว่าง = ผู้ตอบไม่มี/จำปีไม่ได้)
  answers: ReadingAnswer[];
};

export type CombinedHourScore = {
  hourBranch: HourBranch;
  hourLabel: string;
  total: number;
  readingScore: number;
  eventsScore: number;
  window: { start: string; end: string; mid: string };
};

export type RunCombinedResult =
  | { status: "need_more_signal"; message: string }
  | {
      status: "question";
      questionId: string;
      question: string;
      // hours = ยามที่ตัวเลือกนั้นชี้ (expert/debug view — UI ทั่วไปไม่ต้องโชว์)
      options: { id: string; label: string; hours: string[] }[];
      questionNumber: number;
      totalQuestions: number;
    }
  | {
      status: "result";
      shortlist: CombinedHourScore[];
      timeEstimate: TimeEstimate | null;
      answeredCount: number;
      totalQuestions: number;
      eventsUsed: number;
      daypartLabel: string;
      // ไม่มีสัญญาณรายยามเลย (ข้ามทุกคำถาม + ไม่มีเหตุการณ์) → บอกได้แค่ระดับช่วงของวัน
      daypartOnly: boolean;
      confidence: "beta";
    };

const SHORTLIST_MIN = 3;
const SHORTLIST_MAX = 4;

/** รวมคะแนน v3 (reading) + v2 (events) ต่อยาม → เรียงมาก→น้อย (pure, testable) */
export function combineHourScores(
  candidates: readonly HourBranch[],
  readingScores: ReadonlyMap<HourBranch, number>,
  eventsScores: ReadonlyMap<HourBranch, number>,
): CombinedHourScore[] {
  const branchOrder = new Map<HourBranch, number>(HOUR_BRANCHES.map((b, i) => [b, i]));
  return candidates
    .map((hourBranch) => {
      const readingScore = readingScores.get(hourBranch) ?? 0;
      const eventsScore = eventsScores.get(hourBranch) ?? 0;
      return {
        hourBranch,
        hourLabel: HOUR_BRANCH_LABELS_TH[hourBranch],
        total: readingScore + eventsScore,
        readingScore,
        eventsScore,
        window: yamWindow(hourBranch),
      };
    })
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return (branchOrder.get(a.hourBranch) ?? 0) - (branchOrder.get(b.hourBranch) ?? 0);
    });
}

/** shortlist 3-4 ยามแบบเดียวกับ v3: ไล่ทีละชั้นคะแนนจนถึงอย่างน้อย 3 ไม่เกิน 4 */
export function shortlistCombined(ranked: readonly CombinedHourScore[]): CombinedHourScore[] {
  const shortlist: CombinedHourScore[] = [];
  const tiers = [...new Set(ranked.map((r) => r.total))];
  for (const tier of tiers) {
    const tierHours = ranked.filter((r) => r.total === tier);
    if (shortlist.length >= SHORTLIST_MIN) break;
    if (shortlist.length + tierHours.length > SHORTLIST_MAX && shortlist.length > 0) break;
    shortlist.push(...tierHours.slice(0, SHORTLIST_MAX - shortlist.length));
  }
  return shortlist;
}

export async function runRectificationCombined(
  input: RunCombinedInput,
  loadMap: () => Promise<NewdataMap>,
): Promise<RunCombinedResult> {
  const { daypart, events, answers, ...baseInput } = input;

  // ── gate: ไม่รู้ช่วงของวัน + ไม่มีเหตุการณ์พอ → ไม่ไปต่อ (ตามหลักอาจารย์ ไม่มโน) ──
  const daypartKnown = isDaypartId(daypart);
  if (!daypartKnown && events.length < MIN_EVENTS_WHEN_DAYPART_UNKNOWN) {
    return {
      status: "need_more_signal",
      message:
        "ไม่ทราบช่วงของวันเลย ต้องมีเหตุการณ์ชีวิตพร้อมปีอย่างน้อย " +
        `${MIN_EVENTS_WHEN_DAYPART_UNKNOWN} อย่างจึงจะสอบยามได้ — ` +
        "ลองถามคนในครอบครัวเรื่องช่วงเวลาเกิด หรือย้อนกลับไปเพิ่มเหตุการณ์",
    };
  }

  const candidates = daypartKnown ? daypartHours(daypart) : HOUR_BRANCHES;

  // ── ชั้นคำถามจากคำทำนาย — curated 3 มิติ + ชั้นละเอียดจากอ่านดวงเต็ม 15 บท ──
  // คำนวณดวง 12 ยามรอบเดียว ใช้ร่วมทั้งสองชั้น
  const map = await loadMap();
  const profiles = await buildHourChartProfiles(baseInput);
  const curatedFacts = extractHourReadingFacts(profiles, baseInput, map);
  const curated = buildReadingQuestions(curatedFacts, candidates);

  // ชั้นละเอียด: จำลองอ่านดวงเต็ม (pipeline /reading/newdata-reading) → diff กล่องข้ามยาม
  // กันถามซ้ำเชิงข้อมูลด้วย partition ของคำถาม curated แล้ว cap จำนวนข้อรวม
  const boxFacts = extractHourBoxFacts(profiles, baseInput, map);
  const detailed = buildDetailedQuestions(boxFacts, candidates, {
    maxQuestions: Math.max(0, MAX_TOTAL_QUESTIONS - curated.length),
    seenSignatures: new Set(curated.map(questionPartitionSignature)),
  });

  const questions: ScorableQuestion[] = [...curated, ...detailed];

  const answeredIds = new Set(answers.map((a) => a.questionId));
  const nextQuestion = questions.find((q) => !answeredIds.has(q.id));
  if (nextQuestion) {
    return {
      status: "question",
      questionId: nextQuestion.id,
      question: nextQuestion.question,
      options: nextQuestion.options.map((o) => ({ id: o.id, label: o.label, hours: [...o.hours] })),
      questionNumber: questions.findIndex((q) => q.id === nextQuestion.id) + 1,
      totalQuestions: questions.length,
    };
  }

  // ── รวมคะแนน ──
  const reading = scoreReadingAnswers(questions, answers, candidates);
  const readingScores = new Map(reading.ranked.map((r) => [r.hourBranch, r.score]));

  let eventsScores = new Map<HourBranch, number>();
  if (events.length > 0) {
    const { facts12, birthYear } = await buildHourChartFacts(baseInput);
    const ctx: RuleContext = { gender: baseInput.gender };
    const rankedYams: RankedYam[] = ruleScorer.score(facts12, events, ctx, birthYear);
    eventsScores = new Map(
      rankedYams
        .filter((r) => candidates.includes(r.hourBranch))
        .map((r) => [r.hourBranch, r.score]),
    );
  }

  const ranked = combineHourScores(candidates, readingScores, eventsScores);
  const daypartOnly = reading.answeredCount === 0 && events.length === 0;
  const daypartLabel = daypartKnown
    ? (DAYPARTS.find((d) => d.id === daypart)?.label ?? daypart)
    : "ไม่ทราบช่วง";
  const timeEstimate = daypartOnly
    ? null
    : buildTimeEstimate(ranked.map((r) => ({ hourBranch: r.hourBranch, score: r.total })));

  return {
    status: "result",
    shortlist: shortlistCombined(ranked),
    timeEstimate,
    answeredCount: reading.answeredCount,
    totalQuestions: questions.length,
    eventsUsed: events.length,
    daypartLabel,
    daypartOnly,
    confidence: "beta",
  };
}
