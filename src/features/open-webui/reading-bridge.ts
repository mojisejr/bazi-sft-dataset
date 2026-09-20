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
import { buildAlmanacDay } from "@/lib/bazi/almanac/almanac-engine";
import { type LuckyHour } from "@/lib/bazi/almanac/types";
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
  /** ข้อความผู้ใช้ล่าสุด — ใช้ตรวจว่าเป็นคำถาม "วันไหนดี" เพื่อ ground ด้วยวันดีจริง (man-vs-day) */
  message?: string | null;
};

// คำถามเลือก "วันดี/วันมงคล/ฤกษ์/เดือนนี้วันไหนดีสุด" — ต้องตอบด้วยวันจริง ไม่ใช่เลี่ยงไปพูดวัยจร/ปีจร
const GOOD_DAY_RE = /วันไหน|วันดี|วันมงคล|ฤกษ์|ดีสุด|วันที่ดี|มงคล/;
export function isGoodDayQuestion(message?: string | null): boolean {
  return typeof message === "string" && GOOD_DAY_RE.test(message);
}

// คำถามที่ต้องการ "จังหวะเจาะจง" ระดับวัน/เวลา ไม่ใช่ภาพรวมช่วงวัย — การตัดสินใจ, ควรทำเมื่อไหร่, ช่วง
// อีกเดือนสองเดือน, ปรึกษาเรื่องที่ต้องเลือก ฯลฯ. เมื่อมีดวงเกิดครบ + ระบบมีปฏิทินเฉพาะบุคคล ต้อง ground
// ด้วยวันจริง (流日) + ยามมงคล (時辰) แทนการตอบเป็น "ช่วงอายุ" กว้าง ๆ.
const DECISION_TIMING_RE =
  /ตัดสินใจ|ควร|เมื่อไหร่|เมื่อไร|ตอนไหน|ช่วงไหน|วันไหน|เดือนไหน|กี่โมง|เวลาไหน|ยามไหน|อีก.?เดือน|เดือนหน้า|เร็ว ?ๆ นี้|ปรึกษา|ลงทุน|เริ่ม|เซ็น|เปิด(ร้าน|บริษัท|กิจการ)|ย้าย|ลาออก|เปลี่ยนงาน|สมัคร|นัด|คุย|เจรจา|จะเอายังไง|ควรทำ|ควรไป|ควรเริ่ม|เหมาะ(จะ)?/;

// Sub-year timeframes the triage flags → ต้องการวันจริง (ปฏิทินส่วนตัวมีอยู่แล้ว).
const SUB_YEAR_TF: ReadonlySet<TriageTimeframe> = new Set<TriageTimeframe>(["today", "tomorrow", "this_month"]);

export function needsPersonalDayCalendar(
  message?: string | null,
  timeframe?: TriageTimeframe | null,
): boolean {
  if (isGoodDayQuestion(message)) {
    return true;
  }
  if (timeframe != null && SUB_YEAR_TF.has(timeframe)) {
    return true;
  }
  return typeof message === "string" && DECISION_TIMING_RE.test(message);
}

// หัวข้อเสริมที่คำถามพ่วงมาบ่อย (คดีความ/ฤกษ์งานสำคัญ) — สี/ทิศ และ องค์เทพ/สิ่งที่ควรไหว้.
// ตรวจแยกเพื่อ "ดึงผลอ่านหัวข้อนั้นมาจริง" แทนที่จะให้ LLM เดาธาตุเอง (multi-topic grounding).
const COLORS_DIR_RE = /สี(อะไร|มงคล|เสื้อ|รถ|กระเป๋า|เสริม)?|ทิศ(ไหน|มงคล|ทาง)?|ใส่ชุด|แต่งตัว|แต่งกาย/;
const DEITY_RE = /ไหว้|บูชา|องค์เทพ|เทพ|สิ่งศักดิ์สิทธิ์|ขอพร|สิ่งยึดเหนี่ยว|ไหว้พระ/;
export function isColorsDirQuestion(message?: string | null): boolean {
  return typeof message === "string" && COLORS_DIR_RE.test(message);
}
export function isDeityQuestion(message?: string | null): boolean {
  return typeof message === "string" && DEITY_RE.test(message);
}

// ยาม (時辰) → ช่วงเวลาไทย เพื่อให้แชทพูดได้ว่า เช้า/สาย/บ่าย/เย็น/ค่ำ/ดึก + เวลาเป็นโมง
function dayPeriodLabel(range: string): string {
  const startHour = Number((range.split("-")[0] ?? "").split(":")[0]);
  if (!Number.isFinite(startHour)) {
    return "";
  }
  if (startHour >= 5 && startHour < 9) return "เช้า";
  if (startHour >= 9 && startHour < 11) return "สาย";
  if (startHour >= 11 && startHour < 16) return "บ่าย";
  if (startHour >= 16 && startHour < 19) return "เย็น";
  if (startHour >= 19 && startHour < 23) return "ค่ำ";
  return "ดึก";
}

// ยามมงคล (黃道) ของวันหนึ่ง จากปฏิทินฤกษ์ — เดียวกับที่หน้าปฏิทินใช้. คืน 2-3 ยามเด่นเป็นข้อความ.
function renderLuckyHours(dateISO: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateISO);
  if (!m) {
    return "";
  }
  let hours: LuckyHour[];
  try {
    hours = buildAlmanacDay(Number(m[1]), Number(m[2]), Number(m[3])).luckyHours ?? [];
  } catch {
    return "";
  }
  // เอาแค่ช่วงเวลา + โมง ให้อ่านง่าย — ไม่ใส่ชื่อยาม/คำจีน (ผู้ใช้อ่านแล้วงง)
  const parts = hours.slice(0, 3).map((h) => {
    const period = dayPeriodLabel(h.range);
    return `${period ? `${period} ` : ""}${h.range} น.`;
  });
  return parts.join(", ");
}

type ManVsDayDay = {
  date?: string;
  dayOfMonth?: number;
  weekday?: string;
  dayGanzhi?: string;
  overallPercent?: number | null;
  grade?: string | null;
};

// Personal-calendar seam: ground บนปฏิทินเฉพาะบุคคล (/api/bazi/man-vs-day โหมดเดือน) — ตัวเดียวกับที่
// หน้าปฏิทินใช้. หน้าต่าง 2 เดือน (เดือนนี้ + เดือนหน้า เผื่อคำถาม "อีกเดือนสองเดือน"), คืน top วันคะแนนสูงสุด
// พร้อม "ยามมงคล (時辰)" ของแต่ละวัน เพื่อให้ LLM ฟันธงได้ถึงระดับวันจริง + เช้า/สาย/บ่าย/เย็น/ค่ำ/ดึก.
// "" = ไม่มีข้อมูล → ตกไปทางเดิม.
async function fetchOneMonthTopDays(
  origin: string,
  rawInput: RawInputValue,
  month: string,
): Promise<ManVsDayDay[]> {
  try {
    const res = await fetch(`${origin}/api/bazi/man-vs-day`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ person: rawInput, month }),
    });
    if (!res.ok) {
      return [];
    }
    const json = (await res.json()) as { days?: ManVsDayDay[] };
    return Array.isArray(json.days) ? json.days : [];
  } catch {
    return [];
  }
}

async function fetchPersonalDayCalendar(
  origin: string,
  { rawInput }: { rawInput: RawInputValue },
): Promise<string> {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const months = [
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
  ];

  const perMonth = await Promise.all(months.map((month) => fetchOneMonthTopDays(origin, rawInput, month)));
  const sections: string[] = [];

  // 2026-09-20 (เอ็ม live-test): คำถาม "วันนี้/พรุ่งนี้ดวงเป็นไง" เดิมได้แค่ "วันเด่นในเดือน" (top-N คะแนนสูงสุด)
  // ซึ่งวันนี้/พรุ่งนี้อาจไม่ติดโผ (คะแนนไม่สูงพอ) — โมเดลเลยไม่มีเลขวันนี้จริงให้อ้าง ตอบกว้างแทนที่จะฟันธง.
  // ดึงคะแนน "วันนี้" + "พรุ่งนี้" ออกมาเป็นบรรทัดแยกเสมอ (ไม่ผ่านการกรอง top-N) ไม่ว่าจะติดโผหรือไม่.
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;
  const allDaysThisMonth = perMonth[0] ?? [];
  const allDaysNextMonth = perMonth[1] ?? [];
  const findDay = (date: string) =>
    allDaysThisMonth.find((d) => d.date === date) ?? allDaysNextMonth.find((d) => d.date === date);
  const renderOwnDay = (label: string, day: ManVsDayDay | undefined) => {
    if (!day || typeof day.overallPercent !== "number") return null;
    const hours = typeof day.date === "string" ? renderLuckyHours(day.date) : "";
    return `${label} (${day.date}${day.weekday ? ` ${day.weekday}` : ""}${day.dayGanzhi ? ` ${day.dayGanzhi}` : ""}): เหมาะ ${day.overallPercent}%${day.grade ? ` เกรด ${day.grade}` : ""}${hours ? ` · ยามมงคล: ${hours}` : ""}`;
  };
  const ownDayLines = [renderOwnDay("วันนี้", findDay(todayStr)), renderOwnDay("พรุ่งนี้", findDay(tomorrowStr))].filter(
    (l): l is string => l !== null,
  );
  if (ownDayLines.length) {
    sections.push(["คะแนนวันนี้/พรุ่งนี้ (คะแนนจริงของวันนั้น ไม่ใช่วันเด่นในเดือน):", ...ownDayLines].join("\n"));
  }

  for (let i = 0; i < months.length; i += 1) {
    const top = perMonth[i]
      .filter((d) => typeof d.overallPercent === "number")
      .sort((a, b) => (b.overallPercent as number) - (a.overallPercent as number))
      .slice(0, i === 0 ? 5 : 3); // เดือนนี้เอา 5, เดือนหน้าเอา 3
    if (!top.length) {
      continue;
    }
    const lines = top.map((d) => {
      const hours = typeof d.date === "string" ? renderLuckyHours(d.date) : "";
      return `- ${d.date ?? d.dayOfMonth}${d.weekday ? ` (${d.weekday})` : ""}${d.dayGanzhi ? ` ${d.dayGanzhi}` : ""}: เหมาะ ${d.overallPercent}%${d.grade ? ` เกรด ${d.grade}` : ""}${hours ? ` · ยามมงคล: ${hours}` : ""}`;
    });
    sections.push([`เดือน ${months[i]}${i === 0 ? " (เดือนนี้)" : " (เดือนหน้า)"} — วันเด่นเรียงจากคะแนนสูงสุด:`, ...lines].join("\n"));
  }

  if (!sections.length) {
    return "";
  }

  return [
    "ปฏิทินดวงเฉพาะบุคคล (流日 + ยามมงคล 時辰 จริง ไม่ใช่การเดา) — ใช้ฟันธงวันจริงและช่วงเวลาในวันได้เลย:",
    ...sections,
    "ตอบเจาะจงได้ถึงระดับวัน + ยาม (เช้า/สาย/บ่าย/เย็น/ค่ำ/ดึก พร้อมเวลาเป็นโมง). อย่าตอบกว้างเป็นแค่ 'ช่วงอายุ' เมื่อมีข้อมูลนี้แล้ว.",
  ].join("\n\n");
}

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

// Ground ONE topic via the dual-seam plan (newdata natal vs turning_points time), with graceful
// degradation. Returns prose or null. This is the single-topic primitive the compound path reuses.
async function groundOneTopic(
  origin: string,
  topicId: string,
  timeframe: TriageTimeframe | null | undefined,
  rawInput: RawInputValue,
  calculatedState?: CalculatedStateValue | null,
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

function trimSection(text: string, max = 800): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()} …`;
}

// Compound grounding: a question that pairs the main topic with สี/ทิศ (colors_directions) และ/หรือ
// องค์เทพ-การไหว้ (guardian_deities) — เช่น "ขึ้นศาลชนะไหม ไหว้อะไร ใส่สีอะไร". ดึงผลอ่านของแต่ละ
// หัวข้อ "จาก engine จริง" มาต่อกันเป็นก้อนเดียว เพื่อไม่ให้ LLM เดาสี/ทิศ/องค์เอง.
async function fetchCompoundReading(
  origin: string,
  { topicId, timeframe, rawInput, calculatedState, message }: GroundArgs,
  flags: { wantCalendar: boolean; wantColors: boolean; wantDeities: boolean },
): Promise<string | null> {
  const jobs: Array<Promise<{ head: string; body: string } | null>> = [];

  if (flags.wantCalendar) {
    jobs.push(
      fetchPersonalDayCalendar(origin, { rawInput }).then((t) =>
        t ? { head: "จังหวะวัน/เวลาเฉพาะบุคคล", body: t } : null),
    );
  }
  if (flags.wantColors) {
    jobs.push(
      groundOneTopic(origin, "colors_directions", "none", rawInput, calculatedState).then((t) =>
        t ? { head: "สีมงคล & ทิศมงคล (จากผลอ่าน)", body: trimSection(t) } : null),
    );
  }
  if (flags.wantDeities) {
    jobs.push(
      groundOneTopic(origin, "guardian_deities", "none", rawInput, calculatedState).then((t) =>
        t ? { head: "องค์อุปถัมภ์ / สิ่งที่ควรไหว้ (จากผลอ่าน)", body: trimSection(t) } : null),
    );
  }

  // ประเด็นหลักที่ถาม (เช่น โอกาสชนะคดี → turning_points) — ข้ามถ้าซ้ำกับหัวข้อเสริมที่ดึงไปแล้ว
  // หรือถ้าเป็น turning_points ทั้งที่ดึงปฏิทินวันมาแล้ว (ปฏิทินครอบคลุมจังหวะเวลาอยู่แล้ว).
  const primary = isValidTopicId(topicId) ? topicId : null;
  const alreadyCovered = new Set<string>();
  if (flags.wantColors) alreadyCovered.add("colors_directions");
  if (flags.wantDeities) alreadyCovered.add("guardian_deities");
  const skipPrimary =
    !primary ||
    alreadyCovered.has(primary) ||
    (primary === TIME_TOPIC_ID && flags.wantCalendar);
  if (!skipPrimary && primary) {
    jobs.push(
      groundOneTopic(origin, primary, timeframe, rawInput, calculatedState).then((t) =>
        t ? { head: "ประเด็นหลักที่ถาม (จากผลอ่าน)", body: trimSection(t) } : null),
    );
  }

  const parts = (await Promise.all(jobs)).filter((p): p is { head: string; body: string } => p !== null);
  if (!parts.length) {
    // ทุกหัวข้อว่าง → ตกไปทาง single-topic ปกติ
    return groundOneTopic(origin, topicId, timeframe, rawInput, calculatedState);
  }
  void message;
  return parts.map((p) => `【${p.head}】\n${p.body}`).join("\n\n");
}

// Grounded reading entry point. Single-topic by default; switches to multi-topic (compound) grounding
// when the question also asks about สี/ทิศ or องค์เทพ/การไหว้. Returns null on total failure.
export async function fetchGroundedReading(
  origin: string,
  args: GroundArgs,
): Promise<string | null> {
  const { topicId, timeframe, rawInput, calculatedState, message } = args;
  const wantCalendar = needsPersonalDayCalendar(message, timeframe);
  const wantColors = isColorsDirQuestion(message);
  const wantDeities = isDeityQuestion(message);

  // คำถามพ่วงหลายด้าน (มี สี/ทิศ หรือ องค์เทพ) → multi-topic grounding
  if (wantColors || wantDeities) {
    return fetchCompoundReading(origin, args, { wantCalendar, wantColors, wantDeities });
  }

  // คำถามที่ต้องการจังหวะเจาะจง (วันดี/ตัดสินใจ/เมื่อไหร่/อีกเดือนสองเดือน) → วันจริง + ยามมงคล
  if (wantCalendar) {
    const calendar = await fetchPersonalDayCalendar(origin, { rawInput });
    if (calendar) {
      return calendar;
    }
    // ไม่มีข้อมูลปฏิทิน → ตกไปใช้ seam ปกติ
  }

  return groundOneTopic(origin, topicId, timeframe, rawInput, calculatedState);
}
