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
import {
  assertBaziCallerContractSupportsCanonicalBucket,
  type BaziCallerContract,
} from "@/lib/bazi/symbolic-engine.caller-contract";

export type BaziDoctrineHarnessInput = {
  canonicalBucket: BaziAtomicCanonicalBucket;
  payload?: CalculatedStateValue;
  callerContract?: BaziCallerContract;
  currentChatEvidence?: BaziAtomicQuestionResolverChatEvidence;
};

function resolveDoctrinePayload(input: BaziDoctrineHarnessInput): CalculatedStateValue {
  if (input.callerContract) {
    assertBaziCallerContractSupportsCanonicalBucket(input.callerContract, input.canonicalBucket);
    return input.callerContract.calculatedState;
  }

  if (input.payload) {
    return input.payload;
  }

  throw new Error("Bazi doctrine harness requires either payload or callerContract.");
}

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
    payload: resolveDoctrinePayload(input),
    callerContract: input.callerContract,
  });
}