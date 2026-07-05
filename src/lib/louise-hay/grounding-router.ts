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
import { buildAlmanacDay, checkHour, jianchuFor, pillarsForDate } from "@/lib/bazi/almanac/almanac-engine";
import { elementThOfStem, type ElementTh } from "@/lib/bazi/constants/career-finance-table";
import { buildElementInteractionAB, buildFacets } from "@/lib/bazi/pair-matching";
import { drawRandom as drawDivine } from "@/lib/bazi/divine-cards/deck";
import { buildDivineReading } from "@/lib/bazi/divine-cards/reading-engine";
import { drawRandom as drawFortune, TOPICS as FORTUNE_TOPICS } from "@/lib/bazi/fortune-sage/deck";
import { readHoneycomb } from "@/lib/bazi/honeycomb/pyramid";
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

/** ข้อความในบทสนทนา (ไว้ให้ตัวจัดหมวดเห็นบริบทว่าคำถามล่าสุดถามต่อเรื่องอะไร) */
export type ChatTurn = { role: "user" | "assistant"; content: string };

export type LouiseHayRoute =
  | "chart"
  | "day"
  | "timing"
  | "almanac"
  | "card"
  | "divine"
  | "fortune"
  | "phone"
  | "offscope"
  | "chat";

/** วันที่ผู้ใช้ "ตั้งเตือน" ได้ (ส่งให้ frontend ทำปุ่ม 🔔 → POST /api/alerts) */
export type AlertDay = {
  /** YYYY-MM-DD (Asia/Bangkok) */
  date: string;
  kind: "luck" | "caution" | "custom";
  /** ป้ายปุ่ม เช่น "วันโชคดี 13 ก.ค." */
  label: string;
  /** ข้อความที่จะ push เมื่อถึงวัน (โทนอบอุ่น) */
  message: string;
};

export type LouiseHayGrounding = {
  route: LouiseHayRoute;
  /** ป้ายกำกับศาสตร์ที่ใช้ (โชว์เป็น badge บน UI) */
  sourceLabel: string;
  /** เนื้อหา ground truth ที่ inject เข้า prompt ให้โค้ชเรียบเรียง */
  text: string;
  /** ข้อความชวน (เช่น ให้ผูกดวง) เมื่อ fallback */
  note?: string;
  /** วันที่ตั้งเตือนได้ (ถ้าคำถามให้ผลเป็น "วันเจาะจง") — frontend เอาไปทำปุ่ม 🔔 */
  alertDays?: AlertDay[];
  /** โทเคนที่ใช้ในขั้นจัดหมวดคำถาม (classify) — ไว้คิดต้นทุน */
  classifyInTokens: number;
  classifyOutTokens: number;
};

const TH_MONTH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-07-13" → "13 ก.ค." */
function thaiDateLabel(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${TH_MONTH_ABBR[(m ?? 1) - 1] ?? ""}`;
}

/** เนื้อ grounding ก่อนแนบโทเคน classify (fetcher แต่ละตัวคืนแบบนี้; resolve จะเติม classify tokens ทีเดียว) */
type GroundingCore = Omit<LouiseHayGrounding, "classifyInTokens" | "classifyOutTokens">;

const PREDICT_TOPICS = TOPIC_PATH.filter((t) => t.kind === "predict");
const TOPIC_IDS = PREDICT_TOPICS.map((t) => t.id);
const TOPIC_TITLE = new Map(PREDICT_TOPICS.map((t) => [t.id, t.title]));

const CLASSIFY_MODEL = "gemini-2.5-flash-lite";

// ───────────────────────────── classify (chart / day / card) ─────────────────────────────

type RouteClassification = {
  route: LouiseHayRoute;
  topicId: string | null;
  date: string | null;
  inTokens: number;
  outTokens: number;
};

function todayIsoBangkok(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** อายุจริง ณ วันนี้ (เต็มปี) จากวันเกิด — คืน null ถ้าวันเกิดผิดรูปแบบ/นอกช่วงสมเหตุผล */
export function ageFromBirthDate(birthDate: string, now: Date): number | null {
  const m = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [by, bm, bd] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [ty, tm, td] = todayIsoBangkok(now).split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** ย่อบริบทบทสนทนาก่อนหน้า (ไม่รวมข้อความล่าสุด) ให้ตัวจัดหมวดเข้าใจว่าคำถามกำลังถามต่อเรื่องอะไร */
export function recentContext(history: readonly ChatTurn[] | undefined): string {
  if (!history || history.length <= 1) return "";
  const prior = history.slice(0, -1).slice(-4);
  return prior
    .map((m) => `${m.role === "assistant" ? "โค้ช" : "ผู้ใช้"}: ${m.content.slice(0, 220)}`)
    .join("\n");
}

async function classifyRoute(
  question: string,
  now: Date,
  apiKey?: string,
  history?: readonly ChatTurn[],
  prevRoute?: string,
): Promise<RouteClassification> {
  const today = todayIsoBangkok(now);
  const ctx = recentContext(history);
  const prompt = [
    `วันนี้คือ ${today} (Asia/Bangkok).`,
    "จัดหมวดคำถามล่าสุดของผู้ใช้ให้เลือกศาสตร์ที่เหมาะจะตอบ (อ่านให้ดีว่ามี 'มิติเวลา' หรือเป็นการทำนายสิ่งภายนอกไหม):",
    "- \"chart\" = ถามดวงพื้นฐาน/ศักยภาพตัวเอง แบบ \"ไม่มีมิติเวลา\" เช่น นิสัย บุคลิก การงาน/การเงิน/ความรัก/สุขภาพโดยรวม พรสวรรค์ ผู้อุปถัมภ์ หุ้นส่วน สี/ทิศ องค์เทพ",
    "- \"timing\" = ถามอิง \"จังหวะช่วงกว้าง\" ของตัวเอง (เดือน/ปี/ช่วงชีวิต — ไม่เจาะจงวันเดียว) เช่น 'เดือนนี้/ช่วงนี้/ปีนี้/ตอนนี้ ควรทำอะไร' 'เดือนนี้ทำธุรกิจอะไรดี' 'ช่วงนี้เหมาะเริ่ม/ตัดสินใจไหม' (ใช้วัยจร+เสาเดือนจร เป็นฐาน)",
    "- \"day\" = ถามเจาะจง \"วันใดวันหนึ่ง\" ว่าดวงของเราวันนั้นเป็นยังไง / ควรระวัง-ควรทำอะไรในวันนั้น เช่น 'วันนี้/พรุ่งนี้ดวงเป็นยังไง' 'พรุ่งนี้ควรระวังอะไร' 'วันที่ 6 ก.ค. เป็นวันของเรายังไง' (ใช้ ManVsDay = ดวงเรา×เสาวันนั้น เป็นฐาน — ต้องมีวันเกิด)",
    "- \"almanac\" = ถามฤกษ์/ยามมงคล/วันดีตามปฏิทินโหรา แบบทั่วไป (ไม่อิงดวงเกิด) เช่น 'วันนี้ฤกษ์ดีไหม' 'ยามไหนออกรถดี' 'พรุ่งนี้เหมาะเซ็นสัญญา/ขึ้นบ้านไหม'",
    "- \"offscope\" = ขอ \"ทำนายสิ่งภายนอกที่ดวงตัวเองบอกไม่ได้\" เช่น ผลกีฬา/บอล/มวย ใครชนะ, ผลหวย/ลอตเตอรี่/เลขเด็ด, ผลแข่งขัน, หรือดวง/อนาคตของ 'คนอื่น' ที่ไม่ใช่ผู้ถามเอง",
    "- \"fortune\" = ขอ \"เซียมซี/เสี่ยงเซียมซี\" โดยเฉพาะ",
    "- \"divine\" = ขอ \"ไพ่โหมดเซียน\" โดยเฉพาะ",
    "- \"phone\" = ถามเรื่องเบอร์มือถือ/เลขเบอร์โทร (ดูว่าเบอร์ดีไหม)",
    "- \"card\" = ขอคำแนะนำ/ทางเลือก/กำลังใจ หรือขอ 'จั่วไพ่/ดูไพ่' ทั่วไป ที่ไม่เข้าหมวดอื่น (จั่วไพ่ออราเคิล) — ค่าเริ่มต้น",
    "- \"chat\" = แค่ทักทาย ขอบคุณ ระบายความรู้สึก คุยเล่น ไม่ได้ขอคำทำนาย/คำแนะนำเจาะจง",
    `ถ้า route=chart ให้เลือก topicId ที่ใกล้ที่สุดจาก: ${TOPIC_IDS.join(", ")} (ค่าเริ่มต้น chart_foundation).`,
    "ถ้า route=day / timing / almanac / offscope และระบุวันได้ ให้ date เป็น YYYY-MM-DD (แปลง 'พรุ่งนี้' ฯลฯ เทียบวันนี้) ไม่งั้น null.",
    ctx ? `บริบทบทสนทนาก่อนหน้า (ใช้เข้าใจว่าคำถามล่าสุดกำลังถามต่อเรื่องอะไร):\n${ctx}` : "",
    prevRoute ? `หมวด(ศาสตร์)ของคำตอบก่อนหน้า: ${prevRoute}` : "",
    ctx || prevRoute
      ? "**การคุยต่อเนื่อง (สำคัญมาก)**: อ่านบริบท+หมวดก่อนหน้าให้ดีก่อนตัดสินใจ — " +
        "(ก) ถ้าผู้ใช้แค่ถามต่อ/ตอบโต้เกี่ยวกับ 'คำตอบเดิม' (ขออธิบายเพิ่ม, ถามความหมายไพ่/สิ่งที่เพิ่งบอกไป, เห็นด้วย/แย้ง/สงสัย เช่น 'ใบนี้แปลว่าไง' 'ทำไมล่ะ' 'แล้วไง' 'ไม่เข้าใจ') และ 'ไม่ได้ขอดู/จั่ว/เสี่ยงใหม่' → ตอบ route=chat เพื่อคุยต่อจากคำตอบเดิม **ห้ามจั่วไพ่หรือเปิดศาสตร์ชุดใหม่**. " +
        "(ข) ถ้าผู้ใช้ถามข้อมูลใหม่ที่ยังอยู่ในเรื่องเดิมและต้องเปิดศาสตร์ (เช่น 'วันที่ 11 ไม่ดีหรอ' หลังเพิ่งเลือกวันมงคล) → คงหมวดศาสตร์เดิมพร้อม date/topicId ใหม่ให้สอดคล้อง อย่าสลับไป card เอง"
      : "",
    `คำถามล่าสุด: "${question}"`,
  ]
    .filter((line) => line.length > 0)
    .join("\n");

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
            route: { type: "string", enum: ["chart", "timing", "day", "almanac", "offscope", "card", "divine", "fortune", "phone", "chat"] },
            topicId: { type: "string", nullable: true },
            date: { type: "string", nullable: true },
          },
          required: ["route"],
        },
      },
    }),
  });
  if (!res.ok) {
    return { route: "card", topicId: null, date: null, inTokens: 0, outTokens: 0 };
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const inTokens = data.usageMetadata?.promptTokenCount ?? 0;
  const outTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    const parsed = JSON.parse(raw) as { route: LouiseHayRoute; topicId: string | null; date: string | null };
    const valid: LouiseHayRoute[] = ["chart", "timing", "day", "almanac", "offscope", "card", "divine", "fortune", "phone", "chat"];
    const route: LouiseHayRoute = valid.includes(parsed.route) ? parsed.route : "card";
    const topicId = parsed.topicId && TOPIC_IDS.includes(parsed.topicId) ? parsed.topicId : "chart_foundation";
    const date = typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null;
    return { route, topicId, date, inTokens, outTokens };
  } catch {
    return { route: "card", topicId: null, date: null, inTokens, outTokens };
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

async function groundChart(topicId: string, birth: LouiseHayBirthInput): Promise<GroundingCore | null> {
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
): Promise<GroundingCore | null> {
  const repository = createDbKnowledgeRepository();
  const state = await calculateBaziStateFromRawInput(toRawInput(birth), { repository });
  const text = applyMatchingOverrides(await getMatchingMap());
  const iso = dateIso ?? todayIsoBangkok(now);
  const [y, m, d] = iso.split("-").map(Number);
  const result = buildManVsDay(facetPillarsOf(state), dayPillarOf(state), y, m, d, text);
  const items = result.summaryItems.map((it) => `- ${it.label}: ${it.text}`).join("\n");
  const pct = result.overallPercent ?? 50;
  const kind: AlertDay["kind"] = pct >= 55 ? "luck" : pct <= 45 ? "caution" : "custom";
  return {
    route: "day",
    sourceLabel: `ศาสตร์ปฏิทิน · วันที่ ${iso}`,
    alertDays: [
      {
        date: iso,
        kind,
        label: `เตือนวันที่ ${thaiDateLabel(iso)}`,
        message: `📅 ${thaiDateLabel(iso)} — ${result.summaryHeadline} วันนี้ดูแลใจตัวเองดี ๆ นะคะ 💗`,
      },
    ],
    text: `วันที่ ${iso}\n${result.summaryHeadline}\n${result.summary}\n${items}`,
  };
}

/**
 * เสาเดือนจร — พลังของ "เดือนปฏิทินปัจจุบัน" (月柱จร) ปฏิสัมพันธ์กับดวงเกิด.
 * ใช้ตรรกะจับคู่เดียวกับ ManVsDay แต่ใส่ "เสาเดือนจร" ในช่องคู่แทนเสาวัน → person × เสาเดือนจร.
 */
async function groundMonthTransit(dateIso: string | null, birth: LouiseHayBirthInput, now: Date): Promise<GroundingCore | null> {
  const repository = createDbKnowledgeRepository();
  const state = await calculateBaziStateFromRawInput(toRawInput(birth), { repository });
  const matching = applyMatchingOverrides(await getMatchingMap());
  const iso = dateIso ?? todayIsoBangkok(now);
  const [y, m, d] = iso.split("-").map(Number);
  const { monthPillar } = pillarsForDate(y, m, d);
  const monthLite: DayPillar = { stem: monthPillar.stem, branch: monthPillar.branch };
  // ใส่เสาเดือนจรในช่อง .day (relationship "day" อ่านคู่จาก partner.day) → เทียบดวง × เสาเดือนจร
  const monthAsPartner: ManPillars = { hour: monthLite, day: monthLite, month: monthLite, year: monthLite };
  const facets = buildFacets("day", facetPillarsOf(state), monthAsPartner, matching);
  const rel = buildElementInteractionAB(dayPillarOf(state).stem, monthPillar.stem);

  const facetText = facets
    .filter((f) => f.found)
    .map((f) => {
      const detail = f.lines
        .filter((ln) => ln.text)
        .map((ln) => `${ln.name}: ${ln.text}`)
        .join(" · ");
      const pct = f.percent != null ? ` ${f.percent}%` : "";
      return `- ${f.label} (${f.ourGanzhi}×${f.partnerGanzhi}${pct} ${f.ratingText})${detail ? `: ${detail}` : ""}`;
    })
    .filter((line) => line.length > 6)
    .join("\n");
  if (!facetText) return null;
  return {
    route: "timing",
    sourceLabel: `เสาเดือนจร ${monthPillar.ganzhi}`,
    text: `เสาเดือนจร (เดือน ${iso.slice(0, 7)}): ${monthPillar.ganzhi} — ธาตุ${monthPillar.element}\nดิถีเจ้าชะตา × เสาเดือนจร: ${rel.summaryTh}\n${facetText}`,
  };
}

/**
 * คำถามเชิงเวลา ("เดือนนี้/ช่วงนี้ ควรทำอะไร") — รวม 2 ฐาน:
 *   วัยจร (turning_points / ช่วงชีวิตดี-ร้ายตามอายุ) + เสาเดือนจร (月柱จร × ดวงเกิด)
 * ต้องมีดวงเกิด. คืน null ถ้าดึงไม่ได้ทั้งคู่.
 */
async function groundTiming(
  dateIso: string | null,
  birth: LouiseHayBirthInput,
  now: Date,
): Promise<GroundingCore | null> {
  const [luck, month] = await Promise.all([
    groundChart("turning_points", birth).catch(() => null),
    groundMonthTransit(dateIso, birth, now).catch(() => null),
  ]);
  const parts: string[] = [];
  if (luck) parts.push(`[ช่วงวัยจร — จังหวะชีวิตช่วงนี้ตามอายุ]\n${luck.text}`);
  if (month) parts.push(`[เสาเดือนจร — พลังเดือนนี้กับดวง]\n${month.text}`);
  if (parts.length === 0) return null;
  const age = ageFromBirthDate(birth.birthDate, now);
  const ageLine = age != null ? `อายุปัจจุบันของเจ้าชะตา: ${age} ปี\n\n` : "";
  const focusNote =
    "โฟกัสเฉพาะจังหวะ 'ตอนนี้' กับเดือนนี้ ไม่ต้องไล่เล่าทุกช่วงวัยตั้งแต่เด็ก ตอบให้กระชับได้ใจความ (2-3 ย่อหน้าสั้น ๆ)";
  return {
    route: "timing",
    sourceLabel: "ดวงกับเวลา · วัยจร + เสาเดือนจร",
    text: `${ageLine}คำถามนี้อิงจังหวะเวลา ใช้ "วัยจร + เสาเดือนจร" เป็นฐาน (ดวงพื้นฐานเป็นแค่ฉากหลัง):\n\n${parts.join("\n\n———\n\n")}`,
    note:
      age != null
        ? `เวลาพูดถึงจังหวะชีวิตช่วงนี้ ให้อ้าง "อายุ ${age} ปี" (อายุจริงตอนนี้) ไม่ต้องบอกเป็นช่วงอายุ เช่น 30-34 ปี. ${focusNote}`
        : focusNote,
  };
}

function groundCard(question: string): GroundingCore {
  const drawn = drawRandom(3);
  const reading = buildOracleReading([drawn[0], drawn[1], drawn[2]] as const, question);
  const names = drawn.map((c) => `#${c.no} ${c.name}`).join(", ");
  return {
    route: "card",
    sourceLabel: `ไพ่ออราเคิลเคี้ยงคุง · ${names}`,
    text: `ไพ่ที่จั่วได้: ${names}\n${reading.engineProse}`,
  };
}

/** ไพ่โหมดเซียน (deck แยกจากออราเคิล) */
function groundDivine(question: string): GroundingCore {
  const drawn = drawDivine(3);
  const reading = buildDivineReading([drawn[0], drawn[1], drawn[2]] as const, question);
  const names = drawn.map((c) => `#${c.no} ${c.name}`).join(", ");
  return {
    route: "divine",
    sourceLabel: `ไพ่โหมดเซียน · ${names}`,
    text: `ไพ่ที่จั่วได้: ${names}\n${reading.engineProse}`,
  };
}

/** เซียมซี (เซียนเสี่ยงทาย) — เขย่าได้ 1 ใบ ไม่ต้องผูกดวง */
function groundFortune(): GroundingCore {
  const s = drawFortune();
  const topics = FORTUNE_TOPICS.map((t) => `- ${t.label}: ${s.topics[t.key]}`).join("\n");
  return {
    route: "fortune",
    sourceLabel: `เซียนเสี่ยงทาย · ใบที่ ${s.no} (${s.pillar})`,
    text: `เซียมซีที่เสี่ยงได้: ใบที่ ${s.no} เสา ${s.pillar} (${s.nayin})\nแก่นของใบนี้: ${s.personality}\nองค์เทพประจำใบ: ${s.deity}\nคำทำนายรายด้าน:\n${topics}`,
  };
}

/** วิเคราะห์เบอร์มือถือ (เบอร์รังผึ้ง) — สรุปชั้น 1-6 ของปิรามิด */
function groundPhone(phone: string): GroundingCore | null {
  const reading = readHoneycomb(phone);
  const lines = reading.layers
    .filter((l) => l.layerNo <= 6)
    .map((l) => {
      if (l.pairs.length === 0 && l.digitMeaning) {
        return `ชั้น ${l.layerNo} [${l.digitString}] เลข ${l.digitMeaning.digit}: ${l.digitMeaning.keyword}`;
      }
      const pairText = l.pairs
        .map((pr) => `คู่ ${pr.pair}: ${pr.meaning.feeling || pr.meaning.analysis || "-"}`)
        .join("; ");
      return `ชั้น ${l.layerNo} [${l.digitString}]: ${pairText}`;
    })
    .filter((line) => line.length > 0)
    .join("\n");
  if (!lines) return null;
  return {
    route: "phone",
    sourceLabel: `เบอร์รังผึ้ง · ${reading.normalized}`,
    text: `วิเคราะห์เบอร์ ${phone} (ปิรามิดรังผึ้ง ชั้น 1-6):\n${lines}`,
  };
}

/** ปฏิทินโหรา / ตรวจยาม — ฤกษ์+ยามมงคลของวัน (ทั่วไป ไม่อิงดวงเกิด) */
function groundAlmanac(dateIso: string | null, now: Date): GroundingCore {
  const iso = dateIso ?? todayIsoBangkok(now);
  const [y, m, d] = iso.split("-").map(Number);
  const a = buildAlmanacDay(y, m, d);
  const hours = a.luckyHours.slice(0, 6).map((h) => `${h.range} (${h.god}: ${h.meaning})`).join(", ");
  const colors = a.colors.map((c) => `${c.element}=${c.colors}`).join(", ");
  const parts = [
    `วันที่ ${iso} (เสาวัน ${a.dayPillar.ganzhi})`,
    a.officer ? `ฤกษ์ 12 ตำแหน่ง: ${a.officer}${a.officerDesc ? ` — ${a.officerDesc}` : ""}` : "",
    a.luckyDirection ? `ทิศมงคล: ${a.luckyDirection}` : "",
    colors ? `สีมงคล: ${colors}` : "",
    hours ? `ยามมงคล (黃道): ${hours}` : "",
  ].filter((line) => line.length > 0);
  return { route: "almanac", sourceLabel: `ปฏิทินโหรา · ${iso}`, text: parts.join("\n") };
}

/** อาหาร/รส/สีเสริมพลังตาม "ธาตุประจำวัน" (五行) — ใช้ให้โค้ชฟันธงแนะนำการกิน/แต่งตัวได้เป็นรูปธรรม */
const FOOD_BY_ELEMENT: Record<ElementTh, { taste: string; foods: string; color: string }> = {
  ไม้: { taste: "รสเปรี้ยวสดชื่น", foods: "ผักใบเขียว สลัด ผลไม้รสเปรี้ยว (ส้ม มะนาว กีวี)", color: "เขียว" },
  ไฟ: { taste: "รสขมนิด ๆ/เผ็ดอุ่น", foods: "อาหารสีแดง มะเขือเทศ พริกหวาน กาแฟหรือโกโก้เข้ม", color: "แดง-ส้ม" },
  ดิน: { taste: "รสหวานธรรมชาติ", foods: "ข้าว ธัญพืช ฟักทอง มันหวาน กล้วย ของสีเหลือง", color: "เหลือง-น้ำตาล" },
  ทอง: { taste: "รสเผ็ดฉุนอ่อน ๆ", foods: "อาหารสีขาว ขิง หัวไชเท้า กระเทียม เต้าหู้ขาว", color: "ขาว-ทอง" },
  น้ำ: { taste: "รสเค็มกลมกล่อม", foods: "อาหารทะเล สาหร่าย งาดำ เต้าหู้ ซุปใส ของสีเข้ม", color: "ดำ-น้ำเงิน" },
};

/** เลื่อนวัน ISO (YYYY-MM-DD) ไปข้างหน้า n วัน */
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

/** แปลง "วันนี้/พรุ่งนี้/มะรืน" เป็นวัน ISO (deterministic ไม่ต้องเรียก LLM) — ไม่พบ → null (ใช้วันนี้) */
export function parseRelativeDate(question: string, now: Date): string | null {
  const today = todayIsoBangkok(now);
  if (/มะรืน/.test(question)) return addDaysIso(today, 2);
  if (/พรุ่งนี้/.test(question)) return addDaysIso(today, 1);
  return null;
}

/**
 * คำถาม "การใช้ชีวิตประจำวัน" ที่ควรฟันธงแนะนำเป็นรูปธรรม:
 * กินอะไร / ใส่สีอะไร-แต่งตัว / ออกจากบ้านทิศไหน-ก้าวเท้าไหน / พกอะไร / ทำอะไรเสริมดวงวันนี้.
 */
export function wantsDailyLifestyle(question: string): boolean {
  return (
    /กินอะไร|ทานอะไร|เมนู|อาหาร/.test(question) ||
    /(ใส่|แต่ง|สวม).*(เสื้อ|ผ้า|สี|ชุด)|สีอะไร|สีมงคล|สีเสื้อ/.test(question) ||
    /ก้าวเท้า|ก้าวขา|ออกจากบ้าน|ออกบ้าน|ทิศไหน|ทิศมงคล|หันหน้า/.test(question) ||
    /พก(อะไร|.*มงคล)|เสริมดวงวันนี้/.test(question)
  );
}

/**
 * ใช้ชีวิตวันนี้ให้ปัง — ฤกษ์ยาม + "ธาตุประจำวัน" → อาหาร/รส, สีเสื้อผ้า, ทิศ+ก้าวเท้า, ช่วงเวลาดี.
 * ผูกดวง → เสริม % ความเข้ากับดวงเจ้าตัว. note สั่งโค้ชให้ฟันธงเลือกมาให้ชัด ไม่ตอบกว้าง ๆ.
 */
async function groundDailyLifestyle(
  question: string,
  birth: LouiseHayBirthInput | null,
  dateIso: string | null,
  now: Date,
): Promise<GroundingCore> {
  const iso = dateIso ?? todayIsoBangkok(now);
  const [y, m, d] = iso.split("-").map(Number);
  const a = buildAlmanacDay(y, m, d);
  const el = elementThOfStem(a.dayPillar.stem);
  const food = el ? FOOD_BY_ELEMENT[el] : null;
  const colors = a.colors.map((c) => `${c.element}=${c.colors}`).join(", ");
  const hours = a.luckyHours.slice(0, 4).map((h) => `${h.range} (${h.god})`).join(", ");

  let fitLine = "";
  if (birth) {
    try {
      const repository = createDbKnowledgeRepository();
      const state = await calculateBaziStateFromRawInput(toRawInput(birth), { repository });
      const matching = applyMatchingOverrides(await getMatchingMap());
      const fit = buildManVsDay(facetPillarsOf(state), dayPillarOf(state), y, m, d, matching).overallPercent;
      const mineEl = elementThOfStem(state.fourPillars.day.stem);
      fitLine = `วันนี้เข้ากับดวงคุณ ${fit}%${mineEl ? ` (ธาตุประจำตัวคุณคือธาตุ${mineEl})` : ""}`;
    } catch {
      /* ดึงดวงไม่ได้ก็ข้าม ใช้ฤกษ์วันทั่วไป */
    }
  }

  const parts = [
    `วันที่ ${iso} — เสาวัน ${a.dayPillar.ganzhi} ธาตุประจำวันคือ "ธาตุ${el ?? "-"}"`,
    fitLine,
    food ? `อาหารเสริมพลังวันนี้ (ธาตุ${el}): เน้น${food.taste} เช่น ${food.foods}` : "",
    a.luckyDirection
      ? `ทิศมงคลวันนี้: ${a.luckyDirection} — เริ่มวันดี ๆ ด้วยการก้าวเท้าขวาออกจากบ้านก่อน แล้วมุ่งไปทางทิศนี้`
      : "",
    colors ? `สีเสื้อผ้ามงคล: ${colors}${food ? ` (โทน${food.color}ก็เสริมธาตุวัน)` : ""}` : "",
    a.officer ? `ฤกษ์วัน: ${a.officer}${a.officerDesc ? ` — ${a.officerDesc}` : ""}` : "",
    hours ? `ช่วงเวลาดี (ยามมงคล): ${hours}` : "",
  ].filter((line) => line.length > 0);

  return {
    route: "almanac",
    sourceLabel: `ใช้ชีวิตวันนี้ · ${iso}`,
    text: parts.join("\n"),
    note:
      "คำถามนี้เป็นเรื่องการใช้ชีวิตประจำวัน (กิน/แต่งตัว/สี/ทิศ/ก้าวเท้า/เวลา) — ให้ 'ฟันธงแนะนำเป็นรูปธรรม' ไปเลย: " +
      "เลือกมาให้ชัดว่าควรกินอะไร-รสไหน ใส่สีอะไร ออกจากบ้านทิศไหน-ก้าวเท้าไหน ช่วงเวลาไหนดี อิงจากธาตุวัน+ฤกษ์ยามด้านบน. " +
      "อย่าตอบกว้าง ๆ ให้ผู้ใช้ไปคิดเอง แต่ยังคงน้ำเสียงอบอุ่นและปิดท้ายด้วยคำยืนยัน",
  };
}

/**
 * วันฤกษ์ดีในเดือน — สแกนตั้งแต่วันนี้ถึงสิ้นเดือน.
 * ผูกดวง → จัดอันดับด้วย "ฤกษ์วัน (建除) + ความเข้ากับดวงเกิด (ManVsDay person×วัน)" ผสมกัน (วันดีเฉพาะคน).
 * ไม่ผูกดวง → จัดอันดับด้วยฤกษ์วัน (建除) ทั่วไป. โชว์ activity ให้โค้ชเลือกวันที่ตรงสิ่งที่จะทำ.
 */
async function groundAlmanacMonthPick(question: string, birth: LouiseHayBirthInput | null, now: Date): Promise<GroundingCore> {
  const iso = todayIsoBangkok(now);
  const [y, m, dToday] = iso.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();

  // ผูกดวง → เตรียม state + matching เพื่อคิด "ความเข้ากับดวง" ต่อวัน
  let person: { pillars: ManPillars; dayMaster: DayPillar; matching: ReturnType<typeof applyMatchingOverrides> } | null = null;
  if (birth) {
    try {
      const repository = createDbKnowledgeRepository();
      const state = await calculateBaziStateFromRawInput(toRawInput(birth), { repository });
      person = { pillars: facetPillarsOf(state), dayMaster: dayPillarOf(state), matching: applyMatchingOverrides(await getMatchingMap()) };
    } catch {
      person = null;
    }
  }

  const scored: { dd: number; fit: number | null; combined: number }[] = [];
  for (let dd = dToday; dd <= lastDay; dd += 1) {
    const jScore = jianchuFor(y, m, dd)?.score ?? 0;
    let fit: number | null = null;
    if (person) {
      try {
        fit = buildManVsDay(person.pillars, person.dayMaster, y, m, dd, person.matching).overallPercent;
      } catch {
        fit = null;
      }
    }
    const combined = person && fit != null ? (jScore + fit) / 2 : jScore;
    scored.push({ dd, fit, combined });
  }
  const top = scored
    .sort((a, b) => b.combined - a.combined)
    .slice(0, person ? 6 : 8)
    .sort((a, b) => a.dd - b.dd);
  const lines = top
    .map(({ dd, fit }) => {
      const j = jianchuFor(y, m, dd);
      const a = buildAlmanacDay(y, m, dd);
      const hours = a.luckyHours.slice(0, 3).map((h) => `${h.range}(${h.god})`).join(", ");
      const fitStr = fit != null ? ` · เข้ากับดวงคุณ ${fit}%` : "";
      return `- วันที่ ${dd} (เสาวัน ${a.dayPillar.ganzhi} · ฤกษ์ ${j?.name ?? "-"} = ${j?.meaning ?? ""})${fitStr} → เหมาะ/ห้าม: ${j?.activity || "-"}${hours ? ` · ยามมงคล ${hours}` : ""}`;
    })
    .join("\n");
  const basis = person ? "ผสม ฤกษ์วัน(建除) + ความเข้ากับดวงเกิดของผู้ใช้" : "ฤกษ์วัน(建除) ทั่วไป (ผู้ใช้ยังไม่ผูกดวง)";
  return {
    route: "almanac",
    sourceLabel: person ? `เลือกวันดี (อิงดวง) · ${iso.slice(0, 7)}` : `เลือกวันดี · ${iso.slice(0, 7)}`,
    text:
      `ผู้ใช้ขอเลือกวันฤกษ์ดีในเดือนนี้ (จะทำ: "${question}") — คัดจาก ${basis} ตั้งแต่วันที่ ${dToday} ถึงสิ้นเดือน ${iso.slice(0, 7)}:\n${lines}\n\n` +
      `ให้เลือก 2-3 วันที่ช่อง "เหมาะ/ห้าม" ตรงกับสิ่งที่จะทำ${person ? " และ 'เข้ากับดวง' สูง" : ""} เลี่ยงวันที่ระบุห้าม บอกเหตุผลสั้น ๆ + ยามมงคล อย่าตอบวันเดียว.` +
      (person ? "" : " (ถ้าผูกวันเกิดที่ปุ่ม 🔮 จะเลือกวันที่ตรงกับดวงคุณได้แม่นขึ้น — ชวนอย่างนุ่มนวล)"),
  };
}

/**
 * "เดือนนี้มีโชควันไหน / ต้องระวังวันไหน" — ผสม 4 ชั้นให้ระบุ "วันจริง" ได้:
 *   วัยจร + เสาเดือนจร (บริบทเดือน) + สแกนรายวันทั้งเดือน (ManVsDay ดวง×เสาวัน + ฤกษ์ 建除) + ยามมงคล.
 * คืนทั้ง "วันเด่น/โชคดี" และ "วันควรระวัง" พร้อมเสาวัน/%เข้าดวง/ฤกษ์/ยาม. ต้องผูกดวง.
 */
async function groundMonthDayScan(
  birth: LouiseHayBirthInput,
  now: Date,
): Promise<GroundingCore | null> {
  const iso = todayIsoBangkok(now);
  const [y, m, dToday] = iso.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const repository = createDbKnowledgeRepository();
  const state = await calculateBaziStateFromRawInput(toRawInput(birth), { repository });
  const matching = applyMatchingOverrides(await getMatchingMap());
  const pillars = facetPillarsOf(state);
  const dm = dayPillarOf(state);

  const scored: { dd: number; fit: number | null; combined: number }[] = [];
  for (let dd = dToday; dd <= lastDay; dd += 1) {
    const jScore = jianchuFor(y, m, dd)?.score ?? 0;
    let fit: number | null = null;
    try {
      fit = buildManVsDay(pillars, dm, y, m, dd, matching).overallPercent;
    } catch {
      fit = null;
    }
    const combined = fit != null ? (jScore + fit) / 2 : jScore;
    scored.push({ dd, fit, combined });
  }
  if (scored.length === 0) return null;

  const dayLine = ({ dd, fit }: { dd: number; fit: number | null }) => {
    const j = jianchuFor(y, m, dd);
    const a = buildAlmanacDay(y, m, dd);
    const hours = a.luckyHours.slice(0, 3).map((h) => `${h.range}(${h.god})`).join(", ");
    const fitStr = fit != null ? ` · เข้ากับดวงคุณ ${fit}%` : "";
    return `- วันที่ ${dd} (เสาวัน ${a.dayPillar.ganzhi} · ฤกษ์ ${j?.name ?? "-"} = ${j?.meaning ?? ""})${fitStr}${hours ? ` · ยามมงคล ${hours}` : ""}`;
  };

  const goodDays = [...scored].sort((a, b) => b.combined - a.combined).slice(0, 4).sort((a, b) => a.dd - b.dd);
  const cautionDays = [...scored].sort((a, b) => a.combined - b.combined).slice(0, 3).sort((a, b) => a.dd - b.dd);

  const timing = await groundTiming(null, birth, now).catch(() => null);
  const parts: string[] = [];
  if (timing) parts.push(`[บริบทเดือน — วัยจร + เสาเดือนจร (พลังรวมของเดือน)]\n${timing.text}`);
  parts.push(`[วันเด่น/โชคดีในเดือน ${iso.slice(0, 7)} — สแกนรายวัน: ดวงคุณ×เสาวัน + ฤกษ์]\n${goodDays.map(dayLine).join("\n")}`);
  parts.push(`[วันควรระวัง/พลังอ่อนในเดือน ${iso.slice(0, 7)}]\n${cautionDays.map(dayLine).join("\n")}`);

  const monthPrefix = iso.slice(0, 7);
  const isoOf = (dd: number) => `${monthPrefix}-${String(dd).padStart(2, "0")}`;
  const alertDays: AlertDay[] = [
    ...goodDays.map(({ dd }): AlertDay => {
      const date = isoOf(dd);
      return {
        date,
        kind: "luck",
        label: `วันโชคดี ${thaiDateLabel(date)}`,
        message: `🍀 ${thaiDateLabel(date)} เป็นวันเด่นของคุณนะคะ — พลังหนุนดี เหมาะเริ่มสิ่งที่ตั้งใจไว้ ลองใช้วันนี้ทำสิ่งดี ๆ ให้ตัวเองสักอย่างนะคะ 💗`,
      };
    }),
    ...cautionDays.map(({ dd }): AlertDay => {
      const date = isoOf(dd);
      return {
        date,
        kind: "caution",
        label: `วันควรระวัง ${thaiDateLabel(date)}`,
        message: `🌙 ${thaiDateLabel(date)} พลังของวันค่อนข้างอ่อนสำหรับคุณ ค่อย ๆ ดูแลใจ พักให้พอ ไม่ต้องเร่งรีบนะคะ วันนี้แค่ประคองตัวเองได้ก็เก่งมากแล้ว 💗`,
      };
    }),
  ];

  const age = ageFromBirthDate(birth.birthDate, now);
  const ageLine = age != null ? `อายุปัจจุบันของเจ้าชะตา: ${age} ปี\n\n` : "";
  return {
    route: "timing",
    sourceLabel: "ดวงกับเวลา · วัยจร + เสาเดือนจร + ศาสตร์ปฏิทิน + ฤกษ์ยาม",
    alertDays,
    text: `${ageLine}คำถามนี้ถามหา "วันเจาะจงในเดือน" ตั้งแต่วันที่ ${dToday} ถึงสิ้นเดือน ${iso.slice(0, 7)}:\n\n${parts.join("\n\n———\n\n")}`,
    note:
      "คำถามนี้ถามหา 'วัน' ที่เจาะจง — ต้องระบุ 'เลขวันที่' ชัด ๆ ไม่ตอบแค่พลังรวมของเดือน: " +
      "บอก 'วันโชคดี/วันเด่น' 2-3 วัน (พร้อมยามมงคลของวันนั้น) และ 'วันควรระวัง' 1-2 วัน อิงจากรายการด้านบน " +
      "โยงกับพลังเดือน (วัยจร+เสาเดือนจร) สั้น ๆ เป็นฉากหลัง แล้วห่อด้วยน้ำเสียงอบอุ่น ปิดท้ายด้วยคำยืนยัน",
  };
}

/** ผู้ใช้ขอ "เลือกวัน/หาวันดี" ในช่วงเวลา (ไม่ใช่ถามว่าวันนี้เป็นไง) → สแกนทั้งเดือน */
export function wantsDayPicker(question: string): boolean {
  return /เลือกวัน|วันไหน|วันดี|หาวัน|หาฤกษ์|ฤกษ์.*(เดือน|ขึ้นบ้าน|แต่งงาน|ย้าย|เปิดร้าน|ออกรถ)|วัน.*(เหมาะ|มงคล).*เดือน/.test(question);
}

/** กิจกรรมเจาะจง (ขึ้นบ้าน/แต่งงาน…) — คำถามแบบนี้เป็น "เลือกวันตามกิจกรรม" ใช้ groundAlmanacMonthPick */
const ACTIVITY_KEYWORDS =
  /ขึ้นบ้าน|แต่งงาน|หมั้น|ย้าย|เปิดร้าน|เปิดกิจการ|ออกรถ|เซ็นสัญญา|ลาออก|สมัคร|ผ่าตัด|เดินทาง|ขึ้นศาล|โยกย้าย|บวช/;

/**
 * ถามหา "วันเจาะจงในเดือน" เชิงโชค/ดวง/ระวัง (ไม่ใช่กิจกรรม) เช่น
 * 'เดือนนี้มีโชควันไหน' 'เดือนนี้ต้องระวังวันไหน' → ต้องสแกนรายวันทั้งเดือน + บริบทเดือน (ไม่ใช่แค่พลังรวม).
 */
export function wantsMonthDayScan(question: string): boolean {
  if (ACTIVITY_KEYWORDS.test(question)) return false; // กิจกรรมเจาะจง → เลือกวันตามกิจกรรมแทน
  const hasWindow = /เดือนนี้|ในเดือน|ช่วงนี้|เดือน\s*นี้|เดือนนี/.test(question);
  if (!hasWindow) return false;
  // ถาม "วันไหน" ตรง ๆ
  const asksWhichDay = /วันไหน|วันที่ไหน|วันที่เท่าไหร่|กี่ค่ำ|วันดี|วันมงคล|วันเฮง|วันโชค/.test(question);
  // หรือถามเชิงโชค/ระวังในกรอบเดือน แม้ไม่พูดคำว่า "วันไหน" (เช่น "เดือนนี้ควรระวังอะไร") → สแกนรายวันให้เลย
  const luckOrCaution = /ระวัง|เตือน|โชค|เฮง|ดวงดี|ดวงตก|ดวงร้าย/.test(question);
  return asksWhichDay || luckOrCaution;
}

/** ดึงชั่วโมง (0-23) จากข้อความ เช่น "04:00" / "20.30" — คืน null ถ้าไม่พบ */
export function extractHour(text: string): number | null {
  const m = text.match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  return h >= 0 && h <= 23 ? h : null;
}

/**
 * นอกขอบเขต (บอล/หวย/ทำนายผลภายนอก) — จั่วไพ่ให้ "ฟันธงสนุก" + ถ้ามีวัน/เวลา เสริมฤกษ์ยามของเวลานั้น.
 * note สั่งโค้ชให้ตอบแบบเลือกฝั่งไปเลย (จากไพ่) แต่เตือนชัดว่าเป็นการคาดเดาสนุก.
 */
function groundOffscope(question: string, dateIso: string | null, now: Date): GroundingCore {
  const card = groundCard(question);
  const parts = [`ไพ่เสี่ยงทายที่จั่วได้:\n${card.text}`];
  let timeLabel = "";
  let hasTiming = false;
  if (dateIso) {
    hasTiming = true;
    const [y, m, d] = dateIso.split("-").map(Number);
    const alm = groundAlmanac(dateIso, now);
    const hour = extractHour(question);
    let hourInfo = "";
    if (hour != null) {
      const hq = checkHour(y, m, d, hour);
      timeLabel = ` ${dateIso} ${String(hour).padStart(2, "0")}:00`;
      hourInfo = `\nยาม ${String(hour).padStart(2, "0")}:00 (${hq.range}) เทพยาม ${hq.god}: ${hq.meaning} — ${hq.good ? "ยามดี (黃道)" : "ยามระวัง (黑道)"}`;
    } else {
      timeLabel = ` ${dateIso}`;
    }
    parts.push(`ฤกษ์ยามของ${timeLabel}:\n${alm.text}${hourInfo}`);
  }
  return {
    route: "offscope",
    sourceLabel: `เสี่ยงทายสนุก${hasTiming ? " + ฤกษ์ยาม" : ""}`,
    text: parts.join("\n———\n"),
    note:
      "คำถามนี้เป็นการทำนายผลภายนอก/พนัน — ตอบแบบ 'ฟันธงสนุก ๆ' ได้เลย: จากไพ่ให้ 'เลือกฝั่ง/คาดผล' ไปเลยแบบเด็ดขาด (ไพ่เอียงไปทางไหน ฝั่งไหนได้เปรียบ) ไม่ต้องพูดกลาง ๆ ว่าคาดเดายาก. " +
      "แต่ต้องเตือนสั้น ๆ ชัดเจนว่า 'นี่เป็นการเสี่ยงทายสนุก ๆ ไม่ใช่คำทำนายผลจริง'. " +
      (hasTiming ? "มีฤกษ์ยามของวัน/เวลาแนบมา ให้เสริมว่าเวลานั้นเป็นยามดีหรือยามระวัง ประกอบการเชียร์. " : "") +
      "กระชับ มีสีสัน ไม่บ่ายเบี่ยงยาว ๆ",
  };
}

/** ดึงเบอร์มือถือไทยจากข้อความ (0 + 8-9 หลัก อาจมีขีด/เว้นวรรค) — คืน null ถ้าไม่พบ */
export function extractPhone(text: string): string | null {
  const match = text.match(/0[\d\-\s]{8,13}/);
  if (!match) return null;
  const digits = match[0].replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 10 ? digits : null;
}

/**
 * จัดหมวดด้วย keyword/regex ก่อน (deterministic) — ถ้าเข้าเคสชัดเจน คืน route เลย ไม่ต้องเรียก classify LLM
 * (ประหยัดโทเคน + ตอบไวขึ้น โดยไม่กระทบการเขียนคำตอบ). คืน null ถ้าไม่ชัด → ให้ LLM จัดต่อ.
 * ครอบเฉพาะ route ที่ไม่ต้องให้ LLM แกะ topicId/date: phone / fortune / divine / card / ทักทายล้วน.
 */
export function preClassify(question: string, phone: string | null): RouteClassification | null {
  const q = question.trim();
  const zero = { topicId: null as string | null, date: null as string | null, inTokens: 0, outTokens: 0 };
  if (phone) return { route: "phone", ...zero };
  if (/เซียมซี|เสี่ยงทาย/.test(q)) return { route: "fortune", ...zero };
  if (/ไพ่เซียน|โหมดเซียน/.test(q)) return { route: "divine", ...zero };
  if (/(จั่ว|ขอ|เปิด|ดู|สับ)ไพ่|ออราเคิล/.test(q)) return { route: "card", ...zero };
  // ทักทาย/ขอบคุณ ล้วน ๆ (ข้อความสั้น) — ไม่ใช้ศาสตร์
  if (q.length <= 15 && /^(สวัสดี|หวัดดี|ดีจ้า|ดีค่ะ|ดีครับ|ขอบคุณ|ขอบใจ|hello|hi|hey|thank)/i.test(q)) {
    return { route: "chat", ...zero };
  }
  return null;
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
  history?: readonly ChatTurn[],
  prevRoute?: string,
): Promise<LouiseHayGrounding> {
  const phone = extractPhone(question);

  // เคสการใช้ชีวิตประจำวัน (กิน/แต่งตัว/ทิศ/ก้าวเท้า) → ฤกษ์+ธาตุวัน ฟันธงได้ ข้าม classify LLM
  if (!phone && wantsDailyLifestyle(question)) {
    try {
      const g = await groundDailyLifestyle(question, birth, parseRelativeDate(question, now), now);
      return { ...g, classifyInTokens: 0, classifyOutTokens: 0 };
    } catch {
      /* engine พัง → ตกไปเส้นทางปกติด้านล่าง */
    }
  }

  // pre-router: เคสชัดเจน (เบอร์/เซียมซี/ไพ่/ทักทาย) ข้ามการเรียก classify LLM ไปเลย
  let classification: RouteClassification | null = preClassify(question, phone);
  if (!classification) {
    try {
      classification = await classifyRoute(question, now, apiKey, history, prevRoute);
    } catch {
      classification = { route: "card", topicId: null, date: null, inTokens: 0, outTokens: 0 };
    }
  }

  // แนบโทเคน classify ให้ผลลัพธ์ทุกทาง (คิดต้นทุนครบ; เคส pre-router = 0)
  const withClassify = (core: GroundingCore): LouiseHayGrounding => ({
    ...core,
    classifyInTokens: classification!.inTokens,
    classifyOutTokens: classification!.outTokens,
  });

  // safety net: แปลง "พรุ่งนี้/มะรืน" แบบ deterministic เผื่อ classifier ไม่เติม date ให้ route ที่อิงวัน
  if (!classification.date) {
    const rel = parseRelativeDate(question, now);
    if (rel) classification.date = rel;
  }

  const route: LouiseHayRoute = classification.route;

  // ทักทาย/คุยเล่น — ไม่ต้องใช้ศาสตร์ ตอบจากใจได้เลย
  if (route === "chat") {
    return withClassify({ route: "chat", sourceLabel: "", text: "" });
  }

  try {
    // "เดือนนี้มีโชค/ต้องระวังวันไหน" — ต้องสแกนรายวันทั้งเดือน + บริบทเดือน (ต้องผูกดวง)
    // เช็คก่อนแยก route เพราะ classifier มักจัดไป timing/almanac แต่ทั้งคู่ระบุ "วันจริง" ไม่ได้
    if (birth && wantsMonthDayScan(question)) {
      const scan = await groundMonthDayScan(birth, now);
      if (scan) return withClassify(scan);
    }

    // ── ศาสตร์ที่ไม่ต้องผูกดวง ──
    if (route === "phone") {
      if (phone) {
        const grounded = groundPhone(phone);
        if (grounded) return withClassify(grounded);
      }
      return withClassify({
        ...groundCard(question),
        note: "อยากให้ดูเบอร์มือถือ พิมพ์เบอร์ (เช่น 0891234567) มาได้เลยนะคะ เดี๋ยวเราวิเคราะห์ให้",
      });
    }
    if (route === "fortune") return withClassify(groundFortune());
    if (route === "divine") return withClassify(groundDivine(question));
    if (route === "almanac") {
      // ขอ "เลือกวัน/หาวันดี" → สแกนทั้งเดือน (อิงดวงถ้าผูก); ถามว่าวันนี้/วันเดียวเป็นไง → ตอบวันเดียว
      if (wantsDayPicker(question)) {
        return withClassify(await groundAlmanacMonthPick(question, birth, now));
      }
      return withClassify(groundAlmanac(classification.date, now));
    }

    // นอกขอบเขต (บอล/หวย/ทำนายคนอื่น) — จั่วไพ่ "ฟันธงสนุก" + ถ้ามีวัน/เวลา เสริมฤกษ์ยาม
    if (route === "offscope") {
      return withClassify(groundOffscope(question, classification.date, now));
    }

    // ── ศาสตร์ที่ต้องผูกดวง ──
    if (route === "timing") {
      if (!birth) {
        return withClassify({ ...groundCard(question), note: "คำถามนี้ต้องดูวัยจร+จรของดวงเกิด ถ้าผูกวันเกิดที่ปุ่ม 🔮 จะตอบได้ตรงจังหวะชีวิตช่วงนี้ของคุณเลยนะคะ" });
      }
      const grounded = await groundTiming(classification.date, birth, now);
      if (grounded) return withClassify(grounded);
    } else if (route === "chart") {
      if (!birth) {
        return withClassify({ ...groundCard(question), note: "ถ้าอยากให้อ่านจากดวงเกิดจริง ลองผูกวันเกิดที่ปุ่ม 🔮 นะคะ" });
      }
      const grounded = await groundChart(classification.topicId ?? "chart_foundation", birth);
      if (grounded) return withClassify(grounded);
    } else if (route === "day") {
      if (!birth) {
        return withClassify({ ...groundCard(question), note: "ถ้าอยากดูดวงกับวันจริง ๆ ลองผูกวันเกิดที่ปุ่ม 🔮 นะคะ" });
      }
      const grounded = await groundDay(classification.date, birth, now);
      if (grounded) return withClassify(grounded);
    }
  } catch {
    // engine ล้ม → ตกไปจั่วไพ่
  }

  // ไม่ได้ผูกดวง → จั่วไพ่ตอบได้ แต่ชวนกรอกวันเกิดอย่างนุ่มนวล เพื่อให้อ่านได้แม่นและตรงกับเจ้าตัวมากขึ้น
  const card = groundCard(question);
  if (!birth) {
    return withClassify({
      ...card,
      note: "ผู้ใช้ยังไม่ได้กรอกวันเกิด — ให้ตอบคำถามให้เต็มที่ก่อน แล้วค่อยชวนแบบอบอุ่นสั้น ๆ ว่า ถ้ากรอกวัน–เดือน–ปี–เวลาเกิดที่ปุ่ม 🔮 ผูกดวง จะช่วยให้อ่านได้ลึกและตรงกับคุณมากขึ้น",
    });
  }
  return withClassify(card);
}
