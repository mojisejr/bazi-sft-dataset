import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { type RawInputValue } from "@/lib/bazi/schema-types";

// Control the API-key branch of the topic ladder (llm requires a key; throw => consumer-only).
const getGeminiApiKeyMock = vi.fn();
vi.mock("@/lib/env", async () => {
  const actual = await vi.importActual<typeof import("@/lib/env")>("@/lib/env");
  return { ...actual, getGeminiApiKey: getGeminiApiKeyMock };
});

const {
  fetchGroundedReading,
  resolveTopicId,
  resolveGroundingTopicId,
  resolveGroundingPlan,
  INTENT_TO_TOPIC,
  isValidTopicId,
} = await import("@/features/open-webui/reading-bridge");

const RAW_INPUT = {
  birthDate: "1989-01-03",
  birthTime: "08:45",
  gender: "ชาย",
  province: "จันทบุรี",
} as RawInputValue;

const ORIGIN = "http://localhost";

function topicResponse(ok: boolean, humanReading?: unknown): Response {
  return { ok, json: async () => ({ humanReading }) } as unknown as Response;
}

function newdataResponse(ok: boolean, chapters?: unknown): Response {
  return { ok, json: async () => ({ chapters }) } as unknown as Response;
}

function urlOf(call: number, fetchMock: ReturnType<typeof vi.fn>): string {
  return fetchMock.mock.calls[call][0] as string;
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

  test("chit_chat has no consult topic", () => {
    expect(resolveTopicId("chit_chat")).toBeNull();
  });
});

describe("resolveGroundingTopicId", () => {
  test("a valid chip hint wins over the routed topic", () => {
    const validHint = INTENT_TO_TOPIC.love as string;
    expect(isValidTopicId(validHint)).toBe(true);
    expect(resolveGroundingTopicId("wealth_and_investment", validHint)).toBe(validHint);
  });

  test("falls to the routed topic when the hint is invalid", () => {
    expect(resolveGroundingTopicId("wealth_and_investment", "not-a-real-topic")).toBe("wealth_and_investment");
  });

  test("off_topic / chit_chat resolve to null (no consult)", () => {
    expect(resolveGroundingTopicId("off_topic")).toBeNull();
    expect(resolveGroundingTopicId("chit_chat")).toBeNull();
  });
});

describe("resolveGroundingPlan", () => {
  test("natal topic with no timeframe uses the newdata seam", () => {
    expect(resolveGroundingPlan("colors_directions", "none")).toEqual({
      seam: "newdata",
      topicId: "colors_directions",
      requestedTopicId: "colors_directions",
    });
  });

  test("same-day framing stays on the natal seam (engine has no 流日)", () => {
    expect(resolveGroundingPlan("wealth_and_investment", "today")?.seam).toBe("newdata");
    expect(resolveGroundingPlan("career_potential", "tomorrow")?.seam).toBe("newdata");
  });

  test("year/period timeframes route to the time seam (turning_points)", () => {
    expect(resolveGroundingPlan("wealth_and_investment", "next_year")).toEqual({
      seam: "time",
      topicId: "turning_points",
      requestedTopicId: "wealth_and_investment",
    });
    expect(resolveGroundingPlan("love_partner", "period")?.topicId).toBe("turning_points");
    expect(resolveGroundingPlan("health", "in_n_years")?.seam).toBe("time");
  });

  test("the turning_points chapter itself always uses the time seam", () => {
    expect(resolveGroundingPlan("turning_points", "none")?.seam).toBe("time");
  });

  test("non-reading topics resolve to null", () => {
    expect(resolveGroundingPlan("off_topic", "none")).toBeNull();
    expect(resolveGroundingPlan(null, "none")).toBeNull();
  });
});

describe("fetchGroundedReading — natal seam (newdata)", () => {
  test("renders the matching newdata chapter into grounding prose", async () => {
    getGeminiApiKeyMock.mockImplementation(() => {
      throw new Error("no key");
    });
    const fetchMock = vi.fn().mockResolvedValue(
      newdataResponse(true, [
        { id: "wealth_and_investment", title: "โชคลาภ", hasContent: true, boxes: [
          { title: "ภาพรวม", body: "ดวงการเงินแข็งแรง" },
          { title: "จังหวะ", body: "ปีนี้ดาวลาภเด่น" },
        ] },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGroundedReading(ORIGIN, {
      topicId: "wealth_and_investment",
      timeframe: "none",
      rawInput: RAW_INPUT,
    });

    expect(result).toContain("ดวงการเงินแข็งแรง");
    expect(result).toContain("ปีนี้ดาวลาภเด่น");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(urlOf(0, fetchMock)).toBe(`${ORIGIN}/api/reading/newdata-reading`);
    // newdata-reading takes the raw birth input directly.
    expect(bodyOf(0, fetchMock).birthDate).toBe(RAW_INPUT.birthDate);
  });

  test("degrades to the topic ladder when the newdata chapter is empty", async () => {
    getGeminiApiKeyMock.mockImplementation(() => {
      throw new Error("no key");
    });
    const fetchMock = vi
      .fn()
      // newdata: chapter present but no content boxes -> empty render
      .mockResolvedValueOnce(newdataResponse(true, [
        { id: "colors_directions", title: "สีมงคล", hasContent: false, boxes: [] },
      ]))
      // degrade -> topic consumer reading
      .mockResolvedValueOnce(topicResponse(true, "สีมงคลของคุณคือสีเขียว"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGroundedReading(ORIGIN, {
      topicId: "colors_directions",
      timeframe: "none",
      rawInput: RAW_INPUT,
    });

    expect(result).toBe("สีมงคลของคุณคือสีเขียว");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urlOf(0, fetchMock)).toBe(`${ORIGIN}/api/reading/newdata-reading`);
    expect(urlOf(1, fetchMock)).toBe(`${ORIGIN}/api/reading/topic`);
    expect(bodyOf(1, fetchMock).topicId).toBe("colors_directions");
    expect(bodyOf(1, fetchMock).mode).toBe("consumer");
  });
});

describe("fetchGroundedReading — time seam (turning_points)", () => {
  test("a year question grounds on the turning_points topic reading", async () => {
    getGeminiApiKeyMock.mockReturnValue("test-key");
    const fetchMock = vi.fn().mockResolvedValue(topicResponse(true, "ปีหน้าเป็นปีจรดาวลาภ"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGroundedReading(ORIGIN, {
      topicId: "wealth_and_investment",
      timeframe: "next_year",
      rawInput: RAW_INPUT,
    });

    expect(result).toBe("ปีหน้าเป็นปีจรดาวลาภ");
    expect(urlOf(0, fetchMock)).toBe(`${ORIGIN}/api/reading/topic`);
    expect(bodyOf(0, fetchMock).topicId).toBe("turning_points");
    expect(bodyOf(0, fetchMock).mode).toBe("llm");
    expect(bodyOf(0, fetchMock).apiKey).toBe("test-key");
  });
});

describe("fetchGroundedReading — degradation", () => {
  test("returns null for a non-reading topic (caller uses truth packet)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGroundedReading(ORIGIN, {
      topicId: "off_topic",
      timeframe: "none",
      rawInput: RAW_INPUT,
    });

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("returns null when both newdata and topic ladder yield nothing", async () => {
    getGeminiApiKeyMock.mockImplementation(() => {
      throw new Error("no key");
    });
    const fetchMock = vi.fn().mockResolvedValue(newdataResponse(false));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGroundedReading(ORIGIN, {
      topicId: "chart_foundation",
      timeframe: "none",
      rawInput: RAW_INPUT,
    });

    expect(result).toBeNull();
  });

  test("network failure is swallowed, never throws", async () => {
    getGeminiApiKeyMock.mockImplementation(() => {
      throw new Error("no key");
    });
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchGroundedReading(ORIGIN, { topicId: "chart_foundation", timeframe: "none", rawInput: RAW_INPUT }),
    ).resolves.toBeNull();
  });
});
