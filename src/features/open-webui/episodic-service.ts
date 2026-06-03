import { and, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziChatHistories } from "@/db/schema";
import { sanitizeAssistantReplyForStreaming } from "@/features/open-webui/sse-streamer";

export type OpenWebUiEpisodicMessage = {
  role: "user" | "assistant";
  content: string;
};

export type PersistedOpenWebUiThreadState = {
  clerkUserId: string;
  threadId: string;
  contextSummary: string | null;
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
    assistantReply: string;
  }) => Promise<PersistedOpenWebUiThreadState | null>;
};

export const OPEN_WEBUI_EPISODIC_RECENT_MESSAGE_LIMIT = 6;
export const OPEN_WEBUI_EPISODIC_SUMMARY_HEADER = "Same-thread visible continuity:";
export const OPEN_WEBUI_EPISODIC_SUMMARY_MAX_CHARS = 1_200;

const VALID_STORED_ROLES = new Set(["user", "assistant", "model"]);

function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
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
) {
  const lines = [
    ...parseExistingSummaryLines(previousSummary),
    ...archivedMessages.map(formatSummaryLine),
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
}) {
  const combinedMessages = [...input.existingMessages, ...input.appendedMessages]
    .map((message) => sanitizeOpenWebUiPersistedTurn(message))
    .filter((message): message is OpenWebUiEpisodicMessage => message !== null);

  if (combinedMessages.length <= OPEN_WEBUI_EPISODIC_RECENT_MESSAGE_LIMIT) {
    return {
      contextSummary: normalizeText(input.previousSummary),
      messages: combinedMessages,
    };
  }

  const archivedCount = combinedMessages.length - OPEN_WEBUI_EPISODIC_RECENT_MESSAGE_LIMIT;
  const archivedMessages = combinedMessages.slice(0, archivedCount);
  const recentMessages = combinedMessages.slice(archivedCount);

  return {
    contextSummary: buildContextSummary(input.previousSummary, archivedMessages),
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
      const assistantReply = sanitizeOpenWebUiPersistedTurn({
        role: "assistant",
        content: input.assistantReply,
      });

      if (!clerkUserId || !threadId || !userMessage || !assistantReply) {
        return null;
      }

      const previousState = await this.findByClerkUserIdAndThreadId({
        clerkUserId,
        threadId,
      });
      const nextState = buildRollingOpenWebUiThreadState({
        previousSummary: previousState?.contextSummary ?? null,
        existingMessages: previousState?.messages ?? [],
        appendedMessages: [userMessage, assistantReply],
      });

      const [history] = await db
        .insert(baziChatHistories)
        .values({
          clerkUserId,
          threadId,
          contextSummary: nextState.contextSummary,
          messages: nextState.messages.map((message) => ({
            role: message.role === "assistant" ? "model" : message.role,
            content: message.content,
          })),
        })
        .onConflictDoUpdate({
          target: [baziChatHistories.clerkUserId, baziChatHistories.threadId],
          set: {
            contextSummary: nextState.contextSummary,
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
          messages: baziChatHistories.messages,
        });

      if (!history?.clerkUserId || !history.threadId) {
        return null;
      }

      return {
        clerkUserId: history.clerkUserId,
        threadId: history.threadId,
        contextSummary: normalizeText(history.contextSummary),
        messages: sanitizeOpenWebUiEpisodicMessages(history.messages),
      };
    },
  };
}