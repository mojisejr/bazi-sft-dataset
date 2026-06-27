import { calculateBaziStateFromRawInput, type BaziStatePayload, BaziEngineAdapterError } from "@/features/bazi-math/bazi-engine-adapter";
import { validateApiToken } from "@/features/open-webui/api-guard";
import { type ChatRunnerSuccess, runChatPipeline } from "@/features/open-webui/chat-runner";
import {
  generateGeminiAssistantReply,
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
import { type RawInputValue } from "@/lib/bazi/schema-types";
import {
  createGuardedOpenAiSseStream,
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

    return generateGeminiAssistantReply(result, { executionContext });
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