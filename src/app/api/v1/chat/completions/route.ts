import { calculateBaziStateFromRawInput, type BaziStatePayload, BaziEngineAdapterError } from "@/features/bazi-math/bazi-engine-adapter";
import { validateApiToken } from "@/features/open-webui/api-guard";
import { type ChatRunnerSuccess, runChatPipeline } from "@/features/open-webui/chat-runner";
import {
  generateGeminiAssistantReply,
  isHonestPrecisionReframe,
  isOtherChartRequest,
  wantsCardReading,
  wantsDream,
  wantsFengshui,
  wantsHouseNumber,
  wantsPhoneNumber,
  wantsSpecificPersonLove,
  type OpenWebUiGeminiExecutionContext,
  OpenWebUiGeminiError,
} from "@/features/open-webui/gemini-adapter";
import { readHouseNumber, readPhoneNumber, type HouseNumberReading, type PhoneReading } from "@/lib/bazi/phone-number";
import { readDream, type DreamReading } from "@/lib/bazi/dream/engine";
import { readHoneycomb, type HoneycombReading } from "@/lib/bazi/honeycomb/pyramid";
import { drawRandom as drawOracle } from "@/lib/bazi/oracle-cards/deck";
import { buildOracleReading } from "@/lib/bazi/oracle-cards/reading-engine";
import { drawOne as drawSiamsi } from "@/lib/bazi/siamsi-kiangkung/deck";
import { buildSiamsiReading } from "@/lib/bazi/siamsi-kiangkung/reading-engine";
import { drawRandom as drawFengshui } from "@/lib/bazi/fengshui/deck";
import { buildFengshuiReading } from "@/lib/bazi/fengshui/reading-engine";
import { seedFromQuestion } from "@/lib/bazi/seed";
import { detectRelationship, fetchCompatibilityReading } from "@/features/open-webui/compatibility-bridge";
import {
  type OpenWebUiIntentClassification,
  type OpenWebUiTriageResult,
  type TriageRoute,
  type TriageTimeframe,
  OpenWebUiTriageError,
  runOpenWebUiTriage,
  topicIdToDomain,
} from "@/features/open-webui/triage";
import { stringifyOpenWebUiTruthPacket } from "@/features/open-webui/truth-packet";
import { fetchGroundedReading, resolveGroundingTopicId, needsPersonalDayCalendar, isValidTopicId } from "@/features/open-webui/reading-bridge";
import { resolveStaticKnowledge } from "@/features/open-webui/static-knowledge";
import { RawInputSchema, type RawInputValue } from "@/lib/bazi/schema-types";
import { qiGate } from "@/lib/bazi/qi/quota";
import { logLlmUsage } from "@/lib/llm-usage/logger";
import { logMateChatMeta } from "@/lib/bazi/mate-chat-meta";
import {
  createGuardedOpenAiSseStream,
  type GlassBoxTrace,
} from "@/features/open-webui/sse-streamer";

// เลขศาสตร์เบอร์ (เอ็ม 2026-09-22): ดึงเบอร์มือถือไทยจากข้อความ (0xx-xxx-xxxx / 0xxxxxxxxx / 66xxxxxxxxx)
function extractThaiPhone(msg: string): string | null {
  const m = msg.match(/0\s?\d[\s-]?\d{3}[\s-]?\d{4}|0\d{9}|66\d{9}/);
  if (!m) return null;
  const d = m[0].replace(/\D/g, "");
  return d.length >= 10 ? d : null;
}
// ย่อผลถอดเลขศาสตร์ให้ LLM อธิบายต่อ (คู่ปิดท้าย = น้ำหนักมากสุด + คู่เด่น 2 + เลขที่พบบ่อย พร้อมความหมาย งาน/เงิน/รัก)
function formatPhoneReadingForChat(r: PhoneReading): string {
  const lines: string[] = [`เบอร์ (9 หลักนัยสำคัญ): ${r.normalized}`];
  const c = r.closing;
  lines.push(`คู่ปิดท้าย ${c.pair} (น้ำหนักมากสุด): ${c.meaning.analysis || c.meaning.feeling}`);
  if (c.meaning.work) lines.push(`  • การงาน: ${c.meaning.work}`);
  if (c.meaning.money) lines.push(`  • การเงิน: ${c.meaning.money}`);
  if (c.meaning.love) lines.push(`  • ความรัก: ${c.meaning.love}`);
  const others = [...r.pairs].sort((a, b) => b.weight - a.weight).filter((p) => p.position !== c.position).slice(0, 2);
  if (others.length) {
    lines.push("คู่เด่นอื่น:");
    for (const p of others) lines.push(`  • ${p.pair}: ${p.meaning.analysis || p.meaning.feeling}`);
  }
  const freq = r.digitTally.slice(0, 2).filter((d) => d.count > 1).map((d) => `${d.digit} (${d.planet}/${d.element} ${d.keyword}) ×${d.count}`).join(", ");
  if (freq) lines.push(`เลขที่พบบ่อย: ${freq}`);
  return lines.join("\n");
}
// เบอร์ปิรามิด/รังผึ้ง (เอ็ม 2026-09-23: "ทำทั้งสอง — ปิรามิด + คู่เลข"): ย่อผลปิรามิดให้ LLM เสริมกับคู่เลข.
// เน้น "ยอดปิรามิด" (แก่นรวมของทั้งเบอร์) + คู่แก่นชั้นใกล้ยอด (โซนตัวเรา) — ส่วนที่วิชาคู่เลขปกติไม่ได้ให้.
function clip(s: string, n = 110): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}
function formatHoneycombForChat(h: HoneycombReading): string {
  const lines: string[] = ["[ปิรามิดเบอร์ (เบอร์รังผึ้ง) — ภาพรวมทั้งเบอร์ยุบรวมลงหายอด]"];
  const apex = h.layers.find((l) => l.layerNo === 1);
  if (apex?.digitMeaning) {
    const d = apex.digitMeaning;
    lines.push(`ยอดปิรามิด (แก่นรวมของเบอร์นี้): เลข ${d.digit} — ${d.planet}/${d.element} ${d.keyword}`);
  }
  // ชั้นใกล้ยอด (โซน "ตัวเรา") = แก่นนิสัย/พลังของเจ้าของเบอร์ (layerNo 2,3) — เลือกคู่เด่นชั้นละ 1 คู่
  for (const layerNo of [2, 3]) {
    const layer = h.layers.find((l) => l.layerNo === layerNo);
    const p = layer?.pairs[0];
    if (p) lines.push(`ชั้นแก่น (โซนตัวเรา) คู่ ${p.pair}: ${clip(p.meaning.analysis || p.meaning.feeling)}`);
  }
  return lines.join("\n");
}
// บ้านเลขที่/เลขสั้น: ดึงตัวเลข 1–6 หลัก (รองรับ 135/2) + ย่อผลถอด (ผลรวม/เลขเดี่ยว/ความหมายคู่ผลรวม)
function extractShortNumber(msg: string): string | null {
  const m = msg.match(/\d{1,4}(?:[/\-]\d{1,3})?/);
  if (!m) return null;
  const d = m[0].replace(/\D/g, "");
  return d.length >= 1 && d.length <= 6 ? d : null;
}
function formatHouseReadingForChat(r: HouseNumberReading): string {
  const lines: string[] = [`เลขที่: ${r.digits} → ผลรวม ${r.sum}${r.sum !== r.root ? ` (ยุบเหลือ ${r.root})` : ""}`];
  if (r.pairMeaning) {
    lines.push(`ความหมายผลรวม ${r.sum}: ${r.pairMeaning.analysis || r.pairMeaning.feeling}`);
    if (r.pairMeaning.money) lines.push(`  • การเงิน: ${r.pairMeaning.money}`);
    if (r.pairMeaning.love) lines.push(`  • ความรัก: ${r.pairMeaning.love}`);
  }
  lines.push(`เลขเดี่ยว ${r.root}: ${r.rootMeaning.planet}/${r.rootMeaning.element} — ${r.rootMeaning.keyword}`);
  return lines.join("\n");
}

// ทำนายฝัน (เอ็ม 2026-09-23): ย่อผลถอดสัญลักษณ์ในฝัน + เลขนำโชค ให้ LLM เรียบเรียงต่อ (ไม่ใช่ปาจื่อ)
function formatDreamReadingForChat(r: DreamReading): string {
  const lines: string[] = [`ความฝันที่เล่ามา: ${r.query}`];
  if (r.matched.length === 0) {
    lines.push("สัญลักษณ์ในคลัง: ไม่พบสัญลักษณ์ตรง ๆ — ให้ตีความตามหลักตำราฝันไทยทั่วไปอย่างระมัดระวัง (บอกผู้ใช้ว่าเป็นการตีความกว้าง ๆ)");
    return lines.join("\n");
  }
  lines.push(`พบสัญลักษณ์ ${r.matched.length} อย่าง:`);
  for (const m of r.matched) {
    lines.push(`• ${m.symbol}: ${m.general}`);
    if (m.love) lines.push(`   - ความรัก: ${m.love}`);
    if (m.work) lines.push(`   - การงาน: ${m.work}`);
    if (m.money) lines.push(`   - การเงิน: ${m.money}`);
    if (m.warn) lines.push(`   - ข้อควรระวัง: ${m.warn}`);
  }
  if (r.luckyNumbers.length) lines.push(`เลขนำโชคตามตำรา (เพื่อความบันเทิง): ${r.luckyNumbers.join(", ")}`);
  return lines.join("\n");
}

export const runtime = "nodejs";

function createBadRequestResponse(message: string, code = "bad_request") {
  return Response.json(
    {
      error: {
        message,
        type: code,
      },
    },
    { status: 400 },
  );
}

function getForwardedUserId(req: Request) {
  return req.headers.get("x-openwebui-user-id");
}

// #11 (2026-09-13): แชทจากหลังบ้าน/เครื่องมือทดสอบ/ยิง API ตรง ต้อง "ไม่นับ Qi".
// ระบุด้วย (1) x-admin-token ตรงกับ ADMIN_DOCTRINE_TOKEN (คอนเวนชันเดิมของ admin tools ในรีโปนี้) หรือ
// (2) header x-internal-no-qi: 1. ปลอดภัยเพราะผู้ใช้จริงเข้าผ่าน FE BFF (/api/chat/bazi) ซึ่งสร้าง request เอง
// ไม่ส่งต่อ header เหล่านี้ — เบราว์เซอร์จึงยิงตรงมาที่นี่ไม่ได้ (ต้องมี OPEN_WEBUI_API_TOKEN อยู่แล้ว).
function isInternalNoQiRequest(req: Request): boolean {
  const adminExpected = process.env.ADMIN_DOCTRINE_TOKEN?.trim();
  if (adminExpected && req.headers.get("x-admin-token")?.trim() === adminExpected) return true;
  if (req.headers.get("x-internal-no-qi")?.trim() === "1") return true;
  return false;
}

export type BuildOpenWebUiExecutionContextInput = {
  result: Pick<ChatRunnerSuccess, "baziConsult" | "latestUserMessage"> & { baziTopicHint?: string | null };
  triage: OpenWebUiTriageResult;
  calculatedState?: BaziStatePayload | null;
  /** same-server origin used to call the reading engine internally (Path A grounding) */
  origin?: string | null;
};

export async function buildOpenWebUiExecutionContext(
  input: BuildOpenWebUiExecutionContextInput,
): Promise<OpenWebUiGeminiExecutionContext> {
  const { result, triage, calculatedState, origin } = input;
  const { classification, extraction, topicId, timeframe } = triage;
  // ข้อความผู้ใช้ล่าสุด → ตรวจว่าเป็นคำถาม "วันไหนดี" (ground ด้วย man-vs-day + ปิด honest-precision reframe)
  const message = result.latestUserMessage?.content ?? null;
  const isGoodDay = needsPersonalDayCalendar(message, timeframe);
  const base = { intentClassification: classification, topicId, timeframe };

  if (!classification.requiresBaziConsult) {
    return {
      ...base,
      baziConsult: result.baziConsult
        ? {
          rawInput: result.baziConsult.rawInput,
          truthPacket: null,
        }
        : null,
    };
  }

  if (extraction.isComplete && extraction.rawInput && calculatedState) {
    const truthPacket = await groundOrFallback({
      origin,
      classification,
      topicId,
      timeframe,
      topicHint: result.baziTopicHint,
      rawInput: extraction.rawInput,
      calculatedState,
      message,
    });
    return {
      ...base,
      hasDailyGoodDayData: isGoodDay,
      chartFacts: formatChartFacts(calculatedState),
      baziConsult: {
        rawInput: extraction.rawInput,
        truthPacket,
      },
    };
  }

  if (!extraction.isComplete) {
    return {
      ...base,
      baziConsult: {
        rawInput: null,
        truthPacket: null,
      },
      baziMissingFields: extraction.missingFields,
    };
  }

  // Fallback: requiresBaziConsult + complete extraction but no fresh calculation —
  // honor any pre-attached consult payload from the chat runner.
  if (result.baziConsult) {
    const truthPacket = await groundOrFallback({
      origin,
      classification,
      topicId,
      timeframe,
      topicHint: result.baziTopicHint,
      rawInput: result.baziConsult.rawInput,
      calculatedState: result.baziConsult.calculatedState,
      message,
    });
    return {
      ...base,
      hasDailyGoodDayData: isGoodDay,
      chartFacts: result.baziConsult.calculatedState
        ? formatChartFacts(result.baziConsult.calculatedState)
        : null,
      baziConsult: {
        rawInput: result.baziConsult.rawInput,
        truthPacket,
      },
    };
  }

  return {
    ...base,
    baziConsult: null,
  };
}

// Ground the chat answer on the real reading engine (mode llm -> consumer). If the engine
// is unreachable or returns nothing, fall back to the legacy truth packet so chat never breaks.
async function groundOrFallback(args: {
  origin?: string | null;
  classification: OpenWebUiIntentClassification;
  topicId: TriageRoute;
  timeframe?: TriageTimeframe | null;
  topicHint?: string | null;
  rawInput: RawInputValue;
  calculatedState: BaziStatePayload;
  message?: string | null;
}): Promise<string | null> {
  const { origin, classification, topicId, timeframe, topicHint, rawInput, calculatedState, message } = args;
  const resolvedTopicId = resolveGroundingTopicId(topicId, topicHint);
  const fallback = stringifyOpenWebUiTruthPacket(classification, calculatedState);

  if (!origin || !resolvedTopicId) {
    return fallback;
  }

  const grounded = await fetchGroundedReading(origin, {
    topicId: resolvedTopicId,
    timeframe,
    rawInput,
    calculatedState,
    message,
  });
  return grounded ?? fallback;
}

// สรุปผังดวงจริงแบบสั้น — ให้ LLM อ้างหลักวิชาตอบเรื่องคู่ครอง/บุตร/จังหวะได้โดยไม่กุเสาขึ้นเอง.
function formatChartFacts(state: BaziStatePayload | null | undefined): string | null {
  const fp = state?.fourPillars;
  if (!fp?.year || !fp.month || !fp.day || !fp.hour) {
    return null;
  }
  const gz = (p: { stem: string; branch: string }) => `${p.stem}${p.branch}`;
  const dayMaster = state?.dayMaster ?? fp.day.stem;
  const hourHidden = fp.hour.hiddenStems?.length
    ? ` (ราศีแฝงในเสายาม: ${fp.hour.hiddenStems.join("")})`
    : "";
  return [
    "ผังดวงจริง (อ้างหลักวิชาได้ ห้ามกุเสาใหม่):",
    `- เสาสี่: ปี ${gz(fp.year)} · เดือน ${gz(fp.month)} · วัน ${gz(fp.day)} · ยาม ${gz(fp.hour)}`,
    `- ดิถี(日主)=${dayMaster}; วิมานคู่ครอง(日支)=${fp.day.branch}; วิมานบุตร(時柱)=${gz(fp.hour)}${hourHidden}`,
  ].join("\n");
}

// เพศตรงข้ามของผู้ใช้ (เดาให้ personB เมื่อไม่ได้ระบุ — เพศแทบไม่กระทบการเทียบเสาในดวงคู่).
function oppositeGender(gender: string): string {
  return /ชาย|male|ผู้ชาย/i.test(gender) ? "หญิง" : "ชาย";
}

// ดูดวงคู่/สมพงศ์ในแชต: ผู้ใช้ให้วันเกิดอีกฝ่ายมา → คำนวณ 2 ดวงจริงผ่าน pair engine แล้ว ground.
// คืน null เมื่อทำไม่ได้ (ไม่เข้าเงื่อนไข/สกัดวันเกิดอีกฝ่ายไม่ได้/engine ล้ม) → caller ใช้ flow ปกติ (guard เดิม).
async function tryCompatibilityContext(args: {
  result: ChatRunnerSuccess;
  triage: OpenWebUiTriageResult;
  origin?: string | null;
  message: string;
}): Promise<OpenWebUiGeminiExecutionContext | null> {
  const { result, triage, origin, message } = args;
  const personA = result.baziConsult?.rawInput ?? null;
  if (!origin || !personA || !isOtherChartRequest(message)) {
    return null;
  }

  // สกัดวันเกิด "อีกฝ่าย" จากข้อความ โดยไม่ seed โปรไฟล์ผู้ใช้ → extraction = ของอีกฝ่ายล้วน
  let partnerFields: { birthDate: string | null; birthTime: string | null; gender: string | null; province: string | null };
  try {
    const partnerTriage = await runOpenWebUiTriage(result);
    partnerFields = partnerTriage.extraction.fields;
  } catch {
    return null;
  }
  if (!partnerFields.birthDate) {
    return null; // ไม่มีวันเกิดอีกฝ่ายที่ชัดเจน → ปล่อยให้ guard เดิมจัดการ
  }

  const partnerTimeAssumed = !partnerFields.birthTime;
  let personB: RawInputValue;
  try {
    personB = RawInputSchema.parse({
      birthDate: partnerFields.birthDate,
      birthTime: partnerFields.birthTime ?? "12:00",
      gender: partnerFields.gender ?? oppositeGender(personA.gender),
      province: partnerFields.province ?? personA.province,
    });
  } catch {
    return null;
  }

  const relationship = detectRelationship(message);
  const reading = await fetchCompatibilityReading(origin, { personA, personB, relationship, partnerTimeAssumed });
  if (!reading) {
    return null;
  }

  return {
    intentClassification: triage.classification,
    topicId: triage.topicId,
    timeframe: triage.timeframe,
    hasCompatibilityData: true,
    chartFacts: result.baziConsult?.calculatedState
      ? formatChartFacts(result.baziConsult.calculatedState)
      : null,
    baziConsult: { rawInput: personA, truthPacket: reading },
  };
}

// Glass Box (Track B1): assemble the observability trace from data the pipeline already produced —
// what the triage heard, the engine text that was injected into compose, and which filters fired.
// Read-only over the pipeline; building it never changes routing, grounding, or the answer.
export function buildGlassBoxTrace(input: {
  triage: OpenWebUiTriageResult;
  executionContext: OpenWebUiGeminiExecutionContext;
  topicHint?: string | null;
}): GlassBoxTrace {
  const { triage, executionContext, topicHint } = input;
  const { classification, topicId, timeframe } = triage;
  const injectedReadingText = executionContext.baziConsult?.truthPacket ?? null;

  return {
    heard: {
      topicId: topicId ?? classification.intent ?? null,
      timeframe: timeframe ?? null,
      requiresBaziConsult: classification.requiresBaziConsult,
      confidence: classification.confidence,
      birthResolved: triage.extraction.isComplete,
    },
    truthUsed: {
      seam: injectedReadingText
        ? resolveGroundingTopicId(topicId, topicHint ?? null) ?? topicId ?? null
        : null,
      injectedReadingText,
    },
    filters: {
      honestPrecisionApplied: isHonestPrecisionReframe(classification.requiresBaziConsult, timeframe),
    },
  };
}

export async function POST(req: Request) {
  const unauthorizedResponse = validateApiToken(req);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return createBadRequestResponse("Request body must be valid JSON.", "invalid_json");
  }

  const result = runChatPipeline(payload);

  if (result.status === "error") {
    return createBadRequestResponse(result.message, result.code);
  }

  const effectiveUserId = result.userId ?? getForwardedUserId(req);

  console.log("[open-webui] chat completions userId", effectiveUserId);

  // โควตาถาม AI ต่อ user (ระบบแต้ม Qi) — ปิดเป็นค่าเริ่มต้น (กันกระทบแชทหลัก);
  // เปิดด้วย env QI_GATE_OPENWEBUI=1 เมื่อพร้อมบังคับใช้. ฟรีรายวัน → credit ที่แลกด้วย Qi.
  // #11: ข้ามการหัก Qi สำหรับแชทหลังบ้าน/ทดสอบ/ยิง API ตรง (isInternalNoQiRequest)
  const internalNoQi = isInternalNoQiRequest(req);
  if (internalNoQi) {
    console.log("[open-webui] internal/test request — skip Qi gate");
  }
  if (process.env.QI_GATE_OPENWEBUI === "1" && effectiveUserId && !internalNoQi) {
    const gated = await qiGate(effectiveUserId, "chat");
    if (gated) return gated;
  }

  // Glass Box flag: opt-in via request header, default OFF. ON only adds the trace frame to the
  // stream — persona/temperature/grounding are identical, so the answer itself never changes.
  const glassBoxTraceEnabled = req.headers.get("x-glass-box") === "1";

  const origin = (() => {
    try {
      return new URL(req.url).origin;
    } catch {
      return null;
    }
  })();

  const assistantReply = (async () => {
    // Pre-attached consult birth (from the chat runner) seeds the merge so the single triage
    // call can fill any field the user did not restate this turn.
    const existing = result.baziConsult?.rawInput
      ? {
        birthDate: result.baziConsult.rawInput.birthDate,
        birthTime: result.baziConsult.rawInput.birthTime,
        gender: result.baziConsult.rawInput.gender,
        province: result.baziConsult.rawInput.province,
      }
      : undefined;

    // ONE Gemini call: route topic (16) + timeframe + off-topic + extract birth context.
    const triage = await runOpenWebUiTriage(result, { existing });

    // #6 (2026-09-13): ถ้า FE ส่ง baziTopicHint (มาจากการกดชิปคำถาม) และเป็น topic ที่ถูกต้อง แต่ triage
    // ดันจัดเป็น off_topic/chit_chat (LLM พลาดกับคำถามสั้น ๆ เช่น "วันนี้ดีไหม") → เชื่อ hint แล้ว route เข้า
    // หัวข้อดูดวงจริง เพื่อไม่ให้คำถามที่ engine ตอบได้ถูกปฏิเสธผิด ๆ.
    const hint = result.baziTopicHint ?? null;
    if (isValidTopicId(hint) && (triage.topicId === "off_topic" || triage.topicId === "chit_chat")) {
      console.log("[open-webui] topic hint overrides triage", { hint, triaged: triage.topicId });
      triage.topicId = hint;
      triage.requiresBaziConsult = true;
      triage.classification.requiresBaziConsult = true;
      triage.classification.intent = topicIdToDomain(hint);
    }

    // โหมดฮวงจุ้ย (ซินแสนุ้ย 2026-09-22): คำถามเรื่องสถานที่/ชัยภูมิ (บ้าน/ที่ดิน/ที่ทำงาน/ห้อง) → ไม่ขึ้นดวง
    // จั่วไพ่อาถรรพ์ฮวงจุ้ย 3 ใบ ตอบจากตำรา. บังคับ card_reading (bucket "ไม่ใช่หัวข้อดวง") ด้วย regex ตรง ๆ
    // (มิเรอร์ card_reading override) — มาก่อน card_reading เพื่อให้คำถามสถานที่ไปฮวงจุ้ย ไม่ตกไปเซียมซี.
    let isFengshui = false;
    if (wantsFengshui(result.latestUserMessage.content)) {
      console.log("[open-webui] deterministic fengshui override", { was: triage.topicId });
      triage.topicId = "card_reading";
      triage.requiresBaziConsult = false;
      triage.classification.requiresBaziConsult = false;
      isFengshui = true;
    }

    // 2026-09-20 (เอ็ม live-test): LLM triage จัดคำถาม "ของหาย/ลี้ลับ" ผิดบ่อย (สุ่มไปหัวข้ออื่นแม้มี few-shot
    // ในพร้อมท์แล้ว) — เคสที่ชัดเจนระดับนี้บังคับด้วย regex ตรงๆ แทนพึ่ง LLM (มิเรอร์ topic-hint override ด้านบน).
    if (!isFengshui && wantsCardReading(result.latestUserMessage.content) && triage.topicId !== "card_reading") {
      console.log("[open-webui] deterministic card_reading override", {
        was: triage.topicId,
      });
      triage.topicId = "card_reading";
      triage.requiresBaziConsult = false;
      triage.classification.requiresBaziConsult = false;
    }

    // 2026-09-20 (เอ็ม live-test พบ): เคสกลับด้าน — LLM triage เองบางครั้งจัดคำถามความรักเจาะจงคน ("คนนี้เค้า
    // ชอบเราไหม") เข้า card_reading ตรงๆ (คาบเกี่ยวกับ bullet "การกระทำ/ความรู้สึกที่ซ่อนอยู่ของคนอื่น") ซึ่ง
    // ทำให้ requiresBaziConsult=false ไม่มีการคำนวณดวงเลย → hybrid เดิม (ดวงภาพรวม+ไพ่ปิดท้าย, wantsSpecificPersonLove
    // ด้านล่าง) ไม่ทำงานเพราะไม่มี baziConsult.truthPacket ให้ต่อท้าย เหลือแค่ตอบจากไพ่ล้วนไม่มีบริบทดวงเลย —
    // ผิดจากที่ซินแสนุ้ยสั่งไว้ (ต้องมีทั้งดวง+ไพ่). บังคับกลับเข้า love_partner ให้ hybrid ทำงานตามเดิมเสมอ.
    if (wantsSpecificPersonLove(result.latestUserMessage.content) && triage.topicId === "card_reading") {
      console.log("[open-webui] specific-person-love reclaims from card_reading", { was: triage.topicId });
      triage.topicId = "love_partner";
      triage.requiresBaziConsult = true;
      triage.classification.requiresBaziConsult = true;
      triage.classification.intent = topicIdToDomain("love_partner");
    }

    let calculatedState: BaziStatePayload | null = null;

    if (triage.requiresBaziConsult && triage.extraction.isComplete && triage.extraction.rawInput) {
      calculatedState = await calculateBaziStateFromRawInput(triage.extraction.rawInput);
    }

    const executionContext =
      (await tryCompatibilityContext({ result, triage, origin, message: result.latestUserMessage.content })) ??
      (await buildOpenWebUiExecutionContext({
        result,
        triage,
        calculatedState,
        origin,
      }));

    // ความรู้เสริม fix จากซินแส (เช่น ฮวงจุ้ยกระเป๋าตังค์) — แนบเมื่อคำถามเข้า keyword
    executionContext.staticKnowledge = await resolveStaticKnowledge(result.latestUserMessage.content);

    // ไพ่เซียมซีเคี้ยงคุง (ซินแสนุ้ยสั่ง): คำถามที่ "พื้นดวงตอบไม่ได้" — ลี้ลับ/ของหาย/เหตุการณ์เฉพาะจุด/
    // ขอเสี่ยงทายตรง ๆ → triage route เป็น card_reading (requiresBaziConsult=false ไม่ขึ้นดวง). จั่วไพ่ 1 ใบ
    // แล้วตอบจากเนื้อไพ่ (สถานการณ์/ข้อควรระวัง/คำแนะนำ) แบบรู้ใจ ไม่ใช่ขึ้นดวง.
    // ไพ่อาถรรพ์ฮวงจุ้ย (ซินแสนุ้ย 2026-09-22): คำถามเรื่องสถานที่ → จั่ว 3 ใบ (สถานที่มักผิดฮวงจุ้ยหลายจุด)
    // seed จากคำถาม (สถานที่/คำถามเดิม = ไพ่เดิม). ตอบจากตำรา ประเมินดี/เสียเอง — มาก่อนเซียมซี (กันจั่วซ้อน).
    if (isFengshui && !executionContext.hasFengshuiData) {
      try {
        const q = result.latestUserMessage.content;
        const cards = drawFengshui(3, seedFromQuestion(q));
        const reading = buildFengshuiReading(cards, q);
        executionContext.fengshuiReading = reading.chatProse; // บังวิชา: ไม่ส่งชื่อ/เลขไพ่ให้ LLM
        executionContext.hasFengshuiData = true;
      } catch {
        /* จั่ว/อ่านไพ่ฮวงจุ้ยพัง → ข้าม (ตอบตามปกติ) */
      }
    }

    // เลขศาสตร์เบอร์ (เอ็ม 2026-09-22): ถามเรื่องเบอร์ + ให้เบอร์มา → ถอดจริง (readPhoneNumber) แนบให้ LLM อธิบาย
    // (ไม่ขึ้นดวงปาจื่อ). ถ้าไม่ให้เบอร์ → gemini-adapter สั่งขอเบอร์ 10 หลักก่อน (ไม่มโน).
    if (!executionContext.hasPhoneData && wantsPhoneNumber(result.latestUserMessage.content)) {
      const num = extractThaiPhone(result.latestUserMessage.content);
      if (num) {
        try {
          // ทั้งสองวิชา (เอ็ม 2026-09-23): คู่เลข (readPhoneNumber) + ปิรามิด/รังผึ้ง (readHoneycomb) แนบรวมกัน
          const pairPart = formatPhoneReadingForChat(readPhoneNumber(num));
          let pyramidPart = "";
          try {
            pyramidPart = formatHoneycombForChat(readHoneycomb(num));
          } catch {
            /* ปิรามิดพัง → ใช้เฉพาะคู่เลข */
          }
          executionContext.phoneReading = pyramidPart ? `${pairPart}\n\n${pyramidPart}` : pairPart;
          executionContext.hasPhoneData = true;
          triage.requiresBaziConsult = false;
          triage.classification.requiresBaziConsult = false;
        } catch {
          /* เบอร์ไม่ครบ 10 หลัก → ปล่อยให้ instruction ขอเบอร์ใหม่ */
        }
      }
    }

    // บ้านเลขที่/เลขสั้น (เอ็ม 2026-09-22): เลขศาสตร์ผลรวม → ถอดจริง (readHouseNumber) แนบให้ LLM อธิบาย
    if (!executionContext.hasHouseData && wantsHouseNumber(result.latestUserMessage.content)) {
      const num = extractShortNumber(result.latestUserMessage.content);
      if (num) {
        try {
          executionContext.houseReading = formatHouseReadingForChat(readHouseNumber(num));
          executionContext.hasHouseData = true;
          triage.requiresBaziConsult = false;
          triage.classification.requiresBaziConsult = false;
        } catch {
          /* เลขไม่ถูก → ปล่อยให้ instruction ขอเลขใหม่ */
        }
      }
    }

    // ทำนายฝัน (ซินแสนุ้ย/เอ็ม 2026-09-23): ผู้ใช้เล่าความฝัน → ถอดสัญลักษณ์จากตำราฝันไทย (readDream) แนบให้ LLM
    // เรียบเรียง + ปิดด้วยเลขนำโชค (disclaimer บันเทิง). ไม่ขึ้นดวงปาจื่อ. ตำราฝันเป็น folklore สาธารณะ — จับได้เสมอ
    // แม้ไม่มีสัญลักษณ์ในคลัง (LLM ตีความจากหลักทั่วไป). มาก่อน card_reading เพื่อไม่ให้ "ฝัน" ตกไปเซียมซี.
    if (!executionContext.hasDreamData && wantsDream(result.latestUserMessage.content)) {
      try {
        executionContext.dreamReading = formatDreamReadingForChat(readDream(result.latestUserMessage.content));
        executionContext.hasDreamData = true;
        triage.requiresBaziConsult = false;
        triage.classification.requiresBaziConsult = false;
      } catch {
        /* ถอดฝันพัง → ปล่อยตอบตามปกติ */
      }
    }

    if (triage.topicId === "card_reading" && !isFengshui && !executionContext.hasDreamData && !executionContext.hasCardReadingData) {
      try {
        const card = drawSiamsi();
        const reading = buildSiamsiReading(card, result.latestUserMessage.content);
        executionContext.cardReading = reading.chatProse; // บังวิชา: ไม่ส่งชื่อ/เลขไพ่ให้ LLM
        executionContext.hasCardReadingData = true;
      } catch {
        /* จั่ว/อ่านไพ่พัง → ข้าม (ตอบตามปกติ) */
      }
    }

    // ความรักเจาะจง "คนนี้" (ซินแสนุ้ยสั่ง): พื้นดวงตอบภาพรวมได้ แต่ตอบ 'คนคนนั้น' ไม่ได้ → จั่วไพ่เสี่ยงทาย
    // แนบท้ายผลอ่าน แล้วสั่งให้ปิดท้ายด้วยไพ่ (ไม่ชวนไปเมนูเปิดไพ่). ทำเมื่อมีผลอ่านดวงจริงแนบมาแล้วเท่านั้น.
    if (
      wantsSpecificPersonLove(result.latestUserMessage.content) &&
      !executionContext.hasCompatibilityData &&
      executionContext.baziConsult?.truthPacket
    ) {
      try {
        const drawn = drawOracle(3);
        const reading = buildOracleReading([drawn[0], drawn[1], drawn[2]] as const, result.latestUserMessage.content);
        // บังวิชา (เอ็ม 2026-09-23): ไม่ส่งชื่อ/เลขไพ่ + น้ำหนัก% ให้ LLM — ตัดหัว "ไพ่หลัก (น้ำหนัก%) — ชื่อ" ทิ้ง เหลือแต่ใจความ
        const drawnMeaning = reading.engineProse
          .replace(/ไพ่หลัก\s*\([^)]*\)\s*—\s*[^\n]*\n?/g, "")
          .replace(/\s*\(น้ำหนัก[^)]*%\)/g, "")
          .trim();
        executionContext.baziConsult.truthPacket +=
          `\n\n———\n\n[คำเสี่ยงทายปิดท้าย — ตอบเจาะจง "คนที่ผู้ใช้ถามถึง" (ห้ามเอ่ยว่าเป็นไพ่/ชื่อไพ่)]\n${drawnMeaning}`;
        executionContext.hasDrawnCardData = true;
      } catch {
        /* จั่วไพ่/อ่านไพ่พัง → ข้าม (ตอบจากพื้นดวงตามปกติ) */
      }
    }

    const reply = await generateGeminiAssistantReply(result, { executionContext });

    // อุดรอยรั่วต้นทุน: log ทั้ง 2 การเรียก Gemini (triage + ตอบหลัก) เข้า /stats — fire-and-forget
    if (triage.usage) {
      logLlmUsage("open_webui", {
        provider: "gemini",
        model: triage.usage.model,
        inTokens: triage.usage.inTokens,
        outTokens: triage.usage.outTokens,
        label: "triage",
        anonId: effectiveUserId,
      });
    }
    if (reply.usage) {
      logLlmUsage("open_webui", {
        provider: "gemini",
        model: reply.model,
        inTokens: reply.usage.inTokens,
        outTokens: reply.usage.outTokens,
        label: "reply",
        anonId: effectiveUserId,
      });
    }
    // metadata แชท (ไม่เก็บข้อความ) — สำหรับ analytics /ops: ปริมาณ/สัดส่วน persona/หัวข้อ. fire-and-forget
    logMateChatMeta({ anonId: effectiveUserId, persona: result.persona, topicId: triage.topicId, timeframe: triage.timeframe });

    if (!glassBoxTraceEnabled) {
      return reply;
    }

    return {
      ...reply,
      trace: buildGlassBoxTrace({
        triage,
        executionContext,
        topicHint: result.baziTopicHint ?? null,
      }),
    };
  })().catch((error) => {
    if (error instanceof OpenWebUiGeminiError) {
      throw error;
    }

    if (
      error instanceof OpenWebUiTriageError
      || error instanceof BaziEngineAdapterError
    ) {
      throw new OpenWebUiGeminiError("gemini_upstream_error", error.message);
    }

    throw new OpenWebUiGeminiError(
      "gemini_upstream_error",
      error instanceof Error ? error.message : "Unexpected Gemini transport failure.",
    );
  });

  return new Response(createGuardedOpenAiSseStream({
    assistantReply,
    abortSignal: req.signal,
    timeoutMs: 35_000,
  }), {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}