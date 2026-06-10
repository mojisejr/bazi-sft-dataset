import { describe, expect, test, vi } from "vitest";

import {
  createDeleteReadingSessionHandler,
  createGetReadingSessionHandler,
  createListReadingSessionsHandler,
  createSaveReadingSessionHandler,
  SaveReadingSessionRequestSchema,
  type ReadingSessionAuthenticate,
  type ReadingSessionDetail,
  type ReadingSessionListItem,
} from "@/lib/bazi/reading-sessions";
import { buildPayload, formStateFromRawInput, type FormState } from "@/lib/bazi/trainer-workspace";

const VALID_SESSION_ID = "5dca0c34-9f8f-4f42-8e1e-6787dce1dd7e";

// calculatedState ที่ valid ตาม CalculatedStateSchema (รูปเดียวกับ dataset-save-route test)
function validCalculatedState() {
  return {
    fourPillars: {
      year: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
      month: { stem: "戊", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
      day: { stem: "己", branch: "巳", hiddenStems: ["丙", "庚", "戊"] },
      hour: { stem: "辛", branch: "未", hiddenStems: ["己", "丁", "乙"] },
    },
    dayMaster: "己",
    strengthScore: 3.07,
    tenGods: {
      yearStem: "正财",
      yearBranch: "伤官,正财,劫财",
      monthStem: "劫财",
      monthBranch: "伤官,正财,劫财",
      dayStem: "比肩",
      dayBranch: "正印,伤官,劫财",
      hourStem: "正财",
      hourBranch: "伤官,正财,劫财",
    },
    twelveQi: {
      yearBranch: "沐浴",
      monthBranch: "沐浴",
      dayBranch: "帝旺",
      hourBranch: "沐浴",
    },
    elementMetaphors: [
      {
        element: "earth",
        metaphor: "fertile cultivated soil that nurtures, absorbs, and organizes",
      },
    ],
    sixtyJiaziCorePersona: {
      code: "己巳",
      narrative: "Builds influence patiently, then turns preparation into visible results.",
      precedenceNotes: ["Near solar-term boundary."],
    },
  };
}

function createValidSessionBody() {
  return {
    label: "เคสรีวิว",
    status: "in_progress",
    rawInput: {
      birthDate: "1992-08-21",
      birthTime: "14:35",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    },
    calculatedState: validCalculatedState(),
    sessionData: {
      version: 1,
      provider: "gemini",
      topicStates: {
        chart_foundation: { status: "done", result: null, error: null },
      },
      corrections: {},
      readings: { chart_foundation: "คำอ่านบทที่ 1" },
      relationshipLines: null,
    },
  };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/reading/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const authedAs = (userId: string): ReadingSessionAuthenticate =>
  vi.fn().mockResolvedValue({ userId, isAuthenticated: true });

describe("SaveReadingSessionRequestSchema", () => {
  test("accepts a valid body and defaults status to in_progress", () => {
    const body = createValidSessionBody();
    delete (body as Record<string, unknown>).status;
    const parsed = SaveReadingSessionRequestSchema.parse(body);
    expect(parsed.status).toBe("in_progress");
  });

  test("rejects an unknown provider", () => {
    const body = createValidSessionBody();
    body.sessionData.provider = "invalid";
    expect(() => SaveReadingSessionRequestSchema.parse(body)).toThrow();
  });

  test("rejects an empty birthDate", () => {
    const body = createValidSessionBody();
    body.rawInput.birthDate = "";
    expect(() => SaveReadingSessionRequestSchema.parse(body)).toThrow();
  });
});

describe("createSaveReadingSessionHandler", () => {
  test("creates a session through the repository seam (default local auth)", async () => {
    const repository = {
      saveSession: vi.fn().mockResolvedValue({
        sessionId: VALID_SESSION_ID,
        status: "in_progress",
        updatedAt: "2026-06-10T04:30:00.000Z",
      }),
    };
    const handler = createSaveReadingSessionHandler({ repository });

    const response = await handler(jsonRequest(createValidSessionBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sessionId: VALID_SESSION_ID,
      status: "in_progress",
      updatedAt: "2026-06-10T04:30:00.000Z",
    });
    expect(repository.saveSession).toHaveBeenCalledTimes(1);
    expect(repository.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ status: "in_progress", label: "เคสรีวิว" }),
      "local",
    );
  });

  test("forwards sessionId so the repository updates the existing record", async () => {
    const repository = {
      saveSession: vi.fn().mockResolvedValue({
        sessionId: VALID_SESSION_ID,
        status: "in_progress",
        updatedAt: "2026-06-10T04:30:00.000Z",
      }),
    };
    const handler = createSaveReadingSessionHandler({
      repository,
      authenticate: authedAs("local"),
    });

    const body = { ...createValidSessionBody(), sessionId: VALID_SESSION_ID };
    const response = await handler(jsonRequest(body));

    expect(response.status).toBe(200);
    expect(repository.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: VALID_SESSION_ID }),
      "local",
    );
  });

  test("returns 400 on invalid payload without touching the repository", async () => {
    const repository = { saveSession: vi.fn() };
    const handler = createSaveReadingSessionHandler({ repository });

    const body = createValidSessionBody();
    body.sessionData.provider = "invalid";

    const response = await handler(jsonRequest(body));

    expect(response.status).toBe(400);
    expect(repository.saveSession).not.toHaveBeenCalled();
  });

  test("maps a not-found update error to 404", async () => {
    const repository = {
      saveSession: vi
        .fn()
        .mockRejectedValue(new Error(`Reading session ${VALID_SESSION_ID} was not found.`)),
    };
    const handler = createSaveReadingSessionHandler({ repository });

    const response = await handler(jsonRequest({ ...createValidSessionBody(), sessionId: VALID_SESSION_ID }));

    expect(response.status).toBe(404);
  });

  test("rejects unauthenticated requests with 401 before touching the repository", async () => {
    const repository = { saveSession: vi.fn() };
    const handler = createSaveReadingSessionHandler({
      repository,
      authenticate: vi.fn().mockResolvedValue({ userId: null, isAuthenticated: false }),
    });

    const response = await handler(jsonRequest(createValidSessionBody()));

    expect(response.status).toBe(401);
    expect(repository.saveSession).not.toHaveBeenCalled();
  });
});

describe("createListReadingSessionsHandler", () => {
  test("returns the repository listing", async () => {
    const records: ReadingSessionListItem[] = [
      {
        id: VALID_SESSION_ID,
        label: "เคสรีวิว",
        birthDate: "1992-08-21",
        birthTime: "14:35",
        gender: "female",
        dayMaster: "己",
        provider: "gemini",
        status: "in_progress",
        createdAt: "2026-06-10T04:30:00.000Z",
        updatedAt: "2026-06-10T04:30:00.000Z",
      },
    ];
    const repository = { listSessions: vi.fn().mockResolvedValue(records) };
    const handler = createListReadingSessionsHandler({ repository });

    const response = await handler();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(records);
  });
});

describe("createGetReadingSessionHandler", () => {
  test("returns 404 when the session is missing", async () => {
    const repository = { getSessionById: vi.fn().mockResolvedValue(null) };
    const handler = createGetReadingSessionHandler({ repository });

    const response = await handler(new Request("http://localhost/api/reading/sessions/x"), {
      params: Promise.resolve({ sessionId: VALID_SESSION_ID }),
    });

    expect(response.status).toBe(404);
    expect(repository.getSessionById).toHaveBeenCalledWith(VALID_SESSION_ID);
  });

  test("returns the session detail when found", async () => {
    const detail = {
      id: VALID_SESSION_ID,
      label: "เคสรีวิว",
      birthDate: "1992-08-21",
      birthTime: "14:35",
      gender: "female",
      dayMaster: "己",
      provider: "gemini",
      status: "in_progress",
      rawInput: createValidSessionBody().rawInput,
      calculatedState: validCalculatedState(),
      sessionData: createValidSessionBody().sessionData,
      metadata: {},
      ownerId: "local",
      createdAt: "2026-06-10T04:30:00.000Z",
      updatedAt: "2026-06-10T04:30:00.000Z",
    } as unknown as ReadingSessionDetail;
    const repository = { getSessionById: vi.fn().mockResolvedValue(detail) };
    const handler = createGetReadingSessionHandler({ repository });

    const response = await handler(new Request("http://localhost/api/reading/sessions/x"), {
      params: Promise.resolve({ sessionId: VALID_SESSION_ID }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(detail);
  });
});

describe("createDeleteReadingSessionHandler", () => {
  test("deletes via the repository and returns 200", async () => {
    const repository = { deleteSession: vi.fn().mockResolvedValue(undefined) };
    const handler = createDeleteReadingSessionHandler({
      repository,
      authenticate: authedAs("local"),
    });

    const response = await handler(new Request("http://localhost/api/reading/sessions/x"), {
      params: Promise.resolve({ sessionId: VALID_SESSION_ID }),
    });

    expect(response.status).toBe(200);
    expect(repository.deleteSession).toHaveBeenCalledWith(VALID_SESSION_ID, "local");
  });
});

describe("formStateFromRawInput", () => {
  test("round-trips buildPayload for a valid form state", () => {
    const formState: FormState = {
      birthDay: "5",
      birthMonth: "6",
      birthYearBe: "2540",
      birthHour: "09",
      birthMinute: "05",
      gender: "female",
      province: "เชียงใหม่",
    };

    expect(formStateFromRawInput(buildPayload(formState))).toEqual(formState);
  });

  test("converts gregorian year back to Buddhist Era and pads the time", () => {
    const restored = formStateFromRawInput({
      birthDate: "1997-12-31",
      birthTime: "23:07",
      gender: "male",
      province: "กรุงเทพมหานคร",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    });

    expect(restored.birthYearBe).toBe("2540");
    expect(restored.birthMonth).toBe("12");
    expect(restored.birthDay).toBe("31");
    expect(restored.birthHour).toBe("23");
    expect(restored.birthMinute).toBe("07");
  });
});
