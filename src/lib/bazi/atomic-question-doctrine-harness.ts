import {
  composeBaziDoctrinePacket,
  createBaziBucketFallbackDoctrinePacketQuestionContext,
  type BaziDoctrinePacket,
  type BaziDoctrinePacketQuestionContext,
} from "@/lib/bazi/atomic-question-doctrine-packet";
import { type BaziAtomicCanonicalBucket } from "@/lib/bazi/atomic-question-matrix";
import {
  resolveBaziAtomicQuestion,
  type BaziAtomicQuestionResolverChatEvidence,
} from "@/lib/bazi/atomic-question-resolver";
import { type CalculatedStateValue } from "@/lib/bazi/schema-types";

export type BaziDoctrineHarnessInput = {
  canonicalBucket: BaziAtomicCanonicalBucket;
  payload: CalculatedStateValue;
  currentChatEvidence?: BaziAtomicQuestionResolverChatEvidence;
};

export function resolveBaziDoctrinePacketQuestionContext(
  canonicalBucket: BaziAtomicCanonicalBucket,
  currentChatEvidence?: BaziAtomicQuestionResolverChatEvidence,
): BaziDoctrinePacketQuestionContext {
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

export function selectBaziDoctrinePacketForCanonicalQuestion(
  input: BaziDoctrineHarnessInput,
): BaziDoctrinePacket {
  return composeBaziDoctrinePacket({
    questionContext: resolveBaziDoctrinePacketQuestionContext(
      input.canonicalBucket,
      input.currentChatEvidence,
    ),
    payload: input.payload,
  });
}