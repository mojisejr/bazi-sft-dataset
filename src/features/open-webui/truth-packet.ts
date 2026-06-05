import { type BaziStatePayload } from "@/features/bazi-math/bazi-engine-adapter";
import { type OpenWebUiIntentClassification } from "@/features/open-webui/intent-router";
import {
  BaziDoctrinePacketSchema,
  type BaziDoctrinePacket,
} from "@/lib/bazi/atomic-question-doctrine-packet";
import { selectBaziDoctrinePacketForCanonicalQuestion } from "@/lib/bazi/atomic-question-doctrine-harness";
import { type BaziAtomicCanonicalBucket } from "@/lib/bazi/atomic-question-matrix";
import {
  BaziAtomicQuestionResolverChatEvidenceSchema,
  type BaziAtomicQuestionResolverChatEvidence,
} from "@/lib/bazi/atomic-question-resolver";

export const OpenWebUiTruthPacketSchema = BaziDoctrinePacketSchema;
export const OpenWebUiTruthPacketChatEvidenceSchema = BaziAtomicQuestionResolverChatEvidenceSchema;

export type OpenWebUiTruthPacket = BaziDoctrinePacket;
export type OpenWebUiTruthPacketChatEvidence = BaziAtomicQuestionResolverChatEvidence;

function mapOpenWebUiIntentToCanonicalBucket(
  intent: Exclude<OpenWebUiIntentClassification["intent"], "chit_chat">,
): BaziAtomicCanonicalBucket {
  switch (intent) {
    case "wealth":
      return "wealth";

    case "love":
      return "relationship";

    case "career":
      return "work";

    case "health":
      return "health";

    case "general_reading":
      return "foundation";
  }
}

function resolveOpenWebUiCanonicalBucket(
  classification: OpenWebUiIntentClassification,
): BaziAtomicCanonicalBucket | null {
  if (!classification.requiresBaziConsult || classification.intent === "chit_chat") {
    return null;
  }

  return mapOpenWebUiIntentToCanonicalBucket(classification.intent);
}

// Open WebUI remains an adapter: it maps routed shell intent to the canonical
// doctrine packet context and leaves packet ownership below src/lib/bazi.
export function selectOpenWebUiTruthPacket(
  classification: OpenWebUiIntentClassification,
  payload: BaziStatePayload,
  currentChatEvidence?: OpenWebUiTruthPacketChatEvidence,
): OpenWebUiTruthPacket | null {
  const canonicalBucket = resolveOpenWebUiCanonicalBucket(classification);

  if (!canonicalBucket) {
    return null;
  }

  return selectBaziDoctrinePacketForCanonicalQuestion({
    canonicalBucket,
    payload,
    currentChatEvidence,
  });
}

export function stringifyOpenWebUiTruthPacket(
  classification: OpenWebUiIntentClassification,
  payload: BaziStatePayload,
  currentChatEvidence?: OpenWebUiTruthPacketChatEvidence,
): string | null {
  const truthPacket = selectOpenWebUiTruthPacket(classification, payload, currentChatEvidence);

  return truthPacket ? JSON.stringify(truthPacket, null, 2) : null;
}
