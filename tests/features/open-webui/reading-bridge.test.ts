import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { type RawInputValue } from "@/lib/bazi/schema-types";

// Control the API-key branch of the fallback ladder (llm requires a key; throw => consumer-only).
const getGeminiApiKeyMock = vi.fn();
vi.mock("@/lib/env", async () => {
  const actual = await vi.importActual<typeof import("@/lib/env")>("@/lib/env");
  return { ...actual, getGeminiApiKey: getGeminiApiKeyMock };
});

const { fetchGroundedReading, resolveTopicId, INTENT_TO_TOPIC, isValidTopicId } = await import(
  "@/features/open-webui/reading-bridge"
);

const RAW_INPUT = {
  birthDate: "1989-01-03",
  birthTime: "08:45",
  gender: "ชาย",
  province: "จันทบุรี",
} as RawInputValue;

const ORIGIN = "http://localhost";

function fetchResponse(ok: boolean, humanReading?: unknown): Response {
  return { ok, json: async () => ({ humanReading }) } as unknown as Response;
}

function bodyOf(call: number, fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string);
}

beforeEach(() => {
  getGeminiApiKeyMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("resolveTopicId", () => {
  test("maps each consult intent to its canonical reading topic", () => {
    expect(resolveTopicId("wealth")).toBe("wealth_and_investment");
    expect(resolveTopicId("love")).toBe("love_partner");
    expect(resolveTopicId("career")).toBe("career_potential");
    expect(resolveTopicId("health")).toBe("health");
    expect(resolveTopicId("general_reading")).toBe("chart_foundation");
  });

  test("a valid explicit topic hint wins over the intent mapping", () => {
    const validHint = INTENT_TO_TOPIC.love as string;
    expect(isValidTopicId(validHint)).toBe(true);
    expect(resolveTopicId("wealth", validHint)).toBe(validHint);
  });

  test("an invalid topic hint falls back to the intent mapping", () => {
    expect(resolveTopicId("wealth", "not-a-real-topic")).toBe("wealth_and_investment");
  });

  test("chit_chat has no consult topic", () => {
    expect(resolveTopicId("chit_chat")).toBeNull();
  });
});

describe("fetchGroundedReading", () => {
  test("consumer-only ladder (no api key) returns trimmed humanReading", async () => {
    getGeminiApiKeyMock.mockImplementation(() => {
      throw new Error("no key");
    });
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse(true, "  ซินแสฟันธง prose  "));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGroundedReading(ORIGIN, {
      topicId: "wealth_and_investment",
      rawInput: RAW_INPUT,
    });

    expect(result).toBe("ซินแสฟันธง prose");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${ORIGIN}/api/reading/topic`);
    const body = bodyOf(0, fetchMock);
    expect(body.mode).toBe("consumer");
    expect(body).not.toHaveProperty("apiKey");
    expect(body.topicId).toBe("wealth_and_investment");
  });

  test("llm attempt comes first when an api key exists and carries the key", async () => {
    getGeminiApiKeyMock.mockReturnValue("test-key");
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse(true, "llm grounded reading"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGroundedReading(ORIGIN, {
      topicId: "love_partner",
      rawInput: RAW_INPUT,
    });

    expect(result).toBe("llm grounded reading");
    expect(fetchMock).toHaveBeenCalledTimes(1); // llm succeeded, consumer not needed
    const body = bodyOf(0, fetchMock);
    expect(body.mode).toBe("llm");
    expect(body.apiKey).toBe("test-key");
  });

  test("falls from a failed llm attempt to consumer mode", async () => {
    getGeminiApiKeyMock.mockReturnValue("test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fetchResponse(false)) // llm: HTTP not ok
      .mockResolvedValueOnce(fetchResponse(true, "consumer reading")); // consumer ok
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGroundedReading(ORIGIN, {
      topicId: "health",
      rawInput: RAW_INPUT,
    });

    expect(result).toBe("consumer reading");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodyOf(0, fetchMock).mode).toBe("llm");
    expect(bodyOf(1, fetchMock).mode).toBe("consumer");
  });

  test("returns null when every attempt yields empty humanReading (caller uses truth packet)", async () => {
    getGeminiApiKeyMock.mockImplementation(() => {
      throw new Error("no key");
    });
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse(true, "   ")); // whitespace only
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGroundedReading(ORIGIN, {
      topicId: "career_potential",
      rawInput: RAW_INPUT,
    });

    expect(result).toBeNull();
  });

  test("returns null on network failure (swallowed, never throws)", async () => {
    getGeminiApiKeyMock.mockImplementation(() => {
      throw new Error("no key");
    });
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchGroundedReading(ORIGIN, { topicId: "chart_foundation", rawInput: RAW_INPUT }),
    ).resolves.toBeNull();
  });
});
