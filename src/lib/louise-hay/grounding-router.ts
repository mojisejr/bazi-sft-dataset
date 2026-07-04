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
import { buildAlmanacDay, pillarsForDate } from "@/lib/bazi/almanac/almanac-engine";
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

export type LouiseHayGrounding = {
  route: LouiseHayRoute;
  /** ป้ายกำกับศาสตร์ที่ใช้ (โชว์เป็น badge บน UI) */
  sourceLabel: string;
  /** เนื้อหา ground truth ที่ inject เข้า prompt ให้โค้ชเรียบเรียง */
  text: string;
  /** ข้อความชวน (เช่น ให้ผูกดวง) เมื่อ fallback */
  note?: string;
  /** โทเคนที่ใช้ในขั้นจัดหมวดคำถาม (classify) — ไว้คิดต้นทุน */
  classifyInTokens: number;
  classifyOutTokens: number;
};

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

async function classifyRoute(question: string, now: Date, apiKey?: string): Promise<RouteClassification> {
  const today = todayIsoBangkok(now);
  const prompt = [
    `วันนี้คือ ${today} (Asia/Bangkok).`,
    "จัดหมวดคำถามล่าสุดของผู้ใช้ให้เลือกศาสตร์ที่เหมาะจะตอบ (อ่านให้ดีว่ามี 'มิติเวลา' หรือเป็นการทำนายสิ่งภายนอกไหม):",
    "- \"chart\" = ถามดวงพื้นฐาน/ศักยภาพตัวเอง แบบ \"ไม่มีมิติเวลา\" เช่น นิสัย บุคลิก การงาน/การเงิน/ความรัก/สุขภาพโดยรวม พรสวรรค์ ผู้อุปถัมภ์ หุ้นส่วน สี/ทิศ องค์เทพ",
    "- \"timing\" = ถามอิง \"จังหวะเวลาปัจจุบัน\" ของตัวเอง เช่น 'เดือนนี้/ช่วงนี้/ปีนี้/ตอนนี้ ควรทำอะไร' 'เดือนนี้ทำธุรกิจอะไรดี' 'ช่วงนี้เหมาะเริ่ม/ตัดสินใจไหม' 'วันนี้/พรุ่งนี้ดวงเป็นยังไง' (ใช้วัยจร+จร เป็นฐาน)",
    "- \"almanac\" = ถามฤกษ์/ยามมงคล/วันดีตามปฏิทินโหรา แบบทั่วไป (ไม่อิงดวงเกิด) เช่น 'วันนี้ฤกษ์ดีไหม' 'ยามไหนออกรถดี' 'พรุ่งนี้เหมาะเซ็นสัญญา/ขึ้นบ้านไหม'",
    "- \"offscope\" = ขอ \"ทำนายสิ่งภายนอกที่ดวงตัวเองบอกไม่ได้\" เช่น ผลกีฬา/บอล/มวย ใครชนะ, ผลหวย/ลอตเตอรี่/เลขเด็ด, ผลแข่งขัน, หรือดวง/อนาคตของ 'คนอื่น' ที่ไม่ใช่ผู้ถามเอง",
    "- \"fortune\" = ขอ \"เซียมซี/เสี่ยงเซียมซี\" โดยเฉพาะ",
    "- \"divine\" = ขอ \"ไพ่โหมดเซียน\" โดยเฉพาะ",
    "- \"phone\" = ถามเรื่องเบอร์มือถือ/เลขเบอร์โทร (ดูว่าเบอร์ดีไหม)",
    "- \"card\" = ขอคำแนะนำ/ทางเลือก/กำลังใจ หรือขอ 'จั่วไพ่/ดูไพ่' ทั่วไป ที่ไม่เข้าหมวดอื่น (จั่วไพ่ออราเคิล) — ค่าเริ่มต้น",
    "- \"chat\" = แค่ทักทาย ขอบคุณ ระบายความรู้สึก คุยเล่น ไม่ได้ขอคำทำนาย/คำแนะนำเจาะจง",
    `ถ้า route=chart ให้เลือก topicId ที่ใกล้ที่สุดจาก: ${TOPIC_IDS.join(", ")} (ค่าเริ่มต้น chart_foundation).`,
    "ถ้า route=timing หรือ almanac และระบุวันได้ ให้ date เป็น YYYY-MM-DD (แปลง 'พรุ่งนี้' ฯลฯ เทียบวันนี้) ไม่งั้น null.",
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
            route: { type: "string", enum: ["chart", "timing", "almanac", "offscope", "card", "divine", "fortune", "phone", "chat"] },
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
    const valid: LouiseHayRoute[] = ["chart", "timing", "almanac", "offscope", "card", "divine", "fortune", "phone", "chat"];
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
  return {
    route: "day",
    sourceLabel: `ศาสตร์ปฏิทิน · วันที่ ${iso}`,
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
  return {
    route: "timing",
    sourceLabel: "ดวงกับเวลา · วัยจร + เสาเดือนจร",
    text: `คำถามนี้อิงจังหวะเวลา ใช้ "วัยจร + เสาเดือนจร" เป็นฐาน (ดวงพื้นฐานเป็นแค่ฉากหลัง):\n\n${parts.join("\n\n———\n\n")}`,
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

/** ดึงเบอร์มือถือไทยจากข้อความ (0 + 8-9 หลัก อาจมีขีด/เว้นวรรค) — คืน null ถ้าไม่พบ */
function extractPhone(text: string): string | null {
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
function preClassify(question: string, phone: string | null): RouteClassification | null {
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
): Promise<LouiseHayGrounding> {
  const phone = extractPhone(question);

  // pre-router: เคสชัดเจน (เบอร์/เซียมซี/ไพ่/ทักทาย) ข้ามการเรียก classify LLM ไปเลย
  let classification: RouteClassification | null = preClassify(question, phone);
  if (!classification) {
    try {
      classification = await classifyRoute(question, now, apiKey);
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

  const route: LouiseHayRoute = classification.route;

  // ทักทาย/คุยเล่น — ไม่ต้องใช้ศาสตร์ ตอบจากใจได้เลย
  if (route === "chat") {
    return withClassify({ route: "chat", sourceLabel: "", text: "" });
  }

  try {
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
    if (route === "almanac") return withClassify(groundAlmanac(classification.date, now));

    // นอกขอบเขต (บอล/หวย/ทำนายคนอื่น) — จั่วไพ่แบบสนุก ๆ แต่บอกชัดว่าไม่ใช่คำทำนายจริง
    if (route === "offscope") {
      return withClassify({
        ...groundCard(question),
        note: "คำถามนี้เป็นการทำนายผลภายนอก/ของคนอื่น/การพนัน ซึ่งดวงบอกตรง ๆ ไม่ได้ — ให้จั่วไพ่เล่าเป็น 'ความสนุกเสี่ยงทายเบา ๆ' และต้องพูดชัดสั้น ๆ ว่านี่ไม่ใช่คำทำนายผลจริง (ห้ามฟันธงแพ้/ชนะ/ตัวเลข) แล้วชวนกลับมาโฟกัสที่ตัวเขาเองอย่างอบอุ่น ห้ามบ่ายเบี่ยงยาว ๆ",
      });
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
