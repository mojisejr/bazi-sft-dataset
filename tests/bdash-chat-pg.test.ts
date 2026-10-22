/**
 * bdash แชตถามอะไร against a real Postgres (mumate-bdash-v2-001 slice 4). BDASH_TEST_DATABASE_URL must name a
 * disposable database: this file creates and fills its own tables there. APP_DATABASE_URL is never used.
 * Proves: topic counts equal a direct count; the question card shows only questions asked after the member accepted
 * the current ai_training version; filters work; no member id or subject reaches the page data.
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { AI_TRAINING_VERSION, subjectFor } from "@/lib/bazi/ai-question-log";
import { clearBdashCache, dbRunner, loadChat } from "@/lib/bdash/live";
import { parseRange } from "@/lib/bdash/range";

const url = process.env.BDASH_TEST_DATABASE_URL;
const required = process.env.BDASH_REQUIRE_DB === "1";
if (required && !url) throw new Error("BDASH_TEST_DATABASE_URL is required for test:bdash-db");

const range = parseRange({ from: "2026-10-23", to: "2026-10-29" }, "2026-10-29");
const quiet = () => {};
const run = () => dbRunner({ url, log: quiet });
const at = (bkk: string) => `${bkk}+07:00`;

describe.skipIf(!url)("bdash chat reads on Postgres", () => {
  const db = url ? postgres(url, { ssl: "require", max: 1, onnotice: () => {} }) : null!;

  beforeAll(async () => {
    await db.unsafe(`
      DROP TABLE IF EXISTS mate_ai_chat_meta, v2_payment, bazi_consent, ai_question_log;
      CREATE TABLE mate_ai_chat_meta (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), anon_id text NOT NULL, persona text, topic_id text, timeframe text, created_at timestamptz NOT NULL);
      CREATE TABLE v2_payment (user_id text NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL);
      CREATE TABLE bazi_consent (anon_id text NOT NULL, kind text NOT NULL, version text NOT NULL, accepted boolean NOT NULL, created_at timestamptz NOT NULL);
      CREATE TABLE ai_question_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject text NOT NULL, question text NOT NULL, source text NOT NULL DEFAULT 'chat',
        persona text, topic_id text, label text, created_at timestamptz NOT NULL);`);

    const meta = [
      // PAID-1 paid on 10-01: career x3, love x1 · FREE-2: career x2, off_topic x1 · FREE-3 only before and after the range
      ["PAID-1", "career_potential", "this_year", "2026-10-23 09:00"],
      ["PAID-1", "career_potential", "today", "2026-10-24 00:30"],
      ["PAID-1", "career_potential", "this_year", "2026-10-29 23:59"],
      ["PAID-1", "love_partner", "tomorrow", "2026-10-25 12:00"],
      ["FREE-2", "career_potential", "next_year", "2026-10-23 00:00"],
      ["FREE-2", "career_potential", "none", "2026-10-26 10:00"],
      ["FREE-2", "off_topic", "none", "2026-10-26 11:00"],
      ["FREE-3", "health", "today", "2026-10-22 23:59"],
      ["FREE-3", "health", "today", "2026-10-30 00:00"],
    ];
    for (const [anon, topic, tf, when] of meta) {
      await db`INSERT INTO mate_ai_chat_meta (anon_id, topic_id, timeframe, created_at) VALUES (${anon}, ${topic}, ${tf}, ${at(when)})`;
    }
    await db`INSERT INTO v2_payment VALUES ('PAID-1', 'APPROVED', ${at("2026-10-01 10:00")}), ('FREE-2', 'EXPIRED', ${at("2026-10-01 10:00")})`;

    const consent = [
      ["OLD-A", "2026-10", true, "2026-10-22 10:00"], // accepted the old wording only
      ["RE-B", "2026-10", true, "2026-10-22 10:00"],
      ["RE-B", AI_TRAINING_VERSION, true, "2026-10-24 12:00"], // re-accepted: only questions after this count
      ["GONE-C", AI_TRAINING_VERSION, true, "2026-10-23 08:00"],
      ["GONE-C", AI_TRAINING_VERSION, false, "2026-10-25 08:00"], // withdrew
      ["NEW-D", AI_TRAINING_VERSION, true, "2026-10-23 08:00"],
    ] as const;
    for (const [anon, version, accepted, when] of consent) {
      await db`INSERT INTO bazi_consent VALUES (${anon}, 'ai_training', ${version}, ${accepted}, ${at(when)})`;
    }

    const questions = [
      ["OLD-A", "old wording question", "career_potential", "2026-10-24 09:00"],
      ["RE-B", "asked before re-consent", "career_potential", "2026-10-24 11:59"],
      ["RE-B", "งานปีหน้าจะดีไหม", "career_potential", "2026-10-24 12:30"],
      ["GONE-C", "withdrawn member question", "health", "2026-10-24 09:00"],
      ["NEW-D", "แฟนจะกลับมาไหม 100%", "love_partner", "2026-10-25 20:00"],
      ["NEW-D", "สุขภาพแม่", null, "2026-10-26 08:00"],
      ["NEW-D", "outside the range", "health", "2026-10-30 08:00"],
    ] as const;
    for (const [anon, q, topic, when] of questions) {
      await db`INSERT INTO ai_question_log (subject, question, topic_id, created_at) VALUES (${subjectFor(anon)}, ${q}, ${topic}, ${at(when)})`;
    }
  });

  afterAll(async () => {
    await db?.end();
  });

  test("topic counts equal a direct count, split by paying and free members", async () => {
    clearBdashCache();
    const { value } = await loadChat(range, { topic: null, q: null }, { run: run() });
    const direct = await db`
      SELECT topic_id AS topic, count(*)::int AS n FROM mate_ai_chat_meta
       WHERE created_at >= '2026-10-23 00:00+07' AND created_at < '2026-10-30 00:00+07' GROUP BY 1`;
    const shown = Object.fromEntries(value.topics.rows.map((r) => [r.topic, r.questions]));
    expect(shown).toEqual(Object.fromEntries(direct.map((r) => [r.topic, r.n])));
    expect(value.topics).toMatchObject({ questions: 7, people: 2, paidPeople: 1, paidQuestions: 4, compared: false });
    expect(value.topics.rows.find((r) => r.topic === "career_potential")).toMatchObject({ questions: 5, people: 2, paidQuestions: 3, freeQuestions: 2 });
    // off_topic is left out of the timeframe split: 6 reading questions
    expect(Object.fromEntries(value.topics.timeframes.map((g) => [g.key, g.questions]))).toEqual({ near: 2, month: 0, year: 3, long: 0, none: 1 });
  });

  test("the question card shows only questions asked after accepting the current version, newest first", async () => {
    clearBdashCache();
    const { value } = await loadChat(range, { topic: null, q: null }, { run: run() });
    const q = value.questions;
    expect(q.consenters).toBe(2); // RE-B and NEW-D
    expect(q.rows.map((r) => r.question)).toEqual(["สุขภาพแม่", "แฟนจะกลับมาไหม 100%", "งานปีหน้าจะดีไหม"]);
    expect(q).toMatchObject({ questions: 3, people: 2, more: false });
    expect(q.rows[0]).toMatchObject({ topic: "unknown", label: "ไม่ระบุ", at: "2026-10-26 08:00" });
    const json = JSON.stringify(value);
    for (const id of ["OLD-A", "RE-B", "GONE-C", "NEW-D", "PAID-1", "FREE-2"]) expect(json).not.toContain(id);
    for (const id of ["RE-B", "NEW-D"]) expect(json).not.toContain(subjectFor(id));
  });

  test("topic and word filters narrow the list; a % in the search is a plain character", async () => {
    clearBdashCache();
    const love = await loadChat(range, { topic: "love_partner", q: null }, { run: run() });
    expect(love.value.questions.rows.map((r) => r.question)).toEqual(["แฟนจะกลับมาไหม 100%"]);
    expect(love.value.questions.topics.map((t) => t.topic).sort()).toEqual(["career_potential", "love_partner", "unknown"]);
    const word = await loadChat(range, { topic: null, q: "ปีหน้า" }, { run: run() });
    expect(word.value.questions.rows.map((r) => r.question)).toEqual(["งานปีหน้าจะดีไหม"]);
    const pct = await loadChat(range, { topic: null, q: "0%" }, { run: run() });
    expect(pct.value.questions.rows.map((r) => r.question)).toEqual(["แฟนจะกลับมาไหม 100%"]);
    const none = await loadChat(range, { topic: "unknown", q: null }, { run: run() });
    expect(none.value.questions.rows.map((r) => r.question)).toEqual(["สุขภาพแม่"]);
  });
});
