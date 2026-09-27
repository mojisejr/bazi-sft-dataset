/**
 * mumate-vercel-to-do-001 slice 2 — ไม่มีการเรียก LLM ไหนค้างได้ตลอดไปใน container (นอก Vercel ไม่มีใครฆ่าฟังก์ชัน)
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { GoogleGenAI } from "@google/genai";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { DEFAULT_LLM_TIMEOUT_MS, genAiClientOptions, llmTimeoutMs } from "@/lib/llm-timeout";

describe("llmTimeoutMs", () => {
  test("defaults just under Vercel's 300 s ceiling, so nothing changes on Vercel", () => {
    expect(DEFAULT_LLM_TIMEOUT_MS).toBe(290_000);
    expect(llmTimeoutMs({})).toBe(290_000);
  });

  test("LLM_TIMEOUT_MS overrides; junk falls back to the default", () => {
    expect(llmTimeoutMs({ LLM_TIMEOUT_MS: "45000" })).toBe(45_000);
    expect(llmTimeoutMs({ LLM_TIMEOUT_MS: "" })).toBe(290_000);
    expect(llmTimeoutMs({ LLM_TIMEOUT_MS: "abc" })).toBe(290_000);
    expect(llmTimeoutMs({ LLM_TIMEOUT_MS: "-5" })).toBe(290_000);
  });

  test("genAiClientOptions carries the key and the timeout", () => {
    expect(genAiClientOptions("k", 1234)).toEqual({ apiKey: "k", httpOptions: { timeout: 1234 } });
  });
});

describe("a Gemini call to an upstream that never answers", () => {
  let server: Server;
  let baseUrl = "";
  beforeAll(async () => {
    server = createServer(() => {
      /* never respond */
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  test("gives up at the configured timeout instead of hanging", async () => {
    const opts = genAiClientOptions("test-key", 300);
    const ai = new GoogleGenAI({ ...opts, httpOptions: { ...opts.httpOptions, baseUrl } });
    const started = Date.now();
    await expect(ai.models.generateContent({ model: "gemini-test", contents: "hi" })).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(3_000);
  });
});

describe("every LLM call site uses the timeout", () => {
  const src = (pattern: string) =>
    execFileSync("git", ["grep", "-l", "-E", pattern, "--", "src"], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);

  test("every new GoogleGenAI(...) goes through genAiClientOptions", () => {
    const offenders = src("new GoogleGenAI\\(").filter((f) =>
      /new GoogleGenAI\((?!genAiClientOptions\()/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  test("every direct fetch to an LLM API carries llmFetchSignal", () => {
    const files = src("generativelanguage\\.googleapis\\.com|OPENCODE_BASE_URL\\}/chat|ANTHROPIC_BASE_URL\\}/v1/messages");
    const offenders = files.filter((f) => {
      const text = readFileSync(f, "utf8");
      const fetches = text.split(/await fetch(?:Impl)?\(/).slice(1);
      return fetches.some(
        (chunk) => /googleapis|OPENCODE|ANTHROPIC|\burl\b/.test(chunk.slice(0, 200)) && !/llmFetchSignal\(\)/.test(chunk.slice(0, 1200)),
      );
    });
    expect(offenders).toEqual([]);
  });
});
