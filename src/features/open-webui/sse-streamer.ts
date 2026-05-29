const SSE_ENCODER = new TextEncoder();

export const OPEN_WEBUI_DUMMY_MODEL = "bazi-open-webui-phase3";
const DEFAULT_GEMINI_STREAM_TIMEOUT_MS = 15_000;
const DEFAULT_GEMINI_STREAM_ERROR_MESSAGE = "ขออภัยค่ะ ตอนนี้การเชื่อมต่อ Gemini ใช้เวลานานหรือมีปัญหา กรุณาลองใหม่อีกครั้ง";

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

type GuardedAssistantReply = {
  model: string;
  text: string;
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

function createTimeoutError(timeoutMs: number) {
  return new Error(`Open WebUI Gemini stream timed out after ${timeoutMs}ms.`);
}

function createAbortError() {
  return new Error("Open WebUI Gemini stream aborted before completion.");
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
  fallbackMessage = DEFAULT_GEMINI_STREAM_ERROR_MESSAGE,
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

      try {
        resolvedReply = await resolveGuardedAssistantReply(assistantReply, timeoutMs, abortSignal);
      } catch {
        resolvedReply = {
          model,
          text: fallbackMessage,
        };
      }

      const effectiveModel = resolvedReply.model || model;
      const contentChunks = splitAssistantReplyIntoChunks(resolvedReply.text);

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
