import { z } from "zod";

import {
  composeProofDimensions,
  getUnmappedLegacyDimensions,
  type ProofDimensionProvenance,
} from "@/lib/bazi/orchestrator/proof-dimension-composer";
import {
  DraftAnnotationDataSchema,
  type CalculatedStateValue,
  type DraftAnnotationDataValue,
  type AnnotationDimensionName,
} from "@/lib/bazi/schema-types";

export type MapTopicDraftContext = {
  calculatedState?: CalculatedStateValue;
};

export type MappedTopicDraftWithProvenance = {
  annotationData: DraftAnnotationDataValue;
  provenance: Record<AnnotationDimensionName, ProofDimensionProvenance>;
};

export function mapTopicDraftWithProvenance(
  draftByTopic: z.infer<typeof import("@/lib/bazi/orchestrator/chunk-manager").FullTopicDraftSchema>,
  context?: MapTopicDraftContext,
): MappedTopicDraftWithProvenance {
  const composed = composeProofDimensions({
    draftByTopic,
    calculatedState: context?.calculatedState,
  });

  return {
    annotationData: DraftAnnotationDataSchema.parse({
      version: "1.6",
      reviewSummary:
        "ร่างนี้มาจาก Step 3 chunked orchestrator และถูก map เข้าสู่ legacy proof dimensions เพื่อรอซินแสตรวจต่อ",
      dimensions: composed.dimensions,
    }),
    provenance: composed.provenance,
  };
}

export function mapTopicDraftToDraftAnnotationData(
  draftByTopic: z.infer<typeof import("@/lib/bazi/orchestrator/chunk-manager").FullTopicDraftSchema>,
  context?: MapTopicDraftContext,
): DraftAnnotationDataValue {
  return mapTopicDraftWithProvenance(draftByTopic, context).annotationData;
}

export { getUnmappedLegacyDimensions };