import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { ProofWorkspace } from "@/components/bazi/ProofWorkspace";
import {
  createSaveProofDatasetHandler,
  type DatasetProofLookupRepository,
  type DatasetRecordRepository,
  type SaveDatasetAuthenticate,
} from "@/lib/bazi/dataset-records";
import {
  CalculatedStateSchema,
  DraftAnnotationDataSchema,
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  RawInputSchema,
} from "@/lib/bazi/schema-types";

function createProofRecord() {
  return {
    id: "f1d128dc-8a32-4659-88c0-e42dc742b171",
    rawInput: RawInputSchema.parse({
      birthDate: "1992-08-21",
      birthTime: "14:35",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    }),
    calculatedState: CalculatedStateSchema.parse({
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
        dayStem: "日主",
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
      elementMetaphors: [],
      elementAnalysis: {
        visibleCounts: {
          wood: 0,
          fire: 1,
          earth: 1,
          metal: 1,
          water: 0,
        },
        hiddenCounts: {
          wood: 3,
          fire: 1,
          earth: 3,
          metal: 1,
          water: 2,
        },
        totalCounts: {
          wood: 3,
          fire: 2,
          earth: 4,
          metal: 2,
          water: 2,
        },
        missingElements: [],
        dominantElements: ["earth"],
        elementStrengths: [
          { element: "wood", rooted: true, seasonalSupport: "seasonal-support", strength: "balanced" },
          { element: "fire", rooted: true, seasonalSupport: "seasonal-drained", strength: "balanced" },
          { element: "earth", rooted: true, seasonalSupport: "seasonal-support", strength: "strong" },
          { element: "metal", rooted: true, seasonalSupport: "seasonal-peak", strength: "balanced" },
          { element: "water", rooted: true, seasonalSupport: "seasonal-support", strength: "balanced" },
        ],
      },
      seasonalInteraction: {
        dayMasterStem: "己",
        dayMasterElement: "earth",
        monthBranch: "申",
        season: "autumn",
        phase: "early",
        seasonLabel: "ต้นฤดูใบไม้ร่วง",
        metaphor: "ดินเพาะปลูกในต้นฤดูใบไม้ร่วง",
      },
      sixtyJiaziCorePersona: {
        code: "己巳",
        narrative: "Builds influence patiently, then turns preparation into visible results when timing opens.",
        elementTone: "fire",
        twelveQiLabel: "帝旺",
        semanticNotes: [
          "โทนธาตุของ 60 กะจื่อวันนี้คือ fire",
          "ชั้น 12 เชี่ยงแซของกะจื่อวันอยู่ที่ 帝旺",
        ],
        precedenceNotes: ["Near solar-term boundary."],
        precedenceNoteSignals: [
          {
            key: "SOLAR_TERM_BOUNDARY_NEAR",
            params: {
              hours: "1.50",
              solarTermName: "立秋",
              boundaryAt: "1992-08-21T15:00:00",
            },
          },
        ],
      },
      daYun: [],
      shenSha: [],
      explainable: {
        strengthScore: {
          value: 3.07,
          trace: {
            engine: "orthodox-override",
            ruleName: "StrengthScore_WeightedSeasonalSupport",
            stepKeys: ["weight-stages", "add-relations", "apply-penalties"],
            rawVariables: {
              stageContribution: 0.82,
              visibleContributions: [
                { label: "monthStem", stem: "戊", hidden: false, weight: 0.75 },
                { label: "hourStem", stem: "辛", hidden: false, weight: 0.4 },
              ],
              hiddenContributions: [
                { label: "dayHiddenStem1", stem: "丙", hidden: true, weight: 0.3 },
              ],
              penalties: {
                clashes: 0.2,
                punishments: 0,
                harms: 0,
                destructions: 0,
              },
              result: 3.07,
            },
          },
        },
      },
    }),
    intentDomain: "general",
    metadata: {
      customerName: "สมบัติ",
      sourceFile: "/tmp/example-cases.csv",
      sourceRow: 2,
    },
    annotationData: DraftAnnotationDataSchema.parse({
      version: "1.6",
      dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
        dimension_name: dimensionName,
        thought_process: dimensionName === "chart_foundation" ? "AI draft reason" : "",
        final_prediction: dimensionName === "chart_foundation" ? "AI draft prediction" : "",
        supporting_signals: [],
      })),
      sinsaeProofNote: "ตรวจโครงสร้างก่อนเริ่มเกลา",
    }),
    status: "draft" as const,
    annotatorId: "agent_gpt4o",
    createdAt: "2026-04-17T00:00:00.000Z",
    updatedAt: "2026-04-17T01:00:00.000Z",
  };
}

function createLegacyEncodedProofRecord() {
  return {
    ...createProofRecord(),
    id: "eb662a4a-4b12-4e11-886e-ea0d425a7c2f",
    calculatedState: {
      ...createProofRecord().calculatedState,
      fourPillars: {
        year: { stem: "ren", branch: "shen", hiddenStems: ["geng", "ren", "wu"] },
        month: { stem: "wu", branch: "shen", hiddenStems: ["geng", "ren", "wu"] },
        day: { stem: "ji", branch: "mao", hiddenStems: ["yi"] },
        hour: { stem: "xin", branch: "wei", hiddenStems: ["ji", "ding", "yi"] },
      },
      dayMaster: "ji-earth",
    },
  };
}

describe("ProofWorkspace", () => {
  test("renders mobile-friendly proof controls with human-readable labels", () => {
    const html = renderToStaticMarkup(
      createElement(ProofWorkspace, {
        record: createProofRecord(),
        returnToPath: "/?workspace=queue",
      }),
    );

    expect(html).toContain("หน้าตรวจทานคำทำนาย AI");
    expect(html).toContain("กลับไปคิวรอตรวจ");
    expect(html).toContain("/?workspace=queue");
    expect(html).toContain("ชื่อลูกค้า");
    expect(html).toContain("สมบัติ");
    expect(html).toContain("แกนบุคลิกสำหรับงานตรวจ");
    expect(html).toContain('data-core-persona="available"');
    expect(html).toContain('data-seasonal-metaphor="available"');
    expect(html).toContain('data-element-analysis="available"');
    expect(html).toContain("ดินเพาะปลูกในต้นฤดูใบไม้ร่วง");
    expect(html).toContain("ธาตุนำ ดิน");
    expect(html).toContain("ดุลธาตุและกำลังธาตุ");
    expect(html).toContain("กำลังเด่น");
    expect(html).toContain("มีราก");
    expect(html).toContain("โทนธาตุ fire");
    expect(html).toContain("ควรตรวจเคสคาบเกี่ยวด้วยมืออีกครั้ง");
    expect(html).toContain("สมการคะแนนพลังสำหรับงานตรวจ");
    expect(html).toContain("ก้านฟ้าเดือน · 戊");
    expect(html).toContain('data-strength-breakdown="available"');
    expect(html).toContain("บันทึกความคืบหน้าไว้ก่อน");
    expect(html).toContain("ตีกลับงาน AI");
    expect(html).toContain("อนุมัติและปิดงาน");
    expect(html).not.toContain("proofing hook");
    expect(html).not.toContain("Accept Annotation");
  });
});

describe("createSaveProofDatasetHandler", () => {
  test("saves a reviewed proof payload against the existing record", async () => {
    const repository: DatasetRecordRepository & DatasetProofLookupRepository = {
      getRecordById: vi.fn().mockResolvedValue(createProofRecord()),
      saveRecord: vi.fn().mockResolvedValue({
        recordId: "f1d128dc-8a32-4659-88c0-e42dc742b171",
        status: "reviewed",
        updatedAt: "2026-04-17T02:00:00.000Z",
      }),
    };
    const authenticate: SaveDatasetAuthenticate = vi.fn().mockResolvedValue({
      userId: "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
      isAuthenticated: true,
    });
    const handler = createSaveProofDatasetHandler({ repository, authenticate });

    const response = await handler(
      new Request("http://localhost/api/dataset/proof", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          recordId: "f1d128dc-8a32-4659-88c0-e42dc742b171",
          status: "reviewed",
          annotationData: {
            version: "1.6",
            sinsaeProofNote: "ปรับภาษาและยืนยันว่าครบทุกมิติแล้ว",
            dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
              dimension_name: dimensionName,
              thought_process: `Reasoning for ${dimensionName}`,
              final_prediction: `Prediction for ${dimensionName}`,
            })),
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(repository.getRecordById).toHaveBeenCalledWith(
      "f1d128dc-8a32-4659-88c0-e42dc742b171",
    );
    expect(repository.saveRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: "f1d128dc-8a32-4659-88c0-e42dc742b171",
        status: "reviewed",
        metadata: {
          customerName: "สมบัติ",
          sourceFile: "/tmp/example-cases.csv",
          sourceRow: 2,
        },
      }),
      "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
    );
  });

  test("accepts rejected proof payloads with a proof note even when predictions are incomplete", async () => {
    const repository: DatasetRecordRepository & DatasetProofLookupRepository = {
      getRecordById: vi.fn().mockResolvedValue(createProofRecord()),
      saveRecord: vi.fn().mockResolvedValue({
        recordId: "f1d128dc-8a32-4659-88c0-e42dc742b171",
        status: "rejected",
        updatedAt: "2026-04-17T02:00:00.000Z",
      }),
    };
    const authenticate: SaveDatasetAuthenticate = vi.fn().mockResolvedValue({
      userId: "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
      isAuthenticated: true,
    });
    const handler = createSaveProofDatasetHandler({ repository, authenticate });

    const response = await handler(
      new Request("http://localhost/api/dataset/proof", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          recordId: "f1d128dc-8a32-4659-88c0-e42dc742b171",
          status: "rejected",
          annotationData: {
            version: "1.6",
            sinsaeProofNote: "logic หลักยังผิดอยู่ จึงตีกลับโดยไม่ฝืนเกลาให้จบ",
            dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
              dimension_name: dimensionName,
              thought_process: dimensionName === "chart_foundation" ? "ยังมีแกนผิด" : "",
              final_prediction: "",
            })),
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(repository.saveRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        metadata: {
          customerName: "สมบัติ",
          sourceFile: "/tmp/example-cases.csv",
          sourceRow: 2,
        },
      }),
      "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
    );
  });

  test("saves reviewed proof payloads for legacy persisted records without revalidating stored chart encoding", async () => {
    const legacyRecord = createLegacyEncodedProofRecord();
    const repository: DatasetRecordRepository & DatasetProofLookupRepository = {
      getRecordById: vi.fn().mockResolvedValue(legacyRecord),
      saveRecord: vi.fn().mockResolvedValue({
        recordId: legacyRecord.id,
        status: "reviewed",
        updatedAt: "2026-04-17T02:30:00.000Z",
      }),
    };
    const authenticate: SaveDatasetAuthenticate = vi.fn().mockResolvedValue({
      userId: "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
      isAuthenticated: true,
    });
    const handler = createSaveProofDatasetHandler({ repository, authenticate });

    const response = await handler(
      new Request("http://localhost/api/dataset/proof", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          recordId: legacyRecord.id,
          status: "reviewed",
          annotationData: {
            version: "1.6",
            sinsaeProofNote: "legacy draft นี้ตรวจแล้วและอนุมัติได้แม้ chart encoding เดิมยังเป็น romanized",
            dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
              dimension_name: dimensionName,
              thought_process: `Reasoning for ${dimensionName}`,
              final_prediction: `Prediction for ${dimensionName}`,
            })),
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(repository.saveRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: legacyRecord.id,
        rawInput: legacyRecord.rawInput,
        calculatedState: legacyRecord.calculatedState,
        status: "reviewed",
        metadata: {
          customerName: "สมบัติ",
          sourceFile: "/tmp/example-cases.csv",
          sourceRow: 2,
        },
      }),
      "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
    );
  });

  test("rejects proof requests that omit the proof note for rejected status", async () => {
    const repository: DatasetRecordRepository & DatasetProofLookupRepository = {
      getRecordById: vi.fn().mockResolvedValue(createProofRecord()),
      saveRecord: vi.fn(),
    };
    const authenticate: SaveDatasetAuthenticate = vi.fn().mockResolvedValue({
      userId: "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
      isAuthenticated: true,
    });
    const handler = createSaveProofDatasetHandler({ repository, authenticate });

    const response = await handler(
      new Request("http://localhost/api/dataset/proof", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          recordId: "f1d128dc-8a32-4659-88c0-e42dc742b171",
          status: "rejected",
          annotationData: {
            version: "1.6",
            dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
              dimension_name: dimensionName,
              thought_process: "",
              final_prediction: "",
            })),
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(repository.saveRecord).not.toHaveBeenCalled();
  });
});