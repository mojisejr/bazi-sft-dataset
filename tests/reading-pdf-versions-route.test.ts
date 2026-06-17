import { describe, expect, test, vi } from "vitest";

import {
  createDeleteReadingPdfVersionHandler,
  createGetReadingPdfVersionHandler,
  createListReadingPdfVersionsHandler,
  createSaveReadingPdfVersionHandler,
  SaveReadingPdfVersionRequestSchema,
  type ReadingPdfVersionAuthenticate,
  type ReadingPdfVersionDetail,
  type ReadingPdfVersionListItem,
} from "@/lib/bazi/reading-pdf-versions";

const VALID_SESSION_ID = "5dca0c34-9f8f-4f42-8e1e-6787dce1dd7e";
const VALID_VERSION_ID = "11111111-2222-4333-8444-555555555555";

// calculatedState ที่ valid ตาม CalculatedStateSchema (รูปเดียวกับ reading-sessions-route test)
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
      { element: "earth", metaphor: "fertile cultivated soil that nurtures, absorbs, and organizes" },
    ],
    sixtyJiaziCorePersona: {
      code: "己巳",
      narrative: "Builds influence patiently, then turns preparation into visible results.",
      precedenceNotes: ["Near solar-term boundary."],
    },
  };
}

function createValidVersionBody() {
  return {
    sessionId: VALID_SESSION_ID,
    versionNote: "ก่อนแก้บทคู่ครอง",
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
      topicStates: { chart_foundation: { status: "done", result: null, error: null } },
      corrections: {},
      readings: { chart_foundation: "คำอ่านบทที่ 1" },
      relationshipLines: null,
    },
  };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/reading/pdf-versions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const authedAs = (userId: string): ReadingPdfVersionAuthenticate =>
  vi.fn().mockResolvedValue({ userId, isAuthenticated: true });

describe("SaveReadingPdfVersionRequestSchema", () => {
  test("accepts a valid body and defaults status to in_progress", () => {
    const body = createValidVersionBody();
    delete (body as Record<string, unknown>).status;
    const parsed = SaveReadingPdfVersionRequestSchema.parse(body);
    expect(parsed.status).toBe("in_progress");
  });

  test("allows a null sessionId (snapshot ก่อนมีดวงต้นทาง)", () => {
    const body = { ...createValidVersionBody(), sessionId: null };
    const parsed = SaveReadingPdfVersionRequestSchema.parse(body);
    expect(parsed.sessionId).toBeNull();
  });

  test("rejects an unknown provider", () => {
    const body = createValidVersionBody();
    body.sessionData.provider = "invalid";
    expect(() => SaveReadingPdfVersionRequestSchema.parse(body)).toThrow();
  });
});

describe("createSaveReadingPdfVersionHandler", () => {
  test("inserts a snapshot through the repository seam (default local auth)", async () => {
    const repository = {
      saveVersion: vi.fn().mockResolvedValue({
        versionId: VALID_VERSION_ID,
        createdAt: "2026-06-10T04:30:00.000Z",
      }),
    };
    const handler = createSaveReadingPdfVersionHandler({ repository });

    const response = await handler(jsonRequest(createValidVersionBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      versionId: VALID_VERSION_ID,
      createdAt: "2026-06-10T04:30:00.000Z",
    });
    expect(repository.saveVersion).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: VALID_SESSION_ID, versionNote: "ก่อนแก้บทคู่ครอง" }),
      "local",
    );
  });

  test("returns 400 on invalid payload without touching the repository", async () => {
    const repository = { saveVersion: vi.fn() };
    const handler = createSaveReadingPdfVersionHandler({ repository });

    const body = createValidVersionBody();
    body.sessionData.provider = "invalid";

    const response = await handler(jsonRequest(body));

    expect(response.status).toBe(400);
    expect(repository.saveVersion).not.toHaveBeenCalled();
  });

  test("rejects unauthenticated requests with 401 before touching the repository", async () => {
    const repository = { saveVersion: vi.fn() };
    const handler = createSaveReadingPdfVersionHandler({
      repository,
      authenticate: vi.fn().mockResolvedValue({ userId: null, isAuthenticated: false }),
    });

    const response = await handler(jsonRequest(createValidVersionBody()));

    expect(response.status).toBe(401);
    expect(repository.saveVersion).not.toHaveBeenCalled();
  });
});

describe("createListReadingPdfVersionsHandler", () => {
  test("returns the repository listing", async () => {
    const records: ReadingPdfVersionListItem[] = [
      {
        id: VALID_VERSION_ID,
        sessionId: VALID_SESSION_ID,
        label: "เคสรีวิว",
        versionNote: "ก่อนแก้บทคู่ครอง",
        birthDate: "1992-08-21",
        birthTime: "14:35",
        gender: "female",
        dayMaster: "己",
        provider: "gemini",
        status: "in_progress",
        createdAt: "2026-06-10T04:30:00.000Z",
      },
    ];
    const repository = { listVersions: vi.fn().mockResolvedValue(records) };
    const handler = createListReadingPdfVersionsHandler({ repository });

    const response = await handler();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(records);
  });
});

describe("createGetReadingPdfVersionHandler", () => {
  test("returns 404 when the version is missing", async () => {
    const repository = { getVersionById: vi.fn().mockResolvedValue(null) };
    const handler = createGetReadingPdfVersionHandler({ repository });

    const response = await handler(new Request("http://localhost/api/reading/pdf-versions/x"), {
      params: Promise.resolve({ versionId: VALID_VERSION_ID }),
    });

    expect(response.status).toBe(404);
    expect(repository.getVersionById).toHaveBeenCalledWith(VALID_VERSION_ID);
  });

  test("returns the version detail when found", async () => {
    const detail = {
      id: VALID_VERSION_ID,
      sessionId: VALID_SESSION_ID,
      label: "เคสรีวิว",
      versionNote: "ก่อนแก้บทคู่ครอง",
      birthDate: "1992-08-21",
      birthTime: "14:35",
      gender: "female",
      dayMaster: "己",
      provider: "gemini",
      status: "in_progress",
      rawInput: createValidVersionBody().rawInput,
      calculatedState: validCalculatedState(),
      sessionData: createValidVersionBody().sessionData,
      ownerId: "local",
      createdAt: "2026-06-10T04:30:00.000Z",
    } as unknown as ReadingPdfVersionDetail;
    const repository = { getVersionById: vi.fn().mockResolvedValue(detail) };
    const handler = createGetReadingPdfVersionHandler({ repository });

    const response = await handler(new Request("http://localhost/api/reading/pdf-versions/x"), {
      params: Promise.resolve({ versionId: VALID_VERSION_ID }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(detail);
  });
});

describe("createDeleteReadingPdfVersionHandler", () => {
  test("deletes via the repository and returns 200", async () => {
    const repository = { deleteVersion: vi.fn().mockResolvedValue(undefined) };
    const handler = createDeleteReadingPdfVersionHandler({
      repository,
      authenticate: authedAs("local"),
    });

    const response = await handler(new Request("http://localhost/api/reading/pdf-versions/x"), {
      params: Promise.resolve({ versionId: VALID_VERSION_ID }),
    });

    expect(response.status).toBe(200);
    expect(repository.deleteVersion).toHaveBeenCalledWith(VALID_VERSION_ID, "local");
  });
});
