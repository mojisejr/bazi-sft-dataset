import { calculateBaziStateFromRawInput, type BaziStatePayload, BaziEngineAdapterError } from "@/features/bazi-math/bazi-engine-adapter";
import { validateApiToken } from "@/features/open-webui/api-guard";
import { type ChatRunnerSuccess, runChatPipeline } from "@/features/open-webui/chat-runner";
import {
  generateGeminiAssistantReply,
  isHonestPrecisionReframe,
  type OpenWebUiGeminiExecutionContext,
  OpenWebUiGeminiError,
} from "@/features/open-webui/gemini-adapter";
import {
  type OpenWebUiIntentClassification,
  type OpenWebUiTriageResult,
  type TriageRoute,
  type TriageTimeframe,
  OpenWebUiTriageError,
  runOpenWebUiTriage,
} from "@/features/open-webui/triage";
import { stringifyOpenWebUiTruthPacket } from "@/features/open-webui/truth-packet";
import { fetchGroundedReading, resolveGroundingTopicId } from "@/features/open-webui/reading-bridge";
import { resolveStaticKnowledge } from "@/features/open-webui/static-knowledge";
import { type RawInputValue } from "@/lib/bazi/schema-types";
import { qiGate } from "@/lib/bazi/qi/quota";
import { logLlmUsage } from "@/lib/llm-usage/logger";
import {
  createGuardedOpenAiSseStream,
  type GlassBoxTrace,
} from "@/features/open-webui/sse-streamer";

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

export type BuildOpenWebUiExecutionContextInput = {
  result: Pick<ChatRunnerSuccess, "baziConsult"> & { baziTopicHint?: string | null };
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
    });
    return {
      ...base,
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
    });
    return {
      ...base,
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
}): Promise<string | null> {
  const { origin, classification, topicId, timeframe, topicHint, rawInput, calculatedState } = args;
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
  });
  return grounded ?? fallback;
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
  if (process.env.QI_GATE_OPENWEBUI === "1" && effectiveUserId) {
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

    let calculatedState: BaziStatePayload | null = null;

    if (triage.requiresBaziConsult && triage.extraction.isComplete && triage.extraction.rawInput) {
      calculatedState = await calculateBaziStateFromRawInput(triage.extraction.rawInput);
    }

    const executionContext = await buildOpenWebUiExecutionContext({
      result,
      triage,
      calculatedState,
      origin,
    });

    // ความรู้เสริม fix จากซินแส (เช่น ฮวงจุ้ยกระเป๋าตังค์) — แนบเมื่อคำถามเข้า keyword
    executionContext.staticKnowledge = await resolveStaticKnowledge(result.latestUserMessage.content);

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