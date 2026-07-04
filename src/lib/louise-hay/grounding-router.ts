/**
 * Router เลือก "ศาสตร์" ที่ใช้ตอบ ตามชนิดคำถาม แล้วดึงเนื้อหา ground truth มาจาก engine เดิมของโปรเจกต์:
 *   - chart : ถามเรื่องดวงพื้นฐาน/ชะตาชีวิต   → อ่านดวงใหม่ (NewData) บทที่ตรงหัวข้อ
 *   - day   : ถามเจาะจงเรื่อง "วัน"           → ศาสตร์ปฏิทิน (ดวงกับวัน / man-vs-day)
 *   - card  : นอกเหนือจากนั้น                  → จั่วไพ่ออราเคิลเคี้ยงคุงมาตอบเลย
 *
 * ผลลัพธ์ถูกส่งต่อให้โค้ชฮีลใจเรียบเรียงด้วยน้ำเสียงอบอุ่น (ไม่ทำนายฟันธงดิบ ๆ).
 * chart/day ต้องมีวันเกิด (ผูกดวง) — ถ้าไม่มี จะ fallback ไปจั่วไพ่ พร้อมชวนให้ผูกดวง.
 *
 * server-only.
 */
import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { applyMatchingOverrides } from "@/lib/bazi/matching-overlay";
import { getMatchingMap } from "@/lib/bazi/matching.server";
import { buildManVsDay, type ManPillars } from "@/lib/bazi/manvsday";
import { resolveChapterBoxes } from "@/lib/bazi/chapter-newdata-map";
import { extractChartFacts } from "@/lib/bazi/newdata-lookup";
import { getNewdataMap } from "@/lib/bazi/newdata.server";
import { drawRandom } from "@/lib/bazi/oracle-cards/deck";
import { buildOracleReading } from "@/lib/bazi/oracle-cards/reading-engine";
import type { DayPillar } from "@/lib/bazi/pair-types";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { getGeminiApiKey } from "@/lib/env";

export type LouiseHayBirthInput = {
  birthDate: string;
  birthTime: string;
  gender: string;
  province: string;
};

export type LouiseHayRoute = "chart" | "day" | "card" | "chat";

export type LouiseHayGrounding = {
  route: LouiseHayRoute;
  /** ป้ายกำกับศาสตร์ที่ใช้ (โชว์เป็น badge บน UI) */
  sourceLabel: string;
  /** เนื้อหา ground truth ที่ inject เข้า prompt ให้โค้ชเรียบเรียง */
  text: string;
  /** ข้อความชวน (เช่น ให้ผูกดวง) เมื่อ fallback */
  note?: string;
};

const PREDICT_TOPICS = TOPIC_PATH.filter((t) => t.kind === "predict");
const TOPIC_IDS = PREDICT_TOPICS.map((t) => t.id);
const TOPIC_TITLE = new Map(PREDICT_TOPICS.map((t) => [t.id, t.title]));

const CLASSIFY_MODEL = "gemini-2.5-flash-lite";

// ───────────────────────────── classify (chart / day / card) ─────────────────────────────

type RouteClassification = { route: LouiseHayRoute; topicId: string | null; date: string | null };

function todayIsoBangkok(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

async function classifyRoute(question: string, now: Date, apiKey?: string): Promise<RouteClassification> {
  const today = todayIsoBangkok(now);
  const prompt = [
    `วันนี้คือ ${today} (Asia/Bangkok).`,
    "จัดหมวดคำถามล่าสุดของผู้ใช้ให้เลือกศาสตร์ที่เหมาะจะตอบ:",
    "- \"chart\" = ถามเรื่องดวงพื้นฐาน/ชะตาชีวิตตัวเอง เช่น นิสัย การงาน การเงิน ความรัก ครอบครัว สุขภาพ พรสวรรค์ ผู้อุปถัมภ์ หุ้นส่วน ลูกน้อง การเรียน สี/ทิศมงคล องค์เทพ ช่วงชีวิตดี-ร้าย",
    "- \"day\" = ถามเจาะจงเกี่ยวกับ \"วัน\" เช่น วันนี้/พรุ่งนี้/วันที่ระบุเป็นยังไง ควรทำอะไรวันไหน ฤกษ์ ดวงประจำวัน",
    "- \"card\" = ขอคำแนะนำ/ทางเลือก/กำลังใจกับเรื่องหนึ่ง ๆ ที่ไม่ผูกกับดวงเกิดหรือวันโดยตรง (จะจั่วไพ่มาตอบ)",
    "- \"chat\" = แค่ทักทาย ขอบคุณ ระบายความรู้สึก หรือคุยเล่น ไม่ได้ขอคำทำนาย/คำแนะนำเจาะจง (ไม่ต้องใช้ศาสตร์ใด)",
    `ถ้า route=chart ให้เลือก topicId ที่ใกล้ที่สุดจาก: ${TOPIC_IDS.join(", ")} (ค่าเริ่มต้น chart_foundation).`,
    "ถ้า route=day และระบุวันได้ ให้ date เป็น YYYY-MM-DD (แปลง 'พรุ่งนี้' ฯลฯ เทียบวันนี้) ไม่งั้น null.",
    `คำถามล่าสุด: "${question}"`,
  ].join("\n");

  const key = apiKey?.trim() || getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CLASSIFY_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            route: { type: "string", enum: ["chart", "day", "card", "chat"] },
            topicId: { type: "string", nullable: true },
            date: { type: "string", nullable: true },
          },
          required: ["route"],
        },
      },
    }),
  });
  if (!res.ok) {
    return { route: "card", topicId: null, date: null };
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    const parsed = JSON.parse(raw) as RouteClassification;
    const valid: LouiseHayRoute[] = ["chart", "day", "card", "chat"];
    const route: LouiseHayRoute = valid.includes(parsed.route) ? parsed.route : "card";
    const topicId = parsed.topicId && TOPIC_IDS.includes(parsed.topicId) ? parsed.topicId : "chart_foundation";
    const date = typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null;
    return { route, topicId, date };
  } catch {
    return { route: "card", topicId: null, date: null };
  }
}

// ───────────────────────────── grounding fetchers ─────────────────────────────

function toRawInput(birth: LouiseHayBirthInput) {
  return {
    birthDate: birth.birthDate,
    birthTime: birth.birthTime,
    gender: birth.gender,
    province: birth.province,
    calendarSystem: "solar" as const,
    timezone: "Asia/Bangkok",
  };
}

async function groundChart(topicId: string, birth: LouiseHayBirthInput): Promise<LouiseHayGrounding | null> {
  const repository = createDbKnowledgeRepository();
  const state = await calculateBaziStateFromRawInput(toRawInput(birth), { repository });
  const facts = extractChartFacts(state, birth.gender);
  const map = await getNewdataMap();

  const collect = (id: string) => resolveChapterBoxes(id, facts, map);
  let resolved = collect(topicId);
  let usedTopic = topicId;
  if (!resolved.hasContent && topicId !== "chart_foundation") {
    resolved = collect("chart_foundation");
    usedTopic = "chart_foundation";
  }
  const body = resolved.boxes
    .map((b) => `- ${b.title}: ${b.body}`)
    .filter((line) => line.length > 3)
    .join("\n");
  if (!body) return null;
  const title = TOPIC_TITLE.get(usedTopic) ?? "ดวงพื้นฐาน";
  return {
    route: "chart",
    sourceLabel: `อ่านดวงใหม่ (NewData) · ${title}`,
    text: `หัวข้อ: ${title}\n${body}`,
  };
}

function dayPillarOf(state: Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>): DayPillar {
  return { stem: state.fourPillars.day.stem, branch: state.fourPillars.day.branch };
}

function facetPillarsOf(state: Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>): ManPillars {
  const p = state.fourPillars;
  const lite = (x: { stem: string; branch: string }): DayPillar => ({ stem: x.stem, branch: x.branch });
  return { hour: lite(p.hour), day: lite(p.day), month: lite(p.month), year: lite(p.year) };
}

async function groundDay(
  dateIso: string | null,
  birth: LouiseHayBirthInput,
  now: Date,
): Promise<LouiseHayGrounding | null> {
  const repository = createDbKnowledgeRepository();
  const state = await calculateBaziStateFromRawInput(toRawInput(birth), { repository });
  const text = applyMatchingOverrides(await getMatchingMap());
  const iso = dateIso ?? todayIsoBangkok(now);
  const [y, m, d] = iso.split("-").map(Number);
  const result = buildManVsDay(facetPillarsOf(state), dayPillarOf(state), y, m, d, text);
  const items = result.summaryItems.map((it) => `- ${it.label}: ${it.text}`).join("\n");
  return {
    route: "day",
    sourceLabel: `ศาสตร์ปฏิทิน · วันที่ ${iso}`,
    text: `วันที่ ${iso}\n${result.summaryHeadline}\n${result.summary}\n${items}`,
  };
}

function groundCard(question: string): LouiseHayGrounding {
  const drawn = drawRandom(3);
  const reading = buildOracleReading([drawn[0], drawn[1], drawn[2]] as const, question);
  const names = drawn.map((c) => `#${c.no} ${c.name}`).join(", ");
  return {
    route: "card",
    sourceLabel: `ไพ่ออราเคิลเคี้ยงคุง · ${names}`,
    text: `ไพ่ที่จั่วได้: ${names}\n${reading.engineProse}`,
  };
}

// ───────────────────────────── public entry ─────────────────────────────

/**
 * เลือกศาสตร์ + ดึง ground truth สำหรับคำถามล่าสุด. ไม่มีวันเกิดแต่ถามดวง/วัน → จั่วไพ่แทน
 * พร้อมชวนให้ผูกดวง. ทุกชั้น degrade เป็นการจั่วไพ่ ถ้า engine ใดพัง (แชทตอบได้เสมอ).
 */
export async function resolveLouiseHayGrounding(
  question: string,
  birth: LouiseHayBirthInput | null,
  now: Date = new Date(),
  apiKey?: string,
): Promise<LouiseHayGrounding> {
  let classification: RouteClassification;
  try {
    classification = await classifyRoute(question, now, apiKey);
  } catch {
    classification = { route: "card", topicId: null, date: null };
  }

  // ทักทาย/คุยเล่น — ไม่ต้องใช้ศาสตร์ ตอบจากใจได้เลย
  if (classification.route === "chat") {
    return { route: "chat", sourceLabel: "", text: "" };
  }

  try {
    if (classification.route === "chart") {
      if (!birth) {
        return { ...groundCard(question), note: "ถ้าอยากให้อ่านจากดวงเกิดจริง ลองผูกวันเกิดที่ปุ่ม 🔮 นะคะ" };
      }
      const grounded = await groundChart(classification.topicId ?? "chart_foundation", birth);
      if (grounded) return grounded;
    } else if (classification.route === "day") {
      if (!birth) {
        return { ...groundCard(question), note: "ถ้าอยากดูดวงกับวันจริง ๆ ลองผูกวันเกิดที่ปุ่ม 🔮 นะคะ" };
      }
      const grounded = await groundDay(classification.date, birth, now);
      if (grounded) return grounded;
    }
  } catch {
    // engine ล้ม → ตกไปจั่วไพ่
  }
  return groundCard(question);
}
