import { z } from "zod";

export const SOURCE3_HEALTH_STEP_IDS = [
  "step-1-weak-element-routing",
  "step-2-organ-risk-mapping",
  "step-3-conflict-injury-markers",
  "step-4-bounded-caution-framing",
] as const;

export const SOURCE3_HEALTH_TERMINOLOGY_IDS = [
  "baseline-health-weakness",
  "organ-risk-map",
  "conflict-injury-marker",
  "health-caution-framing",
  "recovery-caution-boundary",
] as const;

export const SOURCE3_FORBIDDEN_CLAIM_IDS = [
  "diagnosis",
  "treatment-instruction",
  "source7-remedy-drift",
  "disease-certainty",
] as const;

export const SOURCE3_ALLOWED_CALLER_CONTRACT_PACKET_FAMILIES = [
  "strength",
  "role-of-element",
  "twelve-qi-texture",
  "conflict-context",
] as const;

const Source3HealthStepIdSchema = z.enum(SOURCE3_HEALTH_STEP_IDS);
const Source3HealthTerminologyIdSchema = z.enum(SOURCE3_HEALTH_TERMINOLOGY_IDS);
const Source3ForbiddenClaimIdSchema = z.enum(SOURCE3_FORBIDDEN_CLAIM_IDS);

const Source3Source1ReuseSchema = z.object({
  fieldId: z.enum([
    "weighted-strength",
    "role-of-element",
    "twelve-qi-texture",
    "conflict-context",
  ]),
  ownerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source3RetrievalContextReuseSchema = z.object({
  allowed: z.boolean(),
  mode: z.enum(["not-used", "context-only"]),
  surfaces: z.array(z.string().trim().min(1)),
  note: z.string().trim().min(1),
  guardrails: z.array(z.string().trim().min(1)).min(1),
});

const Source3OwnerTargetSchema = z.object({
  module: z.string().trim().min(1),
  ownerKey: z.string().trim().min(1),
  status: z.enum(["existing-owner", "new-owner-required", "gap-classified"]),
  note: z.string().trim().min(1),
});

const Source3LocalLogicSchema = z.object({
  ownerTarget: Source3OwnerTargetSchema,
  responsibilities: z.array(z.string().trim().min(1)).min(1),
});

const Source3HealthDoctrineStepSchema = z.object({
  stepId: Source3HealthStepIdSchema,
  manualStep: z.number().int().min(1).max(4),
  label: z.string().trim().min(1),
  manualIntent: z.string().trim().min(1),
  source1Reuse: z.array(Source3Source1ReuseSchema).min(1),
  retrievalContextReuse: Source3RetrievalContextReuseSchema,
  source3LocalLogic: Source3LocalLogicSchema,
  terminologyIds: z.array(Source3HealthTerminologyIdSchema).min(1),
});

const Source3TerminologyFreezeSchema = z.object({
  termId: Source3HealthTerminologyIdSchema,
  canonicalLabel: z.string().trim().min(1),
  meaning: z.string().trim().min(1),
  ownerSource: z.enum(["source1", "source3"]),
  ownerSurface: z.string().trim().min(1),
  mustNotBeNamedAs: z.array(z.string().trim().min(1)).default([]),
  note: z.string().trim().min(1),
});

const Source3ForbiddenClaimContractSchema = z.object({
  contractVerdict: z.literal("caution-only"),
  bannedClaimKinds: z.array(Source3ForbiddenClaimIdSchema).length(
    SOURCE3_FORBIDDEN_CLAIM_IDS.length,
  ),
  requiredLanguage: z.array(z.string().trim().min(1)).min(3),
  note: z.string().trim().min(1),
});

export const Source3HealthDoctrineSchema = z.object({
  sourceId: z.literal("source-3"),
  preserveSource1Authority: z.literal(true),
  allowRetrievalContextOnly: z.literal(true),
  forbidDiagnosisClaims: z.literal(true),
  forbidTreatmentClaims: z.literal(true),
  forbidSource7RemedyDrift: z.literal(true),
  allowedCallerContractPacketFamilies: z.tuple([
    z.literal("strength"),
    z.literal("role-of-element"),
    z.literal("twelve-qi-texture"),
    z.literal("conflict-context"),
  ]),
  forbiddenClaimContract: Source3ForbiddenClaimContractSchema,
  terminologyFreeze: z.array(Source3TerminologyFreezeSchema).length(
    SOURCE3_HEALTH_TERMINOLOGY_IDS.length,
  ),
  steps: z.array(Source3HealthDoctrineStepSchema).length(SOURCE3_HEALTH_STEP_IDS.length),
});

export type Source3HealthDoctrine = z.infer<typeof Source3HealthDoctrineSchema>;

const HEALTH_DELIVERY_SURFACES = [
  "topic-registry.health_risks",
  "healthOverviewDictionary",
  "hybrid-retrieval.health_overview",
] as const;

const RETRIEVAL_UNUSED = {
  allowed: false,
  mode: "not-used",
  surfaces: [],
  note: "Current health topic and retrieval surfaces do not own this deterministic health lane during the doctrine-freeze phase.",
  guardrails: [
    "Prompt or retrieval wording cannot be promoted into primary health logic for this step",
  ],
} as const;

export function buildSource3HealthDoctrine(): Source3HealthDoctrine {
  return Source3HealthDoctrineSchema.parse({
    sourceId: "source-3",
    preserveSource1Authority: true,
    allowRetrievalContextOnly: true,
    forbidDiagnosisClaims: true,
    forbidTreatmentClaims: true,
    forbidSource7RemedyDrift: true,
    allowedCallerContractPacketFamilies: [...SOURCE3_ALLOWED_CALLER_CONTRACT_PACKET_FAMILIES],
    forbiddenClaimContract: {
      contractVerdict: "caution-only",
      bannedClaimKinds: [...SOURCE3_FORBIDDEN_CLAIM_IDS],
      requiredLanguage: [
        "State structural weakness, organ strain, or timing-sensitive caution as a health tendency only.",
        "Stop at watchfulness, self-care framing, and bounded caution rather than clinical certainty.",
        "Do not prescribe treatment, diagnose disease, or smuggle Source 7 remedy language into Source 3 delivery.",
      ],
      note: "Source 3 may warn about weakness and strain, but it cannot claim diagnosis, treatment, or fortune-remedy ownership.",
    },
    terminologyFreeze: [
      {
        termId: "baseline-health-weakness",
        canonicalLabel: "baseline health weakness",
        meaning: "โครงจุดอ่อนสุขภาพที่ต้องเริ่มจากธาตุอ่อนหรือธาตุเสียก่อน แล้วค่อยขยายเป็นคำเตือนระดับสุขภาพพื้นฐาน.",
        ownerSource: "source3",
        ownerSurface: "source3-health-doctrine.step1-weak-element-routing",
        mustNotBeNamedAs: ["diagnosis", "disease label", "clinical finding"],
        note: "Source 3 เริ่มที่ weakness lane ไม่ใช่การตั้งชื่อโรค.",
      },
      {
        termId: "organ-risk-map",
        canonicalLabel: "organ risk map",
        meaning: "แผนที่อวัยวะหรือระบบร่างกายที่เสี่ยงจากธาตุอ่อนและเชิง texture/damage โดยใช้เป็น risk mapping เท่านั้น.",
        ownerSource: "source3",
        ownerSurface: "source3-health-rules.resolveHealthOrganRiskMap",
        mustNotBeNamedAs: ["medical diagnosis", "confirmed illness"],
        note: "owner นี้ต้องคงสถานะเป็น caution mapping ไม่ใช่ผลตรวจทางแพทย์.",
      },
      {
        termId: "conflict-injury-marker",
        canonicalLabel: "conflict injury marker",
        meaning: "ตัวชี้แรงกระแทกจากชง เฮ้ง ไห่ ผั่ว หรือ damage context ที่ยกระดับ weakness ไปเป็นจุดเฝ้าระวังเพิ่ม.",
        ownerSource: "source1",
        ownerSurface: "symbolic-engine.shared-packets.conflict-context",
        mustNotBeNamedAs: ["emergency diagnosis", "accident certainty"],
        note: "Source 3 reuse ได้ แต่ห้ามเปลี่ยน conflict context ให้กลายเป็นคำตัดสินทางการแพทย์.",
      },
      {
        termId: "health-caution-framing",
        canonicalLabel: "health caution framing",
        meaning: "กรอบภาษาที่ใช้ส่งต่อ weakness และ conflict marker ไปเป็นคำเตือนเชิงดูแลตัวเองอย่างมีขอบเขต.",
        ownerSource: "source3",
        ownerSurface: "source3-health-rules.interpretBoundedHealthCaution",
        mustNotBeNamedAs: ["treatment plan", "clinical recommendation", "fear escalation"],
        note: "ทุกคำตอบสุขภาพต้องจบที่ caution framing ไม่ใช่ certainty claim.",
      },
      {
        termId: "recovery-caution-boundary",
        canonicalLabel: "recovery caution boundary",
        meaning: "ขอบเขตที่ Source 3 อนุญาตให้พูดถึงการดูแลตัวเองหรือแผนฟื้นตัวได้เพียงระดับระวังและปรับภาระ ไม่ใช่การรักษาหรือแก้เคล็ด.",
        ownerSource: "source3",
        ownerSurface: "source3-health-doctrine.forbiddenClaimContract",
        mustNotBeNamedAs: ["treatment instructions", "source7 remedy", "merit-making fix"],
        note: "ขอบเขตนี้ล็อกไม่ให้ Source 3 หลุดไปเป็นเจ้าของ remedy lane ของ Source 7.",
      },
    ],
    steps: [
      {
        stepId: "step-1-weak-element-routing",
        manualStep: 1,
        label: "Weak element routing",
        manualIntent: "จัด baseline health weakness จาก weighted strength, role-of-element และ twelve-qi texture ก่อน โดยไม่ให้ prose หรือ retrieval ตัดสินแทนว่าอวัยวะไหนเสี่ยง.",
        source1Reuse: [
          {
            fieldId: "weighted-strength",
            ownerKey: "source1-operating-system-contract.buildSource1StrengthContract",
            note: "strength band เป็น structural owner ของ baseline ว่าดวงบางหรือรับแรงได้น้อยตรงไหน.",
          },
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "role-of-element packet keeps Source 3 anchored to the caller-contract packet families already frozen upstream.",
          },
          {
            fieldId: "twelve-qi-texture",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "texture packet helps distinguish weak or depleted baseline without inventing diagnosis wording.",
          },
        ],
        retrievalContextReuse: {
          allowed: true,
          mode: "context-only",
          surfaces: [...HEALTH_DELIVERY_SURFACES],
          note: "health topic and retrieval surfaces may narrate the baseline after the weak element lane is fixed, but they cannot choose the lane.",
          guardrails: [
            "delivery surfaces cannot choose which element or body system is structurally weak",
            "Step 1 must remain explainable from caller-contract packets even when Source 3 prose is absent",
          ],
        },
        source3LocalLogic: {
          ownerTarget: {
            module: "source3-health-doctrine",
            ownerKey: "step1-weak-element-routing",
            status: "existing-owner",
            note: "Phase 1 freezes the weak-element routing doctrine here before a runtime classifier exists.",
          },
          responsibilities: [
            "lock weak-element-first ordering for Source 3",
            "prevent delivery wording from becoming the owner of baseline health weakness",
          ],
        },
        terminologyIds: ["baseline-health-weakness", "health-caution-framing"],
      },
      {
        stepId: "step-2-organ-risk-mapping",
        manualStep: 2,
        label: "Organ risk mapping",
        manualIntent: "แปลง weak element และ texture signals ไปเป็น organ risk map ของอวัยวะหรือระบบที่ต้องเฝ้าระวังอย่างมีขอบเขต โดยยืนยันว่าเป็น risk mapping ไม่ใช่การวินิจฉัยหรือคำรักษา.",
        source1Reuse: [
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "shared packet roles remain the structural anchor before Source 3 maps organs or body systems.",
          },
          {
            fieldId: "twelve-qi-texture",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "texture evidence bounds how strain or depletion is described at the organ-risk level.",
          },
        ],
        retrievalContextReuse: RETRIEVAL_UNUSED,
        source3LocalLogic: {
          ownerTarget: {
            module: "source3-health-rules",
            ownerKey: "resolveHealthOrganRiskMap",
            status: "new-owner-required",
            note: "Phase 2 should implement the typed organ-risk mapping explicitly.",
          },
          responsibilities: [
            "freeze organ-risk lookup as a Source 3 owner lane",
            "keep organ wording bounded to caution rather than diagnosis",
          ],
        },
        terminologyIds: ["baseline-health-weakness", "organ-risk-map"],
      },
      {
        stepId: "step-3-conflict-injury-markers",
        manualStep: 3,
        label: "Conflict injury markers",
        manualIntent: "ยกระดับ weak element ไปเป็นจุดเฝ้าระวังเมื่อมีชง เฮ้ง ไห่ ผั่ว หรือ damage context แตะอวัยวะหรือระบบนั้น โดยไม่ข้ามไปเป็นคำตัดสินโรคหรือเหตุฉุกเฉินแน่นอน.",
        source1Reuse: [
          {
            fieldId: "conflict-context",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "conflict packet is the only allowed owner for damage or impact escalation during this phase.",
          },
          {
            fieldId: "twelve-qi-texture",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "texture evidence bounds whether the conflict marker reads as fragility, depletion, or pressure.",
          },
        ],
        retrievalContextReuse: RETRIEVAL_UNUSED,
        source3LocalLogic: {
          ownerTarget: {
            module: "source3-health-rules",
            ownerKey: "resolveHealthConflictInjuryMarkers",
            status: "new-owner-required",
            note: "Phase 2 should implement typed conflict markers for health strain and impact.",
          },
          responsibilities: [
            "separate structural weakness from conflict-triggered strain",
            "prevent conflict markers from turning into medical certainty or fear language",
          ],
        },
        terminologyIds: ["organ-risk-map", "conflict-injury-marker", "health-caution-framing"],
      },
      {
        stepId: "step-4-bounded-caution-framing",
        manualStep: 4,
        label: "Bounded caution framing",
        manualIntent: "compose คำเตือนสุขภาพให้จบที่ caution framing และ recovery boundary โดยห้าม drift ไปเป็นการวินิจฉัย การรักษา หรือ Source 7 remedy ownership.",
        source1Reuse: [
          {
            fieldId: "weighted-strength",
            ownerKey: "source1-operating-system-contract.buildSource1StrengthContract",
            note: "strength band constrains how strongly Source 3 may phrase a health caution.",
          },
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "element-role anchors keep the caution tied to structural chart truth rather than generic wellness prose.",
          },
          {
            fieldId: "conflict-context",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "conflict evidence is allowed to intensify watchfulness, but not to claim disease certainty.",
          },
        ],
        retrievalContextReuse: {
          allowed: true,
          mode: "context-only",
          surfaces: [...HEALTH_DELIVERY_SURFACES],
          note: "delivery surfaces may phrase the health caution after structural weakness and conflict markers are fixed deterministically.",
          guardrails: [
            "delivery surfaces cannot prescribe treatment or claim clinical certainty",
            "Step 4 must remain separate from Source 7 remedy, merit-making, or lucky-item guidance",
          ],
        },
        source3LocalLogic: {
          ownerTarget: {
            module: "source3-health-rules",
            ownerKey: "interpretBoundedHealthCaution",
            status: "new-owner-required",
            note: "Phase 2 should implement a bounded health caution interpreter instead of prose-only delivery.",
          },
          responsibilities: [
            "translate structural weakness and conflict truth into bounded health caution",
            "forbid treatment, diagnosis, and Source 7 remedy drift from becoming the owner of Source 3 wording",
          ],
        },
        terminologyIds: [
          "conflict-injury-marker",
          "health-caution-framing",
          "recovery-caution-boundary",
        ],
      },
    ],
  });
}