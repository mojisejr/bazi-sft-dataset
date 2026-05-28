import { afterEach, describe, expect, test, vi } from "vitest";

import {
  buildDummyAssistantReply,
  createOpenAiSseStream,
  splitAssistantReplyIntoChunks,
} from "@/features/open-webui/sse-streamer";

async function readStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      return output;
    }

    output += decoder.decode(value, { stream: true });
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createOpenAiSseStream", () => {
  test("emits OpenAI-compatible chunk events and closes with [DONE]", async () => {
    const output = await readStream(createOpenAiSseStream({
      completionId: "chatcmpl-test",
      created: 123,
      model: "bazi-open-webui-test",
      contentChunks: ["สวัสดี", " โลก"],
    }));

    const events = output.trim().split("\n\n");

    expect(events).toEqual([
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":123,"model":"bazi-open-webui-test","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":123,"model":"bazi-open-webui-test","choices":[{"index":0,"delta":{"content":"สวัสดี"},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":123,"model":"bazi-open-webui-test","choices":[{"index":0,"delta":{"content":" โลก"},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":123,"model":"bazi-open-webui-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
      "data: [DONE]",
    ]);
  });

  test("keeps the stream open until delayed content chunks are emitted", async () => {
    vi.useFakeTimers();

    const reader = createOpenAiSseStream({
      completionId: "chatcmpl-test",
      created: 123,
      model: "bazi-open-webui-test",
      contentChunks: ["สวัสดี"],
      chunkDelayMs: 20,
    }).getReader();

    const firstChunk = await reader.read();
    expect(firstChunk.done).toBe(false);
    expect(new TextDecoder().decode(firstChunk.value)).toContain('"role":"assistant"');

    const delayedChunkPromise = reader.read();
    await Promise.resolve();
    expect(vi.isFakeTimers()).toBe(true);

    let delayedChunkSettled = false;
    delayedChunkPromise.then(() => {
      delayedChunkSettled = true;
    });

    await Promise.resolve();
    expect(delayedChunkSettled).toBe(false);

    await vi.advanceTimersByTimeAsync(20);

    const delayedChunk = await delayedChunkPromise;
    expect(delayedChunk.done).toBe(false);
    expect(new TextDecoder().decode(delayedChunk.value)).toContain('"content":"สวัสดี"');
  });
});

describe("buildDummyAssistantReply", () => {
  test("includes the latest user prompt in the dummy reply", () => {
    expect(buildDummyAssistantReply("อยากรู้ดวงการงาน")).toBe(
      "Bazi Open WebUI Phase 3 stream ready: อยากรู้ดวงการงาน",
    );
  });
});

describe("splitAssistantReplyIntoChunks", () => {
  test("splits unicode-safe reply text into multiple ordered chunks", () => {
    expect(splitAssistantReplyIntoChunks("สวัสดีโลก async SSE", 6)).toEqual([
      "สวัสดี",
      "โลก as",
      "ync SS",
      "E",
    ]);
  });
});
