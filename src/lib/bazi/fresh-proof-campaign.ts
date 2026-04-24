import {
  mergeDatasetRecordMetadata,
  type DatasetGenerationProvenanceValue,
  type DatasetRecordMetadataValue,
} from "@/lib/bazi/dataset-metadata";
import type { ImportedBaziCase } from "@/lib/bazi/csv-case-loader";
import type {
  ActiveDraftProofRecordSummary,
  ProofDatasetRecord,
} from "@/lib/bazi/dataset-records";

const TEST_CASE_PATTERN = /test|sample|demo|dummy|mock|ตัวอย่าง|ทดลอง|ทดสอบ|เทส/i;

export type FreshProofCampaignPlanEntryStatus =
  | "create_draft"
  | "rewrite_draft"
  | "cloned_revision"
  | "excluded_test_case";

export type FreshProofCampaignPlanEntry = {
  importedCase: ImportedBaziCase;
  existingRecord: ProofDatasetRecord | null;
  status: FreshProofCampaignPlanEntryStatus;
  selected: boolean;
  reason: string;
};

export type BuildFreshProofCampaignPlanOptions = {
  excludeTestCases?: boolean;
};

export type FreshProofCampaignReceipt = {
  totalRows: number;
  includedFreshCount: number;
  createDraftCount: number;
  rewriteDraftCount: number;
  clonedRevisionCount: number;
  excludedTestCaseCount: number;
  excludedLegacyTargetCount: number;
  failedValidationCount: number;
};

function isSupersededRecord(metadata: DatasetRecordMetadataValue) {
  return Boolean(metadata.revision?.supersededByRecordId)
    || metadata.reviewLifecycle?.state === "superseded";
}

function createRawInputKey(importedCase: Pick<ImportedBaziCase, "rawInput">) {
  return JSON.stringify(importedCase.rawInput);
}

export function isFreshCampaignTestCase(importedCase: ImportedBaziCase) {
  return TEST_CASE_PATTERN.test(importedCase.name)
    || TEST_CASE_PATTERN.test(importedCase.note ?? "");
}

export function buildFreshProofCampaignPlan(
  importedCases: ImportedBaziCase[],
  existingRecordsByRawInput: Map<string, ProofDatasetRecord | null>,
  options: BuildFreshProofCampaignPlanOptions = {},
): FreshProofCampaignPlanEntry[] {
  return importedCases.map((importedCase) => {
    if (options.excludeTestCases && isFreshCampaignTestCase(importedCase)) {
      return {
        importedCase,
        existingRecord: existingRecordsByRawInput.get(createRawInputKey(importedCase)) ?? null,
        status: "excluded_test_case",
        selected: false,
        reason: "matched-test-case-heuristic",
      } satisfies FreshProofCampaignPlanEntry;
    }

    const existingRecord = existingRecordsByRawInput.get(createRawInputKey(importedCase)) ?? null;

    if (!existingRecord) {
      return {
        importedCase,
        existingRecord: null,
        status: "create_draft",
        selected: true,
        reason: "curated-row-has-no-existing-record",
      } satisfies FreshProofCampaignPlanEntry;
    }

    if (existingRecord.status === "draft" && !isSupersededRecord(existingRecord.metadata)) {
      return {
        importedCase,
        existingRecord,
        status: "rewrite_draft",
        selected: true,
        reason: "existing-active-draft-becomes-fresh-campaign-target",
      } satisfies FreshProofCampaignPlanEntry;
    }

    return {
      importedCase,
      existingRecord,
      status: "cloned_revision",
      selected: true,
      reason: existingRecord.status === "exported"
        ? "historical-exported-record-spawns-new-draft"
        : "historical-record-spawns-new-draft",
    } satisfies FreshProofCampaignPlanEntry;
  });
}

export function countLegacyDraftTargetsForFreshCampaign(
  activeDraftRecords: ActiveDraftProofRecordSummary[],
  planEntries: FreshProofCampaignPlanEntry[],
  campaignLabel: string,
) {
  const rewriteTargetIds = new Set(
    planEntries
      .filter((entry) => entry.status === "rewrite_draft" && entry.existingRecord)
      .map((entry) => entry.existingRecord?.id)
      .filter((recordId): recordId is string => Boolean(recordId)),
  );

  return activeDraftRecords.filter((record) => {
    if (record.metadata.generation?.queueBatchId === campaignLabel) {
      return false;
    }

    return !rewriteTargetIds.has(record.id);
  });
}

export function createFreshProofCampaignReceipt(
  planEntries: FreshProofCampaignPlanEntry[],
  excludedLegacyTargetCount: number,
  failedValidationCount = 0,
): FreshProofCampaignReceipt {
  return {
    totalRows: planEntries.length,
    includedFreshCount: planEntries.filter((entry) => entry.selected).length,
    createDraftCount: planEntries.filter((entry) => entry.status === "create_draft").length,
    rewriteDraftCount: planEntries.filter((entry) => entry.status === "rewrite_draft").length,
    clonedRevisionCount: planEntries.filter((entry) => entry.status === "cloned_revision").length,
    excludedTestCaseCount: planEntries.filter((entry) => entry.status === "excluded_test_case").length,
    excludedLegacyTargetCount,
    failedValidationCount,
  };
}

export function createFreshCampaignRootMetadata(
  importedCase: ImportedBaziCase,
): DatasetRecordMetadataValue {
  return {
    customerName: importedCase.name,
    caseNote: importedCase.note,
    sourceRow: importedCase.sourceRow,
  };
}

export function createFreshCampaignDraftMetadata(
  importedCase: ImportedBaziCase,
  sourceFile: string,
  generation: DatasetGenerationProvenanceValue,
): DatasetRecordMetadataValue {
  return mergeDatasetRecordMetadata(createFreshCampaignRootMetadata(importedCase), {
    sourceFile,
    generation,
    reviewLifecycle: {
      state: "active",
      staleReason: undefined,
      staleAt: undefined,
    },
  });
}
