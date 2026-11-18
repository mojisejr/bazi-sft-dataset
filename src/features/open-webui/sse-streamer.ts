const SSE_ENCODER = new TextEncoder();

export const OPEN_WEBUI_DUMMY_MODEL = "bazi-open-webui-phase3";
const DEFAULT_GEMINI_STREAM_TIMEOUT_MS = 15_000;
// Shown to the member when no answer was produced: the team's wording (2026-11-18), naming no AI
// provider and pointing to LINE OA. The FE charges only when the stream carries no ANSWER_FAILED_OBJECT
// frame, and mootech-fe lib/chat/failed-reply.ts holds the same text to keep it out of chat history.
export const DEFAULT_ANSWER_FAILED_MESSAGE =
  "ขออภัยนะคะ ตอนนี้ระบบอาจใช้เวลาประมวลผลนานกว่าปกติหรือขัดข้องชั่วคราว รบกวนลองใหม่อีกครั้งน้า~ แต่ถ้าลองแล้วยังไม่หาย ทักหาแอดมินได้เลยที่ LINE OA: @mumate ยินดีดูแลค่ะ";

// A failed answer is marked in the stream with one extra frame, the same kind as the Glass Box trace:
// clients that only read choices[0].delta.content ignore it and still show the fallback text, and the
// FE chat route reads it to decide not to charge. reason is a fixed code, never member content.
export const ANSWER_FAILED_OBJECT = "mumate.answer.failed";

export type AnswerFailedReason =
  | "timeout"
  | "aborted"
  | "config_error"
  | "upstream_error"
  | "empty_response"
  | "empty_reply"
  | "unknown";

type ChatCompletionChunk = {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: "assistant";
      content?: string;
    };
    finish_reason: "stop" | null;
  }>;
};

type OpenAiSseStreamOptions = {
  completionId?: string;
  created?: number;
  model?: string;
  contentChunks: readonly string[];
  chunkDelayMs?: number;
};

// Glass Box (v2, Track B1): an observability frame the chat emits BEFORE the answer tokens when the
// caller opted in (header flag). It only EXPOSES what the pipeline already heard/used — it never
// changes the answer. Default off in prod (no flag = no trace = PDPA-clean). Realtime, never stored.
export const GLASS_BOX_TRACE_OBJECT = "glass-box.trace";

export type GlassBoxTrace = {
  /** what the triage understood from the user's turn */
  heard: {
    topicId: string | null;
    timeframe: string | null;
    requiresBaziConsult: boolean;
    confidence: number;
    birthResolved: boolean;
  };
  /** the engine truth that was actually injected into the compose call */
  truthUsed: {
    seam: string | null;
    injectedReadingText: string | null;
  };
  /** disposition filters the pipeline applied before composing */
  filters: {
    honestPrecisionApplied: boolean;
  };
};

type GuardedAssistantReply = {
  model: string;
  text: string;
  /** present only when the Glass Box flag was on for this request */
  trace?: GlassBoxTrace;
};

type GuardedOpenAiSseStreamOptions = {
  completionId?: string;
  created?: number;
  model?: string;
  assistantReply: Promise<GuardedAssistantReply>;
  chunkDelayMs?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  fallbackMessage?: string;
};

const DEFAULT_CHUNK_DELAY_MS = 20;
const DEFAULT_REPLY_CHUNK_SIZE = 12;

function waitForChunkDelay(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function encodeSseEvent(data: string) {
  return SSE_ENCODER.encode(`data: ${data}\n\n`);
}

function encodeTraceEvent(trace: GlassBoxTrace) {
  return encodeSseEvent(JSON.stringify({ object: GLASS_BOX_TRACE_OBJECT, trace }));
}

class GuardedReplyError extends Error {
  constructor(readonly reason: "timeout" | "aborted", message: string) {
    super(message);
  }
}

function createTimeoutError(timeoutMs: number) {
  return new GuardedReplyError("timeout", `Open WebUI Gemini stream timed out after ${timeoutMs}ms.`);
}

function createAbortError() {
  return new GuardedReplyError("aborted", "Open WebUI Gemini stream aborted before completion.");
}

const UPSTREAM_REASONS: Record<string, AnswerFailedReason> = {
  gemini_config_error: "config_error",
  gemini_upstream_error: "upstream_error",
  gemini_empty_response: "empty_response",
};

/** Map a caught failure to a fixed reason code. Reads only the error's class and code. */
export function answerFailedReasonOf(error: unknown): AnswerFailedReason {
  if (error instanceof GuardedReplyError) return error.reason;
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && code in UPSTREAM_REASONS) return UPSTREAM_REASONS[code];
  return "unknown";
}

function encodeAnswerFailedEvent(reason: AnswerFailedReason) {
  return encodeSseEvent(JSON.stringify({ object: ANSWER_FAILED_OBJECT, reason }));
}

function logAnswerFailed(reason: AnswerFailedReason, waitedMs: number) {
  // bounded metadata only: no question, answer, member id or error message
  console.log(JSON.stringify({ event: "chat_answer_failed", reason, waited_ms: waitedMs }));
}

function createSignalAbortPromise(signal: AbortSignal) {
  return new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(createAbortError());
      return;
    }

    signal.addEventListener("abort", () => reject(createAbortError()), { once: true });
  });
}

async function resolveGuardedAssistantReply(
  assistantReply: Promise<GuardedAssistantReply>,
  timeoutMs: number,
  abortSignal?: AbortSignal,
) {
  const guardPromises: Array<Promise<GuardedAssistantReply>> = [assistantReply];

  guardPromises.push(new Promise<GuardedAssistantReply>((_, reject) => {
    setTimeout(() => reject(createTimeoutError(timeoutMs)), timeoutMs);
  }));

  if (abortSignal) {
    guardPromises.push(createSignalAbortPromise(abortSignal));
  }

  return Promise.race(guardPromises);
}

async function streamAssistantChunks(options: {
  controller: ReadableStreamDefaultController<Uint8Array>;
  completionId: string;
  created: number;
  model: string;
  contentChunks: readonly string[];
  chunkDelayMs: number;
}) {
  for (const chunk of options.contentChunks) {
    if (!chunk) {
      continue;
    }

    await waitForChunkDelay(options.chunkDelayMs);

    options.controller.enqueue(encodeSseEvent(JSON.stringify(createChatCompletionChunk({
      completionId: options.completionId,
      created: options.created,
      model: options.model,
      delta: { content: chunk },
      finishReason: null,
    }))));
  }
}

async function closeAssistantStream(options: {
  controller: ReadableStreamDefaultController<Uint8Array>;
  completionId: string;
  created: number;
  model: string;
  chunkDelayMs: number;
}) {
  await waitForChunkDelay(options.chunkDelayMs);

  options.controller.enqueue(encodeSseEvent(JSON.stringify(createChatCompletionChunk({
    completionId: options.completionId,
    created: options.created,
    model: options.model,
    delta: {},
    finishReason: "stop",
  }))));
  options.controller.enqueue(encodeSseEvent("[DONE]"));
  options.controller.close();
}

function createChatCompletionChunk(options: {
  completionId: string;
  created: number;
  model: string;
  delta: ChatCompletionChunk["choices"][number]["delta"];
  finishReason: ChatCompletionChunk["choices"][number]["finish_reason"];
}): ChatCompletionChunk {
  return {
    id: options.completionId,
    object: "chat.completion.chunk",
    created: options.created,
    model: options.model,
    choices: [
      {
        index: 0,
        delta: options.delta,
        finish_reason: options.finishReason,
      },
    ],
  };
}

export function buildDummyAssistantReply(prompt: string) {
  return `Bazi Open WebUI Phase 3 stream ready: ${prompt}`;
}

export function splitAssistantReplyIntoChunks(
  reply: string,
  chunkSize = DEFAULT_REPLY_CHUNK_SIZE,
): string[] {
  if (!reply) {
    return [];
  }

  const symbols = Array.from(reply);
  const safeChunkSize = Math.max(1, chunkSize);
  const chunks: string[] = [];

  for (let index = 0; index < symbols.length; index += safeChunkSize) {
    chunks.push(symbols.slice(index, index + safeChunkSize).join(""));
  }

  return chunks;
}

export function createOpenAiSseStream({
  completionId = `chatcmpl-${crypto.randomUUID()}`,
  created = Math.floor(Date.now() / 1000),
  model = OPEN_WEBUI_DUMMY_MODEL,
  contentChunks,
  chunkDelayMs = DEFAULT_CHUNK_DELAY_MS,
}: OpenAiSseStreamOptions): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encodeSseEvent(JSON.stringify(createChatCompletionChunk({
        completionId,
        created,
        model,
        delta: { role: "assistant" },
        finishReason: null,
      }))));

      await streamAssistantChunks({
        controller,
        completionId,
        created,
        model,
        contentChunks,
        chunkDelayMs,
      });
      await closeAssistantStream({
        controller,
        completionId,
        created,
        model,
        chunkDelayMs,
      });
    },
  });
}

export function createGuardedOpenAiSseStream({
  completionId = `chatcmpl-${crypto.randomUUID()}`,
  created = Math.floor(Date.now() / 1000),
  model = OPEN_WEBUI_DUMMY_MODEL,
  assistantReply,
  chunkDelayMs = DEFAULT_CHUNK_DELAY_MS,
  timeoutMs = DEFAULT_GEMINI_STREAM_TIMEOUT_MS,
  abortSignal,
  fallbackMessage = DEFAULT_ANSWER_FAILED_MESSAGE,
}: GuardedOpenAiSseStreamOptions): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encodeSseEvent(JSON.stringify(createChatCompletionChunk({
        completionId,
        created,
        model,
        delta: { role: "assistant" },
        finishReason: null,
      }))));

      let resolvedReply: GuardedAssistantReply;
      let failedReason: AnswerFailedReason | null = null;
      const startedAt = Date.now();

      try {
        resolvedReply = await resolveGuardedAssistantReply(assistantReply, timeoutMs, abortSignal);
        if (!resolvedReply.text?.trim()) failedReason = "empty_reply";
      } catch (error) {
        failedReason = answerFailedReasonOf(error);
        resolvedReply = { model, text: "" };
      }

      if (failedReason) {
        logAnswerFailed(failedReason, Date.now() - startedAt);
        controller.enqueue(encodeAnswerFailedEvent(failedReason));
        resolvedReply = { model: resolvedReply.model || model, text: fallbackMessage };
      }

      const effectiveModel = resolvedReply.model || model;
      const contentChunks = splitAssistantReplyIntoChunks(resolvedReply.text);

      // Glass Box: surface the trace frame before any answer token when the caller opted in.
      // Absent on the fallback path and whenever the flag was off, so prod streams are untouched.
      if (resolvedReply.trace) {
        controller.enqueue(encodeTraceEvent(resolvedReply.trace));
      }

      await streamAssistantChunks({
        controller,
        completionId,
        created,
        model: effectiveModel,
        contentChunks,
        chunkDelayMs,
      });
      await closeAssistantStream({
        controller,
        completionId,
        created,
        model: effectiveModel,
        chunkDelayMs,
      });
    },
  });
}
