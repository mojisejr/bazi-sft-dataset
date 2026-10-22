// bdash อ่านสดตามช่วงที่เลือก (mumate-bdash-v2-001 slice 2) พร้อมกันไม่ให้แอปช้า (owner 2026-10-21):
// - ทุกหน้าอ่านใน transaction อ่านอย่างเดียว · ทุก statement หมดเวลาที่ ~3 วินาที → หน้าบอกว่าช่วงยาวเกินไป
// - ผลเก็บไว้ต่อหน้าต่อช่วง ~10 นาที (คนเปิดซ้ำหรือสลับเมนูไม่ยิงฐานซ้ำ)
// - ทุก query log เวลาที่ใช้ (event bdash_query) — query ไหนเริ่มช้า ย้ายไปคำนวณตอนตี 3 แทน
// query เรียงทีละตัวใน connection เดียว ไม่แย่ง pool ของสมาชิก.
import { sql, type SQL } from "drizzle-orm";

import { createDbClient } from "@/db/client";

import {
  queryActiveMembers,
  queryCohorts,
  queryPayers,
  queryPayments,
  queryQiBalance,
  queryQiDays,
  type Exec,
} from "./compute";
import {
  consentSubjects,
  previousRange,
  queryChatTotals,
  queryConsenters,
  queryQuestionCount,
  queryQuestions,
  queryQuestionTopics,
  queryTimeframes,
  queryTopicBuckets,
  queryTopics,
  shapeQuestionCard,
  shapeTopicCard,
  type QuestionCard,
  type QuestionFilter,
  type TopicCard,
} from "./chat";
import { queryAiBuckets, queryPeople, queryPeopleTotals, shapeFeatureCard, type FeatureCard } from "./features";
import type { BdashRange } from "./range";
import { fillQiDays, shapeCohorts, shapePayments } from "./shape";
import type { BdashCohort, BdashPayer, BdashPayerSummary, BdashPaymentRow, BdashQiDay } from "./types";
import { byMethod, shapePayers } from "./view";

export const STATEMENT_TIMEOUT_MS = 3_000;
export const CACHE_MS = 10 * 60_000;
/** เพดานทั้งหน้า เผื่อ connection ค้างแบบที่ statement_timeout ไม่ช่วย (ฐานไม่ได้รับ query ครบ) */
export const PAGE_BUDGET_MS = 12_000;
const CACHE_MAX = 60;

export class RangeTooHeavyError extends Error {}

type Page = "overview" | "stay" | "money" | "features" | "chat";

const cache = new Map<string, { at: number; value: Promise<unknown> }>();

/** วัดเวลาทุก query ของหน้านั้นแล้ว log เป็นบรรทัดเดียวต่อ query */
function timed(db: Exec, page: Page, range: BdashRange, log: (line: string) => void): (name: string) => Exec {
  return (name) => ({
    async execute(q: SQL) {
      const started = Date.now();
      try {
        return await db.execute(q);
      } finally {
        log(JSON.stringify({ event: "bdash_query", page, query: name, ms: Date.now() - started, days: range.days }));
      }
    },
  });
}

const isTimeout = (e: unknown): boolean => {
  const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  return code === "57014"; // query_canceled (statement_timeout)
};

export type Runner = <T>(page: Page, range: BdashRange, work: (q: (name: string) => Exec) => Promise<T>) => Promise<T>;

/** ทางจริง: transaction อ่านอย่างเดียว + statement_timeout บน connection เดียว (url/timeout เปลี่ยนได้เพื่อเทสต์กับฐานทิ้งได้) */
export function dbRunner(opts: { url?: string; timeoutMs?: number; log?: (line: string) => void } = {}): Runner {
  return async (page, range, work) => {
    const db = createDbClient(opts.url);
    return db.transaction(
      async (tx) => {
        await tx.execute(sql.raw(`SET LOCAL statement_timeout = ${Math.round(opts.timeoutMs ?? STATEMENT_TIMEOUT_MS)}`));
        return work(timed(tx, page, range, opts.log ?? ((l) => console.log(l))));
      },
      { accessMode: "read only" },
    );
  };
}

function withBudget<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RangeTooHeavyError(`bdash page over ${ms} ms`)), ms);
  });
  return Promise.race([p, stop]).finally(() => clearTimeout(timer));
}

/** อ่านผ่าน cache — ช่วงเดียวกัน หน้าเดียวกัน ภายใน 10 นาที ได้ผลชุดเดิม · พลาดแล้วไม่จำ */
export async function cached<T>(
  page: Page,
  range: BdashRange,
  work: (q: (name: string) => Exec) => Promise<T>,
  opts: { run?: Runner; now?: () => number; key?: string } = {},
): Promise<{ value: T; at: number }> {
  const now = opts.now ?? Date.now;
  // key = ตัวกรองเพิ่มเติมของหน้านั้น (เช่น หัวข้อ/คำค้นของการ์ดคำถาม) — ต่างตัวกรองต่างผล
  const key = `${page}|${range.from}|${range.to}${opts.key ? `|${opts.key}` : ""}`;
  const hit = cache.get(key);
  if (hit && now() - hit.at < CACHE_MS) return { value: (await hit.value) as T, at: hit.at };

  const at = now();
  const value = withBudget((opts.run ?? dbRunner())(page, range, work), PAGE_BUDGET_MS).catch((e: unknown) => {
    cache.delete(key);
    throw isTimeout(e) || e instanceof RangeTooHeavyError ? new RangeTooHeavyError("bdash range too heavy") : e;
  });
  cache.set(key, { at, value });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return { value: await value, at };
}

export function clearBdashCache(): void {
  cache.clear();
}

// ── ข้อมูลของแต่ละเมนู ──

export type StayData = { cohorts: BdashCohort[] };
export type MoneyData = { payments: BdashPaymentRow[]; payerSummary: BdashPayerSummary; payers: BdashPayer[] };
export type FeaturesData = {
  card: FeatureCard;
  activeMembers: number;
  qiDays: BdashQiDay[];
  qiBalance: { holders: number; median: number; p90: number };
};
export type OverviewData = {
  cohorts: BdashCohort[];
  payments: BdashPaymentRow[];
  ai: { totalThb: number; activeMembers: number };
  card: FeatureCard;
};

export type ChatData = { topics: TopicCard; questions: QuestionCard };

export const loadChat = (range: BdashRange, filter: QuestionFilter, opts?: Omit<NonNullable<Parameters<typeof cached>[3]>, "key">) =>
  cached<ChatData>(
    "chat",
    range,
    async (q) => {
      const prev = previousRange(range);
      const topics = shapeTopicCard(
        range,
        await queryTopics(q("topics"), range.from, range.to),
        await queryChatTotals(q("chat_totals"), range.from, range.to),
        await queryTopicBuckets(q("topic_buckets"), range),
        await queryTimeframes(q("timeframes"), range.from, range.to),
        prev ? await queryTopics(q("topics_previous"), prev.from, prev.to) : null,
      );
      const subjects = consentSubjects(await queryConsenters(q("consenters")));
      const questions = subjects.length
        ? shapeQuestionCard(
            subjects.length,
            await queryQuestionCount(q("question_count"), subjects, range.from, range.to, filter),
            await queryQuestions(q("questions"), subjects, range.from, range.to, filter),
            await queryQuestionTopics(q("question_topics"), subjects, range.from, range.to, filter.q),
            filter,
          )
        : shapeQuestionCard(0, { questions: 0, people: 0 }, [], [], filter);
      return { topics, questions };
    },
    { ...opts, key: JSON.stringify(filter) },
  );

export const loadStay = (range: BdashRange, opts?: Parameters<typeof cached>[3]) =>
  cached<StayData>("stay", range, async (q) => ({ cohorts: shapeCohorts(await queryCohorts(q("cohorts"), range.to), range.to) }), opts);

export const loadMoney = (range: BdashRange, opts?: Parameters<typeof cached>[3]) =>
  cached<MoneyData>(
    "money",
    range,
    async (q) => {
      const payments = byMethod(shapePayments(await queryPayments(q("payments"), range.from, range.to)));
      const { summary, payers } = shapePayers(await queryPayers(q("payers"), range.from, range.to));
      return { payments, payerSummary: summary, payers };
    },
    opts,
  );

export const loadFeatures = (range: BdashRange, opts?: Parameters<typeof cached>[3]) =>
  cached<FeaturesData>(
    "features",
    range,
    async (q) => {
      const ai = await queryAiBuckets(q("ai_buckets"), range);
      const people = await queryPeople(q("people_buckets"), range);
      const totals = await queryPeopleTotals(q("people_totals"), range);
      const activeMembers = await queryActiveMembers(q("active_members"), range.from, range.to);
      const qi = await queryQiDays(q("qi_days"), range.from, range.to);
      const qiBalance = await queryQiBalance(q("qi_balance"));
      return { card: shapeFeatureCard(range, ai, people, totals), activeMembers, qiDays: fillQiDays(qi, range.to, range.days), qiBalance };
    },
    opts,
  );

export const loadOverview = (range: BdashRange, opts?: Parameters<typeof cached>[3]) =>
  cached<OverviewData>(
    "overview",
    range,
    async (q) => {
      const cohorts = shapeCohorts(await queryCohorts(q("cohorts"), range.to), range.to);
      const payments = byMethod(shapePayments(await queryPayments(q("payments"), range.from, range.to)));
      const activeMembers = await queryActiveMembers(q("active_members"), range.from, range.to);
      const aiBuckets = await queryAiBuckets(q("ai_buckets"), range);
      const totals = await queryPeopleTotals(q("people_totals"), range);
      const card = shapeFeatureCard(range, aiBuckets, [], totals);
      return { cohorts, payments, ai: { totalThb: card.totalThb, activeMembers }, card };
    },
    opts,
  );
