import { afterEach, describe, expect, test, vi } from "vitest";

import {
  buildDummyAssistantReply,
  createGuardedOpenAiSseStream,
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

describe("createGuardedOpenAiSseStream", () => {
  test("emits role, content deltas, stop, and [DONE] after the assistant reply resolves", async () => {
    const output = await readStream(createGuardedOpenAiSseStream({
      completionId: "chatcmpl-guarded",
      created: 123,
      model: "gemini-test",
      assistantReply: Promise.resolve({
        model: "gemini-test",
        text: "สวัสดีโลก",
      }),
      chunkDelayMs: 0,
    }));

    const events = output.trim().split("\n\n");

    expect(events).toEqual([
      'data: {"id":"chatcmpl-guarded","object":"chat.completion.chunk","created":123,"model":"gemini-test","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-guarded","object":"chat.completion.chunk","created":123,"model":"gemini-test","choices":[{"index":0,"delta":{"content":"สวัสดีโลก"},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-guarded","object":"chat.completion.chunk","created":123,"model":"gemini-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
      "data: [DONE]",
    ]);
  });

  test("falls back to a terminal assistant message and closes on timeout", async () => {
    const output = await readStream(createGuardedOpenAiSseStream({
      completionId: "chatcmpl-timeout",
      created: 123,
      model: "gemini-test",
      assistantReply: new Promise(() => undefined),
      chunkDelayMs: 0,
      timeoutMs: 5,
      fallbackMessage: "timeout fallback",
    }));
    const events = output.trim().split("\n\n");

    expect(events[0]).toBe(
      'data: {"id":"chatcmpl-timeout","object":"chat.completion.chunk","created":123,"model":"gemini-test","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}'
    );

    const contentEvents = events.slice(1, -2).map((event) => JSON.parse(event.replace("data: ", "")));
    const reconstructedContent = contentEvents
      .map((event) => event.choices[0]?.delta?.content ?? "")
      .join("");

    expect(reconstructedContent).toBe("timeout fallback");
    expect(events.at(-2)).toBe(
      'data: {"id":"chatcmpl-timeout","object":"chat.completion.chunk","created":123,"model":"gemini-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}'
    );
    expect(events.at(-1)).toBe("data: [DONE]");
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
