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

export type ProofCompositionMetadataSummary = {
  layer: "proof-dimension-composer";
  version: "v1";
  strategies: ProofDimensionCompositionStrategy[];
  directCount: number;
  sharedCount: number;
  unmappedCount: number;
};

function getDimensionMeta(dimensionName: AnnotationDimensionName) {
  return ANNOTATION_DIMENSION_META.find((entry) => entry.dimensionName === dimensionName);
}

function normalizeTopicDraft(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildChartTruthAnchors(calculatedState?: CalculatedStateValue) {
  if (!calculatedState) {
    return [] as string[];
  }

  const anchors = [`ยึดดิถี ${calculatedState.dayMaster} เป็นแกนของดวง`];

  if (calculatedState.dayMasterStrengthProfile?.narrative) {
    anchors.push(calculatedState.dayMasterStrengthProfile.narrative);
  } else if (calculatedState.dayMasterStrengthProfile?.strengthState) {
    anchors.push(`กำลังดิถีอยู่ในภาวะ ${calculatedState.dayMasterStrengthProfile.strengthState}`);
  }

  if (calculatedState.seasonalInteraction?.metaphor) {
    anchors.push(`ภาพฤดูกาลของดวงสะท้อนว่า ${calculatedState.seasonalInteraction.metaphor}`);
  }

  return anchors.slice(0, 3);
}

function buildMappedThoughtProcess(
  dimensionName: AnnotationDimensionName,
  draftByTopic: FullTopicDraftValue,
  topicIds: readonly TopicId[],
  calculatedState?: CalculatedStateValue,
) {
  const meta = getDimensionMeta(dimensionName);
  const topicLabels = topicIds.map((topicId) => getBaziTopicDefinition(topicId).thaiLabel);
  const chartTruthAnchors = buildChartTruthAnchors(calculatedState);
  const chartTruthPrefix = chartTruthAnchors[0]
    ? `มิตินี้อ่านในกรอบ ${meta?.title ?? dimensionName} โดย${chartTruthAnchors[0]}ก่อน.`
    : `มิตินี้อ่านในกรอบ ${meta?.title ?? dimensionName} โดยยึดหัวข้อ ${topicLabels.join(" และ ")} เป็นแกนก่อน.`;

  if (topicIds.length === 1) {
    const topicId = topicIds[0];

    return [
      chartTruthPrefix,
      `ประเด็นหลักจากหัวข้อ ${topicLabels[0]} ชี้ว่า ${normalizeTopicDraft(draftByTopic[topicId])}.`,
      chartTruthAnchors[1]
        ? `เมื่อประกบกับแกนดวงเดิมที่บอกว่า ${chartTruthAnchors[1]} จึงตีความมิตินี้ไปในทิศเดียวกัน.`
        : `จึงใช้หัวข้อนี้เป็นเหตุผลหลักในการ proof มิตินี้ต่อได้เลย.`,
    ].join(" ");
  }

  const topicEvidence = topicIds.map((topicId) => {
    const topic = getBaziTopicDefinition(topicId);

    return `${topic.thaiLabel} บอกว่า ${normalizeTopicDraft(draftByTopic[topicId])}`;
  });

  return [
    chartTruthPrefix,
    `มิตินี้ต้องอ่านร่วมกันระหว่าง ${topicLabels.join(" และ ")} เพราะทั้งหมดไหลมาที่ ${meta?.title ?? dimensionName}.`,
    `น้ำหนักเหตุผลที่เห็นตอนนี้คือ ${topicEvidence.join(" ขณะที่ ")}.`,
    chartTruthAnchors[1]
      ? `เมื่อเทียบกับแกนดวงที่บอกว่า ${chartTruthAnchors[1]} จึงต้องผสานทั้งสองหัวข้อก่อนสรุปผล.`
      : `จึงต้องผสานทั้งสองหัวข้อก่อนสรุปผลแทนการยึดเพียงหัวข้อเดียว.`,
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
  const meta = getDimensionMeta(dimensionName);

  return {
    dimension_name: dimensionName,
    thought_process: [
      `มิติ ${meta?.title ?? dimensionName} ยังไม่มีหัวข้อ Step 3 ที่แมปตรงเข้ามาโดยตรง.`,
      "ดังนั้นรอบนี้ต้องเว้นพื้นที่ไว้ให้ซินแสเติมเหตุผลในขั้น proof และไม่ควรสรุปเกินหลักฐานที่มี.",
      "ให้ถือมิตินี้เป็น explicit gap ที่รอการอ่านต่อด้วยมือ ไม่ใช่ช่องให้ระบบแต่งเหตุผลเอง.",
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
  calculatedState?: CalculatedStateValue,
): DraftDimensionValue {
  const topicIds = getTopicIdsForAnnotationDimension(dimensionName);

  if (topicIds.length === 0) {
    return buildUnmappedDimension(dimensionName);
  }

  return {
    dimension_name: dimensionName,
    thought_process: buildMappedThoughtProcess(dimensionName, draftByTopic, topicIds, calculatedState),
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
    buildMappedDimension(dimensionName, context.draftByTopic, context.calculatedState),
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

export function summarizeProofCompositionProvenance(
  provenance: Record<AnnotationDimensionName, ProofDimensionProvenance>,
): ProofCompositionMetadataSummary {
  const values = Object.values(provenance);

  return {
    layer: "proof-dimension-composer",
    version: "v1",
    strategies: [...new Set(values.map((entry) => entry.strategy))],
    directCount: values.filter((entry) => entry.strategy === "direct-topic-dimension").length,
    sharedCount: values.filter((entry) => entry.strategy === "shared-legacy-dimension").length,
    unmappedCount: values.filter((entry) => entry.strategy === "unmapped-legacy-dimension").length,
  };
}