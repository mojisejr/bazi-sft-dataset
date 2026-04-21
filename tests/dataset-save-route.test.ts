import { describe, expect, test, vi } from "vitest";

import {
  createSaveDatasetHandler,
  type DatasetRecordRepository,
  SaveDatasetRequestSchema,
  type SaveDatasetAuthenticate,
} from "@/lib/bazi/dataset-records";
import { REQUIRED_ANNOTATION_DIMENSION_NAMES } from "@/lib/bazi/schema-types";

function createRequestBody() {
  return {
    rawInput: {
      birthDate: "1992-08-21",
      birthTime: "14:35",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Hong_Kong",
    },
    calculatedState: {
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
        narrative: "Builds influence patiently, then turns preparation into visible results when timing opens.",
        precedenceNotes: ["Near solar-term boundary."],
      },
    },
    annotationData: {
      version: "1.6",
      sinsaeProofNote:
        "AI draft is structurally sound; adjusted emphasis so the language reads like a senior sinsae.",
      dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
        dimension_name: dimensionName,
        thought_process: `Reasoning for ${dimensionName}`,
        final_prediction: `Prediction for ${dimensionName}`,
      })),
    },
    status: "reviewed",
  };
}

function createCase2ConflictRequestBody() {
  return {
    rawInput: {
      birthDate: "1981-03-12",
      birthTime: "05:59",
      gender: "male",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    },
    calculatedState: {
      fourPillars: {
        year: { stem: "辛", branch: "酉", hiddenStems: ["辛"] },
        month: { stem: "辛", branch: "卯", hiddenStems: ["乙"] },
        day: { stem: "己", branch: "巳", hiddenStems: ["丙", "庚", "戊"] },
        hour: { stem: "丁", branch: "卯", hiddenStems: ["乙"] },
      },
      dayMaster: "己",
      strengthScore: 1.93,
      tenGods: {
        yearStem: "食神",
        yearBranch: "食神",
        monthStem: "食神",
        monthBranch: "七杀",
        dayStem: "日主",
        dayBranch: "正印,劫财,正官",
        hourStem: "偏印",
        hourBranch: "七杀",
      },
      twelveQi: {
        yearBranch: "长生",
        monthBranch: "病",
        dayBranch: "帝旺",
        hourBranch: "病",
      },
      elementMetaphors: [
        {
          element: "earth",
          metaphor: "fertile cultivated soil that nurtures, absorbs, and organizes",
        },
      ],
      sixtyJiaziCorePersona: {
        code: "己巳",
        narrative: "Builds influence patiently, then turns preparation into visible results when timing opens.",
        precedenceNotes: ["Near solar-term boundary."],
      },
    },
    annotationData: {
      version: "1.6",
      sinsaeProofNote: "Conflict sample for validation coverage.",
      dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
        dimension_name: dimensionName,
        thought_process: `Reasoning for ${dimensionName}`,
        final_prediction: `Prediction for ${dimensionName}`,
      })),
    },
    status: "reviewed",
  } as const;
}

describe("createSaveDatasetHandler", () => {
  test("schema rejects calculated states that contradict the raw-input pillar truth", () => {
    expect(() => SaveDatasetRequestSchema.parse(createCase2ConflictRequestBody())).toThrow(
      /四?calculatedState\.fourPillars\.day|expected, received/i,
    );
  });

  test("saves a reviewed payload through the repository seam", async () => {
    const repository: DatasetRecordRepository = {
      saveRecord: vi.fn().mockResolvedValue({
        recordId: "5dca0c34-9f8f-4f42-8e1e-6787dce1dd7e",
        status: "reviewed",
        updatedAt: "2026-04-13T04:30:00.000Z",
      }),
    };
    const authenticate: SaveDatasetAuthenticate = vi.fn().mockResolvedValue({
      userId: "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
      isAuthenticated: true,
    });
    const handler = createSaveDatasetHandler({ repository, authenticate });

    const response = await handler(
      new Request("http://localhost/api/dataset/save", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(createRequestBody()),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      recordId: "5dca0c34-9f8f-4f42-8e1e-6787dce1dd7e",
      status: "reviewed",
      updatedAt: "2026-04-13T04:30:00.000Z",
    });
    expect(repository.saveRecord).toHaveBeenCalledTimes(1);
    expect(repository.saveRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "reviewed",
      }),
      "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
    );
  });

  test("rejects reviewed payloads when any dimension is incomplete", async () => {
    const repository: DatasetRecordRepository = {
      saveRecord: vi.fn(),
    };
    const authenticate: SaveDatasetAuthenticate = vi.fn().mockResolvedValue({
      userId: "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
      isAuthenticated: true,
    });
    const handler = createSaveDatasetHandler({ repository, authenticate });
    const requestBody = createRequestBody();

    requestBody.annotationData.dimensions[0] = {
      ...requestBody.annotationData.dimensions[0],
      final_prediction: "",
    };

    const response = await handler(
      new Request("http://localhost/api/dataset/save", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }),
    );

    expect(response.status).toBe(400);
    expect(repository.saveRecord).not.toHaveBeenCalled();
  });

  test("rejects reviewed payloads when sinsae proof note is missing", async () => {
    const repository: DatasetRecordRepository = {
      saveRecord: vi.fn(),
    };
    const authenticate: SaveDatasetAuthenticate = vi.fn().mockResolvedValue({
      userId: "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
      isAuthenticated: true,
    });
    const handler = createSaveDatasetHandler({ repository, authenticate });
    const requestBody = createRequestBody();
    const invalidRequestBody = {
      ...requestBody,
      annotationData: {
        version: requestBody.annotationData.version,
        dimensions: requestBody.annotationData.dimensions,
      },
    };

    const response = await handler(
      new Request("http://localhost/api/dataset/save", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(invalidRequestBody),
      }),
    );

    expect(response.status).toBe(400);
    expect(repository.saveRecord).not.toHaveBeenCalled();
  });

  test("rejects unauthenticated requests with 401 before touching the repository", async () => {
    const repository: DatasetRecordRepository = {
      saveRecord: vi.fn(),
    };
    const authenticate: SaveDatasetAuthenticate = vi.fn().mockResolvedValue({
      userId: null,
      isAuthenticated: false,
    });
    const handler = createSaveDatasetHandler({ repository, authenticate });

    const response = await handler(
      new Request("http://localhost/api/dataset/save", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(createRequestBody()),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized",
    });
    expect(repository.saveRecord).not.toHaveBeenCalled();
  });

  test("allows rejected payloads with a proof note even when dimensions are still incomplete", async () => {
    const repository: DatasetRecordRepository = {
      saveRecord: vi.fn().mockResolvedValue({
        recordId: "5dca0c34-9f8f-4f42-8e1e-6787dce1dd7e",
        status: "rejected",
        updatedAt: "2026-04-13T04:30:00.000Z",
      }),
    };
    const authenticate: SaveDatasetAuthenticate = vi.fn().mockResolvedValue({
      userId: "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
      isAuthenticated: true,
    });
    const handler = createSaveDatasetHandler({ repository, authenticate });
    const requestBody = createRequestBody();

    requestBody.status = "rejected";
    requestBody.annotationData.dimensions[0] = {
      ...requestBody.annotationData.dimensions[0],
      final_prediction: "",
    };

    const response = await handler(
      new Request("http://localhost/api/dataset/save", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }),
    );

    expect(response.status).toBe(200);
    expect(repository.saveRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
      }),
      "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
    );
  });

  test("rejects reviewed payloads when calculated pillars contradict raw input", async () => {
    const repository: DatasetRecordRepository = {
      saveRecord: vi.fn(),
    };
    const authenticate: SaveDatasetAuthenticate = vi.fn().mockResolvedValue({
      userId: "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
      isAuthenticated: true,
    });
    const handler = createSaveDatasetHandler({ repository, authenticate });

    const response = await handler(
      new Request("http://localhost/api/dataset/save", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(createCase2ConflictRequestBody()),
      }),
    );

    expect(response.status).toBe(400);
    expect(repository.saveRecord).not.toHaveBeenCalled();

    const body = (await response.json()) as { details: Array<{ message: string }> };
    expect(body.details.some((issue) => issue.message.includes("己丑 expected, received 己巳"))).toBe(true);
  });
});