import { z } from "zod";

import { CalculatedStateSchema, RawInputSchema } from "@/lib/bazi/schema-types";

export const MAX_TRIAGE_TURNS = 2;

export type OpenWebUiSyntheticMetadataPromptKind = "title" | "tags" | "follow_ups";

const OpenWebUiRoleSchema = z.enum(["system", "user", "assistant"]);

const OpenWebUiTextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

const OpenWebUiMessageInputSchema = z.object({
  role: OpenWebUiRoleSchema,
  content: z.union([z.string(), z.array(OpenWebUiTextPartSchema)]),
});

const OpenWebUiBaziConsultContextSchema = z.object({
  rawInput: RawInputSchema,
  calculatedState: CalculatedStateSchema,
});

const OpenWebUiPayloadSchema = z.object({
  messages: z.array(OpenWebUiMessageInputSchema).min(1),
  user: z
    .object({
      id: z.string().trim().min(1).optional(),
    })
    .optional(),
  chat_id: z.string().trim().min(1).optional(),
  chatId: z.string().trim().min(1).optional(),
  conversation_id: z.string().trim().min(1).optional(),
  conversationId: z.string().trim().min(1).optional(),
  baziConsult: OpenWebUiBaziConsultContextSchema.optional(),
});

export const NormalizedChatMessageSchema = z.object({
  role: OpenWebUiRoleSchema,
  content: z.string().trim().min(1),
});

export const ChatRunnerSuccessSchema = z.object({
  status: z.literal("ready"),
  phase: z.literal("phase-2"),
  userId: z.string().trim().min(1).nullable(),
  threadId: z.string().trim().min(1).nullable(),
  continuityBoundary: z.object({
    requestedFreshThreadBoundary: z.boolean(),
    reason: z.enum(["explicit_new_case", "none"]),
  }),
  normalizedMessages: z.array(NormalizedChatMessageSchema).min(1),
  triageMessages: z.array(NormalizedChatMessageSchema).min(1),
  latestUserMessage: NormalizedChatMessageSchema.extend({ role: z.literal("user") }),
  baziConsult: OpenWebUiBaziConsultContextSchema.nullable(),
  streamPlan: z.object({
    transport: z.literal("sse"),
    status: z.literal("deferred"),
  }),
});

export const ChatRunnerErrorSchema = z.object({
  status: z.literal("error"),
  phase: z.literal("phase-2"),
  code: z.enum(["invalid_payload", "missing_user_message"]),
  message: z.string().trim().min(1),
});

export const ChatRunnerResultSchema = z.union([
  ChatRunnerSuccessSchema,
  ChatRunnerErrorSchema,
]);

export type NormalizedChatMessage = z.infer<typeof NormalizedChatMessageSchema>;
export type OpenWebUiBaziConsultContext = z.infer<typeof OpenWebUiBaziConsultContextSchema>;
export type ChatRunnerSuccess = z.infer<typeof ChatRunnerSuccessSchema>;
export type ChatRunnerResult = z.infer<typeof ChatRunnerResultSchema>;

const BAZI_LOGIC_BLOCK_PATTERN = /<bazi_logic\b[^>]*>[\s\S]*?<\/bazi_logic>/giu;
const EXPLICIT_NEW_CASE_PATTERN = /(?:\b(?:new|fresh)\s+case\b|\bnew\s+profile\b|เปิด(?:เคส|ดวง)ใหม่|เริ่ม(?:เคส|ดวง)ใหม่|(?:เคส|ดวง|โปรไฟล์)ใหม่|คนละคน|อีกคนหนึ่ง)/iu;
const SYNTHETIC_METADATA_PROMPT_MARKERS = ["### task:", "### chat history:", "<chat_history>"] as const;

function hasSyntheticMetadataPromptScaffold(content: string) {
  const normalized = content.trim().toLowerCase();

  return SYNTHETIC_METADATA_PROMPT_MARKERS.every((marker) => normalized.includes(marker))
    && normalized.includes("json");
}

function resolveThreadId(payload: z.infer<typeof OpenWebUiPayloadSchema>) {
  return payload.chat_id
    ?? payload.chatId
    ?? payload.conversation_id
    ?? payload.conversationId
    ?? null;
}

export function normalizeMessageContent(
  content: string | Array<{ type: "text"; text: string }>,
  role?: z.infer<typeof OpenWebUiRoleSchema>,
) {
  const text = typeof content === "string"
    ? content.trim()
    : content
      .map((part) => part.text.trim())
      .filter((part) => part.length > 0)
      .join("\n")
      .trim();
  const normalized = role === "assistant"
    ? text.replace(BAZI_LOGIC_BLOCK_PATTERN, "").trim()
    : text;

  if (!normalized) {
    throw new Error("Message content must include text.");
  }

  return normalized;
}

export function normalizeChatMessages(messages: readonly z.input<typeof OpenWebUiMessageInputSchema>[]) {
  return messages.map((message) => NormalizedChatMessageSchema.parse({
    role: message.role,
    content: normalizeMessageContent(message.content, message.role),
  }));
}

export function sliceMessagesForTriage(
  messages: readonly NormalizedChatMessage[],
  maxTurns = MAX_TRIAGE_TURNS,
) {
  const conversationalMessages = messages.filter((message) => message.role !== "system");

  if (conversationalMessages.length <= 1 || maxTurns <= 0) {
    return [...conversationalMessages];
  }

  let userTurnCount = 0;
  let startIndex = conversationalMessages.length - 1;

  for (let index = conversationalMessages.length - 1; index >= 0; index -= 1) {
    startIndex = index;

    if (conversationalMessages[index]?.role === "user") {
      userTurnCount += 1;
    }

    if (userTurnCount >= maxTurns) {
      break;
    }
  }

  return conversationalMessages.slice(startIndex);
}

export function detectExplicitFreshThreadBoundary(content: string) {
  return EXPLICIT_NEW_CASE_PATTERN.test(content.trim());
}

export function detectSyntheticOpenWebUiMetadataPrompt(
  content: string,
): OpenWebUiSyntheticMetadataPromptKind | null {
  const normalized = content.trim().toLowerCase();

  if (!hasSyntheticMetadataPromptScaffold(content)) {
    return null;
  }

  if (normalized.includes("follow-up") && normalized.includes('"follow_ups"')) {
    return "follow_ups";
  }

  if (normalized.includes('"tags"') && normalized.includes("tag")) {
    return "tags";
  }

  if (
    normalized.includes("title")
    && (
      normalized.includes("3-5 word")
      || normalized.includes("3 to 5 word")
      || normalized.includes("concise title")
      || normalized.includes("short title")
      || normalized.includes('"title"')
    )
  ) {
    return "title";
  }

  return null;
}

export function runChatPipeline(payload: unknown): ChatRunnerResult {
  let parsedPayload: z.infer<typeof OpenWebUiPayloadSchema>;

  try {
    parsedPayload = OpenWebUiPayloadSchema.parse(payload);
  } catch (error) {
    return ChatRunnerErrorSchema.parse({
      status: "error",
      phase: "phase-2",
      code: "invalid_payload",
      message: error instanceof Error ? error.message : "Invalid chat payload.",
    });
  }

  let normalizedMessages: NormalizedChatMessage[];

  try {
    normalizedMessages = normalizeChatMessages(parsedPayload.messages);
  } catch (error) {
    return ChatRunnerErrorSchema.parse({
      status: "error",
      phase: "phase-2",
      code: "invalid_payload",
      message: error instanceof Error ? error.message : "Invalid chat payload.",
    });
  }

  const latestUserMessage = [...normalizedMessages].reverse().find((message) => message.role === "user");

  if (!latestUserMessage) {
    return ChatRunnerErrorSchema.parse({
      status: "error",
      phase: "phase-2",
      code: "missing_user_message",
      message: "Chat payload must contain at least one user message.",
    });
  }

  const triageMessages = sliceMessagesForTriage(normalizedMessages);

  return ChatRunnerSuccessSchema.parse({
    status: "ready",
    phase: "phase-2",
    userId: parsedPayload.user?.id ?? null,
    threadId: resolveThreadId(parsedPayload),
    continuityBoundary: {
      requestedFreshThreadBoundary: detectExplicitFreshThreadBoundary(latestUserMessage.content),
      reason: detectExplicitFreshThreadBoundary(latestUserMessage.content)
        ? "explicit_new_case"
        : "none",
    },
    normalizedMessages,
    triageMessages,
    latestUserMessage,
    baziConsult: parsedPayload.baziConsult ?? null,
    streamPlan: {
      transport: "sse",
      status: "deferred",
    },
  });
}