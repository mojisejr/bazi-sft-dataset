// Chat-zone grounding bridge (Path A): ground chat answers on the SAME reading engines the
// product UI uses, by calling existing reading routes internally. Zero engine-zone edits —
// only read-only constants/types are imported; engine files are never mutated.
//
// Phase 2 — DUAL SEAM:
//   • Natal chapters (นิสัย/การเงิน/ความรัก/สี/ฯลฯ, asked with no time or same-day framing)
//       → /api/reading/newdata-reading  (DB "newdata" 15 chapters — natal-strong, friend's preferred source)
//   • Time / period questions (ปีนี้/ปีหน้า/อีก N ปี/ช่วงวัย, or the turning_points chapter itself)
//       → /api/reading/topic?topicId=turning_points  (topic-knowledge time engine: liuNian forecast + ปีชง + วัยจร)
//
// Each seam degrades gracefully: an empty newdata chapter falls back to the deterministic topic
// reading; an empty time reading falls back too; total failure returns null so the caller uses the
// truth-packet. The seam choice keeps natal answers rich AND keeps period answers honest.
import { type OpenWebUiIntentClassification } from "@/features/open-webui/triage";
import { type CalculatedStateValue, type RawInputValue } from "@/lib/bazi/schema-types";
import { type TriageTimeframe } from "@/features/open-webui/triage";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { getGeminiApiKey } from "@/lib/env";

type Intent = OpenWebUiIntentClassification["intent"];

// Map each coarse intent to the canonical reading topic that answers it (engine 15-topic path).
// chit_chat intentionally has no topic (no consult).
export const INTENT_TO_TOPIC: Partial<Record<Intent, string>> = {
  wealth: "wealth_and_investment",
  love: "love_partner",
  career: "career_potential",
  health: "health",
  general_reading: "chart_foundation",
};

// The canonical time/period chapter — its topic-knowledge reading carries the liuNian annual
// forecast, ปีชง detection, and วัยจร (da-yun) verdicts.
export const TIME_TOPIC_ID = "turning_points";

// Timeframes coarser-or-equal to a year that the engine can actually interpret as period luck.
// (today/tomorrow are same-day → engine has no 流日; those stay on the natal seam and Phase 3
// reframes them honestly to disposition + current period.)
const PERIOD_TIMEFRAMES: ReadonlySet<TriageTimeframe> = new Set<TriageTimeframe>([
  "this_month",
  "this_year",
  "next_year",
  "in_n_years",
  "period",
]);

const VALID_TOPIC_IDS: ReadonlySet<string> = new Set(TOPIC_PATH.map((topic) => topic.id));

export function isValidTopicId(id: string | null | undefined): id is string {
  return typeof id === "string" && VALID_TOPIC_IDS.has(id);
}

// Prefer an explicit (frontend chip) topic hint; otherwise derive from the routed intent.
export function resolveTopicId(intent: Intent, topicHint?: string | null): string | null {
  if (isValidTopicId(topicHint)) {
    return topicHint;
  }
  return INTENT_TO_TOPIC[intent] ?? null;
}

// Phase 1 routing: the triage already produced a precise reading topicId (one of the 15 chapters,
// or off_topic/chit_chat). Prefer an explicit chip hint, then the routed topic; off_topic/chit_chat
// (and any non-reading value) resolve to null so no consult is attempted.
export function resolveGroundingTopicId(
  routedTopicId: string | null | undefined,
  topicHint?: string | null,
): string | null {
  if (isValidTopicId(topicHint)) {
    return topicHint;
  }
  if (isValidTopicId(routedTopicId)) {
    return routedTopicId;
  }
  return null;
}

export type GroundingSeam = "newdata" | "time";

export type GroundingPlan = {
  seam: GroundingSeam;
  /** The topic whose reading we fetch. For the time seam this is always TIME_TOPIC_ID. */
  topicId: string;
  /** The topic the user actually asked about (preserved for downstream prompt context). */
  requestedTopicId: string;
};

// Decide which seam answers this (topic, timeframe) pair. Returns null for non-reading topics.
export function resolveGroundingPlan(
  topicId: string | null | undefined,
  timeframe?: TriageTimeframe | null,
): GroundingPlan | null {
  if (!isValidTopicId(topicId)) {
    return null;
  }

  const isTimeQuestion = topicId === TIME_TOPIC_ID
    || (timeframe != null && PERIOD_TIMEFRAMES.has(timeframe));

  if (isTimeQuestion) {
    return { seam: "time", topicId: TIME_TOPIC_ID, requestedTopicId: topicId };
  }

  return { seam: "newdata", topicId, requestedTopicId: topicId };
}

type GroundArgs = {
  topicId: string;
  timeframe?: TriageTimeframe | null;
  rawInput: RawInputValue;
  calculatedState?: CalculatedStateValue | null;
};

type NewdataChapter = {
  id?: unknown;
  title?: unknown;
  hasContent?: unknown;
  boxes?: unknown;
};

function renderNewdataChapter(chapter: NewdataChapter): string {
  const boxes = Array.isArray(chapter.boxes) ? chapter.boxes : [];
  const lines: string[] = [];
  const title = typeof chapter.title === "string" ? chapter.title.trim() : "";

  if (title) {
    lines.push(title);
  }

  for (const box of boxes) {
    if (!box || typeof box !== "object") {
      continue;
    }
    const boxTitle = typeof (box as { title?: unknown }).title === "string"
      ? (box as { title: string }).title.trim()
      : "";
    const boxBody = typeof (box as { body?: unknown }).body === "string"
      ? (box as { body: string }).body.trim()
      : "";
    if (!boxBody) {
      continue;
    }
    lines.push(boxTitle ? `- ${boxTitle}: ${boxBody}` : `- ${boxBody}`);
  }

  // Need at least one real content box (the title alone is not grounding).
  return lines.length > 1 ? lines.join("\n") : "";
}

// Natal seam: pull the chapter from the newdata 15-chapter reading. Returns rendered prose, or
// "" when the chapter has no real content (caller then degrades to the topic seam).
async function fetchNewdataChapterReading(
  origin: string,
  { topicId, rawInput }: { topicId: string; rawInput: RawInputValue },
): Promise<string> {
  try {
    const res = await fetch(`${origin}/api/reading/newdata-reading`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rawInput),
    });
    if (!res.ok) {
      return "";
    }
    const json = (await res.json()) as { chapters?: unknown };
    const chapters = Array.isArray(json.chapters) ? (json.chapters as NewdataChapter[]) : [];
    const chapter = chapters.find((entry) => entry?.id === topicId);
    if (!chapter) {
      return "";
    }
    return renderNewdataChapter(chapter);
  } catch {
    return "";
  }
}

// Topic seam: the existing /api/reading/topic ladder (llm ซินแส voice -> consumer deterministic).
async function fetchTopicReading(
  origin: string,
  { topicId, rawInput, calculatedState }: GroundArgs,
): Promise<string | null> {
  let apiKey: string | undefined;
  try {
    apiKey = getGeminiApiKey();
  } catch {
    apiKey = undefined;
  }

  const attempts: Array<Record<string, unknown>> = [];
  // llm mode requires apiKey + rawInput; gives the tuned ซินแสฟันธง voice that matches the PDF.
  if (apiKey) {
    attempts.push({ topicId, mode: "llm", rawInput, calculatedState, apiKey });
  }
  // consumer mode is deterministic (no LLM) — cheaper fallback that still carries doctrine + substitution.
  attempts.push({ topicId, mode: "consumer", rawInput, calculatedState });

  for (const body of attempts) {
    try {
      const res = await fetch(`${origin}/api/reading/topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        continue;
      }
      const json = (await res.json()) as { humanReading?: unknown };
      const text = typeof json.humanReading === "string" ? json.humanReading.trim() : "";
      if (text) {
        return text;
      }
    } catch {
      // network/parse failure — try the next mode, then ultimately null
    }
  }

  return null;
}

// Dual-seam grounded reading. Picks newdata (natal) vs turning_points (time) per the plan, with
// graceful degradation. Returns prose, or null on total failure (caller uses the truth packet).
export async function fetchGroundedReading(
  origin: string,
  { topicId, timeframe, rawInput, calculatedState }: GroundArgs,
): Promise<string | null> {
  const plan = resolveGroundingPlan(topicId, timeframe);
  if (!plan) {
    return null;
  }

  if (plan.seam === "newdata") {
    const newdata = await fetchNewdataChapterReading(origin, { topicId: plan.topicId, rawInput });
    if (newdata) {
      return newdata;
    }
    // Degrade: empty newdata chapter -> deterministic topic reading for the same chapter.
    return fetchTopicReading(origin, { topicId: plan.topicId, rawInput, calculatedState });
  }

  // Time seam: ground on the turning_points topic reading (liuNian forecast + ปีชง + วัยจร).
  return fetchTopicReading(origin, { topicId: plan.topicId, rawInput, calculatedState });
}
