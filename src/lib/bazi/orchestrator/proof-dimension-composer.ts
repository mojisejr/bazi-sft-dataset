import { z } from "zod";

import { ANNOTATION_DIMENSION_META } from "@/lib/bazi/annotation-dimension-meta";
import {
  getTopicIdsForAnnotationDimension,
  UNMAPPED_ANNOTATION_DIMENSIONS,
} from "@/lib/bazi/knowledge/topic-dimension-bridge";
import { getBaziTopicDefinition } from "@/lib/bazi/knowledge/topic-registry";
import { type TopicId } from "@/lib/bazi/knowledge/topic-types";
import { FullTopicDraftSchema } from "@/lib/bazi/orchestrator/chunk-manager";
import {
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  type AnnotationDimensionName,
  type CalculatedStateValue,
  type DraftDimensionValue,
} from "@/lib/bazi/schema-types";

export type FullTopicDraftValue = z.infer<typeof FullTopicDraftSchema>;

export type ProofDimensionCompositionStrategy =
  | "direct-topic-dimension"
  | "shared-legacy-dimension"
  | "unmapped-legacy-dimension";

export type ProofDimensionProvenance = {
  dimensionName: AnnotationDimensionName;
  topicIds: TopicId[];
  strategy: ProofDimensionCompositionStrategy;
  synthesisRationale:
    | "single-topic-direct-map"
    | "shared-legacy-dimension-merge"
    | "legacy-dimension-awaits-proof-mapping";
};

export type ComposeProofDimensionsContext = {
  draftByTopic: FullTopicDraftValue;
  calculatedState?: CalculatedStateValue;
};

export type ComposeProofDimensionsResult = {
  dimensions: DraftDimensionValue[];
  provenance: Record<AnnotationDimensionName, ProofDimensionProvenance>;
};

function buildMappedThoughtProcess(
  dimensionName: AnnotationDimensionName,
  topicIds: readonly TopicId[],
) {
  const topicLabels = topicIds.map((topicId) => getBaziTopicDefinition(topicId).thaiLabel);

  return [
    "Generated via Chunked Orchestrator.",
    `Mapped from Step 3 topics: ${topicLabels.join(", ")}.`,
    `Legacy proof dimension: ${dimensionName}.`,
  ].join(" ");
}

function buildMappedPrediction(
  dimensionName: AnnotationDimensionName,
  draftByTopic: FullTopicDraftValue,
  topicIds: readonly TopicId[],
) {
  if (topicIds.length === 1) {
    return draftByTopic[topicIds[0]];
  }

  const meta = ANNOTATION_DIMENSION_META.find((entry) => entry.dimensionName === dimensionName);
  const sectionHeader = meta ? `${meta.title}` : dimensionName;

  return [
    `${sectionHeader}`,
    ...topicIds.map((topicId) => {
      const topic = getBaziTopicDefinition(topicId);

      return `- ${topic.thaiLabel}: ${draftByTopic[topicId]}`;
    }),
  ].join("\n");
}

function buildUnmappedDimension(dimensionName: AnnotationDimensionName): DraftDimensionValue {
  const meta = ANNOTATION_DIMENSION_META.find((entry) => entry.dimensionName === dimensionName);

  return {
    dimension_name: dimensionName,
    thought_process: [
      "Generated via Chunked Orchestrator.",
      "No direct Step 3 topic is mapped to this legacy proof dimension yet.",
      "Hold this dimension for manual sinsae completion during proof.",
    ].join(" "),
    final_prediction: meta
      ? `ยังไม่มี topic ตรงจาก Step 3 สำหรับมิติ ${meta.title} จึงต้องให้ซินแสเติมคำอ่านมิตินี้ในขั้น proof ต่อค่ะ`
      : `ยังไม่มี topic ตรงจาก Step 3 สำหรับมิติ ${dimensionName} จึงต้องให้ซินแสเติมในขั้น proof ต่อค่ะ`,
    supporting_signals: [
      "source=step3-topic-draft",
      "mapping=unmapped-legacy-dimension",
    ],
    confidence_note: "awaiting-manual-proof-mapping",
  };
}

function buildDimensionProvenance(
  dimensionName: AnnotationDimensionName,
  topicIds: readonly TopicId[],
): ProofDimensionProvenance {
  if (topicIds.length === 0) {
    return {
      dimensionName,
      topicIds: [],
      strategy: "unmapped-legacy-dimension",
      synthesisRationale: "legacy-dimension-awaits-proof-mapping",
    };
  }

  if (topicIds.length === 1) {
    return {
      dimensionName,
      topicIds: [...topicIds],
      strategy: "direct-topic-dimension",
      synthesisRationale: "single-topic-direct-map",
    };
  }

  return {
    dimensionName,
    topicIds: [...topicIds],
    strategy: "shared-legacy-dimension",
    synthesisRationale: "shared-legacy-dimension-merge",
  };
}

function buildMappedDimension(
  dimensionName: AnnotationDimensionName,
  draftByTopic: FullTopicDraftValue,
): DraftDimensionValue {
  const topicIds = getTopicIdsForAnnotationDimension(dimensionName);

  if (topicIds.length === 0) {
    return buildUnmappedDimension(dimensionName);
  }

  return {
    dimension_name: dimensionName,
    thought_process: buildMappedThoughtProcess(dimensionName, topicIds),
    final_prediction: buildMappedPrediction(dimensionName, draftByTopic, topicIds),
    supporting_signals: [
      `source_topics=${topicIds.join(",")}`,
      topicIds.length > 1 ? "mapping=shared-legacy-dimension" : "mapping=direct-topic-dimension",
    ],
  };
}

export function composeProofDimensions(
  context: ComposeProofDimensionsContext,
): ComposeProofDimensionsResult {
  FullTopicDraftSchema.parse(context.draftByTopic);

  const dimensions = REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) =>
    buildMappedDimension(dimensionName, context.draftByTopic),
  );
  const provenance = Object.fromEntries(
    REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => [
      dimensionName,
      buildDimensionProvenance(
        dimensionName,
        getTopicIdsForAnnotationDimension(dimensionName),
      ),
    ]),
  ) as Record<AnnotationDimensionName, ProofDimensionProvenance>;

  return {
    dimensions,
    provenance,
  };
}

export function getUnmappedLegacyDimensions() {
  return UNMAPPED_ANNOTATION_DIMENSIONS;
}