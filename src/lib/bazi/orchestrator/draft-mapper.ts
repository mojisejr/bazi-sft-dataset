import { z } from "zod";

import {
  composeProofDimensions,
  getUnmappedLegacyDimensions,
} from "@/lib/bazi/orchestrator/proof-dimension-composer";
import {
  DraftAnnotationDataSchema,
  type DraftAnnotationDataValue,
} from "@/lib/bazi/schema-types";

export function mapTopicDraftToDraftAnnotationData(
  draftByTopic: z.infer<typeof import("@/lib/bazi/orchestrator/chunk-manager").FullTopicDraftSchema>,
): DraftAnnotationDataValue {
  const composed = composeProofDimensions({ draftByTopic });

  return DraftAnnotationDataSchema.parse({
    version: "1.6",
    reviewSummary:
      "ร่างนี้มาจาก Step 3 chunked orchestrator และถูก map เข้าสู่ legacy proof dimensions เพื่อรอซินแสตรวจต่อ",
    dimensions: composed.dimensions,
  });
}

export { getUnmappedLegacyDimensions };