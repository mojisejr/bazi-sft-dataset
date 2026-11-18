import { afterEach, describe, expect, test, vi } from "vitest";

import {
  ANSWER_FAILED_OBJECT,
  DEFAULT_ANSWER_FAILED_MESSAGE,
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

    expect(JSON.parse(events[1].replace("data: ", ""))).toEqual({ object: ANSWER_FAILED_OBJECT, reason: "timeout" });

    const contentEvents = events.slice(2, -2).map((event) => JSON.parse(event.replace("data: ", "")));
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

describe("failed answers", () => {
  const frames = (output: string) => output.trim().split("\n\n").map((event) => event.replace("data: ", ""));
  const failedFrames = (output: string) =>
    frames(output).filter((event) => event.includes(ANSWER_FAILED_OBJECT)).map((event) => JSON.parse(event));
  const contentOf = (output: string) =>
    frames(output)
      .filter((event) => event.includes('"content"'))
      .map((event) => JSON.parse(event).choices[0].delta.content)
      .join("");
  const failedLogs = (spy: { mock: { calls: unknown[][] } }): Array<Record<string, unknown>> =>
    spy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .filter((line: string) => line.includes("chat_answer_failed"))
      .map((line: string) => JSON.parse(line) as Record<string, unknown>);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const cases: Array<[string, () => Promise<never> | Promise<{ model: string; text: string }>, string, { timeoutMs?: number; abort?: boolean }]> = [
    ["timeout", () => new Promise<never>(() => undefined), "timeout", { timeoutMs: 5 }],
    ["upstream error", () => Promise.reject(Object.assign(new Error("boom"), { code: "gemini_upstream_error" })), "upstream_error", {}],
    ["config error", () => Promise.reject(Object.assign(new Error("boom"), { code: "gemini_config_error" })), "config_error", {}],
    ["empty response", () => Promise.reject(Object.assign(new Error("boom"), { code: "gemini_empty_response" })), "empty_response", {}],
    ["unexpected error", () => Promise.reject(new Error("unexpected")), "unknown", {}],
    ["empty reply text", () => Promise.resolve({ model: "gemini-test", text: "  " }), "empty_reply", {}],
    ["aborted request", () => new Promise<never>(() => undefined), "aborted", { abort: true }],
  ];

  test.each(cases)("%s: one failure frame before the fallback text, one log line, then [DONE]", async (_name, reply, reason, opts) => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const controller = new AbortController();
    if (opts.abort) controller.abort();

    const output = await readStream(createGuardedOpenAiSseStream({
      assistantReply: reply() as Promise<{ model: string; text: string }>,
      chunkDelayMs: 0,
      timeoutMs: opts.timeoutMs ?? 1000,
      abortSignal: controller.signal,
    }));

    expect(failedFrames(output)).toEqual([{ object: ANSWER_FAILED_OBJECT, reason }]);
    const all = frames(output);
    expect(all.findIndex((e) => e.includes(ANSWER_FAILED_OBJECT))).toBeLessThan(all.findIndex((e) => e.includes('"content"')));
    expect(contentOf(output)).toBe(DEFAULT_ANSWER_FAILED_MESSAGE);
    expect(all.at(-1)).toBe("[DONE]");

    const logs = failedLogs(log);
    expect(logs).toHaveLength(1);
    expect(Object.keys(logs[0]).sort()).toEqual(["event", "reason", "waited_ms"]);
    expect(logs[0]).toMatchObject({ event: "chat_answer_failed", reason });
  });

  test("the error message never reaches the stream or the log", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const secretish = "question-text-and-member-9f95";
    const output = await readStream(createGuardedOpenAiSseStream({
      assistantReply: Promise.reject(Object.assign(new Error(secretish), { code: "gemini_upstream_error" })),
      chunkDelayMs: 0,
    }));
    expect(output).not.toContain(secretish);
    expect(log.mock.calls.flat().join(" ")).not.toContain(secretish);
  });

  test("the member-facing text names no AI provider", () => {
    expect(DEFAULT_ANSWER_FAILED_MESSAGE).not.toMatch(/gemini|openai|gpt|claude|llm|google/i);
  });

  test("a real answer carries no failure frame and logs nothing", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const output = await readStream(createGuardedOpenAiSseStream({
      assistantReply: Promise.resolve({ model: "gemini-test", text: "สวัสดีโลก" }),
      chunkDelayMs: 0,
    }));
    expect(output).not.toContain(ANSWER_FAILED_OBJECT);
    expect(contentOf(output)).toBe("สวัสดีโลก");
    expect(failedLogs(log)).toEqual([]);
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
