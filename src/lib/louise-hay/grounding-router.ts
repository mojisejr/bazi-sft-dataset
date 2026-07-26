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
import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
import { buildElementInteractionAB, buildFacets } from "@/lib/bazi/pair-matching";
import { drawRandom as drawDivine } from "@/lib/bazi/divine-cards/deck";
import { buildDivineReading } from "@/lib/bazi/divine-cards/reading-engine";
import { drawRandom as drawFortune, TOPICS as FORTUNE_TOPICS } from "@/lib/bazi/fortune-sage/deck";
import { readHoneycomb, readShortNumber } from "@/lib/bazi/honeycomb/pyramid";
import { applyMatchingOverrides } from "@/lib/bazi/matching-overlay";
import { getMatchingMap } from "@/lib/bazi/matching.server";
import { buildManVsDay, type ManPillars } from "@/lib/bazi/manvsday";
import { resolveChapterBoxes } from "@/lib/bazi/chapter-newdata-map";
import { extractChartFacts, favorableElements } from "@/lib/bazi/newdata-lookup";
import {
  COLOR_BY_ELEMENT,
  DEITY_BY_ELEMENT,
  DIRECTION_BY_ELEMENT,
  FENGSHUI_RULES,
  MU_LOCATIONS,
  PLANT_BY_ELEMENT,
  type FengshuiTopic,
  type MuTopic,
} from "@/lib/bazi/constants/mu-fengshui";
import { getNewdataMap } from "@/lib/bazi/newdata.server";
import { drawRandom } from "@/lib/bazi/oracle-cards/deck";
import { buildOracleReading } from "@/lib/bazi/oracle-cards/reading-engine";
import type { DayPillar } from "@/lib/bazi/pair-types";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { buildXiangshaBoard, formatXiangshaBoard } from "@/lib/bazi/xiangsha-verdict";
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
  | "mu"
  | "fengshui"
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
const TH_WEEKDAY = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

/** วันในสัปดาห์ไทยของ ISO (แบบวันล้วน ไม่พึ่ง timezone) เช่น "2026-07-10" → "ศุกร์" */
function thaiWeekday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return TH_WEEKDAY[dow] ?? "";
}

/** "2026-07-10" → "วันศุกร์ที่ 10 ก.ค." — ใส่วันในสัปดาห์เสมอ กันโมเดลเดาวันผิด */
function thaiDateLabel(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `วัน${thaiWeekday(iso)}ที่ ${d} ${TH_MONTH_ABBR[(m ?? 1) - 1] ?? ""}`;
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
    "- \"phone\" = ถามเรื่องเบอร์มือถือ/เลขเบอร์โทร/เลขทะเบียนรถ (ดูว่าเลขดีไหม)",
    "- \"mu\" = สายมู: ถามหาที่ไหว้พระ/ขอพร/บนบาน/แก้ชง/สะเดาะเคราะห์/ทำบุญเสริมดวง หรือถามเครื่องราง-วัตถุมงคล-องค์เทพที่ถูกโฉลก-วอลเปเปอร์มงคล",
    "- \"fengshui\" = ฮวงจุ้ย/การจัดบ้าน-โต๊ะทำงาน: ทิศหัวนอน ทางสามแพร่ง กระเป๋าสตางค์สีมงคล ต้นไม้มงคล การตั้งของในบ้าน/ออฟฟิศ",
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
            route: { type: "string", enum: ["chart", "timing", "day", "almanac", "offscope", "card", "divine", "fortune", "phone", "mu", "fengshui", "chat"] },
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
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  };
  const inTokens = data.usageMetadata?.promptTokenCount ?? 0;
  // รวม thinking tokens (Gemini คิดเป็น output) เผื่อ classify เปิด thinking
  const outTokens =
    (data.usageMetadata?.candidatesTokenCount ?? 0) + (data.usageMetadata?.thoughtsTokenCount ?? 0);
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    const parsed = JSON.parse(raw) as { route: LouiseHayRoute; topicId: string | null; date: string | null };
    const valid: LouiseHayRoute[] = ["chart", "timing", "day", "almanac", "offscope", "card", "divine", "fortune", "phone", "mu", "fengshui", "chat"];
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

function dayPillarOf(state: Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>): DayPillar {
  return { stem: state.fourPillars.day.stem, branch: state.fourPillars.day.branch };
}

function facetPillarsOf(state: Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>): ManPillars {
  const p = state.fourPillars;
  const lite = (x: { stem: string; branch: string }): DayPillar => ({ stem: x.stem, branch: x.branch });
  return { hour: lite(p.hour), day: lite(p.day), month: lite(p.month), year: lite(p.year) };
}

// ─────────────── building blocks (โหลด state ครั้งเดียว แล้วประกอบชั้นศาสตร์) ───────────────

type BaziState = Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>;
type LoadedState = {
  state: BaziState;
  matching: ReturnType<typeof applyMatchingOverrides>;
  facts: ReturnType<typeof extractChartFacts>;
  map: Awaited<ReturnType<typeof getNewdataMap>>;
};

/** โหลด state + matching + facts + map ครั้งเดียว (ใช้ประกอบหลายชั้นโดยไม่ต้อง fetch ซ้ำ) */
async function loadReadingState(birth: LouiseHayBirthInput): Promise<LoadedState> {
  const repository = createDbKnowledgeRepository();
  const state = await calculateBaziStateFromRawInput(toRawInput(birth), { repository });
  const [matchingMap, map] = await Promise.all([getMatchingMap(), getNewdataMap()]);
  return {
    state,
    matching: applyMatchingOverrides(matchingMap),
    facts: extractChartFacts(state, birth.gender),
    map,
  };
}

/** topic ที่ถือเป็น "การงาน/ธุรกิจ" → เติมชั้น "ปีจร" ให้ */
const CAREER_TOPICS = new Set(["career_potential"]);

/** บรรทัด "ดิถี" (หลักวันเกิด + กำลังดวง) — แนบทุกคำตอบเชิงดวง */
function dithiLine(facts: LoadedState["facts"]): string {
  const band = classifyOperatorStrengthScore(facts.strengthScore);
  const el = elementThOfStem(facts.dayMaster);
  // ไม่แนบคะแนนดิบ (strengthScore) — เป็นค่าหลังบ้าน โมเดลเคยเผลอพูดตัวเลขออกไปให้ผู้ใช้เห็น
  return `ดิถี (หลักวันเกิด): ${facts.dayMaster}${el ? ` ธาตุ${el}` : ""} · ${band.displayLabel}`;
}

/**
 * บล็อก "ตารางเซียงแซตามตำแหน่งเสา" — ชั้นที่ซินแสสั่งเพิ่มสำหรับหมวดการงาน
 *
 * ก่อนหน้านี้ router ป้อนแต่ bundle กว้าง ๆ (ดิถี + วัยจร prose + ปีจร facets) โมเดลจึงไม่มีทาง
 * ตอบตามที่ซินแสสั่ง เช่น "ราศีบนหลักเดือนเทียบกับเซียงแซ ดี/กลางๆ/ไม่ดี" เพราะข้อมูลชั้นนี้
 * ไม่เคยถูกส่งเข้า prompt เลย (เอนจินคำนวณได้อยู่แล้ว แต่ไม่มีใครดึงมาใช้)
 *
 * คืน null ถ้าอ่านสภาวะไม่ได้เลย — ให้บล็อกอื่นทำงานต่อได้ ไม่ทำให้คำตอบล้ม
 */
function xiangshaBlock(L: LoadedState, now: Date): string | null {
  const p = L.state.fourPillars;
  const dayMasterStem = p.day.stem;
  const iso = todayIsoBangkok(now);
  const [y, m, d] = iso.split("-").map(Number);
  const transits: { label: string; pillar: { stem: string; branch: string } }[] = [];
  const currentDaYun = L.state.daYun?.find((entry) => entry.isCurrent);
  if (currentDaYun?.stem && currentDaYun?.branch) {
    transits.push({ label: "วัยจร (ช่วงนี้)", pillar: { stem: currentDaYun.stem, branch: currentDaYun.branch } });
  }
  const yearPillar = pillarsForDate(y, m, d).yearPillar;
  if (yearPillar.stem && yearPillar.branch) {
    transits.push({ label: `ปีจร ${y}`, pillar: { stem: yearPillar.stem, branch: yearPillar.branch } });
  }

  const rows = buildXiangshaBoard({
    dayMasterStem,
    pillars: { year: p.year, month: p.month, day: p.day, hour: p.hour },
    transits,
  });
  if (!rows.length) return null;
  // หัวข้อไม่ใส่ก้านเป็นจีน — stripInternalJargon ที่ chat route ลบ CJK ทิ้งก่อนส่งเข้า LLM
  const dmEl = elementThOfStem(dayMasterStem);
  const monthUpper = rows.find((r) => r.position === "หลักเดือน" && r.place === "ราศีบน");
  return [
    `[ชั้นชี้ขาด (ข้อมูลภายใน) — ดิถี${dmEl ? `ธาตุ${dmEl}` : ""}]`,
    formatXiangshaBoard(rows),
    "เกณฑ์เรียงจากดีไปเสีย: ดีมาก > ดี > กลาง > เสีย > เสียมาก",
    // ชี้ตำแหน่งชี้ขาดให้ตรง ๆ — ไม่งั้นโมเดลจะไปหยิบบทวัยจร (ข้อความยาวกว่ามาก) มาเป็นคำตอบแทน
    monthUpper
      ? `ข้อสรุปเรื่องงาน/เปลี่ยนงาน/ก้าวหน้า = "${monthUpper.read.verdict}" ` +
        `ให้ใช้ระดับนี้กำหนด "ทิศทางคำตอบ" แล้วใช้ วัยจร กับ ปีจร เป็นตัวบอกจังหวะเวลาว่าช่วงไหนหนัก-เบา`
      : "ข้อสรุปเรื่องงานให้อิงระดับของหลักเดือน แล้วใช้ วัยจร กับ ปีจร บอกจังหวะเวลา",
    "ถ้าชั้นนี้ขัดกับเนื้อหาบทอ่านดวงด้านล่าง ให้ยึดชั้นนี้เป็นหลัก",
    // persona ห้ามสาดศัพท์เทคนิค/ยกป้ายกำกับใส่เครื่องหมายคำพูด — ย้ำที่ตัวข้อมูลด้วย
    // เพราะทดสอบแล้วพบว่าโมเดลลอกชื่อตำแหน่ง/ระดับออกไปให้ผู้ใช้เห็นตรง ๆ
    'ห้ามเอ่ยชื่อตำแหน่งเสา ชื่อสภาวะ หรือคำว่า "ดีมาก/ดี/กลาง/เสีย/เสียมาก" ให้ผู้ใช้เห็น — ' +
      "ใช้เป็นเกณฑ์ตัดสินภายในแล้วเล่าเป็นภาษาคนธรรมดาอบอุ่นเท่านั้น",
  ].join("\n");
}

/** ดึงเนื้อหาบทหนึ่งจาก NewData (fallback → chart_foundation) */
function chartTopicText(topicId: string, facts: LoadedState["facts"], map: LoadedState["map"]): { title: string; body: string } | null {
  const collect = (id: string) => resolveChapterBoxes(id, facts, map);
  let resolved = collect(topicId);
  let usedTopic = topicId;
  if (!resolved.hasContent && topicId !== "chart_foundation") {
    resolved = collect("chart_foundation");
    usedTopic = "chart_foundation";
  }
  const body = resolved.boxes.map((b) => `- ${b.title}: ${b.body}`).filter((line) => line.length > 3).join("\n");
  if (!body) return null;
  return { title: TOPIC_TITLE.get(usedTopic) ?? "ดวงพื้นฐาน", body };
}

/** ชั้น "จร" (person × เสาจร: เดือน/ปี) — ปฏิสัมพันธ์ดวงเกิดกับเสาจร */
function transitPillarText(label: string, pillar: { stem: string; branch: string; ganzhi: string; element: string }, state: BaziState, matching: LoadedState["matching"]): string | null {
  const lite: DayPillar = { stem: pillar.stem, branch: pillar.branch };
  const asPartner: ManPillars = { hour: lite, day: lite, month: lite, year: lite };
  const facets = buildFacets("day", facetPillarsOf(state), asPartner, matching);
  const rel = buildElementInteractionAB(dayPillarOf(state).stem, pillar.stem);
  const facetText = facets
    .filter((f) => f.found)
    .map((f) => {
      const detail = f.lines.filter((ln) => ln.text).map((ln) => `${ln.name}: ${ln.text}`).join(" · ");
      const pct = f.percent != null ? ` ${f.percent}%` : "";
      return `- ${f.label} (${f.ourGanzhi}×${f.partnerGanzhi}${pct} ${f.ratingText})${detail ? `: ${detail}` : ""}`;
    })
    .filter((line) => line.length > 6)
    .join("\n");
  if (!facetText) return null;
  return `${label}: ${pillar.ganzhi} — ธาตุ${pillar.element}\nดิถีเจ้าชะตา × ${label}: ${rel.summaryTh}\n${facetText}`;
}

/** ManVsDay (ดวงเรา × เสาวันนั้น) เป็นข้อความ + %/headline */
function manVsDayBlock(state: BaziState, matching: LoadedState["matching"], y: number, m: number, d: number): { text: string; headline: string; pct: number } {
  const result = buildManVsDay(facetPillarsOf(state), dayPillarOf(state), y, m, d, matching);
  const items = result.summaryItems.map((it) => `- ${it.label}: ${it.text}`).join("\n");
  return { text: `${result.summaryHeadline}\n${result.summary}\n${items}`, headline: result.summaryHeadline, pct: result.overallPercent ?? 50 };
}

/** ฤกษ์ยามของวัน (ปฏิทินโหรา: ฤกษ์/ทิศ/สี/ยามมงคล) */
function almanacBlock(y: number, m: number, d: number): string {
  const a = buildAlmanacDay(y, m, d);
  const hours = a.luckyHours.slice(0, 4).map((h) => `${h.range}(${h.god})`).join(", ");
  const colors = a.colors.map((c) => `${c.element}=${c.colors}`).join(", ");
  return [
    `เสาวัน ${a.dayPillar.ganzhi}`,
    a.officer ? `ฤกษ์: ${a.officer}${a.officerDesc ? ` — ${a.officerDesc}` : ""}` : "",
    a.luckyDirection ? `ทิศมงคล: ${a.luckyDirection}` : "",
    colors ? `สีมงคล: ${colors}` : "",
    hours ? `ยามมงคล: ${hours}` : "",
  ].filter((line) => line.length > 0).join("\n");
}

/** สแกนรายวันจากรายการวัน (ManVsDay fit + ฤกษ์ 建除 + ยามมงคล) → วันเด่น/วันควรระวัง + alertDays */
function scanDates(
  L: LoadedState,
  dates: { y: number; m: number; d: number; iso: string }[],
): { goodText: string; cautionText: string; alertDays: AlertDay[] } {
  const scored = dates.map((dt) => {
    const jScore = jianchuFor(dt.y, dt.m, dt.d)?.score ?? 0;
    let fit: number | null = null;
    try {
      fit = buildManVsDay(facetPillarsOf(L.state), dayPillarOf(L.state), dt.y, dt.m, dt.d, L.matching).overallPercent;
    } catch {
      fit = null;
    }
    return { ...dt, fit, combined: fit != null ? (jScore + fit) / 2 : jScore };
  });
  const line = (s: (typeof scored)[number]) => {
    const j = jianchuFor(s.y, s.m, s.d);
    const a = buildAlmanacDay(s.y, s.m, s.d);
    const hours = a.luckyHours.slice(0, 3).map((h) => `${h.range}(${h.god})`).join(", ");
    const fitStr = s.fit != null ? ` · เข้ากับดวงคุณ ${s.fit}%` : "";
    return `- ${thaiDateLabel(s.iso)} (เสาวัน ${a.dayPillar.ganzhi} · ฤกษ์ ${j?.name ?? "-"} = ${j?.meaning ?? ""})${fitStr}${hours ? ` · ยามมงคล ${hours}` : ""}`;
  };
  const bySoonIso = (a: { iso: string }, b: { iso: string }) => (a.iso < b.iso ? -1 : 1);
  const good = [...scored].sort((a, b) => b.combined - a.combined).slice(0, 4).sort(bySoonIso);
  const caution = [...scored].sort((a, b) => a.combined - b.combined).slice(0, 3).sort(bySoonIso);
  const alertDays: AlertDay[] = [
    ...good.map((s): AlertDay => ({
      date: s.iso,
      kind: "luck",
      label: `วันโชคดี ${thaiDateLabel(s.iso)}`,
      message: `🍀 ${thaiDateLabel(s.iso)} เป็นวันเด่นของคุณนะคะ — พลังหนุนดี เหมาะเริ่มสิ่งที่ตั้งใจไว้ ลองใช้วันนี้ทำสิ่งดี ๆ ให้ตัวเองสักอย่างนะคะ 💗`,
    })),
    ...caution.map((s): AlertDay => ({
      date: s.iso,
      kind: "caution",
      label: `วันควรระวัง ${thaiDateLabel(s.iso)}`,
      message: `🌙 ${thaiDateLabel(s.iso)} พลังของวันค่อนข้างอ่อนสำหรับคุณ ค่อย ๆ ดูแลใจ พักให้พอ ไม่ต้องเร่งรีบนะคะ วันนี้แค่ประคองตัวเองได้ก็เก่งมากแล้ว 💗`,
    })),
  ];
  return { goodText: good.map(line).join("\n"), cautionText: caution.map(line).join("\n"), alertDays };
}

function ageLineOf(birth: LouiseHayBirthInput, now: Date): string {
  const age = ageFromBirthDate(birth.birthDate, now);
  return age != null ? `อายุปัจจุบันของเจ้าชะตา: ${age} ปี\n\n` : "";
}

// ─────────────── composite grounders (ประกอบชั้นศาสตร์ตามชนิดคำถาม) ───────────────

/** ดวงพื้นฐาน/หัวข้อ + ดิถี + วัยจร (+ ปีจร ถ้าเป็นการงาน/ธุรกิจ) */
async function groundChartFull(topicId: string, birth: LouiseHayBirthInput, now: Date): Promise<GroundingCore | null> {
  const L = await loadReadingState(birth);
  const topic = chartTopicText(topicId, L.facts, L.map);
  if (!topic) return null;
  const withYear = CAREER_TOPICS.has(topicId);
  const parts: string[] = [dithiLine(L.facts)];
  // ชั้นเซียงแซ: เปิดเฉพาะหมวดการงานก่อน (thin slice) — หมวดอื่นยังใช้ของเดิมไม่เปลี่ยนพฤติกรรม
  // ต้องมา "ก่อน" บทอ่านดวง: บท NewData ยาวเป็นหมื่นตัวอักษร ถ้าวางชั้นนี้ไว้ท้าย โมเดลจะหยิบบทมาตอบแทน
  // (พิสูจน์แล้วด้วย harness — วางท้ายแล้วคำตอบไม่เปลี่ยนจากเดิมเลย)
  if (withYear) {
    const board = xiangshaBlock(L, now);
    if (board) parts.push(board);
  }
  parts.push(`[${topic.title}]\n${topic.body}`);
  const turning = chartTopicText("turning_points", L.facts, L.map);
  if (turning) parts.push(`[วัยจร — จังหวะชีวิตตามอายุ]\n${turning.body}`);
  if (withYear) {
    const iso = todayIsoBangkok(now);
    const [y, m, d] = iso.split("-").map(Number);
    const yr = transitPillarText("ปีจร", pillarsForDate(y, m, d).yearPillar, L.state, L.matching);
    if (yr) parts.push(`[ปีจร — พลังปี ${y} กับดวง]\n${yr}`);
  }
  return {
    route: "chart",
    sourceLabel: `อ่านดวงใหม่ · ${topic.title} + ดิถี + วัยจร${withYear ? " + ปีจร" : ""}`,
    text: ageLineOf(birth, now) + parts.join("\n\n———\n\n"),
    note:
      (withYear
        ? "ยึด 'ชั้นชี้ขาด (ข้อมูลภายใน)' เป็นตัวตัดสินก่อน แล้วค่อยใช้บทอ่านดวง/วัยจร/ปีจร ขยายความ ห้ามเอ่ยศัพท์จากชั้นนั้นให้ผู้ใช้เห็น. "
        : "") +
      "ตอบเน้นหัวข้อที่ถามเป็นแกน โยงดิถี/วัยจร" +
      (withYear ? "/ปีจร" : "") +
      " เป็นบริบท ตอบกระชับได้ใจความ",
  };
}

/** จังหวะช่วงกว้าง (ปีนี้/ช่วงนี้) — วัยจร + ปีจร + ดิถี + พื้นดวง/อาชีพ */
async function groundYearTiming(question: string, birth: LouiseHayBirthInput, now: Date): Promise<GroundingCore | null> {
  const L = await loadReadingState(birth);
  const iso = todayIsoBangkok(now);
  const [y, m, d] = iso.split("-").map(Number);
  const topicId = /ธุรกิจ|การงาน|อาชีพ|งาน|ลงทุน|ค้าขาย/.test(question) ? "career_potential" : "chart_foundation";
  const parts: string[] = [dithiLine(L.facts)];
  // ชั้นเซียงแซ: เปิดเฉพาะคำถามการงาน/ธุรกิจก่อน (thin slice) ให้ตรงขอบเขตที่ตกลงไว้
  if (topicId === "career_potential") {
    const board = xiangshaBlock(L, now);
    if (board) parts.push(board);
  }
  const turning = chartTopicText("turning_points", L.facts, L.map);
  if (turning) parts.push(`[วัยจร — จังหวะชีวิตตามอายุ]\n${turning.body}`);
  const yr = transitPillarText("ปีจร", pillarsForDate(y, m, d).yearPillar, L.state, L.matching);
  if (yr) parts.push(`[ปีจร — พลังปี ${y} กับดวง]\n${yr}`);
  const base = chartTopicText(topicId, L.facts, L.map);
  if (base) parts.push(`[${base.title}]\n${base.body}`);
  if (parts.length <= 1) return null;
  return {
    route: "timing",
    sourceLabel: "ดวงกับเวลา · วัยจร + ปีจร + ดิถี",
    text: `${ageLineOf(birth, now)}คำถามอิงจังหวะ "ช่วงนี้/ปีนี้" ใช้ วัยจร + ปีจร + ดิถี เป็นฐาน:\n\n${parts.join("\n\n———\n\n")}`,
    note:
      (topicId === "career_potential"
        ? "ยึด 'ชั้นชี้ขาด (ข้อมูลภายใน)' เป็นตัวตัดสินก่อน แล้วใช้ วัยจร/ปีจร บอกจังหวะเวลา ห้ามเอ่ยศัพท์จากชั้นนั้นให้ผู้ใช้เห็น. "
        : "") + "โฟกัสพลัง 'ช่วงนี้/ปีนี้' (วัยจร+ปีจร) เป็นหลัก ดวงพื้นฐานเป็นฉากหลัง ตอบกระชับ 2-3 ย่อหน้า",
  };
}

/** เดือนนี้/เดือนหน้า — สแกนรายวันทั้งเดือน + วัยจร + เสาเดือนจร + ปีจร + ดิถี + ปฏิทิน + ฤกษ์ยาม */
async function groundMonthScan(birth: LouiseHayBirthInput, now: Date, monthOffset: number): Promise<GroundingCore | null> {
  const L = await loadReadingState(birth);
  const todayIso = todayIsoBangkok(now);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  const base = new Date(Date.UTC(ty, tm - 1 + monthOffset, 1));
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const startDay = monthOffset === 0 ? td : 1;
  const mm = String(m).padStart(2, "0");
  const dates: { y: number; m: number; d: number; iso: string }[] = [];
  for (let dd = startDay; dd <= lastDay; dd += 1) dates.push({ y, m, d: dd, iso: `${y}-${mm}-${String(dd).padStart(2, "0")}` });
  if (dates.length === 0) return null;
  const { goodText, cautionText, alertDays } = scanDates(L, dates);

  const repDay = Math.min(15, lastDay);
  const { monthPillar, yearPillar } = pillarsForDate(y, m, repDay);
  const parts: string[] = [dithiLine(L.facts)];
  const turning = chartTopicText("turning_points", L.facts, L.map);
  if (turning) parts.push(`[วัยจร — จังหวะชีวิตตามอายุ]\n${turning.body}`);
  const monthTr = transitPillarText("เสาเดือนจร", monthPillar, L.state, L.matching);
  if (monthTr) parts.push(`[เสาเดือนจร — พลังเดือน ${y}-${mm} กับดวง]\n${monthTr}`);
  const yearTr = transitPillarText("ปีจร", yearPillar, L.state, L.matching);
  if (yearTr) parts.push(`[ปีจร — พลังปี ${y} กับดวง]\n${yearTr}`);
  parts.push(`[วันเด่น/โชคดีในเดือน ${y}-${mm} — สแกนรายวัน: ดวงคุณ×เสาวัน + ฤกษ์]\n${goodText}`);
  parts.push(`[วันควรระวัง/พลังอ่อนในเดือน ${y}-${mm}]\n${cautionText}`);

  const whichMonth = monthOffset === 0 ? "เดือนนี้" : "เดือนหน้า";
  return {
    route: "timing",
    sourceLabel: "ดวงกับเวลา · วัยจร + เสาเดือนจร + ปีจร + ศาสตร์ปฏิทิน + ฤกษ์ยาม",
    alertDays,
    text: `${ageLineOf(birth, now)}คำถามอิง "${whichMonth}" — ระบุวันจริงในเดือน ${y}-${mm} (วันที่ ${startDay} ถึง ${lastDay}):\n\n${parts.join("\n\n———\n\n")}`,
    note:
      `คำถามอิง '${whichMonth}' — ต้องระบุ 'เลขวันที่' ชัด ๆ: บอก 'วันโชคดี/วันเด่น' 2-3 วัน (พร้อมยามมงคล) และ 'วันควรระวัง' 1-2 วัน อิงจากรายการด้านบน ` +
      "โยงพลังเดือน (เสาเดือนจร) + ปีจร + วัยจร สั้น ๆ เป็นฉากหลัง แล้วห่อด้วยน้ำเสียงอบอุ่น ปิดท้ายด้วยคำยืนยัน",
  };
}

/** วันนี้/พรุ่งนี้/วันที่ระบุ — วัยจร + ดิถี + ManVsDay + ปฏิทิน + ฤกษ์ยาม (วันเดียว) */
async function groundDayFull(dateIso: string | null, birth: LouiseHayBirthInput, now: Date): Promise<GroundingCore | null> {
  const L = await loadReadingState(birth);
  const iso = dateIso ?? todayIsoBangkok(now);
  const [y, m, d] = iso.split("-").map(Number);
  const mvd = manVsDayBlock(L.state, L.matching, y, m, d);
  const parts: string[] = [dithiLine(L.facts)];
  const turning = chartTopicText("turning_points", L.facts, L.map);
  if (turning) parts.push(`[วัยจร — จังหวะชีวิตตามอายุ]\n${turning.body}`);
  parts.push(`[ดวงกับวัน ${iso} — ManVsDay ดวงคุณ×เสาวัน]\n${mvd.text}`);
  parts.push(`[ฤกษ์ยามของวัน ${iso}]\n${almanacBlock(y, m, d)}`);
  const kind: AlertDay["kind"] = mvd.pct >= 55 ? "luck" : mvd.pct <= 45 ? "caution" : "custom";
  return {
    route: "day",
    sourceLabel: `ดวงกับวัน · ${iso} + วัยจร + ดิถี + ฤกษ์ยาม`,
    alertDays: [{ date: iso, kind, label: `เตือนวันที่ ${thaiDateLabel(iso)}`, message: `📅 ${thaiDateLabel(iso)} — ${mvd.headline} วันนี้ดูแลใจตัวเองดี ๆ นะคะ 💗` }],
    text: `${ageLineOf(birth, now)}คำถามเจาะจงวัน${thaiWeekday(iso)}ที่ ${iso}:\n\n${parts.join("\n\n———\n\n")}`,
    note: "ตอบเจาะจง 'วันนี้/วันนั้น' เป็นแกน (ManVsDay + ฤกษ์ยาม) โยงวัยจร/ดิถีเป็นบริบทสั้น ๆ กระชับ",
  };
}

/** อาทิตย์นี้/สัปดาห์นี้ — สแกน 7 วันข้างหน้า (mini month-scan) + วัยจร + ดิถี */
async function groundWeekScan(birth: LouiseHayBirthInput, now: Date): Promise<GroundingCore | null> {
  const L = await loadReadingState(birth);
  const todayIso = todayIsoBangkok(now);
  const dates: { y: number; m: number; d: number; iso: string }[] = [];
  for (let i = 0; i < 7; i += 1) {
    const iso = addDaysIso(todayIso, i);
    const [y, m, d] = iso.split("-").map(Number);
    dates.push({ y, m, d, iso });
  }
  const { goodText, cautionText, alertDays } = scanDates(L, dates);
  const parts: string[] = [dithiLine(L.facts)];
  const turning = chartTopicText("turning_points", L.facts, L.map);
  if (turning) parts.push(`[วัยจร — จังหวะชีวิตตามอายุ]\n${turning.body}`);
  parts.push(`[วันเด่น/โชคดีใน 7 วันนี้ — สแกนรายวัน: ดวงคุณ×เสาวัน + ฤกษ์]\n${goodText}`);
  parts.push(`[วันควรระวัง/พลังอ่อนใน 7 วันนี้]\n${cautionText}`);
  return {
    route: "timing",
    sourceLabel: "ดวงกับสัปดาห์ · วัยจร + ดิถี + ManVsDay + ศาสตร์ปฏิทิน + ฤกษ์ยาม",
    alertDays,
    text: `${ageLineOf(birth, now)}คำถามอิง "อาทิตย์นี้/สัปดาห์นี้" — สแกน 7 วันจาก ${todayIso}:\n\n${parts.join("\n\n———\n\n")}`,
    note: "คำถามอิง 'อาทิตย์นี้' — ระบุ 'วันเด่น' และ 'วันควรระวัง' ใน 7 วันนี้เป็นเลขวันชัด ๆ พร้อมยามมงคล โยงวัยจร/ดิถีสั้น ๆ ปิดท้ายด้วยคำยืนยัน",
  };
}

/** ตรวจ "กรอบเวลา" ของคำถามแบบ deterministic → เลือก composite ที่ถูก */
type TimeWindow = { kind: "day" | "week" | "month" | "year" | "none"; monthOffset: number };
function detectTimeWindow(question: string, classificationDate: string | null): TimeWindow {
  if (/อาทิตย์นี้|สัปดาห์นี้|อาทิตย์หน้า|สัปดาห์หน้า|7\s*วัน/.test(question)) return { kind: "week", monthOffset: 0 };
  if (/เดือนหน้า/.test(question)) return { kind: "month", monthOffset: 1 };
  if (/เดือนนี้|ในเดือน|เดือนนี|ทั้งเดือน|ภายในเดือน/.test(question)) return { kind: "month", monthOffset: 0 };
  if (/ปีนี้|ปีหน้า|ทั้งปี|ครึ่งปี/.test(question)) return { kind: "year", monthOffset: 0 };
  if (/ช่วงนี้|ตอนนี้|ระยะนี้|พักนี้|เร็ว ๆ นี้/.test(question)) return { kind: "year", monthOffset: 0 };
  if (/วันนี้|พรุ่งนี้|มะรืน|เมื่อวาน|วันที่\s*\d/.test(question) || classificationDate) return { kind: "day", monthOffset: 0 };
  return { kind: "none", monthOffset: 0 };
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

/** เลขทะเบียนรถ (หรือเลขสั้นอื่น) — คู่เลข + เลขผลรวม จากตารางเดียวกับเบอร์โทร */
function groundPlate(question: string): GroundingCore | null {
  // จับกลุ่มเลขทุกกลุ่ม แล้วใช้กลุ่มยาวสุด (เลี่ยงเลขหมวดอักษรนำหน้า เช่น "1กข 1234" → ใช้ 1234)
  const groups = question.match(/\d[\d\s-]{0,7}\d|\d/g);
  if (!groups?.length) return null;
  const best = groups
    .map((g) => g.replace(/\D/g, ""))
    .sort((a, b) => b.length - a.length)[0];
  const reading = readShortNumber(best);
  if (!reading || reading.digits.length < 2) return null;
  const pairLines = reading.pairs
    .map((pr) => `คู่ ${pr.pair}: ${pr.meaning.feeling || pr.meaning.analysis || "-"}`)
    .join("\n");
  return {
    route: "phone",
    sourceLabel: `เลขทะเบียนรถ · ${reading.digits}`,
    text: [
      `วิเคราะห์เลขทะเบียน ${reading.digits} (ตารางคู่เลขศาสตร์เบอร์):`,
      pairLines,
      `เลขผลรวม (ยุบเหลือหลักเดียว) = ${reading.sum}: ${reading.sumMeaning.keyword} (${reading.sumMeaning.planet} ธาตุ${reading.sumMeaning.element})`,
    ].join("\n"),
  };
}

/** เดาหัวข้อคำขอสายมูจากคำถาม */
function detectMuTopic(question: string): MuTopic {
  if (/รัก|เนื้อคู่|แฟน|คู่ครอง|เสน่ห์/.test(question)) return "love";
  if (/ค้าขาย|ยอดขาย|โชคลาภ|การเงิน|เงินทอง|ร่ำรวย|หนี้/.test(question)) return "wealth";
  if (/งานใหม่|เลื่อนตำแหน่ง|เลื่อนขั้น|การงาน|สอบราชการ|สอบแข่งขัน|เจ้านาย/.test(question)) return "career";
  if (/แก้ชง|ปีชง|ดวงตก|สะเดาะเคราะห์|ต่อชะตา|เคราะห์|กรรม|เจ้ากรรมนายเวร/.test(question)) return "fixluck";
  if (/สุขภาพ|ป่วย|โรค|ผ่าตัด|แคล้วคลาด/.test(question)) return "health";
  if (/สอบ|เรียน|ทุน|มหาวิทยาลัย|ปัญญา/.test(question)) return "study";
  return "general";
}

/** สายมู: พิกัดวัด/องค์เทพตามคำขอ + ถ้าผูกดวง เสริมองค์เทพ-สี-ทิศถูกโฉลกตามธาตุเสริมดวง (用神) */
async function groundMu(question: string, birth: LouiseHayBirthInput | null): Promise<GroundingCore> {
  const topic = detectMuTopic(question);
  const spots = MU_LOCATIONS[topic];
  const spotLines = spots
    .map((s) => `- ${s.name}${s.deity !== "—" ? ` (${s.deity})` : ""} · ${s.location} — ${s.tip}`)
    .join("\n");
  const sections = [`[พิกัดมู/ขอพร ตามเรื่องที่ขอ]\n${spotLines}`];
  let extraLabel = "";
  if (birth) {
    try {
      const L = await loadReadingState(birth);
      const fav = favorableElements(L.facts);
      if (fav.length) {
        const lines = fav.map(
          (el) =>
            `ธาตุ${el}: องค์เทพถูกโฉลก ${DEITY_BY_ELEMENT[el]} · สีมงคล ${COLOR_BY_ELEMENT[el]} · ทิศมงคล ${DIRECTION_BY_ELEMENT[el]}`,
        );
        sections.unshift(dithiLine(L.facts));
        sections.push(`[ถูกโฉลกตามธาตุเสริมดวง (用神) ของผู้ถาม]\n${lines.join("\n")}`);
        extraLabel = " + ธาตุเสริมดวง + ดิถี";
      }
    } catch {
      /* ดึงดวงไม่ได้ → ใช้พิกัดทั่วไป */
    }
  }
  return {
    route: "mu",
    sourceLabel: `สายมูเสริมดวง${extraLabel}`,
    text: sections.join("\n\n———\n\n"),
    note: birth ? undefined : "ถ้าผูกวันเกิดที่ปุ่ม 🔮 จะบอกองค์เทพ/สี/ทิศที่ถูกโฉลกกับดวงคุณโดยเฉพาะได้เลยนะคะ",
  };
}

/** เดาหัวข้อฮวงจุ้ยจากคำถาม */
function detectFengshuiTopic(question: string): FengshuiTopic {
  if (/หัวนอน|หัวเตียง|เตียง|ห้องนอน/.test(question)) return "bed";
  if (/โต๊ะทำงาน|ออฟฟิศ|ที่นั่งทำงาน/.test(question)) return "desk";
  if (/สามแพร่ง|เสาไฟ|หน้าบ้าน|ประตูบ้าน|กระจกแปดเหลี่ยม|ยันต์/.test(question)) return "entrance";
  if (/กระเป๋าสตางค์|กระเป๋าตังค์|กระเป๋าเงิน/.test(question)) return "wallet";
  if (/ต้นไม้|ปลูก/.test(question)) return "plant";
  return "general";
}

/** ฮวงจุ้ยพื้นฐาน: กฎรายสถานการณ์ + ถ้าผูกดวง เติมทิศ/สี/ต้นไม้ตามธาตุเสริมดวง */
async function groundFengshui(question: string, birth: LouiseHayBirthInput | null): Promise<GroundingCore> {
  const topic = detectFengshuiTopic(question);
  const sections = [`[หลักฮวงจุ้ยเรื่องที่ถาม]\n${FENGSHUI_RULES[topic]}`];
  let extraLabel = "";
  if (birth) {
    try {
      const L = await loadReadingState(birth);
      const fav = favorableElements(L.facts);
      if (fav.length) {
        const lines = fav.map(
          (el) =>
            `ธาตุ${el}: ทิศมงคล ${DIRECTION_BY_ELEMENT[el]} · สีมงคล ${COLOR_BY_ELEMENT[el]} · ต้นไม้มงคล ${PLANT_BY_ELEMENT[el]}`,
        );
        sections.unshift(dithiLine(L.facts));
        sections.push(`[ทิศ/สี/ต้นไม้ ตามธาตุเสริมดวง (用神) ของผู้ถาม]\n${lines.join("\n")}`);
        extraLabel = " + ธาตุเสริมดวง + ดิถี";
      }
    } catch {
      /* ดึงดวงไม่ได้ → ใช้หลักทั่วไป */
    }
  }
  return {
    route: "fengshui",
    sourceLabel: `ฮวงจุ้ยพื้นฐาน${extraLabel}`,
    text: sections.join("\n\n———\n\n"),
    note: birth ? undefined : "ถ้าผูกวันเกิดที่ปุ่ม 🔮 จะระบุทิศและสีที่เสริมดวงคุณโดยเฉพาะได้แม่นขึ้นนะคะ",
  };
}

/** ปฏิทินโหรา / ตรวจยาม — ฤกษ์+ยามมงคลของวัน (ทั่วไป ไม่อิงดวงเกิด) */
/** ฤกษ์/ยามมงคลของวัน (ปฏิทินโหรา) — ผูกดวง → เสริม ManVsDay + ดิถี (person × เสาวันนั้น) */
async function groundAlmanac(dateIso: string | null, now: Date, birth: LouiseHayBirthInput | null): Promise<GroundingCore> {
  const iso = dateIso ?? todayIsoBangkok(now);
  const [y, m, d] = iso.split("-").map(Number);
  const a = buildAlmanacDay(y, m, d);
  const hours = a.luckyHours.slice(0, 6).map((h) => `${h.range} (${h.god}: ${h.meaning})`).join(", ");
  const colors = a.colors.map((c) => `${c.element}=${c.colors}`).join(", ");
  const almText = [
    `วัน${a.weekday}ที่ ${iso} (เสาวัน ${a.dayPillar.ganzhi})`,
    a.officer ? `ฤกษ์ 12 ตำแหน่ง: ${a.officer}${a.officerDesc ? ` — ${a.officerDesc}` : ""}` : "",
    a.luckyDirection ? `ทิศมงคล: ${a.luckyDirection}` : "",
    colors ? `สีมงคล: ${colors}` : "",
    hours ? `ยามมงคล: ${hours}` : "",
  ].filter((line) => line.length > 0).join("\n");

  const sections = [`[ฤกษ์ยามของวัน ${iso}]\n${almText}`];
  let extraLabel = "";
  if (birth) {
    try {
      const L = await loadReadingState(birth);
      const mvd = manVsDayBlock(L.state, L.matching, y, m, d);
      sections.unshift(dithiLine(L.facts));
      sections.push(`[ดวงกับวัน — ManVsDay ดวงคุณ×เสาวันนั้น]\n${mvd.text}`);
      extraLabel = " + ManVsDay + ดิถี";
    } catch {
      /* ดึงดวงไม่ได้ → ใช้ฤกษ์วันทั่วไป */
    }
  }
  return { route: "almanac", sourceLabel: `ปฏิทินโหรา · ${iso}${extraLabel}`, text: sections.join("\n\n———\n\n") };
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

  let dithi = "";
  let mvdBlock = "";
  if (birth) {
    try {
      const L = await loadReadingState(birth);
      dithi = dithiLine(L.facts);
      const mineEl = elementThOfStem(L.state.fourPillars.day.stem);
      const mvd = manVsDayBlock(L.state, L.matching, y, m, d);
      mvdBlock = `[ดวงกับวัน ${iso} — ManVsDay ดวงคุณ×เสาวัน${mineEl ? ` · ธาตุประจำตัวคุณคือธาตุ${mineEl}` : ""}]\n${mvd.text}`;
    } catch {
      /* ดึงดวงไม่ได้ก็ข้าม ใช้ฤกษ์วันทั่วไป */
    }
  }

  const lifestyle = [
    `วัน${a.weekday}ที่ ${iso} — เสาวัน ${a.dayPillar.ganzhi} ธาตุประจำวันคือ "ธาตุ${el ?? "-"}"`,
    food ? `อาหารเสริมพลังวันนี้ (ธาตุ${el}): เน้น${food.taste} เช่น ${food.foods}` : "",
    a.luckyDirection
      ? `ทิศมงคลวันนี้: ${a.luckyDirection} — เริ่มวันดี ๆ ด้วยการก้าวเท้าขวาออกจากบ้านก่อน แล้วมุ่งไปทางทิศนี้`
      : "",
    colors ? `สีเสื้อผ้ามงคล: ${colors}${food ? ` (โทน${food.color}ก็เสริมธาตุวัน)` : ""}` : "",
    a.officer ? `ฤกษ์วัน: ${a.officer}${a.officerDesc ? ` — ${a.officerDesc}` : ""}` : "",
    hours ? `ช่วงเวลาดี (ยามมงคล): ${hours}` : "",
  ].filter((line) => line.length > 0).join("\n");

  const parts = [dithi, `[ใช้ชีวิตวันนี้ — ฟันธงเป็นรูปธรรม]\n${lifestyle}`, mvdBlock].filter((s) => s.length > 0);

  return {
    route: "almanac",
    sourceLabel: `ใช้ชีวิตวันนี้ · ${iso}${birth ? " + ManVsDay + ดิถี" : ""}`,
    text: parts.join("\n\n———\n\n"),
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

  // ผูกดวง → เตรียม state + matching เพื่อคิด "ความเข้ากับดวง" ต่อวัน + บรรทัดดิถี
  let person: { pillars: ManPillars; dayMaster: DayPillar; matching: ReturnType<typeof applyMatchingOverrides> } | null = null;
  let dithi = "";
  if (birth) {
    try {
      const L = await loadReadingState(birth);
      person = { pillars: facetPillarsOf(L.state), dayMaster: dayPillarOf(L.state), matching: L.matching };
      dithi = dithiLine(L.facts);
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
      return `- วัน${a.weekday}ที่ ${dd} (เสาวัน ${a.dayPillar.ganzhi} · ฤกษ์ ${j?.name ?? "-"} = ${j?.meaning ?? ""})${fitStr} → เหมาะ/ห้าม: ${j?.activity || "-"}${hours ? ` · ยามมงคล ${hours}` : ""}`;
    })
    .join("\n");
  const basis = person ? "ผสม ฤกษ์วัน(建除) + ความเข้ากับดวงเกิดของผู้ใช้" : "ฤกษ์วัน(建除) ทั่วไป (ผู้ใช้ยังไม่ผูกดวง)";
  const mm = String(m).padStart(2, "0");
  // วันที่คัดมา → ปุ่ม 🔔 ตั้งเตือนผ่าน LINE (เหมือน month/week scan)
  const alertDays: AlertDay[] = top.map(({ dd }): AlertDay => {
    const dayIso = `${y}-${mm}-${String(dd).padStart(2, "0")}`;
    return {
      date: dayIso,
      kind: "luck",
      label: `วันดี ${thaiDateLabel(dayIso)}`,
      message: `🍀 ${thaiDateLabel(dayIso)} เป็นวันฤกษ์ดีที่คุณเลือกไว้นะคะ — เหมาะกับสิ่งที่ตั้งใจจะทำ ขอให้ราบรื่นสมหวังค่ะ 💗`,
    };
  });
  return {
    route: "almanac",
    alertDays,
    sourceLabel: person ? `เลือกวันดี (อิงดวง) · ${iso.slice(0, 7)}` : `เลือกวันดี · ${iso.slice(0, 7)}`,
    text:
      (dithi ? `${dithi}\n\n` : "") +
      `ผู้ใช้ขอเลือกวันฤกษ์ดีในเดือนนี้ (จะทำ: "${question}") — คัดจาก ${basis} ตั้งแต่วันที่ ${dToday} ถึงสิ้นเดือน ${iso.slice(0, 7)}:\n${lines}\n\n` +
      `ให้เลือก 2-3 วันที่ช่อง "เหมาะ/ห้าม" ตรงกับสิ่งที่จะทำ${person ? " และ 'เข้ากับดวง' สูง" : ""} เลี่ยงวันที่ระบุห้าม บอกเหตุผลสั้น ๆ + ยามมงคล อย่าตอบวันเดียว.` +
      (person ? "" : " (ถ้าผูกวันเกิดที่ปุ่ม 🔮 จะเลือกวันที่ตรงกับดวงคุณได้แม่นขึ้น — ชวนอย่างนุ่มนวล)"),
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
function groundOffscope(question: string, dateIso: string | null): GroundingCore {
  const card = groundCard(question);
  const parts = [`ไพ่เสี่ยงทายที่จั่วได้:\n${card.text}`];
  let timeLabel = "";
  let hasTiming = false;
  if (dateIso) {
    hasTiming = true;
    const [y, m, d] = dateIso.split("-").map(Number);
    const almText = almanacBlock(y, m, d);
    const hour = extractHour(question);
    let hourInfo = "";
    if (hour != null) {
      const hq = checkHour(y, m, d, hour);
      timeLabel = ` ${dateIso} ${String(hour).padStart(2, "0")}:00`;
      hourInfo = `\nยาม ${String(hour).padStart(2, "0")}:00 (${hq.range}) เทพยาม ${hq.god}: ${hq.meaning} — ${hq.good ? "ยามดี (黃道)" : "ยามระวัง (黑道)"}`;
    } else {
      timeLabel = ` ${dateIso}`;
    }
    parts.push(`ฤกษ์ยามของ${timeLabel}:\n${almText}${hourInfo}`);
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
  if (/ทะเบียนรถ|เลขทะเบียน/.test(q) && /\d/.test(q)) return { route: "phone", ...zero };
  if (/ฮวงจุ้ย|ทางสามแพร่ง|กระจกแปดเหลี่ยม/.test(q)) return { route: "fengshui", ...zero };
  if (/แก้ชง|สะเดาะเคราะห์|ไหว้พระ|ขอพรที่|มูที่ไหน|ไปมู|สายมู|บนบาน|เครื่องราง|วัตถุมงคล|ฝากดวง/.test(q)) {
    return { route: "mu", ...zero };
  }
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

  // เคส "ขอเลือกวัน/หาฤกษ์ดี" ชัดเจน → สแกนทั้งเดือน (almanac picker) ข้าม classify LLM.
  // classifier มักเผลอจัดคำขอแบบนี้ไปเป็น card/timing ทำให้ตกไปจั่วไพ่แทนที่จะเลือกวันให้.
  // จำกัดเฉพาะกริยา 'เลือก/หา' ที่ชี้ชัดว่าเป็นการคัดวัน (ไม่แตะ 'เดือนนี้ควรระวังวันไหน' = personal scan).
  if (!phone && /เลือกวัน|หาวัน|หาฤกษ์|ฤกษ์ดี/.test(question)) {
    try {
      const g = await groundAlmanacMonthPick(question, birth, now);
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

  let route: LouiseHayRoute = classification.route;

  // classifier มักเผลอจัดคำถามดวงสั้น ๆ ("วันนี้เป็นยังไง" "ดวงช่วงนี้ดีไหม") เป็นคุยเล่น (chat)
  // → override แบบ deterministic: มีคำอ้างเวลา + คำถามเชิงประเมิน ให้กลับไปอ่านดวงรายวัน/จังหวะชีวิต
  const askHint = /เป็น(อย่าง|ยัง)?ไง|ยังไงบ้าง|ดีไหม|ดีมั้ย|โอเค(ไหม|มั้ย)|ระวังอะไร|เจออะไร/;
  if (route === "chat" && askHint.test(question)) {
    if (/วันนี้|พรุ่งนี้|มะรืน/.test(question)) route = "day";
    else if (/ช่วงนี้|สัปดาห์นี้|อาทิตย์นี้|เดือนนี้|ปีนี้|ดวง/.test(question)) route = "timing";
  }

  // ทักทาย/คุยเล่น — ไม่ต้องใช้ศาสตร์ ตอบจากใจได้เลย
  if (route === "chat") {
    return withClassify({ route: "chat", sourceLabel: "", text: "" });
  }

  try {
    // เลือก composite ตาม "กรอบเวลา" ของคำถาม (deterministic) ก่อนแยก route —
    // เพราะ classifier มักจัด 'เดือน/สัปดาห์' ไปเป็น timing รวม ๆ ที่ระบุ 'วันจริง' ไม่ได้.
    // จำกัดเฉพาะ route อ่านดวงเชิงเวลา (ไม่แตะ เซียมซี/ไพ่/เบอร์/นอกขอบเขต) และไม่ใช่คำถามกิจกรรม.
    if (birth && (route === "chart" || route === "day" || route === "timing") && !ACTIVITY_KEYWORDS.test(question)) {
      const win = detectTimeWindow(question, classification.date);
      if (win.kind === "month") {
        const g = await groundMonthScan(birth, now, win.monthOffset);
        if (g) return withClassify(g);
      } else if (win.kind === "week") {
        const g = await groundWeekScan(birth, now);
        if (g) return withClassify(g);
      }
    }

    // ── ศาสตร์ที่ไม่ต้องผูกดวง ──
    if (route === "mu") return withClassify(await groundMu(question, birth));
    if (route === "fengshui") return withClassify(await groundFengshui(question, birth));
    if (route === "phone") {
      if (phone) {
        const grounded = groundPhone(phone);
        if (grounded) return withClassify(grounded);
      }
      // เลขทะเบียนรถ / เลขสั้น — ใช้ตารางคู่เลขเดียวกับเบอร์
      if (/ทะเบียน/.test(question)) {
        const plate = groundPlate(question);
        if (plate) return withClassify(plate);
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
      return withClassify(await groundAlmanac(classification.date, now, birth));
    }

    // นอกขอบเขต (บอล/หวย/ทำนายคนอื่น) — จั่วไพ่ "ฟันธงสนุก" + ถ้ามีวัน/เวลา เสริมฤกษ์ยาม
    if (route === "offscope") {
      return withClassify(groundOffscope(question, classification.date));
    }

    // ── ศาสตร์ที่ต้องผูกดวง (composite หลายชั้น) ──
    if (route === "timing") {
      if (!birth) {
        return withClassify({ ...groundCard(question), note: "คำถามนี้ต้องดูวัยจร+จรของดวงเกิด ถ้าผูกวันเกิดที่ปุ่ม 🔮 จะตอบได้ตรงจังหวะชีวิตช่วงนี้ของคุณเลยนะคะ" });
      }
      // เดือน/สัปดาห์ ถูกดักไว้ด้านบนแล้ว → ที่เหลือคือ ปีนี้/ช่วงนี้ (year-timing)
      const grounded = await groundYearTiming(question, birth, now);
      if (grounded) return withClassify(grounded);
    } else if (route === "chart") {
      if (!birth) {
        return withClassify({ ...groundCard(question), note: "ถ้าอยากให้อ่านจากดวงเกิดจริง ลองผูกวันเกิดที่ปุ่ม 🔮 นะคะ" });
      }
      const grounded = await groundChartFull(classification.topicId ?? "chart_foundation", birth, now);
      if (grounded) return withClassify(grounded);
    } else if (route === "day") {
      if (!birth) {
        return withClassify({ ...groundCard(question), note: "ถ้าอยากดูดวงกับวันจริง ๆ ลองผูกวันเกิดที่ปุ่ม 🔮 นะคะ" });
      }
      const grounded = await groundDayFull(classification.date, birth, now);
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
