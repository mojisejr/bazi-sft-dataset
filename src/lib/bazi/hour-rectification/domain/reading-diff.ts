// Hour Rectification v3 — reading-diff (#hour-rectification-engine, "สอบจากคำทำนาย" lane).
//
// แนวคิด (ตามซินแส + หลักยามของอาจารย์): ดวง 12 ยามของคนเดียวกันต่างกันแค่เสายาม → คำทำนายที่
// "ผูกกับเสายาม" ในคลัง NewData (บริวาร/ลูกน้อง · ภพลูก · ความคิดเวลาอยู่คนเดียว/ราศีแฝง) จะต่างกัน
// ระหว่างยาม → เอาคำทำนายจริงเหล่านั้นมาจับกลุ่มยามที่ข้อความเหมือนกัน แล้วให้ user เลือกข้อที่ตรง
// ตัวเอง = คำถามที่แม่นตามศาสตร์จริง ไม่ใช่คำถามบุคลิกกลางๆ (v1) หรือกฎ hypothesis (v2)
//
// กติกาจากอาจารย์ (แชท 17 ก.ค.):
//   - หลักยามถามได้แค่เรื่องที่เสายามคุม: บริวาร · ลูก · ความคิดเวลาอยู่คนเดียว (· ลีลาบนเตียง — ตัดทิ้ง)
//   - ทุกคำถามต้องข้ามได้ ("ไม่มีลูกน้อง/ยังไม่มีลูก/ไม่แน่ใจ") เพราะบางคนตอบไม่ได้
//   - ต้องรู้ช่วงกว้างของวัน (เช้า/บ่าย/เย็น/ดึก) ก่อน — ไม่รู้เลย = ไม่ไปต่อ (เสี่ยงทายมั่ว)
//   - เป้าหมายไม่ใช่ฟันธง 1 ยาม แต่เหลือ shortlist 3-4 ยามอย่างซื่อสัตย์
//   - ห้ามคำถาม 18+ และถ้อยคำสอเสียด/ดูถูก (soften หรือตัด)
//
// Pure logic ทั้งไฟล์ — ไม่มี LLM / engine / DB / file access (วินัยเดียวกับ domain/ อื่นทุกไฟล์)

import { HOUR_BRANCHES, type HourBranch } from "./types";

// === dimensions — คำทำนายที่แปรตามเสายาม ===

export const READING_DIMENSIONS = ["subordinate", "hour_palace", "subconscious"] as const;
export type ReadingDimension = (typeof READING_DIMENSIONS)[number];

// น้ำหนักต่อคำตอบ 1 ข้อของแต่ละมิติ — บริวาร (12 เชี่ยงแซของเสายามตรงๆ) แรงสุดตามหลักยาม
export const DIMENSION_WEIGHT: Record<ReadingDimension, number> = {
  subordinate: 3,
  hour_palace: 2,
  subconscious: 2,
};

export const DIMENSION_QUESTION_TH: Record<ReadingDimension, string> = {
  subordinate: "ลูกน้อง/บริวารรอบตัวคุณ ส่วนใหญ่มีลักษณะแบบไหน?",
  hour_palace: "ความสัมพันธ์ระหว่างคุณกับลูก (หรือเด็ก/ผู้ที่อยู่ในความดูแล) เป็นแบบไหน?",
  subconscious: "เวลาอยู่คนเดียว ความคิดในหัวของคุณมักเป็นแบบไหน?",
};

export const DIMENSION_SKIP_LABEL_TH: Record<ReadingDimension, string> = {
  subordinate: "ไม่มีลูกน้อง/บริวาร หรือไม่ตรงสักข้อ",
  hour_palace: "ยังไม่มีลูก/ผู้ใต้ดูแล หรือไม่ตรงสักข้อ",
  subconscious: "ไม่แน่ใจ / ไม่ตรงสักข้อ",
};

// ข้อความคำทำนายราย 1 ยาม (adapter เติมให้ null = คลังไม่มีเนื้อสำหรับยามนั้น)
export type HourReadingFacts = {
  hourBranch: HourBranch;
  texts: Record<ReadingDimension, string | null>;
};

// === ช่วงกว้างของวัน (gate แรก — ตามอาจารย์: ไม่รู้ช่วงเลยไม่ให้ไปต่อ) ===

export const DAYPARTS = [
  { id: "morning", label: "เช้า (05:00–11:00)", hours: ["卯", "辰", "巳"] },
  { id: "afternoon", label: "กลางวัน–บ่าย (11:00–17:00)", hours: ["午", "未", "申"] },
  { id: "evening", label: "เย็น–ค่ำ (17:00–23:00)", hours: ["酉", "戌", "亥"] },
  { id: "night", label: "ดึก–เช้ามืด (23:00–05:00)", hours: ["子", "丑", "寅"] },
] as const satisfies readonly { id: string; label: string; hours: readonly HourBranch[] }[];

export type DaypartId = (typeof DAYPARTS)[number]["id"];

export function isDaypartId(value: string): value is DaypartId {
  return DAYPARTS.some((d) => d.id === value);
}

export function daypartHours(daypart: DaypartId): readonly HourBranch[] {
  return DAYPARTS.find((d) => d.id === daypart)?.hours ?? HOUR_BRANCHES;
}

// === content filter — ตัด 18+ / soften ถ้อยคำสอเสียด ===

// ข้อความที่แตะเรื่องเพศ = ตัดทั้งตัวเลือก (คำสั่ง user: เลี่ยง 18+ — รวม "ลีลาบนเตียง" ของหลักยามเดิม)
const BLOCKED_18PLUS: RegExp[] = [
  /เตียง/,
  /ลีลารัก/,
  /เพศสัมพันธ์/,
  /เซ็กส?์?/i,
  /\bsex\b/i,
  /ร่วมรัก/,
  /สวาท/,
  /กาม(า|อา)รมณ์/,
];

// ถ้อยคำแรง/สอเสียด → แทนด้วยคำกลางๆ (soften ไม่ตัดทิ้ง เพราะเนื้อทำนายยังต้องแยกยามได้)
const SOFTEN_MAP: [RegExp, string][] = [
  [/เนรคุณ/g, "ไม่ค่อยสำนึกบุญคุณ"],
  [/ทรยศ/g, "ไม่ค่อยซื่อตรงกับเรา"],
  [/โง่(เขลา)?/g, "ไม่ถนัดคิดวิเคราะห์"],
  [/เลวทราม|ชั่วร้าย/g, "ไม่น่าไว้ใจ"],
  [/ขี้เกียจ/g, "ไม่ค่อยกระตือรือร้น"],
  [/เอาเปรียบ/g, "มักคิดถึงประโยชน์ตัวเองก่อน"],
];

export function isBlockedText(text: string): boolean {
  return BLOCKED_18PLUS.some((p) => p.test(text));
}

export function softenText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of SOFTEN_MAP) out = out.replace(pattern, replacement);
  return out;
}

// === สรุปข้อความคำทำนาย → ตัวเลือกสั้นๆ ===

const MAX_OPTION_CHARS = 160;

// ตัด markdown/หัวข้อ แล้วเอาประโยคแรกๆ (ไทยไม่มีจุด — ตัดที่ตัวคั่นที่คลังใช้จริง: บรรทัด/·/—)
export function summarizeReadingText(text: string): string {
  const cleaned = text
    .replace(/\*\*|__|##+/g, "")
    .replace(/^[-•*]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  const firstChunk = cleaned.split(/[·—|]|(?:\n)/)[0]?.trim() || cleaned;
  const base = firstChunk.length >= 40 ? firstChunk : cleaned;
  if (base.length <= MAX_OPTION_CHARS) return base;
  return `${base.slice(0, MAX_OPTION_CHARS).trimEnd()}…`;
}

/**
 * สรุปข้อความหลายก้อนเป็นฉลากตัวเลือกที่ "แยกกันออกด้วยตา": ถ้าสรุปแล้วฉลากชนกัน (ข้อความต่างกัน
 * แค่ช่วงท้าย) → สรุปใหม่จาก "ส่วนที่ต่าง" (ตัด common prefix ทิ้ง ขึ้นต้นด้วย …) — ตัวเลือกที่
 * ผู้ตอบมองไม่เห็นความต่างคือคำถามที่ตอบไม่ได้จริง
 */
export function disambiguateLabels(texts: readonly string[]): string[] {
  const labels = texts.map(summarizeReadingText);
  const byLabel = new Map<string, number[]>();
  labels.forEach((label, i) => byLabel.set(label, [...(byLabel.get(label) ?? []), i]));

  for (const idxs of byLabel.values()) {
    if (idxs.length < 2) continue;
    const colliding = idxs.map((i) => texts[i]);
    // common prefix ของทุกก้อนที่ชนกัน
    let prefix = 0;
    const first = colliding[0];
    while (
      prefix < first.length &&
      colliding.every((t) => prefix < t.length && t[prefix] === first[prefix])
    ) {
      prefix += 1;
    }
    // tail ว่าง = ข้อความนี้คือ "ส่วนร่วม" ของกลุ่มพอดี → คงฉลากเดิม (ตัวอื่นได้ …ส่วนต่าง ไปแล้ว)
    idxs.forEach((i) => {
      const tail = texts[i].slice(prefix).trim();
      if (tail) labels[i] = `…${summarizeReadingText(tail)}`;
    });
  }
  // safeguard สุดท้าย: ถ้าตัดส่วนต่างแล้วยังชนกันเป๊ะ (เช่น ต่างแค่ช่องว่าง/ลำดับ) ติดหมายเลขกำกับ
  const seen = new Map<string, number>();
  return labels.map((label) => {
    const dup = seen.get(label) ?? 0;
    seen.set(label, dup + 1);
    return dup > 0 ? `${label} (แบบที่ ${dup + 1})` : label;
  });
}

// === question building — จับกลุ่มยามที่คำทำนายเหมือนกัน ===

export const SKIP_OPTION_ID = "skip";

export type ReadingOption = {
  id: string;
  label: string;
  hours: HourBranch[]; // ยามที่คำทำนายข้อนี้เป็นของจริง (ว่าง = ตัวเลือกข้าม)
};

// รูปขั้นต่ำที่ scorer ต้องการ — ให้คำถามชั้นละเอียด (reading-diff-detailed) ใช้ scorer ร่วมได้
export type ScorableQuestion = {
  id: string;
  question: string;
  weight: number;
  options: ReadingOption[]; // ตัวเลือกจริง + ตัวเลือกข้าม (SKIP_OPTION_ID) ต่อท้ายเสมอ
};

export type ReadingQuestion = ScorableQuestion & {
  dimension: ReadingDimension; // = dimension (1 มิติ = 1 คำถาม)
};

const branchOrder = new Map<HourBranch, number>(HOUR_BRANCHES.map((b, i) => [b, i]));

/**
 * สร้างคำถามจากคำทำนายจริงของ candidate hours: มิติไหนที่ข้อความ "แยกกลุ่มยามได้" (≥2 กลุ่ม และ
 * ไม่มีกลุ่มเดียวกินทุกยาม) → เป็นคำถาม 1 ข้อ ตัวเลือก = ข้อความสรุปของแต่ละกลุ่ม
 * มิติที่แยกไม่ได้ (เนื้อเหมือนกันหมด/คลังว่าง) ถูกทิ้ง — คำถามที่ไม่ช่วยแยกยามคือ noise
 */
export function buildReadingQuestions(
  factSets: readonly HourReadingFacts[],
  candidateHours: readonly HourBranch[],
): ReadingQuestion[] {
  const candidates = new Set(candidateHours);
  const questions: ReadingQuestion[] = [];

  for (const dimension of READING_DIMENSIONS) {
    // group: ข้อความ (หลัง soften) → ยามที่ได้ข้อความนั้น
    const groups = new Map<string, HourBranch[]>();
    for (const fs of factSets) {
      if (!candidates.has(fs.hourBranch)) continue;
      const raw = fs.texts[dimension];
      if (!raw || !raw.trim()) continue;
      if (isBlockedText(raw)) continue; // 18+ = ตัดทั้งก้อน
      const text = softenText(raw.trim());
      const bucket = groups.get(text);
      if (bucket) bucket.push(fs.hourBranch);
      else groups.set(text, [fs.hourBranch]);
    }

    const coveredHours = [...groups.values()].reduce((n, hs) => n + hs.length, 0);
    // แยกไม่ได้: <2 กลุ่ม หรือกลุ่มเดียวครอบทุกยามที่มีเนื้อ
    if (groups.size < 2) continue;
    const largest = Math.max(...[...groups.values()].map((hs) => hs.length));
    if (largest >= coveredHours) continue;

    // เรียง option ตามยามแรกของกลุ่ม (deterministic) + กันฉลากสรุปชนกัน
    const sorted = [...groups.entries()].sort(
      (a, b) => (branchOrder.get(a[1][0]) ?? 0) - (branchOrder.get(b[1][0]) ?? 0),
    );
    const labels = disambiguateLabels(sorted.map(([text]) => text));
    const options: ReadingOption[] = sorted.map(([, hours], index) => ({
      id: `${dimension}-${index + 1}`,
      label: labels[index],
      hours: [...hours].sort((a, b) => (branchOrder.get(a) ?? 0) - (branchOrder.get(b) ?? 0)),
    }));
    options.push({ id: SKIP_OPTION_ID, label: DIMENSION_SKIP_LABEL_TH[dimension], hours: [] });

    questions.push({
      id: dimension,
      dimension,
      question: DIMENSION_QUESTION_TH[dimension],
      weight: DIMENSION_WEIGHT[dimension],
      options,
    });
  }

  return questions;
}

// === scoring ===

export type ReadingAnswer = { questionId: string; optionId: string };

export type ScoredHour = { hourBranch: HourBranch; score: number };

export type ReadingScoreResult = {
  ranked: ScoredHour[]; // candidate hours ทุกยาม เรียงคะแนนมาก→น้อย (tie → ตามลำดับยาม)
  shortlist: ScoredHour[]; // 3-4 ยามที่เหลือ (เป้าหมายตามอาจารย์)
  answeredCount: number; // จำนวนข้อที่ตอบจริง (ไม่นับข้าม)
};

const SHORTLIST_MIN = 3;
const SHORTLIST_MAX = 4;

/**
 * ให้คะแนน candidate hours จากคำตอบ: เลือกตัวเลือกไหน → ยามในกลุ่มนั้นได้ +weight ของคำถาม
 * ข้าม (skip) = 0 คะแนนทุกยาม (ไม่ลงโทษ — คนไม่มีลูกน้องไม่ใช่หลักฐานทางดวง)
 * shortlist: ไล่เก็บทีละชั้นคะแนนจนได้อย่างน้อย 3 ยาม แต่ไม่เกิน 4 (ตัดชั้นที่ทำให้เกิน)
 */
export function scoreReadingAnswers(
  questions: readonly ScorableQuestion[],
  answers: readonly ReadingAnswer[],
  candidateHours: readonly HourBranch[],
): ReadingScoreResult {
  const score = new Map<HourBranch, number>(candidateHours.map((h) => [h, 0]));
  let answeredCount = 0;

  for (const answer of answers) {
    const question = questions.find((q) => q.id === answer.questionId);
    if (!question) continue;
    if (answer.optionId === SKIP_OPTION_ID) continue;
    const option = question.options.find((o) => o.id === answer.optionId);
    if (!option) continue;
    answeredCount += 1;
    for (const hour of option.hours) {
      if (score.has(hour)) score.set(hour, (score.get(hour) ?? 0) + question.weight);
    }
  }

  const ranked: ScoredHour[] = [...score.entries()]
    .map(([hourBranch, s]) => ({ hourBranch, score: s }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (branchOrder.get(a.hourBranch) ?? 0) - (branchOrder.get(b.hourBranch) ?? 0);
    });

  // shortlist ทีละชั้นคะแนน: ชั้นถัดไปเข้าได้ก็ต่อเมื่อยังไม่ถึง 3 และรวมแล้วไม่เกิน 4
  const shortlist: ScoredHour[] = [];
  const tiers = [...new Set(ranked.map((r) => r.score))];
  for (const tier of tiers) {
    const tierHours = ranked.filter((r) => r.score === tier);
    if (shortlist.length >= SHORTLIST_MIN) break;
    if (shortlist.length + tierHours.length > SHORTLIST_MAX && shortlist.length > 0) break;
    shortlist.push(...tierHours.slice(0, SHORTLIST_MAX - shortlist.length));
  }

  return { ranked, shortlist, answeredCount };
}
