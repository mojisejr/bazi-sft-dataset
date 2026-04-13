import { describe, expect, test, vi } from "vitest";

import {
  createSaveDatasetHandler,
  type DatasetRecordRepository,
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
        hour: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
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
      dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
        dimension_name: dimensionName,
        thought_process: `Reasoning for ${dimensionName}`,
        final_prediction: `Prediction for ${dimensionName}`,
      })),
    },
    status: "reviewed",
  };
}

describe("createSaveDatasetHandler", () => {
  test("saves a reviewed payload through the repository seam", async () => {
    const repository: DatasetRecordRepository = {
      saveRecord: vi.fn().mockResolvedValue({
        recordId: "5dca0c34-9f8f-4f42-8e1e-6787dce1dd7e",
        status: "reviewed",
        updatedAt: "2026-04-13T04:30:00.000Z",
      }),
    };
    const handler = createSaveDatasetHandler({ repository });

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
  });

  test("rejects reviewed payloads when any dimension is incomplete", async () => {
    const repository: DatasetRecordRepository = {
      saveRecord: vi.fn(),
    };
    const handler = createSaveDatasetHandler({ repository });
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
});