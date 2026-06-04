import { z } from "zod";

import {
  BaziAtomicCanonicalBucketSchema,
  type BaziAtomicCanonicalBucket,
  type BaziAtomicQuestionJobId,
} from "@/lib/bazi/atomic-question-matrix";

export const BAZI_ATOMIC_QUESTION_RESOLVER_FIRST_WAVE_JOB_IDS = [
  "foundation.base_chart_persona",
  "foundation.life_direction_check",
  "wealth.accumulation_capacity",
  "wealth.timing_window",
  "work.career_fit",
  "work.job_switch_timing",
  "relationship.partner_profile",
  "relationship.timing_window",
  "health.constitution_baseline",
  "health.recovery_caution",
] as const satisfies readonly BaziAtomicQuestionJobId[];

export const BaziAtomicQuestionResolverJobIdSchema = z.enum(
  BAZI_ATOMIC_QUESTION_RESOLVER_FIRST_WAVE_JOB_IDS,
);

export const BAZI_ATOMIC_QUESTION_RESOLVER_FALLBACK_REASONS = [
  "unsupported_bucket",
  "insufficient_signal",
  "ambiguous_signal",
] as const;

export const BaziAtomicQuestionResolverFallbackReasonSchema = z.enum(
  BAZI_ATOMIC_QUESTION_RESOLVER_FALLBACK_REASONS,
);

export const BaziAtomicQuestionResolverChatEvidenceSchema = z.object({
  latestUserMessage: z.string().trim().min(1),
  recentMessages: z.array(z.string().trim().min(1)).max(6).default([]),
});

export const BaziAtomicQuestionResolverInputSchema = z.object({
  canonicalBucket: BaziAtomicCanonicalBucketSchema,
  currentChatEvidence: BaziAtomicQuestionResolverChatEvidenceSchema,
});

export const BaziAtomicQuestionResolverResultSchema = z.discriminatedUnion(
  "selectionMode",
  [
    z.object({
      selectionMode: z.literal("atomic_job"),
      canonicalBucket: BaziAtomicCanonicalBucketSchema,
      jobId: BaziAtomicQuestionResolverJobIdSchema,
      confidence: z.number().min(0).max(1),
    }),
    z.object({
      selectionMode: z.literal("bucket_fallback"),
      canonicalBucket: BaziAtomicCanonicalBucketSchema,
      confidence: z.number().min(0).max(1),
      fallbackReason: BaziAtomicQuestionResolverFallbackReasonSchema,
    }),
  ],
);

export type BaziAtomicQuestionResolverJobId = z.infer<
  typeof BaziAtomicQuestionResolverJobIdSchema
>;
export type BaziAtomicQuestionResolverChatEvidence = z.infer<
  typeof BaziAtomicQuestionResolverChatEvidenceSchema
>;
export type BaziAtomicQuestionResolverFallbackReason = z.infer<
  typeof BaziAtomicQuestionResolverFallbackReasonSchema
>;
export type BaziAtomicQuestionResolverInput = z.infer<
  typeof BaziAtomicQuestionResolverInputSchema
>;
export type BaziAtomicQuestionResolverResult = z.infer<
  typeof BaziAtomicQuestionResolverResultSchema
>;

type ResolverRule = {
  jobId: BaziAtomicQuestionResolverJobId;
  requiredSignalGroups: readonly (readonly string[])[];
  supportSignals: readonly string[];
};

const FIRST_WAVE_JOB_IDS_BY_BUCKET: Record<
  BaziAtomicCanonicalBucket,
  readonly BaziAtomicQuestionResolverJobId[]
> = {
  foundation: [
    "foundation.base_chart_persona",
    "foundation.life_direction_check",
  ],
  wealth: [
    "wealth.accumulation_capacity",
    "wealth.timing_window",
  ],
  work: [
    "work.career_fit",
    "work.job_switch_timing",
  ],
  relationship: [
    "relationship.partner_profile",
    "relationship.timing_window",
  ],
  health: [
    "health.constitution_baseline",
    "health.recovery_caution",
  ],
  study: [],
};

const COMMON_TIMING_SIGNALS = [
  "when",
  "timing",
  "window",
  "now",
  "soon",
  "this year",
  "next year",
  "when should",
  "when is",
  "when will",
  "เมื่อไหร่",
  "ช่วงไหน",
  "ตอนไหน",
  "ปีนี้",
  "ปีหน้า",
  "ตอนนี้",
] as const;

const RESOLVER_RULES_BY_BUCKET: Partial<Record<BaziAtomicCanonicalBucket, readonly ResolverRule[]>> = {
  foundation: [
    {
      jobId: "foundation.base_chart_persona",
      requiredSignalGroups: [[
        "base chart",
        "core personality",
        "core temperament",
        "who am i",
        "personality",
        "temperament",
        "พื้นดวง",
        "ตัวตน",
        "นิสัย",
        "บุคลิก",
      ]],
      supportSignals: ["chart", "core", "พื้นฐาน"],
    },
    {
      jobId: "foundation.life_direction_check",
      requiredSignalGroups: [[
        "right path",
        "life direction",
        "aligned",
        "off track",
        "direction",
        "path i'm on",
        "ไปถูกทาง",
        "ทางที่เดิน",
        "เส้นทางชีวิต",
        "หลงทาง",
      ]],
      supportSignals: ["path", "direction", "current phase", "ตอนนี้"],
    },
  ],
  wealth: [
    {
      jobId: "wealth.accumulation_capacity",
      requiredSignalGroups: [[
        "build and keep money",
        "keep money",
        "accumulate",
        "retain money",
        "save money",
        "เก็บเงิน",
        "สร้างฐานะ",
        "เก็บทรัพย์",
        "เก็บเงินอยู่ไหม",
      ]],
      supportSignals: ["money", "wealth", "assets", "income", "การเงิน"],
    },
    {
      jobId: "wealth.timing_window",
      requiredSignalGroups: [
        [
          "money improve",
          "income improve",
          "money movement",
          "เงินจะดีขึ้น",
          "รายได้จะดีขึ้น",
          "เงินเข้า",
          "การเงินดีขึ้น",
        ],
        COMMON_TIMING_SIGNALS,
      ],
      supportSignals: ["money", "income", "wealth", "การเงิน", "รายได้"],
    },
  ],
  work: [
    {
      jobId: "work.career_fit",
      requiredSignalGroups: [[
        "fit me",
        "fits me",
        "suits me",
        "suitable role",
        "suitable job",
        "what kind of role",
        "what kind of job",
        "work style",
        "career path",
        "งานที่เหมาะ",
        "เหมาะกับงาน",
        "เหมาะกับอาชีพ",
        "สายงานไหน",
        "งานแบบไหน",
        "อาชีพไหนดี",
        "ควรทำงานอะไร",
      ]],
      supportSignals: ["role", "job", "career", "path", "style", "งาน", "อาชีพ"],
    },
    {
      jobId: "work.job_switch_timing",
      requiredSignalGroups: [
        [
          "change jobs",
          "change job",
          "switch jobs",
          "switch job",
          "job switch",
          "move jobs",
          "move job",
          "leave my job",
          "quit job",
          "resign",
          "เปลี่ยนงาน",
          "ย้ายงาน",
          "ลาออก",
          "หางานใหม่",
        ],
        COMMON_TIMING_SIGNALS,
      ],
      supportSignals: [
        "safer window",
        "safe time",
        "good time",
        "move window",
        "ย้ายตอนนี้",
        "ช่วงย้ายงาน",
      ],
    },
  ],
  relationship: [
    {
      jobId: "relationship.partner_profile",
      requiredSignalGroups: [[
        "kind of partner",
        "partner type",
        "relationship type",
        "spouse type",
        "คู่แบบไหน",
        "แฟนแบบไหน",
        "คู่ครองแบบไหน",
        "คนแบบไหนที่เหมาะ",
      ]],
      supportSignals: ["partner", "spouse", "relationship", "คู่", "แฟน"],
    },
    {
      jobId: "relationship.timing_window",
      requiredSignalGroups: [
        [
          "relationship enter",
          "new person",
          "marriage",
          "meet partner",
          "start relationship",
          "มีแฟน",
          "เจอคู่",
          "เจอคนใหม่",
          "แต่งงาน",
          "ความรักเข้ามา",
        ],
        COMMON_TIMING_SIGNALS,
      ],
      supportSignals: ["relationship", "partner", "marriage", "ความรัก", "คู่"],
    },
  ],
  health: [
    {
      jobId: "health.constitution_baseline",
      requiredSignalGroups: [[
        "baseline body tendency",
        "core weakness",
        "constitution",
        "baseline health",
        "สุขภาพพื้นฐาน",
        "ร่างกายพื้นฐาน",
        "จุดอ่อนของร่างกาย",
        "ธาตุอ่อน",
      ]],
      supportSignals: ["body", "health", "balance", "ร่างกาย", "สุขภาพ"],
    },
    {
      jobId: "health.recovery_caution",
      requiredSignalGroups: [[
        "recovery plan",
        "recover",
        "body goal",
        "safe to pursue",
        "is it safe",
        "ฟื้นตัว",
        "แผนสุขภาพ",
        "เป้าหมายร่างกาย",
        "ปลอดภัยไหม",
        "ควรทำตอนนี้ไหม",
      ]],
      supportSignals: [
        "plan",
        "safe",
        "now",
        "body",
        "health",
        "ลดน้ำหนัก",
        "ออกกำลังกาย",
      ],
    },
  ],
};

const MINIMUM_SIGNAL_SCORE = 4;
const MINIMUM_SCORE_GAP = 3;

function normalizeResolverText(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildResolverText(input: BaziAtomicQuestionResolverInput["currentChatEvidence"]) {
  return normalizeResolverText([
    ...input.recentMessages,
    input.latestUserMessage,
    input.latestUserMessage,
  ].join(" "));
}

function scoreSignalGroup(text: string, signals: readonly string[]) {
  return signals.some((signal) => text.includes(signal)) ? 3 : 0;
}

function scoreSupportSignals(text: string, signals: readonly string[]) {
  return signals.reduce((score, signal) => (text.includes(signal) ? score + 1 : score), 0);
}

function scoreResolverRule(text: string, rule: ResolverRule) {
  let score = 0;

  for (const signalGroup of rule.requiredSignalGroups) {
    const groupScore = scoreSignalGroup(text, signalGroup);

    if (groupScore === 0) {
      return 0;
    }

    score += groupScore;
  }

  return score + scoreSupportSignals(text, rule.supportSignals);
}

function toConfidence(topScore: number, secondScore: number) {
  if (topScore <= 0) {
    return 0;
  }

  return Number(
    Math.min(0.99, topScore / Math.max(topScore + secondScore + 1, 1)).toFixed(2),
  );
}

function createBucketFallbackResult(
  canonicalBucket: BaziAtomicCanonicalBucket,
  fallbackReason: BaziAtomicQuestionResolverFallbackReason,
  confidence: number,
): BaziAtomicQuestionResolverResult {
  return BaziAtomicQuestionResolverResultSchema.parse({
    selectionMode: "bucket_fallback",
    canonicalBucket,
    confidence,
    fallbackReason,
  });
}

export function resolveBaziAtomicQuestion(
  rawInput: BaziAtomicQuestionResolverInput,
): BaziAtomicQuestionResolverResult {
  const input = BaziAtomicQuestionResolverInputSchema.parse(rawInput);
  const supportedJobIds = FIRST_WAVE_JOB_IDS_BY_BUCKET[input.canonicalBucket];

  if (supportedJobIds.length === 0) {
    return createBucketFallbackResult(input.canonicalBucket, "unsupported_bucket", 0);
  }

  const rules = RESOLVER_RULES_BY_BUCKET[input.canonicalBucket] ?? [];
  const text = buildResolverText(input.currentChatEvidence);
  const rankedCandidates = rules
    .map((rule) => ({
      jobId: rule.jobId,
      score: scoreResolverRule(text, rule),
    }))
    .sort((left, right) => right.score - left.score);
  const topCandidate = rankedCandidates[0];
  const secondCandidate = rankedCandidates[1];
  const topScore = topCandidate?.score ?? 0;
  const secondScore = secondCandidate?.score ?? 0;
  const confidence = toConfidence(topScore, secondScore);

  if (topScore < MINIMUM_SIGNAL_SCORE) {
    return createBucketFallbackResult(input.canonicalBucket, "insufficient_signal", confidence);
  }

  if (secondScore > 0 && topScore - secondScore < MINIMUM_SCORE_GAP) {
    return createBucketFallbackResult(input.canonicalBucket, "ambiguous_signal", confidence);
  }

  return BaziAtomicQuestionResolverResultSchema.parse({
    selectionMode: "atomic_job",
    canonicalBucket: input.canonicalBucket,
    jobId: topCandidate.jobId,
    confidence,
  });
}