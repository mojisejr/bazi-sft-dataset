import { z } from "zod";

import { CalculatedStateSchema, RawInputSchema } from "@/lib/bazi/schema-types";

export const MAX_TRIAGE_TURNS = 2;

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

function normalizeMessageContent(content: string | Array<{ type: "text"; text: string }>) {
  const normalized = typeof content === "string"
    ? content.trim()
    : content
      .map((part) => part.text.trim())
      .filter((part) => part.length > 0)
      .join("\n")
      .trim();

  if (!normalized) {
    throw new Error("Message content must include text.");
  }

  return normalized;
}

export function normalizeChatMessages(messages: readonly z.input<typeof OpenWebUiMessageInputSchema>[]) {
  return messages.map((message) => NormalizedChatMessageSchema.parse({
    role: message.role,
    content: normalizeMessageContent(message.content),
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