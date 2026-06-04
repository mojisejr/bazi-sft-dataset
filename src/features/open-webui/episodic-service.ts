import { and, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziChatHistories } from "@/db/schema";
import { type BaziProfileFields } from "@/features/open-webui/profile-service";
import { sanitizeAssistantReplyForStreaming } from "@/features/open-webui/sse-streamer";

export type OpenWebUiEpisodicMessage = {
  role: "user" | "assistant";
  content: string;
};

export type OpenWebUiActiveScope = {
  requestedDomain: "wealth" | "love" | "career" | "health" | "general_reading" | "chit_chat";
  currentAgeWindow: {
    startAge: number;
    endAge: number;
    currentPhase: "upper" | "lower" | null;
    label: string;
  } | null;
};

export type OpenWebUiContinuityState = {
  profileFingerprint: string | null;
  profileFields: BaziProfileFields | null;
  activeScope: OpenWebUiActiveScope | null;
};

export type OpenWebUiFinalizedTurnSkipReason = "fallback_response" | "empty_visible_reply";

export type PersistedOpenWebUiThreadState = {
  clerkUserId: string;
  threadId: string;
  contextSummary: string | null;
  continuityState: OpenWebUiContinuityState | null;
  messages: OpenWebUiEpisodicMessage[];
};

export type BaziOpenWebUiEpisodicRepository = {
  findByClerkUserIdAndThreadId: (input: {
    clerkUserId: string;
    threadId: string;
  }) => Promise<PersistedOpenWebUiThreadState | null>;
  appendFinalizedTurnByClerkUserIdAndThreadId: (input: {
    clerkUserId: string;
    threadId: string;
    userMessage: string;
    assistantReply?: string | null;
    resetThreadState?: boolean;
    continuityState?: OpenWebUiContinuityState | null;
    skipReason?: OpenWebUiFinalizedTurnSkipReason | null;
  }) => Promise<PersistedOpenWebUiThreadState | null>;
};

export const OPEN_WEBUI_EPISODIC_RECENT_MESSAGE_LIMIT = 6;
export const OPEN_WEBUI_EPISODIC_SUMMARY_HEADER = "Same-thread visible continuity:";
export const OPEN_WEBUI_EPISODIC_SUMMARY_MAX_CHARS = 1_200;
const OPEN_WEBUI_CONTINUITY_NOTE_PREFIX = "- Continuity note:";

const VALID_STORED_ROLES = new Set(["user", "assistant", "model"]);
const VALID_ACTIVE_SCOPE_DOMAINS = new Set(["wealth", "love", "career", "health", "general_reading", "chit_chat"]);
const VALID_CURRENT_PHASES = new Set(["upper", "lower"]);

function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function normalizeProfileFields(fields: Partial<BaziProfileFields> | null | undefined) {
  if (!fields) {
    return null;
  }

  const normalized = {
    birthDate: normalizeText(fields.birthDate),
    birthTime: normalizeText(fields.birthTime),
    gender: normalizeText(fields.gender),
    province: normalizeText(fields.province),
  } satisfies BaziProfileFields;

  return normalized.birthDate || normalized.birthTime || normalized.gender || normalized.province
    ? normalized
    : null;
}

export function createOpenWebUiProfileFingerprint(fields: Partial<BaziProfileFields> | null | undefined) {
  const normalized = normalizeProfileFields(fields);

  if (!normalized) {
    return null;
  }

  return [
    normalized.birthDate ?? "",
    normalized.birthTime ?? "",
    normalized.gender ?? "",
    normalized.province ?? "",
  ].join("::");
}

function sanitizeOpenWebUiActiveScope(value: unknown): OpenWebUiActiveScope | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const requestedDomain = typeof candidate.requestedDomain === "string" && VALID_ACTIVE_SCOPE_DOMAINS.has(candidate.requestedDomain)
    ? candidate.requestedDomain as OpenWebUiActiveScope["requestedDomain"]
    : null;

  if (!requestedDomain) {
    return null;
  }

  let currentAgeWindow: OpenWebUiActiveScope["currentAgeWindow"] = null;

  if (candidate.currentAgeWindow && typeof candidate.currentAgeWindow === "object") {
    const ageWindow = candidate.currentAgeWindow as Record<string, unknown>;
    const startAge = typeof ageWindow.startAge === "number" && Number.isFinite(ageWindow.startAge)
      ? ageWindow.startAge
      : null;
    const endAge = typeof ageWindow.endAge === "number" && Number.isFinite(ageWindow.endAge)
      ? ageWindow.endAge
      : null;
    const label = normalizeText(typeof ageWindow.label === "string" ? ageWindow.label : null);
    const currentPhase = typeof ageWindow.currentPhase === "string" && VALID_CURRENT_PHASES.has(ageWindow.currentPhase)
      ? ageWindow.currentPhase as "upper" | "lower"
      : null;

    if (startAge !== null && endAge !== null && label) {
      currentAgeWindow = {
        startAge,
        endAge,
        currentPhase,
        label,
      };
    }
  }

  return {
    requestedDomain,
    currentAgeWindow,
  };
}

export function sanitizeOpenWebUiContinuityState(value: unknown): OpenWebUiContinuityState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const profileFields = normalizeProfileFields(
    candidate.profileFields && typeof candidate.profileFields === "object"
      ? candidate.profileFields as Partial<BaziProfileFields>
      : null,
  );
  const activeScope = sanitizeOpenWebUiActiveScope(candidate.activeScope);
  const profileFingerprint = normalizeText(
    typeof candidate.profileFingerprint === "string"
      ? candidate.profileFingerprint
      : createOpenWebUiProfileFingerprint(profileFields),
  );

  if (!profileFields && !activeScope && !profileFingerprint) {
    return null;
  }

  return {
    profileFingerprint,
    profileFields,
    activeScope,
  };
}

function sanitizePersistedTurnContent(
  role: OpenWebUiEpisodicMessage["role"] | "model",
  content: string | null | undefined,
) {
  const normalized = normalizeText(content);

  if (!normalized) {
    return null;
  }

  if (role === "assistant" || role === "model") {
    return normalizeText(sanitizeAssistantReplyForStreaming(normalized));
  }

  return normalized;
}

function formatSummaryLine(message: OpenWebUiEpisodicMessage) {
  const label = message.role === "assistant" ? "Assistant" : "User";
  const compactContent = message.content.replace(/\s+/g, " ").trim();

  return `- ${label}: ${compactContent}`;
}

function formatContinuityNote(note: string) {
  return `${OPEN_WEBUI_CONTINUITY_NOTE_PREFIX} ${note}`;
}

function formatFinalizedTurnSkipNote(reason: OpenWebUiFinalizedTurnSkipReason) {
  return formatContinuityNote(`assistant reply was not persisted (reason: ${reason}).`);
}

function normalizeSummaryNotes(notes: string[] | null | undefined) {
  if (!Array.isArray(notes)) {
    return [];
  }

  return notes
    .map((note) => normalizeText(note))
    .filter((note): note is string => note !== null);
}

function parseExistingSummaryLines(summary: string | null | undefined) {
  const normalized = normalizeText(summary);

  if (!normalized) {
    return [];
  }

  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== OPEN_WEBUI_EPISODIC_SUMMARY_HEADER);
}

function buildContextSummary(
  previousSummary: string | null,
  archivedMessages: OpenWebUiEpisodicMessage[],
  summaryNotes: string[] = [],
) {
  const lines = [
    ...parseExistingSummaryLines(previousSummary),
    ...archivedMessages.map(formatSummaryLine),
    ...summaryNotes,
  ];

  if (lines.length === 0) {
    return null;
  }

  let keptLines = [...lines];

  while (keptLines.length > 1) {
    const candidate = [OPEN_WEBUI_EPISODIC_SUMMARY_HEADER, ...keptLines].join("\n");

    if (candidate.length <= OPEN_WEBUI_EPISODIC_SUMMARY_MAX_CHARS) {
      return candidate;
    }

    keptLines = keptLines.slice(1);
  }

  const lastLine = keptLines[0] ?? "";
  const availableChars = Math.max(
    0,
    OPEN_WEBUI_EPISODIC_SUMMARY_MAX_CHARS - OPEN_WEBUI_EPISODIC_SUMMARY_HEADER.length - 1,
  );

  if (availableChars === 0) {
    return OPEN_WEBUI_EPISODIC_SUMMARY_HEADER;
  }

  return [
    OPEN_WEBUI_EPISODIC_SUMMARY_HEADER,
    lastLine.slice(Math.max(0, lastLine.length - availableChars)),
  ].join("\n");
}

export function sanitizeOpenWebUiPersistedTurn(input: {
  role: OpenWebUiEpisodicMessage["role"];
  content: string | null | undefined;
}) {
  const content = sanitizePersistedTurnContent(input.role, input.content);

  if (!content) {
    return null;
  }

  return {
    role: input.role,
    content,
  } satisfies OpenWebUiEpisodicMessage;
}

export function buildRollingOpenWebUiThreadState(input: {
  previousSummary: string | null;
  existingMessages: OpenWebUiEpisodicMessage[];
  appendedMessages: OpenWebUiEpisodicMessage[];
  resetThreadState?: boolean;
  summaryNotes?: string[];
}) {
  const baselineMessages = input.resetThreadState ? [] : input.existingMessages;
  const previousSummary = input.resetThreadState ? null : input.previousSummary;
  const summaryNotes = normalizeSummaryNotes(input.summaryNotes);
  const combinedMessages = [...baselineMessages, ...input.appendedMessages]
    .map((message) => sanitizeOpenWebUiPersistedTurn(message))
    .filter((message): message is OpenWebUiEpisodicMessage => message !== null);

  if (combinedMessages.length <= OPEN_WEBUI_EPISODIC_RECENT_MESSAGE_LIMIT) {
    return {
      contextSummary: summaryNotes.length > 0
        ? buildContextSummary(previousSummary, [], summaryNotes)
        : normalizeText(previousSummary),
      messages: combinedMessages,
    };
  }

  const archivedCount = combinedMessages.length - OPEN_WEBUI_EPISODIC_RECENT_MESSAGE_LIMIT;
  const archivedMessages = combinedMessages.slice(0, archivedCount);
  const recentMessages = combinedMessages.slice(archivedCount);

  return {
    contextSummary: buildContextSummary(previousSummary, archivedMessages, summaryNotes),
    messages: recentMessages,
  };
}

export function normalizeOpenWebUiThreadId(value: string | null | undefined) {
  return normalizeText(value);
}

function isStoredEpisodicMessage(value: unknown): value is { role: "user" | "assistant" | "model"; content: string } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.content === "string"
    && typeof candidate.role === "string"
    && VALID_STORED_ROLES.has(candidate.role)
  );
}

export function sanitizeOpenWebUiEpisodicMessages(messages: unknown): OpenWebUiEpisodicMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter(isStoredEpisodicMessage)
    .map((message) => {
      const role = message.role === "model" ? "assistant" : message.role;
      const content = sanitizePersistedTurnContent(message.role, message.content);

      if (!content) {
        return null;
      }

      return {
        role,
        content,
      } satisfies OpenWebUiEpisodicMessage;
    })
    .filter((message): message is OpenWebUiEpisodicMessage => message !== null);
}

export function createBaziOpenWebUiEpisodicRepository(
  db = createDbClient(),
): BaziOpenWebUiEpisodicRepository {
  return {
    async findByClerkUserIdAndThreadId(input) {
      const clerkUserId = normalizeText(input.clerkUserId);
      const threadId = normalizeOpenWebUiThreadId(input.threadId);

      if (!clerkUserId || !threadId) {
        return null;
      }

      const [history] = await db
        .select({
          clerkUserId: baziChatHistories.clerkUserId,
          threadId: baziChatHistories.threadId,
          contextSummary: baziChatHistories.contextSummary,
          continuityState: baziChatHistories.continuityState,
          messages: baziChatHistories.messages,
        })
        .from(baziChatHistories)
        .where(and(
          eq(baziChatHistories.clerkUserId, clerkUserId),
          eq(baziChatHistories.threadId, threadId),
        ))
        .limit(1);

      if (!history?.clerkUserId) {
        return null;
      }

      return {
        clerkUserId: history.clerkUserId,
        threadId,
        contextSummary: normalizeText(history.contextSummary),
        continuityState: sanitizeOpenWebUiContinuityState(history.continuityState),
        messages: sanitizeOpenWebUiEpisodicMessages(history.messages),
      };
    },

    async appendFinalizedTurnByClerkUserIdAndThreadId(input) {
      const clerkUserId = normalizeText(input.clerkUserId);
      const threadId = normalizeOpenWebUiThreadId(input.threadId);
      const userMessage = sanitizeOpenWebUiPersistedTurn({
        role: "user",
        content: input.userMessage,
      });
      const assistantReply = input.skipReason
        ? null
        : sanitizeOpenWebUiPersistedTurn({
          role: "assistant",
          content: input.assistantReply,
        });

      if (!clerkUserId || !threadId || !userMessage) {
        return null;
      }

      const summaryNotes = input.skipReason
        ? [formatFinalizedTurnSkipNote(input.skipReason)]
        : [];
      const appendedMessages = assistantReply
        ? [userMessage, assistantReply]
        : [userMessage];

      const previousState = await this.findByClerkUserIdAndThreadId({
        clerkUserId,
        threadId,
      });
      const nextState = buildRollingOpenWebUiThreadState({
        previousSummary: previousState?.contextSummary ?? null,
        existingMessages: previousState?.messages ?? [],
        appendedMessages,
        resetThreadState: input.resetThreadState,
        summaryNotes,
      });
      const nextContinuityState = input.continuityState === undefined
        ? (input.resetThreadState ? null : previousState?.continuityState ?? null)
        : input.continuityState;

      const [history] = await db
        .insert(baziChatHistories)
        .values({
          clerkUserId,
          threadId,
          contextSummary: nextState.contextSummary,
          continuityState: nextContinuityState,
          messages: nextState.messages.map((message) => ({
            role: message.role === "assistant" ? "model" : message.role,
            content: message.content,
          })),
        })
        .onConflictDoUpdate({
          target: [baziChatHistories.clerkUserId, baziChatHistories.threadId],
          set: {
            contextSummary: nextState.contextSummary,
            continuityState: nextContinuityState,
            messages: nextState.messages.map((message) => ({
              role: message.role === "assistant" ? "model" : message.role,
              content: message.content,
            })),
            updatedAt: new Date(),
          },
        })
        .returning({
          clerkUserId: baziChatHistories.clerkUserId,
          threadId: baziChatHistories.threadId,
          contextSummary: baziChatHistories.contextSummary,
          continuityState: baziChatHistories.continuityState,
          messages: baziChatHistories.messages,
        });

      if (!history?.clerkUserId || !history.threadId) {
        return null;
      }

      return {
        clerkUserId: history.clerkUserId,
        threadId: history.threadId,
        contextSummary: normalizeText(history.contextSummary),
        continuityState: sanitizeOpenWebUiContinuityState(history.continuityState),
        messages: sanitizeOpenWebUiEpisodicMessages(history.messages),
      };
    },
  };
}