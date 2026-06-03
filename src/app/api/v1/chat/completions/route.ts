import { calculateBaziStateFromRawInput, type BaziStatePayload, BaziEngineAdapterError } from "@/features/bazi-math/bazi-engine-adapter";
import { validateApiToken } from "@/features/open-webui/api-guard";
import {
  extractOpenWebUiBaziContext,
  type OpenWebUiBaziExtraction,
  OpenWebUiBaziExtractorError,
} from "@/features/open-webui/bazi-extractor";
import { type ChatRunnerSuccess, runChatPipeline } from "@/features/open-webui/chat-runner";
import {
  generateGeminiAssistantReply,
  type OpenWebUiGeminiExecutionContext,
  OpenWebUiGeminiError,
} from "@/features/open-webui/gemini-adapter";
import {
  type OpenWebUiIntentClassification,
  OpenWebUiIntentRouterError,
  routeOpenWebUiIntent,
} from "@/features/open-webui/intent-router";
import {
  createBaziUserProfileRepository,
  hasAnyBaziProfileField,
  mergeBaziProfileFields,
  toBaziProfileFields,
} from "@/features/open-webui/profile-service";
import {
  createBaziOpenWebUiEpisodicRepository,
  type PersistedOpenWebUiThreadState,
} from "@/features/open-webui/episodic-service";
import { stringifyOpenWebUiTruthPacket } from "@/features/open-webui/truth-packet";
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
  result: Pick<ChatRunnerSuccess, "baziConsult">;
  intentClassification: OpenWebUiIntentClassification;
  extraction?: OpenWebUiBaziExtraction | null;
  calculatedState?: BaziStatePayload | null;
  episodicMemory?: PersistedOpenWebUiThreadState | null;
};

export function buildOpenWebUiExecutionContext(
  input: BuildOpenWebUiExecutionContextInput,
): OpenWebUiGeminiExecutionContext {
  const { result, intentClassification, extraction, calculatedState } = input;
  const episodicMemory = input.episodicMemory
    ? {
      contextSummary: input.episodicMemory.contextSummary,
      messages: input.episodicMemory.messages,
    }
    : undefined;

  if (!intentClassification.requiresBaziConsult) {
    return {
      intentClassification,
      episodicMemory,
      baziConsult: result.baziConsult
        ? {
          rawInput: result.baziConsult.rawInput,
          truthPacket: null,
        }
        : null,
    };
  }

  if (extraction && extraction.isComplete && extraction.rawInput && calculatedState) {
    return {
      intentClassification,
      episodicMemory,
      baziConsult: {
        rawInput: extraction.rawInput,
        truthPacket: stringifyOpenWebUiTruthPacket(intentClassification, calculatedState),
      },
    };
  }

  if (extraction && !extraction.isComplete) {
    return {
      intentClassification,
      episodicMemory,
      baziConsult: {
        rawInput: null,
        truthPacket: null,
      },
      baziMissingFields: extraction.missingFields,
    };
  }

  // Fallback: requiresBaziConsult but no extraction was performed —
  // honor any pre-attached consult payload from the chat runner.
  if (result.baziConsult) {
    return {
      intentClassification,
      episodicMemory,
      baziConsult: {
        rawInput: result.baziConsult.rawInput,
        truthPacket: stringifyOpenWebUiTruthPacket(intentClassification, result.baziConsult.calculatedState),
      },
    };
  }

  return {
    intentClassification,
    episodicMemory,
    baziConsult: null,
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
  const profileRepository = effectiveUserId
    ? createBaziUserProfileRepository()
    : null;
  const episodicRepository = effectiveUserId && result.threadId
    ? createBaziOpenWebUiEpisodicRepository()
    : null;

  console.log("[open-webui] chat completions context", {
    userId: effectiveUserId,
    threadId: result.threadId,
  });

  const assistantReply = (async () => {
    const intentClassification = await routeOpenWebUiIntent(result);
    const persistedProfile = effectiveUserId && profileRepository
      ? await profileRepository.findByClerkUserId(effectiveUserId)
      : null;
    const episodicMemory = effectiveUserId && result.threadId && episodicRepository
      ? await episodicRepository.findByClerkUserIdAndThreadId({
        clerkUserId: effectiveUserId,
        threadId: result.threadId,
      })
      : null;
    const existingProfileFields = mergeBaziProfileFields(
      persistedProfile?.fields,
      result.baziConsult?.rawInput ? toBaziProfileFields(result.baziConsult.rawInput) : null,
    );

    let extraction: OpenWebUiBaziExtraction | null = null;
    let calculatedState: BaziStatePayload | null = null;
    let profileFieldsToPersist = hasAnyBaziProfileField(existingProfileFields)
      ? existingProfileFields
      : null;

    if (intentClassification.requiresBaziConsult) {
      if (result.baziConsult?.calculatedState) {
        calculatedState = result.baziConsult.calculatedState;
      } else {
        extraction = await extractOpenWebUiBaziContext(result, {
          existing: hasAnyBaziProfileField(existingProfileFields)
            ? existingProfileFields
            : undefined,
        });
        profileFieldsToPersist = extraction.fields;

        if (extraction.isComplete && extraction.rawInput) {
          calculatedState = await calculateBaziStateFromRawInput(extraction.rawInput);
        }
      }
    }

    if (effectiveUserId && profileRepository && profileFieldsToPersist) {
      await profileRepository.upsertPartialByClerkUserId({
        clerkUserId: effectiveUserId,
        fields: profileFieldsToPersist,
      });
    }

    const executionContext = buildOpenWebUiExecutionContext({
      result,
      intentClassification,
      extraction,
      calculatedState,
      episodicMemory,
    });

    return generateGeminiAssistantReply(result, { executionContext });
  })().catch((error) => {
    if (error instanceof OpenWebUiGeminiError) {
      throw error;
    }

    if (
      error instanceof OpenWebUiIntentRouterError
      || error instanceof OpenWebUiBaziExtractorError
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
    onFinalizedReply: async (reply) => {
      if (!effectiveUserId || !result.threadId || !episodicRepository) {
        return;
      }

      if (reply.usedFallback || !reply.visibleText.trim()) {
        return;
      }

      await episodicRepository.appendFinalizedTurnByClerkUserIdAndThreadId({
        clerkUserId: effectiveUserId,
        threadId: result.threadId,
        userMessage: result.latestUserMessage.content,
        assistantReply: reply.visibleText,
      });
    },
  }), {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}