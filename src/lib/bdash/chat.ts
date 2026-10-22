// bdash แชตถามอะไร (mumate-bdash-v2-001 slice 4, plan 0.4).
// การ์ดหัวข้อ: จาก mate_ai_chat_meta (หัวข้อที่ AI จัดให้ ไม่มีข้อความ) ทุกแชต — แยกลูกค้าที่จ่ายเงินกับคนใช้ฟรีเป็นยอดรวม.
// การ์ดคำถามจริง: อ่าน ai_question_log ของทีม (อ่านอย่างเดียว) เฉพาะคำถามของคนที่คำตอบล่าสุดยินยอม ai_training รุ่นปัจจุบัน
// และถามหลังเวลาที่ยินยอมรุ่นนั้น — ข้อความยินยอมรุ่นนี้ครอบคลุมการวิเคราะห์เพื่อพัฒนาบริการ รุ่นเดิมไม่ครอบคลุม.
// member id และ subject อยู่ในเซิร์ฟเวอร์เท่านั้น หน้าเห็นแค่ยอดรวมและข้อความคำถาม. bdash ไม่เขียนอะไรลงฐาน.
import { sql, type SQL } from "drizzle-orm";

import { AI_TRAINING_CONSENT_KIND, AI_TRAINING_VERSION, subjectFor } from "@/lib/bazi/ai-question-log";

import { bkkDay, bkkStart, rowsOf, type Exec } from "./compute";
import { PEOPLE_FROM } from "./features";
import { buckets, daysBetween, type BdashRange, type Bucket } from "./range";
import { addDays } from "./shape";

/** วันแรกที่แชตบันทึกหัวข้อพร้อม member id (slice 1 ขึ้น production 2026-10-21) — ก่อนนี้ไม่มีแถว */
export const CHAT_FROM = PEOPLE_FROM;

/** หัวข้อ (topic_id จาก triage) → ชื่อสั้นที่ทีมอ่านเข้าใจ · รหัสที่ไม่รู้จักแสดงตามเดิม */
export const TOPIC_TH: Record<string, string> = {
  chart_foundation: "นิสัย/พื้นดวง",
  career_potential: "งาน/อาชีพ",
  wealth_and_investment: "การเงิน/โชคลาภ",
  benefactor: "ผู้อุปถัมภ์",
  talent: "พรสวรรค์",
  family: "ครอบครัว",
  love_partner: "ความรัก/คู่ครอง",
  friends_foes: "เพื่อน/ศัตรู",
  partnership: "หุ้นส่วน/ธุรกิจ",
  subordinates: "ลูกน้อง/บริวาร",
  education: "การเรียน",
  turning_points: "จังหวะชีวิต/ช่วงอายุ",
  health: "สุขภาพ",
  colors_directions: "สี/ทิศมงคล",
  guardian_deities: "องค์เทพ",
  card_reading: "เปิดไพ่",
  off_topic: "นอกเรื่อง",
  chit_chat: "คุยเล่น",
  unknown: "ไม่ระบุ",
};
export const topicTh = (id: string | null): string => TOPIC_TH[id ?? "unknown"] ?? (id as string);
const ASIDE = new Set(["off_topic", "chit_chat"]);

/** ช่วงเวลาที่ถาม (timeframe จาก triage) → กลุ่มที่ทีมใช้ตัดสินใจ */
export const TIMEFRAME_GROUPS: ReadonlyArray<{ key: string; label: string; values: readonly string[] }> = [
  { key: "near", label: "วันนี้/พรุ่งนี้", values: ["today", "tomorrow"] },
  { key: "month", label: "เดือนนี้", values: ["this_month"] },
  { key: "year", label: "ปีนี้/ปีหน้า", values: ["this_year", "next_year"] },
  { key: "long", label: "หลายปี/ช่วงชีวิต", values: ["in_n_years", "period"] },
  { key: "none", label: "ไม่ระบุเวลา", values: ["none"] },
];

const FIRST_PAID = sql`SELECT user_id, min(${bkkDay(sql`created_at`)}) AS first_paid FROM v2_payment WHERE status = 'APPROVED' GROUP BY 1`;
const windowOf = (from: string, to: string): SQL => sql`created_at >= ${bkkStart(from)} AND created_at < ${bkkStart(addDays(to, 1))}`;
const bucketOf = (bucket: Bucket): SQL =>
  bucket === "day" ? bkkDay(sql`created_at`) : sql`date_trunc('week', created_at AT TIME ZONE 'Asia/Bangkok')::date`;

export type TopicSqlRow = { topic: string; questions: unknown; people: unknown; paid_questions: unknown; paid_people: unknown };

/** คำถามและคนต่อหัวข้อในช่วงนี้ · "ลูกค้าที่จ่ายเงิน" = จ่ายสำเร็จอย่างน้อยครั้งหนึ่งถึงวันสุดท้ายของช่วง (นิยามเดียวกับการ์ด C) */
export async function queryTopics(db: Exec, from: string, to: string): Promise<TopicSqlRow[]> {
  return rowsOf<TopicSqlRow>(
    await db.execute(sql`
      WITH m AS (SELECT anon_id, COALESCE(topic_id, 'unknown') AS topic FROM mate_ai_chat_meta WHERE ${windowOf(from, to)}),
           p AS (${FIRST_PAID})
      SELECT m.topic, count(*) AS questions, count(DISTINCT m.anon_id) AS people,
             count(*) FILTER (WHERE p.first_paid <= ${to}::date) AS paid_questions,
             count(DISTINCT m.anon_id) FILTER (WHERE p.first_paid <= ${to}::date) AS paid_people
        FROM m LEFT JOIN p ON p.user_id = m.anon_id GROUP BY 1`),
  );
}

export type ChatTotalsSqlRow = { questions: unknown; people: unknown; paid_people: unknown };

/** คนถามทั้งช่วง (คนเดียวถามหลายหัวข้อนับครั้งเดียว) */
export async function queryChatTotals(db: Exec, from: string, to: string): Promise<ChatTotalsSqlRow> {
  return (
    rowsOf<ChatTotalsSqlRow>(
      await db.execute(sql`
        WITH m AS (SELECT anon_id FROM mate_ai_chat_meta WHERE ${windowOf(from, to)}), p AS (${FIRST_PAID})
        SELECT count(*) AS questions, count(DISTINCT m.anon_id) AS people,
               count(DISTINCT m.anon_id) FILTER (WHERE p.first_paid <= ${to}::date) AS paid_people
          FROM m LEFT JOIN p ON p.user_id = m.anon_id`),
    )[0] ?? { questions: 0, people: 0, paid_people: 0 }
  );
}

export type TopicBucketSqlRow = { topic: string; bucket: string; questions: unknown };

export async function queryTopicBuckets(db: Exec, range: BdashRange): Promise<TopicBucketSqlRow[]> {
  return rowsOf<TopicBucketSqlRow>(
    await db.execute(sql`
      SELECT COALESCE(topic_id, 'unknown') AS topic, to_char(${bucketOf(range.bucket)}, 'YYYY-MM-DD') AS bucket, count(*) AS questions
        FROM mate_ai_chat_meta WHERE ${windowOf(range.from, range.to)} GROUP BY 1, 2`),
  );
}

export type TimeframeSqlRow = { timeframe: string; questions: unknown };

export async function queryTimeframes(db: Exec, from: string, to: string): Promise<TimeframeSqlRow[]> {
  return rowsOf<TimeframeSqlRow>(
    await db.execute(sql`
      SELECT COALESCE(timeframe, 'none') AS timeframe, count(*) AS questions
        FROM mate_ai_chat_meta WHERE ${windowOf(from, to)} AND topic_id IS DISTINCT FROM 'off_topic' AND topic_id IS DISTINCT FROM 'chit_chat'
       GROUP BY 1`),
  );
}

const num = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));

/** ช่วงก่อนหน้าที่ยาวเท่ากัน — null ถ้าเริ่มก่อนวันที่แชตเริ่มบันทึกหัวข้อ (เทียบไปก็เหมือนโตจากศูนย์) */
export function previousRange(range: Pick<BdashRange, "from" | "to">): { from: string; to: string } | null {
  const days = daysBetween(range.from, range.to);
  const from = addDays(range.from, -days);
  return from < CHAT_FROM ? null : { from, to: addDays(range.from, -1) };
}

export type TopicRow = {
  topic: string;
  label: string;
  questions: number;
  people: number;
  /** คำถามจากลูกค้าที่จ่ายเงิน / จากคนใช้ฟรี */
  paidQuestions: number;
  freeQuestions: number;
  /** สัดส่วนของคำถามทั้งหมดในกลุ่มนั้นที่เป็นหัวข้อนี้ */
  paidShare: number | null;
  freeShare: number | null;
  /** คำถามช่วงก่อนหน้าที่ยาวเท่ากัน (null = เทียบไม่ได้) */
  previous: number | null;
  aside: boolean;
};

export type TopicCard = {
  rows: TopicRow[];
  questions: number;
  people: number;
  paidPeople: number;
  paidQuestions: number;
  /** นอกเรื่อง + คุยเล่น */
  asideShare: number | null;
  timeframes: { key: string; label: string; questions: number; share: number | null }[];
  buckets: string[];
  series: { topic: string; label: string; values: number[] }[];
  /** มีช่วงก่อนหน้าให้เทียบไหม */
  compared: boolean;
  /** ช่วงนี้เริ่มก่อนวันที่แชตเริ่มบันทึกหัวข้อ */
  partial: boolean;
};

export function shapeTopicCard(
  range: BdashRange,
  topics: TopicSqlRow[],
  totals: ChatTotalsSqlRow,
  bucketRows: TopicBucketSqlRow[],
  timeframes: TimeframeSqlRow[],
  previous: TopicSqlRow[] | null,
): TopicCard {
  const prev = previous ? new Map(previous.map((r) => [r.topic, num(r.questions)])) : null;
  const questions = topics.reduce((s, r) => s + num(r.questions), 0);
  const paidQuestions = topics.reduce((s, r) => s + num(r.paid_questions), 0);
  const freeQuestions = questions - paidQuestions;
  const rows: TopicRow[] = topics.map((r) => {
    const q = num(r.questions);
    const pq = num(r.paid_questions);
    return {
      topic: r.topic,
      label: topicTh(r.topic),
      questions: q,
      people: num(r.people),
      paidQuestions: pq,
      freeQuestions: q - pq,
      paidShare: paidQuestions > 0 ? pq / paidQuestions : null,
      freeShare: freeQuestions > 0 ? (q - pq) / freeQuestions : null,
      previous: prev ? (prev.get(r.topic) ?? 0) : null,
      aside: ASIDE.has(r.topic),
    };
  });
  // หัวข้อดวงเรียงตามจำนวนคำถาม · นอกเรื่อง/คุยเล่น/ไม่ระบุ ไว้ท้าย
  const tail = (r: TopicRow) => (r.aside || r.topic === "unknown" ? 1 : 0);
  rows.sort((a, b) => tail(a) - tail(b) || b.questions - a.questions || a.label.localeCompare(b.label, "th"));

  const axis = buckets(range);
  const index = new Map(axis.map((b, i) => [b, i]));
  const chosen = rows.filter((r) => tail(r) === 0 && r.questions > 0).slice(0, 4);
  const series = chosen.map((r) => {
    const values = axis.map(() => 0);
    for (const b of bucketRows) {
      const i = index.get(b.bucket);
      if (b.topic === r.topic && i !== undefined) values[i] += num(b.questions);
    }
    return { topic: r.topic, label: r.label, values };
  });

  // ค่าที่ไม่รู้จักนับเป็น "ไม่ระบุเวลา"
  const groupOf = (tf: string) => (TIMEFRAME_GROUPS.find((g) => g.values.includes(tf)) ?? TIMEFRAME_GROUPS[TIMEFRAME_GROUPS.length - 1]).key;
  const tfBy = new Map<string, number>();
  for (const r of timeframes) tfBy.set(groupOf(r.timeframe), (tfBy.get(groupOf(r.timeframe)) ?? 0) + num(r.questions));
  const tfTotal = timeframes.reduce((s, r) => s + num(r.questions), 0);
  const tf = TIMEFRAME_GROUPS.map((g) => {
    const n = tfBy.get(g.key) ?? 0;
    return { key: g.key, label: g.label, questions: n, share: tfTotal > 0 ? n / tfTotal : null };
  });

  const aside = rows.filter((r) => r.aside).reduce((s, r) => s + r.questions, 0);
  return {
    rows,
    questions,
    people: num(totals.people),
    paidPeople: num(totals.paid_people),
    paidQuestions,
    asideShare: questions > 0 ? aside / questions : null,
    timeframes: tf,
    buckets: axis,
    series,
    compared: prev !== null,
    partial: range.from < CHAT_FROM,
  };
}

// ── การ์ดคำถามจริง ──

/** ค้นหาได้ยาวสุดเท่านี้ · แสดงคำถามล่าสุดได้สูงสุดเท่านี้ต่อหน้า */
export const SEARCH_MAX = 60;
export const QUESTIONS_MAX = 100;

export type QuestionFilter = { topic: string | null; q: string | null };

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** ตัวกรองจากลิงก์ (?topic=&q=) — หัวข้อต้องเป็นรหัสที่รู้จัก, คำค้นตัดช่องว่างและความยาว */
export function parseQuestionFilter(params: Record<string, string | string[] | undefined>): QuestionFilter {
  const topic = one(params.topic)?.trim();
  const q = one(params.q)?.trim().slice(0, SEARCH_MAX);
  return { topic: topic && topic in TOPIC_TH ? topic : null, q: q ? q : null };
}

export type ConsenterSqlRow = { anon_id: string; since: string };

/** คนที่คำตอบล่าสุดเรื่อง ai_training คือยินยอมรุ่นปัจจุบัน และเวลาที่ยินยอม */
export async function queryConsenters(db: Exec): Promise<ConsenterSqlRow[]> {
  return rowsOf<ConsenterSqlRow>(
    await db.execute(sql`
      SELECT anon_id, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS since FROM (
        SELECT DISTINCT ON (anon_id) anon_id, accepted, version, created_at
          FROM bazi_consent WHERE kind = ${AI_TRAINING_CONSENT_KIND}
         ORDER BY anon_id, created_at DESC
      ) latest
      WHERE accepted AND version = ${AI_TRAINING_VERSION}`),
  );
}

/** subject (ชุดเดียวกับที่ ai_question_log เก็บ) ของคนที่ยินยอม — คำนวณในเซิร์ฟเวอร์ ไม่ออกไปถึงหน้า */
export const consentSubjects = (rows: ConsenterSqlRow[]): { subject: string; since: string }[] =>
  rows.map((r) => ({ subject: subjectFor(r.anon_id), since: r.since }));

const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** เงื่อนไขร่วม: เฉพาะคนที่ยินยอมรุ่นนี้ ถามหลังยินยอม และอยู่ในช่วง (+ ตัวกรอง) */
function consentedQuestions(subjects: { subject: string; since: string }[], from: string, to: string, filter: QuestionFilter): SQL {
  const parts: SQL[] = [sql`l.created_at >= ${bkkStart(from)}`, sql`l.created_at < ${bkkStart(addDays(to, 1))}`];
  if (filter.topic) parts.push(filter.topic === "unknown" ? sql`l.topic_id IS NULL` : sql`l.topic_id = ${filter.topic}`);
  if (filter.q) parts.push(sql`l.question ILIKE ${`%${escapeLike(filter.q)}%`}`);
  return sql`
    ai_question_log l
    JOIN jsonb_to_recordset(${JSON.stringify(subjects)}::jsonb) AS c(subject text, since timestamptz)
      ON l.subject = c.subject AND l.created_at >= c.since
    WHERE ${sql.join(parts, sql` AND `)}`;
}

export type QuestionSqlRow = { question: string; topic_id: string | null; at: string };
export type QuestionCountSqlRow = { questions: unknown; people: unknown };
export type QuestionTopicSqlRow = { topic: string; questions: unknown };

export async function queryQuestions(
  db: Exec,
  subjects: { subject: string; since: string }[],
  from: string,
  to: string,
  filter: QuestionFilter,
): Promise<QuestionSqlRow[]> {
  return rowsOf<QuestionSqlRow>(
    await db.execute(sql`
      SELECT l.question, l.topic_id, to_char(l.created_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI') AS at
        FROM ${consentedQuestions(subjects, from, to, filter)}
       ORDER BY l.created_at DESC LIMIT ${QUESTIONS_MAX}`),
  );
}

export async function queryQuestionCount(
  db: Exec,
  subjects: { subject: string; since: string }[],
  from: string,
  to: string,
  filter: QuestionFilter,
): Promise<QuestionCountSqlRow> {
  return (
    rowsOf<QuestionCountSqlRow>(
      await db.execute(sql`SELECT count(*) AS questions, count(DISTINCT l.subject) AS people FROM ${consentedQuestions(subjects, from, to, filter)}`),
    )[0] ?? { questions: 0, people: 0 }
  );
}

/** หัวข้อที่มีคำถาม (ไม่ใช้ตัวกรองหัวข้อ) — สำหรับตัวเลือกหัวข้อ */
export async function queryQuestionTopics(
  db: Exec,
  subjects: { subject: string; since: string }[],
  from: string,
  to: string,
  q: string | null,
): Promise<QuestionTopicSqlRow[]> {
  return rowsOf<QuestionTopicSqlRow>(
    await db.execute(sql`
      SELECT COALESCE(l.topic_id, 'unknown') AS topic, count(*) AS questions
        FROM ${consentedQuestions(subjects, from, to, { topic: null, q })} GROUP BY 1 ORDER BY 2 DESC`),
  );
}

export type QuestionCard = {
  /** คนที่ยินยอมรุ่นนี้ (ทั้งหมด ไม่ขึ้นกับช่วง) */
  consenters: number;
  questions: number;
  people: number;
  rows: { question: string; topic: string; label: string; at: string }[];
  /** มีมากกว่าที่แสดง */
  more: boolean;
  topics: { topic: string; label: string; questions: number }[];
  filter: QuestionFilter;
};

export function shapeQuestionCard(
  consenters: number,
  count: QuestionCountSqlRow,
  rows: QuestionSqlRow[],
  topics: QuestionTopicSqlRow[],
  filter: QuestionFilter,
): QuestionCard {
  const questions = num(count.questions);
  return {
    consenters,
    questions,
    people: num(count.people),
    rows: rows.map((r) => ({ question: r.question, topic: r.topic_id ?? "unknown", label: topicTh(r.topic_id), at: r.at })),
    more: questions > rows.length,
    topics: topics.map((t) => ({ topic: t.topic, label: topicTh(t.topic), questions: num(t.questions) })),
    filter,
  };
}
