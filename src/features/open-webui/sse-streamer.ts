const SSE_ENCODER = new TextEncoder();

export const OPEN_WEBUI_DUMMY_MODEL = "bazi-open-webui-phase3";

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

      for (const chunk of contentChunks) {
        if (!chunk) {
          continue;
        }

        await waitForChunkDelay(chunkDelayMs);

        controller.enqueue(encodeSseEvent(JSON.stringify(createChatCompletionChunk({
          completionId,
          created,
          model,
          delta: { content: chunk },
          finishReason: null,
        }))));
      }

      await waitForChunkDelay(chunkDelayMs);

      controller.enqueue(encodeSseEvent(JSON.stringify(createChatCompletionChunk({
        completionId,
        created,
        model,
        delta: {},
        finishReason: "stop",
      }))));
      controller.enqueue(encodeSseEvent("[DONE]"));
      controller.close();
    },
  });
}
