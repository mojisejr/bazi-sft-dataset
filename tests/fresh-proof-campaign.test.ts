import { describe, expect, test } from "vitest";

import {
  buildFreshProofCampaignPlan,
  countLegacyDraftTargetsForFreshCampaign,
  createFreshProofCampaignReceipt,
  isFreshCampaignTestCase,
} from "@/lib/bazi/fresh-proof-campaign";
import type { ImportedBaziCase } from "@/lib/bazi/csv-case-loader";
import type { ProofDatasetRecord } from "@/lib/bazi/dataset-records";
import { CalculatedStateSchema } from "@/lib/bazi/schema-types";

function createImportedCase(overrides: Partial<ImportedBaziCase> = {}): ImportedBaziCase {
  return {
    sourceRow: 2,
    name: "สมบัติ",
    note: undefined,
    rawInput: {
      birthDate: "1981-01-17",
      birthTime: "23:58",
      gender: "male",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    },
    ...overrides,
  };
}

function createRecord(overrides: Partial<ProofDatasetRecord> = {}): ProofDatasetRecord {
  return {
    id: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
    rawInput: createImportedCase().rawInput,
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
        monthStem: "劫财",
        hourStem: "食神",
      },
      twelveQi: {
        yearBranch: "沐浴",
        monthBranch: "沐浴",
        dayBranch: "帝旺",
        hourBranch: "冠带",
      },
      sixtyJiaziCorePersona: {
        code: "己巳",
        narrative: "Measured earth that grows through patience and timing.",
      },
    }),
    intentDomain: "general",
    annotationData: {
      version: "1.6",
      dimensions: [],
    },
    status: "draft",
    annotatorId: "agent_gpt4o",
    metadata: {
      customerName: "สมบัติ",
      sourceFile: "/tmp/example-cases.csv",
      generation: {
        source: "csv",
        model: "gemini-3-flash-preview",
        queueBatchId: "old-campaign",
        generatedAt: "2026-04-24T12:00:00.000Z",
      },
    },
    createdAt: "2026-04-24T12:00:00.000Z",
    updatedAt: "2026-04-24T12:05:00.000Z",
    ...overrides,
  };
}

describe("fresh proof campaign planning", () => {
  test("classifies obvious test cases from name or note", () => {
    expect(isFreshCampaignTestCase(createImportedCase({ name: "test user" }))).toBe(true);
    expect(isFreshCampaignTestCase(createImportedCase({ note: "ตัวอย่างสำหรับทดลอง" }))).toBe(true);
    expect(isFreshCampaignTestCase(createImportedCase({ name: "สมบัติ" }))).toBe(false);
  });

  test("creates, rewrites, clones, and excludes according to the fresh campaign contract", () => {
    const createCase = createImportedCase({
      sourceRow: 2,
      name: "สมบัติ",
    });
    const rewriteCase = createImportedCase({
      sourceRow: 3,
      name: "KD",
      rawInput: {
        birthDate: "1979-11-12",
        birthTime: "06:00",
        gender: "female",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      },
    });
    const cloneCase = createImportedCase({
      sourceRow: 4,
      name: "ออง",
      rawInput: {
        birthDate: "1981-05-24",
        birthTime: "01:30",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      },
    });
    const excludedCase = createImportedCase({
      sourceRow: 5,
      name: "test fixture",
    });

    const existingRecords = new Map<string, ProofDatasetRecord | null>([
      [JSON.stringify(createCase.rawInput), null],
      [JSON.stringify(rewriteCase.rawInput), createRecord({ id: "rewrite-id", rawInput: rewriteCase.rawInput })],
      [
        JSON.stringify(cloneCase.rawInput),
        createRecord({ id: "reviewed-id", rawInput: cloneCase.rawInput, status: "reviewed" }),
      ],
      [JSON.stringify(excludedCase.rawInput), null],
    ]);

    const entries = buildFreshProofCampaignPlan(
      [createCase, rewriteCase, cloneCase, excludedCase],
      existingRecords,
      { excludeTestCases: true },
    );

    expect(entries.map((entry) => entry.status)).toEqual([
      "create_draft",
      "rewrite_draft",
      "cloned_revision",
      "excluded_test_case",
    ]);
    expect(entries.map((entry) => entry.selected)).toEqual([true, true, true, false]);
  });

  test("counts legacy draft targets excluding rewrite targets and same-campaign rows", () => {
    const rewriteCase = createImportedCase();
    const rewriteRecord = createRecord({ id: "rewrite-id", rawInput: rewriteCase.rawInput });
    const entries = buildFreshProofCampaignPlan(
      [rewriteCase],
      new Map([[JSON.stringify(rewriteCase.rawInput), rewriteRecord]]),
    );

    const legacyTargets = countLegacyDraftTargetsForFreshCampaign(
      [
        rewriteRecord,
        createRecord({
          id: "same-campaign-id",
          rawInput: {
            birthDate: "1988-02-01",
            birthTime: "02:00",
            gender: "female",
            province: "Bangkok",
            calendarSystem: "solar",
            timezone: "Asia/Bangkok",
          },
          metadata: {
            customerName: "same campaign",
            generation: {
              source: "csv",
              queueBatchId: "fresh-2026-04-24",
              generatedAt: "2026-04-24T12:00:00.000Z",
            },
          },
        }),
        createRecord({
          id: "legacy-id",
          rawInput: {
            birthDate: "1990-03-02",
            birthTime: "03:00",
            gender: "female",
            province: "Bangkok",
            calendarSystem: "solar",
            timezone: "Asia/Bangkok",
          },
        }),
      ],
      entries,
      "fresh-2026-04-24",
    );

    expect(legacyTargets.map((record) => record.id)).toEqual(["legacy-id"]);
  });

  test("summarizes the fresh campaign receipt counts", () => {
    const entries = buildFreshProofCampaignPlan(
      [
        createImportedCase(),
        createImportedCase({ sourceRow: 3, name: "test fixture" }),
      ],
      new Map<string, ProofDatasetRecord | null>([
        [JSON.stringify(createImportedCase().rawInput), null],
        [JSON.stringify(createImportedCase({ sourceRow: 3, name: "test fixture" }).rawInput), null],
      ]),
      { excludeTestCases: true },
    );

    expect(createFreshProofCampaignReceipt(entries, 2, 1)).toEqual({
      totalRows: 2,
      includedFreshCount: 1,
      createDraftCount: 1,
      rewriteDraftCount: 0,
      clonedRevisionCount: 0,
      excludedTestCaseCount: 1,
      excludedLegacyTargetCount: 2,
      failedValidationCount: 1,
    });
  });
});