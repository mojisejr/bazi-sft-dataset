import { type BaziStatePayload } from "@/features/bazi-math/bazi-engine-adapter";
import { type OpenWebUiIntentClassification } from "@/features/open-webui/intent-router";
import {
  BaziDoctrinePacketSchema,
  composeBaziDoctrinePacket,
  createBaziBucketFallbackDoctrinePacketQuestionContext,
  type BaziDoctrinePacket,
  type BaziDoctrinePacketQuestionContext,
} from "@/lib/bazi/atomic-question-doctrine-packet";
import { type BaziAtomicCanonicalBucket } from "@/lib/bazi/atomic-question-matrix";
import {
  BaziAtomicQuestionResolverChatEvidenceSchema,
  resolveBaziAtomicQuestion,
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

function resolveOpenWebUiQuestionContext(
  classification: OpenWebUiIntentClassification,
  currentChatEvidence?: OpenWebUiTruthPacketChatEvidence,
): BaziDoctrinePacketQuestionContext | null {
  const canonicalBucket = resolveOpenWebUiCanonicalBucket(classification);

  if (!canonicalBucket) {
    return null;
  }

  if (!currentChatEvidence) {
    return createBaziBucketFallbackDoctrinePacketQuestionContext(canonicalBucket);
  }

  const selection = resolveBaziAtomicQuestion({
    canonicalBucket,
    currentChatEvidence,
  });

  if (selection.selectionMode === "atomic_job") {
    return {
      canonicalBucket: selection.canonicalBucket,
      jobId: selection.jobId,
      selectionMode: "atomic_job",
    };
  }

  return createBaziBucketFallbackDoctrinePacketQuestionContext(selection.canonicalBucket);
}

// Open WebUI remains an adapter: it maps routed shell intent to the canonical
// doctrine packet context and leaves packet ownership below src/lib/bazi.
export function selectOpenWebUiTruthPacket(
  classification: OpenWebUiIntentClassification,
  payload: BaziStatePayload,
  currentChatEvidence?: OpenWebUiTruthPacketChatEvidence,
): OpenWebUiTruthPacket | null {
  const questionContext = resolveOpenWebUiQuestionContext(classification, currentChatEvidence);

  if (!questionContext) {
    return null;
  }

  return composeBaziDoctrinePacket({
    questionContext,
    payload,
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
