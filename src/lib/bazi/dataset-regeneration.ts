import {
  mergeDatasetRecordMetadata,
  type DatasetGenerationProvenanceValue,
  type DatasetRecordMetadataValue,
} from "@/lib/bazi/dataset-metadata";
import { createDraftAnnotationPayload, type SaveDatasetRequest } from "@/lib/bazi/dataset-request";
import {
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  type CalculatedStateValue,
  type RawInputValue,
  type StoredAnnotationDataValue,
} from "@/lib/bazi/schema-types";

export type DatasetRegenerationRecordStatus = "draft" | "reviewed" | "rejected" | "exported";

export type DatasetRegenerationRecord = {
  id: string;
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  annotationData: StoredAnnotationDataValue | null;
  status: DatasetRegenerationRecordStatus;
  metadata: DatasetRecordMetadataValue;
  updatedAt: string;
};

export type DatasetGenerationFingerprint = Partial<
  Pick<
    DatasetGenerationProvenanceValue,
    | "model"
    | "promptVersion"
    | "promptHash"
    | "referencePackVersion"
    | "engineVersion"
    | "calculatedStateHash"
  >
>;

export type DatasetStaleReason =
  | "generation-missing"
  | "model-mismatch"
  | "prompt-version-mismatch"
  | "prompt-hash-mismatch"
  | "reference-pack-version-mismatch"
  | "engine-version-mismatch"
  | "calculated-state-hash-mismatch";

export type DatasetRevisionAction =
  | { action: "create-draft" }
  | {
      action: "rewrite-draft";
      targetRecordId: string;
      reason: "draft-is-active";
    }
  | {
      action: "clone-revision";
      targetRecordId: string;
      reason: "historical-records-are-immutable" | "draft-was-already-superseded";
    }
  | {
      action: "skip-exported";
      targetRecordId: string;
      reason: "exported-records-are-immutable";
    };

export type DatasetRegenerationPlanEntryStatus =
  | "rewrite_draft"
  | "cloned_revision"
  | "skipped_exported"
  | "skipped_clean";

export type DatasetRegenerationPlanEntry<
  T extends DatasetRegenerationRecord = DatasetRegenerationRecord,
> = {
  record: T;
  status: DatasetRegenerationPlanEntryStatus;
  selected: boolean;
  staleReasons: DatasetStaleReason[];
  reason: string;
};

export type DatasetRegenerationPlanOptions = {
  fingerprint: DatasetGenerationFingerprint;
  onlyStale?: boolean;
  includeReviewedAsRevision?: boolean;
  limit?: number;
};

export type DatasetRegenerationReceipt = {
  totalCandidates: number;
  selectedCount: number;
  rewrittenCount: number;
  clonedRevisionCount: number;
  skippedExportedCount: number;
  skippedCleanCount: number;
  failedCount: number;
};

function createEmptyDraftAnnotationData(): StoredAnnotationDataValue {
  return {
    version: "1.6",
    dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
      dimension_name: dimensionName,
      thought_process: "",
      final_prediction: "",
      supporting_signals: [],
    })),
  };
}

function normalizeDraftAnnotationData(
  annotationData: StoredAnnotationDataValue | null,
): StoredAnnotationDataValue {
  const emptyDraft = createEmptyDraftAnnotationData();

  if (!annotationData) {
    return emptyDraft;
  }

  const dimensionsByName = new Map(
    annotationData.dimensions.map((dimension) => [dimension.dimension_name, dimension]),
  );
  const emptyDimensionsByName = new Map(
    emptyDraft.dimensions.map((dimension) => [dimension.dimension_name, dimension]),
  );

  return {
    ...emptyDraft,
    ...annotationData,
    dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => {
      const baseDimension = emptyDimensionsByName.get(dimensionName);

      if (!baseDimension) {
        throw new Error(`Missing draft dimension template for ${dimensionName}.`);
      }

      return {
        ...baseDimension,
        ...dimensionsByName.get(dimensionName),
        dimension_name: dimensionName,
      };
    }),
  };
}

function isSupersededMetadata(metadata: DatasetRecordMetadataValue): boolean {
  return Boolean(metadata.revision?.supersededByRecordId)
    || metadata.reviewLifecycle?.state === "superseded";
}

function createRawInputKey(rawInput: RawInputValue) {
  return JSON.stringify(rawInput);
}

export function collectDatasetStaleReasons(
  metadata: DatasetRecordMetadataValue,
  fingerprint: DatasetGenerationFingerprint,
): DatasetStaleReason[] {
  const generation = metadata.generation;

  if (!generation) {
    return Object.keys(fingerprint).length > 0 ? ["generation-missing"] : [];
  }

  const reasons: DatasetStaleReason[] = [];

  if (fingerprint.model && generation.model && fingerprint.model !== generation.model) {
    reasons.push("model-mismatch");
  }

  if (
    fingerprint.promptVersion
    && generation.promptVersion
    && fingerprint.promptVersion !== generation.promptVersion
  ) {
    reasons.push("prompt-version-mismatch");
  }

  if (fingerprint.promptHash && generation.promptHash && fingerprint.promptHash !== generation.promptHash) {
    reasons.push("prompt-hash-mismatch");
  }

  if (
    fingerprint.referencePackVersion
    && generation.referencePackVersion
    && fingerprint.referencePackVersion !== generation.referencePackVersion
  ) {
    reasons.push("reference-pack-version-mismatch");
  }

  if (
    fingerprint.engineVersion
    && generation.engineVersion
    && fingerprint.engineVersion !== generation.engineVersion
  ) {
    reasons.push("engine-version-mismatch");
  }

  if (
    fingerprint.calculatedStateHash
    && generation.calculatedStateHash
    && fingerprint.calculatedStateHash !== generation.calculatedStateHash
  ) {
    reasons.push("calculated-state-hash-mismatch");
  }

  return reasons;
}

export function resolveDatasetRevisionAction(
  existingRecord: Pick<DatasetRegenerationRecord, "id" | "status" | "metadata"> | null,
): DatasetRevisionAction {
  if (!existingRecord) {
    return { action: "create-draft" };
  }

  if (existingRecord.status === "exported") {
    return {
      action: "skip-exported",
      targetRecordId: existingRecord.id,
      reason: "exported-records-are-immutable",
    };
  }

  if (existingRecord.status === "draft" && !isSupersededMetadata(existingRecord.metadata)) {
    return {
      action: "rewrite-draft",
      targetRecordId: existingRecord.id,
      reason: "draft-is-active",
    };
  }

  return {
    action: "clone-revision",
    targetRecordId: existingRecord.id,
    reason: existingRecord.status === "draft"
      ? "draft-was-already-superseded"
      : "historical-records-are-immutable",
  };
}

export function createRevisionDraftMetadata(
  existingRecord: Pick<DatasetRegenerationRecord, "id" | "status" | "metadata">,
  nextGeneration: DatasetGenerationProvenanceValue,
  staleReasons: DatasetStaleReason[] = [],
): DatasetRecordMetadataValue {
  return mergeDatasetRecordMetadata(existingRecord.metadata, {
    generation: nextGeneration,
    revision: {
      supersedesRecordId: existingRecord.id,
      supersededByRecordId: undefined,
      revisionRootRecordId:
        existingRecord.metadata.revision?.revisionRootRecordId ?? existingRecord.id,
      latestEffectiveRecordId: undefined,
    },
    reviewLifecycle: {
      state: existingRecord.status === "draft" ? "active" : "needs-reproof",
      staleReason: staleReasons[0],
      staleAt: staleReasons.length > 0 ? nextGeneration.generatedAt : undefined,
    },
  });
}

export function createActiveDraftMetadata(
  existingRecord: Pick<DatasetRegenerationRecord, "id" | "metadata">,
  nextGeneration: DatasetGenerationProvenanceValue,
): DatasetRecordMetadataValue {
  return mergeDatasetRecordMetadata(existingRecord.metadata, {
    generation: nextGeneration,
    revision: {
      revisionRootRecordId:
        existingRecord.metadata.revision?.revisionRootRecordId ?? existingRecord.id,
      latestEffectiveRecordId: existingRecord.id,
      supersededByRecordId: undefined,
    },
    reviewLifecycle: {
      state: "active",
      staleReason: undefined,
      staleAt: undefined,
    },
  });
}

export function createSupersededDatasetMetadata(
  metadata: DatasetRecordMetadataValue,
  supersededByRecordId: string,
): DatasetRecordMetadataValue {
  return mergeDatasetRecordMetadata(metadata, {
    revision: {
      supersededByRecordId,
      latestEffectiveRecordId: supersededByRecordId,
    },
    reviewLifecycle: {
      state: "superseded",
      staleReason: undefined,
      staleAt: undefined,
    },
  });
}

export function createRevisionDraftSaveRequest(
  existingRecord: Omit<DatasetRegenerationRecord, "updatedAt">,
  nextGeneration: DatasetGenerationProvenanceValue,
  staleReasons: DatasetStaleReason[] = [],
): SaveDatasetRequest {
  return createDraftAnnotationPayload(
    existingRecord.rawInput,
    existingRecord.calculatedState,
    normalizeDraftAnnotationData(existingRecord.annotationData),
    "draft",
    undefined,
    createRevisionDraftMetadata(existingRecord, nextGeneration, staleReasons),
  );
}

export function resolveLatestEffectiveDatasetRecord<T extends DatasetRegenerationRecord>(
  records: T[],
): T | null {
  const activeRecords = records.filter(
    (record) => record.status !== "exported" && !isSupersededMetadata(record.metadata),
  );

  if (activeRecords.length === 0) {
    return null;
  }

  const explicitPointerRecords = activeRecords.filter(
    (record) => record.metadata.revision?.latestEffectiveRecordId === record.id,
  );

  const rankedRecords = explicitPointerRecords.length > 0 ? explicitPointerRecords : activeRecords;

  return [...rankedRecords].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )[0] ?? null;
}

export function buildDatasetRegenerationPlan<
  T extends DatasetRegenerationRecord,
>(
  records: T[],
  options: DatasetRegenerationPlanOptions,
): DatasetRegenerationPlanEntry<T>[] {
  const groupedRecords = new Map<string, T[]>();

  for (const record of records) {
    const key = createRawInputKey(record.rawInput);
    const currentGroup = groupedRecords.get(key) ?? [];
    currentGroup.push(record);
    groupedRecords.set(key, currentGroup);
  }

  const candidateRecords = [...groupedRecords.values()]
    .map((group) => resolveLatestEffectiveDatasetRecord(group) ?? group[0])
    .filter((record): record is T => record !== null);
  const limitedCandidates = options.limit
    ? candidateRecords.slice(0, options.limit)
    : candidateRecords;

  return limitedCandidates.map((record) => {
    const staleReasons = collectDatasetStaleReasons(record.metadata, options.fingerprint);
    const revisionAction = resolveDatasetRevisionAction(record);

    if (revisionAction.action === "skip-exported") {
      return {
        record,
        status: "skipped_exported",
        selected: false,
        staleReasons,
        reason: revisionAction.reason,
      };
    }

    if (options.onlyStale && staleReasons.length === 0) {
      return {
        record,
        status: "skipped_clean",
        selected: false,
        staleReasons,
        reason: "not-stale-under-current-fingerprint",
      };
    }

    if (
      revisionAction.action === "clone-revision"
      && record.status !== "draft"
      && !options.includeReviewedAsRevision
    ) {
      return {
        record,
        status: "skipped_clean",
        selected: false,
        staleReasons,
        reason: "historical-record-needs-include-reviewed-as-revision",
      };
    }

    if (revisionAction.action === "rewrite-draft") {
      return {
        record,
        status: "rewrite_draft",
        selected: true,
        staleReasons,
        reason: revisionAction.reason,
      };
    }

    if (revisionAction.action === "clone-revision") {
      return {
        record,
        status: "cloned_revision",
        selected: true,
        staleReasons,
        reason: revisionAction.reason,
      };
    }

    return {
      record,
      status: "skipped_clean",
      selected: false,
      staleReasons,
      reason: "no-regeneration-action",
    };
  });
}

export function createDatasetRegenerationReceipt(
  entries: DatasetRegenerationPlanEntry[],
  failedCount = 0,
): DatasetRegenerationReceipt {
  return {
    totalCandidates: entries.length,
    selectedCount: entries.filter((entry) => entry.selected).length,
    rewrittenCount: entries.filter((entry) => entry.status === "rewrite_draft").length,
    clonedRevisionCount: entries.filter((entry) => entry.status === "cloned_revision").length,
    skippedExportedCount: entries.filter((entry) => entry.status === "skipped_exported").length,
    skippedCleanCount: entries.filter((entry) => entry.status === "skipped_clean").length,
    failedCount,
  };
}