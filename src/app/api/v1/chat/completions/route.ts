import { calculateBaziStateFromRawInput, type BaziStatePayload, BaziEngineAdapterError } from "@/features/bazi-math/bazi-engine-adapter";
import { validateApiToken } from "@/features/open-webui/api-guard";
import {
  extractOpenWebUiBaziContext,
  type OpenWebUiBaziExtraction,
  OpenWebUiBaziExtractorError,
} from "@/features/open-webui/bazi-extractor";
import {
  detectSyntheticOpenWebUiMetadataPrompt,
  type ChatRunnerSuccess,
  runChatPipeline,
} from "@/features/open-webui/chat-runner";
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
  createOpenWebUiProfileFingerprint,
  normalizeOpenWebUiThreadId,
  type OpenWebUiActiveScope,
  type OpenWebUiContinuityState,
  type OpenWebUiFinalizedTurnSkipReason,
  type PersistedOpenWebUiThreadState,
} from "@/features/open-webui/episodic-service";
import {
  stringifyOpenWebUiTruthPacket,
  type OpenWebUiTruthPacketChatEvidence,
} from "@/features/open-webui/truth-packet";
import {
  createGuardedOpenAiSseStream,
} from "@/features/open-webui/sse-streamer";

export const runtime = "nodejs";

const PROFILE_BOUNDARY_KEYS = ["birthDate", "birthTime", "gender", "province"] as const;

type OpenWebUiUserIdentitySource = "payload_user" | "forwarded_header" | "none";
type OpenWebUiContinuityDisposition = "stateless" | "preserve" | "reset_requested_boundary" | "reset_profile_conflict";

function logOpenWebUiOperationalEvent(event: string, detail: Record<string, unknown>) {
  console.info("[open-webui] operational", {
    event,
    ...detail,
  });
}

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

const OPEN_WEBUI_FORWARDED_CHAT_ID_HEADER_NAMES = ["x-openwebui-chat-id"] as const;

function getForwardedOpenWebUiChatId(req: Request) {
  for (const headerName of OPEN_WEBUI_FORWARDED_CHAT_ID_HEADER_NAMES) {
    const chatId = normalizeOpenWebUiThreadId(req.headers.get(headerName));

    if (chatId) {
      return chatId;
    }
  }

  return null;
}

function resolveOpenWebUiUserIdentity(
  req: Request,
  payloadUserId: string | null | undefined,
): { effectiveUserId: string | null; userIdentitySource: OpenWebUiUserIdentitySource } {
  if (payloadUserId) {
    return {
      effectiveUserId: payloadUserId,
      userIdentitySource: "payload_user" as const,
    };
  }

  const forwardedUserId = getForwardedUserId(req);

  if (forwardedUserId) {
    return {
      effectiveUserId: forwardedUserId,
      userIdentitySource: "forwarded_header" as const,
    };
  }

  return {
    effectiveUserId: null,
    userIdentitySource: "none" as const,
  };
}

function resolveOpenWebUiThreadIdentity(req: Request, payloadThreadId: string | null | undefined) {
  return normalizeOpenWebUiThreadId(payloadThreadId) ?? getForwardedOpenWebUiChatId(req);
}

function getContinuityDisposition(input: {
  hasPersistenceLane: boolean;
  requestedFreshThreadBoundary: boolean;
  hasProfileConflict: boolean;
}): OpenWebUiContinuityDisposition {
  if (!input.hasPersistenceLane) {
    return "stateless";
  }

  if (input.requestedFreshThreadBoundary) {
    return "reset_requested_boundary";
  }

  if (input.hasProfileConflict) {
    return "reset_profile_conflict";
  }

  return "preserve";
}

export type BuildOpenWebUiExecutionContextInput = {
  result: Pick<ChatRunnerSuccess, "baziConsult" | "latestUserMessage" | "triageMessages">;
  intentClassification: OpenWebUiIntentClassification;
  extraction?: OpenWebUiBaziExtraction | null;
  calculatedState?: BaziStatePayload | null;
  episodicMemory?: PersistedOpenWebUiThreadState | null;
};

function buildOpenWebUiTruthPacketChatEvidence(
  result: Pick<ChatRunnerSuccess, "latestUserMessage" | "triageMessages">,
): OpenWebUiTruthPacketChatEvidence {
  let latestUserMessageIndex = -1;

  result.triageMessages.forEach((message, index) => {
    if (
      message.role === "user"
      && message.content === result.latestUserMessage.content
    ) {
      latestUserMessageIndex = index;
    }
  });

  return {
    latestUserMessage: result.latestUserMessage.content,
    recentMessages: result.triageMessages
      .filter((_, index) => index !== latestUserMessageIndex)
      .map((message) => message.content)
      .slice(-5),
  };
}

export function buildOpenWebUiExecutionContext(
  input: BuildOpenWebUiExecutionContextInput,
): OpenWebUiGeminiExecutionContext {
  const { result, intentClassification, extraction, calculatedState } = input;
  const truthPacketChatEvidence = buildOpenWebUiTruthPacketChatEvidence(result);
  const episodicMemory = input.episodicMemory
    ? {
      contextSummary: input.episodicMemory.contextSummary,
      activeScope: input.episodicMemory.continuityState?.activeScope ?? null,
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
        truthPacket: stringifyOpenWebUiTruthPacket(intentClassification, calculatedState, truthPacketChatEvidence),
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
        truthPacket: stringifyOpenWebUiTruthPacket(intentClassification, result.baziConsult.calculatedState, truthPacketChatEvidence),
      },
    };
  }

  return {
    intentClassification,
    episodicMemory,
    baziConsult: null,
  };
}

function normalizeContinuityProfileFields(
  fields: Partial<ReturnType<typeof mergeBaziProfileFields>> | null | undefined,
) {
  const normalized = mergeBaziProfileFields(fields ?? null);

  return hasAnyBaziProfileField(normalized) ? normalized : null;
}

function hasContinuityProfileConflict(
  nextFields: Partial<ReturnType<typeof mergeBaziProfileFields>> | null | undefined,
  previousFields: Partial<ReturnType<typeof mergeBaziProfileFields>> | null | undefined,
) {
  const normalizedNextFields = normalizeContinuityProfileFields(nextFields);
  const normalizedPreviousFields = normalizeContinuityProfileFields(previousFields);

  if (!normalizedNextFields || !normalizedPreviousFields) {
    return false;
  }

  return PROFILE_BOUNDARY_KEYS.some((key) => (
    normalizedNextFields[key] !== null
    && normalizedPreviousFields[key] !== null
    && normalizedNextFields[key] !== normalizedPreviousFields[key]
  ));
}

function buildOpenWebUiActiveScope(
  intentClassification: OpenWebUiIntentClassification,
  calculatedState: BaziStatePayload | null,
): OpenWebUiActiveScope | null {
  if (!intentClassification.requiresBaziConsult) {
    return null;
  }

  const currentDaYun = calculatedState?.daYun.find((pillar) => pillar.isCurrent) ?? calculatedState?.daYun.at(-1) ?? null;

  if (!currentDaYun) {
    return {
      requestedDomain: intentClassification.intent,
      currentAgeWindow: null,
    };
  }

  let startAge = currentDaYun.startAge;
  let endAge = currentDaYun.endAge;

  if (currentDaYun.currentPhase === "upper") {
    endAge = Math.min(currentDaYun.endAge, currentDaYun.startAge + 4);
  }

  if (currentDaYun.currentPhase === "lower") {
    startAge = Math.min(currentDaYun.endAge, currentDaYun.startAge + 5);
  }

  return {
    requestedDomain: intentClassification.intent,
    currentAgeWindow: {
      startAge,
      endAge,
      currentPhase: currentDaYun.currentPhase ?? null,
      label: `${startAge}-${endAge}`,
    },
  };
}

function buildOpenWebUiContinuityState(input: {
  intentClassification: OpenWebUiIntentClassification;
  calculatedState: BaziStatePayload | null;
  profileFields: Partial<ReturnType<typeof mergeBaziProfileFields>> | null | undefined;
}): OpenWebUiContinuityState | null {
  const profileFields = normalizeContinuityProfileFields(input.profileFields);
  const activeScope = buildOpenWebUiActiveScope(input.intentClassification, input.calculatedState);

  if (!profileFields && !activeScope) {
    return null;
  }

  return {
    profileFingerprint: createOpenWebUiProfileFingerprint(profileFields),
    profileFields,
    activeScope,
  };
}

function getFinalizedReplySkipReason(reply: {
  usedFallback: boolean;
  visibleText: string;
}): OpenWebUiFinalizedTurnSkipReason | null {
  if (reply.usedFallback) {
    return "fallback_response";
  }

  if (!reply.visibleText.trim()) {
    return "empty_visible_reply";
  }

  return null;
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

  const syntheticMetadataPromptKind = detectSyntheticOpenWebUiMetadataPrompt(result.latestUserMessage.content);

  const { effectiveUserId, userIdentitySource } = resolveOpenWebUiUserIdentity(req, result.userId);
  const effectiveThreadId = resolveOpenWebUiThreadIdentity(req, result.threadId);
  const profileRepository = effectiveUserId
    ? createBaziUserProfileRepository()
    : null;
  const episodicRepository = effectiveUserId && effectiveThreadId
    ? createBaziOpenWebUiEpisodicRepository()
    : null;
  const hasPersistenceLane = Boolean(effectiveUserId && effectiveThreadId && episodicRepository);

  logOpenWebUiOperationalEvent("request_context", {
    userIdentitySource,
    hasThreadId: Boolean(effectiveThreadId),
    threadPersistenceEligible: hasPersistenceLane,
    syntheticMetadataPromptKind,
  });

  let continuityPersistencePlan: {
    shouldResetThreadState: boolean;
    continuityDisposition: OpenWebUiContinuityDisposition;
    continuityState?: OpenWebUiContinuityState | null;
  } = {
    shouldResetThreadState: false,
    continuityDisposition: hasPersistenceLane ? "preserve" : "stateless",
  };

  const assistantReply = (async () => {
    const intentClassification = await routeOpenWebUiIntent(result);
    const persistedProfile = effectiveUserId && profileRepository
      ? await profileRepository.findByClerkUserId(effectiveUserId)
      : null;
    const episodicMemory = effectiveUserId && effectiveThreadId && episodicRepository
      ? await episodicRepository.findByClerkUserIdAndThreadId({
        clerkUserId: effectiveUserId,
        threadId: effectiveThreadId,
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

    const nextProfileBoundaryFields = result.baziConsult?.rawInput
      ? toBaziProfileFields(result.baziConsult.rawInput)
      : extraction?.fields ?? null;
    const previousProfileBoundaryFields = episodicMemory?.continuityState?.profileFields
      ?? persistedProfile?.fields
      ?? null;
    const hasProfileConflict = hasContinuityProfileConflict(nextProfileBoundaryFields, previousProfileBoundaryFields);
    const shouldResetThreadState = result.continuityBoundary.requestedFreshThreadBoundary
      || hasProfileConflict;
    const effectiveEpisodicMemory = shouldResetThreadState ? null : episodicMemory;
    const continuityDisposition = getContinuityDisposition({
      hasPersistenceLane,
      requestedFreshThreadBoundary: result.continuityBoundary.requestedFreshThreadBoundary,
      hasProfileConflict,
    });

    continuityPersistencePlan = {
      shouldResetThreadState,
      continuityDisposition,
      continuityState: intentClassification.requiresBaziConsult
        ? buildOpenWebUiContinuityState({
          intentClassification,
          calculatedState,
          profileFields: profileFieldsToPersist,
        })
        : shouldResetThreadState
          ? null
          : undefined,
    };

    logOpenWebUiOperationalEvent("continuity_plan", {
      continuityDisposition,
      requiresBaziConsult: intentClassification.requiresBaziConsult,
      hasPersistedProfile: Boolean(persistedProfile),
      hasEpisodicMemory: Boolean(episodicMemory),
      activeScopeRequestedDomain: continuityPersistencePlan.continuityState?.activeScope?.requestedDomain ?? null,
    });

    const executionContext = buildOpenWebUiExecutionContext({
      result,
      intentClassification,
      extraction,
      calculatedState,
      episodicMemory: effectiveEpisodicMemory,
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
      const clerkUserId = effectiveUserId;
      const threadId = effectiveThreadId;
      const persistentEpisodicRepository = episodicRepository;
      if (!clerkUserId || !threadId || !persistentEpisodicRepository) {
        const reason = !clerkUserId
          ? "missing_user_id"
          : !threadId
            ? "missing_thread_id"
            : "missing_repository";

        logOpenWebUiOperationalEvent("finalized_turn_nonpersistent", {
          reason,
          userIdentitySource,
          continuityDisposition: continuityPersistencePlan.continuityDisposition,
        });
        return;
      }

      if (syntheticMetadataPromptKind) {
        logOpenWebUiOperationalEvent("finalized_turn_nonpersistent", {
          reason: "synthetic_metadata_prompt",
          syntheticMetadataPromptKind,
          userIdentitySource,
          continuityDisposition: continuityPersistencePlan.continuityDisposition,
        });
        return;
      }

      const skipReason = getFinalizedReplySkipReason(reply);

      try {
        await persistentEpisodicRepository.appendFinalizedTurnByClerkUserIdAndThreadId({
          clerkUserId,
          threadId,
          userMessage: result.latestUserMessage.content,
          ...(skipReason ? { skipReason } : { assistantReply: reply.visibleText }),
          ...(continuityPersistencePlan.shouldResetThreadState ? { resetThreadState: true } : {}),
          ...(continuityPersistencePlan.continuityState !== undefined
            ? { continuityState: continuityPersistencePlan.continuityState }
            : {}),
        });

        logOpenWebUiOperationalEvent("finalized_turn_recorded", {
          persistenceOutcome: skipReason ? "skip_recorded" : "assistant_reply_persisted",
          skipReason,
          continuityDisposition: continuityPersistencePlan.continuityDisposition,
          resetThreadState: continuityPersistencePlan.shouldResetThreadState,
        });
      } catch (error) {
        logOpenWebUiOperationalEvent("finalized_turn_persist_failed", {
          persistenceOutcome: "append_failed",
          skipReason,
          continuityDisposition: continuityPersistencePlan.continuityDisposition,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });

        throw error;
      }
    },
  }), {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}