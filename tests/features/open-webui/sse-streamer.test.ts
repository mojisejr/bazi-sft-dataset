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

  test("emits a Glass Box trace frame before the answer tokens when the reply carries a trace", async () => {
    const trace = {
      heard: {
        topicId: "wealth_and_investment",
        timeframe: "none",
        requiresBaziConsult: true,
        confidence: 0.91,
        birthResolved: true,
      },
      truthUsed: { seam: "wealth_and_investment", injectedReadingText: '{"intent":"wealth"}' },
      filters: { honestPrecisionApplied: false },
    };
    const output = await readStream(createGuardedOpenAiSseStream({
      completionId: "chatcmpl-trace",
      created: 123,
      model: "gemini-test",
      assistantReply: Promise.resolve({ model: "gemini-test", text: "สวัสดีโลก", trace }),
      chunkDelayMs: 0,
    }));

    const events = output.trim().split("\n\n").map((event) => event.replace("data: ", ""));
    const traceIndex = events.findIndex((event) => event.includes('"object":"glass-box.trace"'));
    const contentIndex = events.findIndex((event) => event.includes('"content":"สวัสดีโลก"'));

    // trace frame present and strictly before the first answer token
    expect(traceIndex).toBeGreaterThan(-1);
    expect(contentIndex).toBeGreaterThan(traceIndex);
    expect(JSON.parse(events[traceIndex])).toEqual({ object: "glass-box.trace", trace });
  });

  test("the trace flag never changes the answer — content frames are identical with and without trace", async () => {
    const text = "ภาพรวมการงานปีนี้ดีขึ้นค่ะ";
    const contentOf = (output: string) =>
      output
        .trim()
        .split("\n\n")
        .map((event) => event.replace("data: ", ""))
        .filter((event) => event.includes('"content"'))
        .map((event) => JSON.parse(event).choices[0].delta.content)
        .join("");

    const withoutTrace = await readStream(createGuardedOpenAiSseStream({
      completionId: "chatcmpl-a",
      created: 1,
      model: "gemini-test",
      assistantReply: Promise.resolve({ model: "gemini-test", text }),
      chunkDelayMs: 0,
    }));
    const withTrace = await readStream(createGuardedOpenAiSseStream({
      completionId: "chatcmpl-b",
      created: 1,
      model: "gemini-test",
      assistantReply: Promise.resolve({
        model: "gemini-test",
        text,
        trace: {
          heard: { topicId: "career", timeframe: "none", requiresBaziConsult: true, confidence: 0.9, birthResolved: true },
          truthUsed: { seam: "career", injectedReadingText: "x" },
          filters: { honestPrecisionApplied: false },
        },
      }),
      chunkDelayMs: 0,
    }));

    expect(contentOf(withoutTrace)).toBe(text);
    expect(contentOf(withTrace)).toBe(text);
    // and the no-trace stream contains no trace frame at all
    expect(withoutTrace).not.toContain("glass-box.trace");
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
