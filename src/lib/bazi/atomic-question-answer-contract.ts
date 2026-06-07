import { z } from "zod";

import {
  BaziDoctrinePacketSectionProvenanceSchema,
  type BaziDoctrinePacket,
} from "@/lib/bazi/atomic-question-doctrine-packet";

export const BaziSchoolAnswerStageKeySchema = z.enum([
  "day_master",
  "day_master_strength",
  "five_element_reaction_and_role_evidence",
  "interaction_markers",
  "twelve_qi",
  "stars_and_supporting_markers",
]);

export const BaziSchoolAnswerStageStatusSchema = z.enum([
  "present",
  "missing_required_evidence",
  "optional_absent",
]);

export const BaziSchoolAnswerStageSchema = z.object({
  key: BaziSchoolAnswerStageKeySchema,
  schoolLabel: z.string().trim().min(1),
  required: z.boolean(),
  status: BaziSchoolAnswerStageStatusSchema,
  primaryEvidenceKeys: z.array(z.string().trim().min(1)),
  supportingEvidenceKeys: z.array(z.string().trim().min(1)),
  guidance: z.string().trim().min(1),
});

export const BaziSchoolAnswerVocabularySchema = z.object({
  anchorTerms: z.array(z.string().trim().min(1)).min(1),
  fiveElementTerms: z.array(z.string().trim().min(1)).min(1),
  interactionTerms: z.array(z.string().trim().min(1)).min(1),
  twelveQiTerms: z.array(z.string().trim().min(1)).min(1),
  starTerms: z.array(z.string().trim().min(1)).min(1),
  forbiddenPrimaryReplacements: z.array(z.string().trim().min(1)).min(1),
});

export const BaziSchoolAnswerOwnershipSchema = z.object({
  answerContractOwns: z.array(z.string().trim().min(1)).min(1),
  doctrinePacketOwns: z.array(z.string().trim().min(1)).min(1),
  resolverOwns: z.array(z.string().trim().min(1)).min(1),
  promptPersonaOwns: z.array(z.string().trim().min(1)).min(1),
});

export const BaziSchoolAnswerProvenanceRuleSchema = z.object({
  provenance: BaziDoctrinePacketSectionProvenanceSchema,
  applicableSectionKeys: z.array(z.string().trim().min(1)),
  directive: z.string().trim().min(1),
});

export const BaziSchoolAnswerDomainBoundaryLawSchema = z.object({
  primaryDomain: z.enum([
    "wealth",
    "love",
    "career",
    "health",
    "general_reading",
    "study",
  ]),
  disallowedDriftDomains: z.array(z.string().trim().min(1)),
  crossDomainRule: z.string().trim().min(1),
});

export const BaziSchoolAnswerAgeWindowLawSchema = z.object({
  anchorTimingKey: z.string().trim().min(1).nullable(),
  directive: z.string().trim().min(1),
});

export const BaziSchoolAnswerHealthCautionLawSchema = z.object({
  applies: z.boolean(),
  directive: z.string().trim().min(1),
});

export const BaziSchoolAnswerContractSchema = z.object({
  kind: z.literal("bazi_school_answer_contract"),
  canonicalBucket: z.enum([
    "wealth",
    "relationship",
    "work",
    "health",
    "foundation",
    "study",
  ]),
  selectionMode: z.enum(["atomic_job", "bucket_fallback"]),
  bucketFallbackPolicy: z.string().trim().min(1),
  packetHints: z.array(z.string().trim().min(1)),
  schoolReadingOrder: z.array(BaziSchoolAnswerStageSchema).length(6),
  allowedSchoolVocabulary: BaziSchoolAnswerVocabularySchema,
  provenanceRules: z.array(BaziSchoolAnswerProvenanceRuleSchema).length(4),
  domainBoundaryLaw: BaziSchoolAnswerDomainBoundaryLawSchema,
  ageWindowLaw: BaziSchoolAnswerAgeWindowLawSchema,
  healthCautionLaw: BaziSchoolAnswerHealthCautionLawSchema,
  ownership: BaziSchoolAnswerOwnershipSchema,
});

export type BaziSchoolAnswerContract = z.infer<typeof BaziSchoolAnswerContractSchema>;
export type BaziSchoolAnswerStageKey = z.infer<typeof BaziSchoolAnswerStageKeySchema>;

export type BaziSchoolAnswerScopedRuntimeContext = {
  requestedDomain?: "wealth" | "love" | "career" | "health" | "general_reading" | "study" | "chit_chat" | null;
  currentAgeWindowLabel?: string | null;
};

const STAGE_DEFINITIONS: Array<{
  key: BaziSchoolAnswerStageKey;
  schoolLabel: string;
  required: boolean;
  guidance: string;
  promptLine: string;
  primaryEvidencePaths: string[];
  supportingEvidencePaths: string[];
}> = [
  {
    key: "day_master",
    schoolLabel: "ดิถี",
    required: true,
    guidance: "เปิดคำตอบด้วยดิถีเป็นตัวตั้งก่อนแรงอื่นเสมอ",
    promptLine: "ตรวจดิถี (Day Master) ก่อนเสมอ เพราะเป็นตัวตั้งของการอ่าน",
    primaryEvidencePaths: ["chartIdentity.dayMaster"],
    supportingEvidencePaths: [],
  },
  {
    key: "day_master_strength",
    schoolLabel: "กำลังดิถี",
    required: true,
    guidance: "ห้ามกระโดดไป role, timing, หรือคำสรุปโดยยังไม่ระบุกำลังดิถี",
    promptLine: "ตรวจกำลังดิถีให้ชัดก่อนข้ามไปเรื่องงาน ความรัก หรือจังหวะเวลา",
    primaryEvidencePaths: ["anchors.dayMasterStrengthProfile"],
    supportingEvidencePaths: [],
  },
  {
    key: "five_element_reaction_and_role_evidence",
    schoolLabel: "ปฏิกิริยาธาตุทั้ง 5 / role evidence",
    required: true,
    guidance: "ใช้ปฏิกิริยาธาตุทั้ง 5 และ role evidence เป็นแกนตีความตามโดเมนที่ผู้ใช้ถาม",
    promptLine: "ไล่ปฏิกิริยาธาตุทั้ง 5 และ role evidence ตามหัวข้อที่ผู้ใช้ถาม",
    primaryEvidencePaths: [
      "anchors.elementAnalysis",
      "anchors.seasonalInteraction",
      "anchors.financeTenGodHighlights",
      "anchors.relationshipTenGodHighlights",
      "anchors.careerTenGodHighlights",
      "anchors.source6CareerBusinessInterpretation",
      "anchors.loveCompatibilityProfile",
      "anchors.workCompatibilityProfile",
    ],
    supportingEvidencePaths: ["support.roleBadges"],
  },
  {
    key: "interaction_markers",
    schoolLabel: "ชง เฮ้ง ไห่ ผั่ว ภาคี",
    required: false,
    guidance: "อ่านแรงปฏิสัมพันธ์หลังแกนดิถีและ role evidence เพื่อกันการอ่านเกินจริง",
    promptLine: "ค่อยดูชง เฮ้ง ไห่ ผั่ว ภาคี และแรงปฏิสัมพันธ์ที่ Truth Packet ให้มา",
    primaryEvidencePaths: ["anchors.spousePalace"],
    supportingEvidencePaths: [
      "support.stemInteractionBadges",
      "support.branchInteractionBadges",
    ],
  },
  {
    key: "twelve_qi",
    schoolLabel: "12 เชี่ยงแซ",
    required: false,
    guidance: "ใช้ 12 เชี่ยงแซเป็นตัวขยายจังหวะและน้ำหนัก ไม่ใช่ตัวเปิดคำตอบ",
    promptLine: "ใช้ 12 เชี่ยงแซเป็นตัวขยายจังหวะและน้ำหนักของสิ่งที่อ่านมาแล้ว",
    primaryEvidencePaths: [
      "timing.activeTimingWindow",
      "timing.currentDaYun",
      "timing.nextTimingWindows",
      "timing.liuNian",
    ],
    supportingEvidencePaths: [],
  },
  {
    key: "stars_and_supporting_markers",
    schoolLabel: "กุ้ยนั้ง บุ่งเชียง และดาวประกอบการอ่าน",
    required: false,
    guidance: "เก็บดาวประกอบการอ่านไว้เป็นตัวเสริมท้าย ไม่ให้แซงแกนสำนัก",
    promptLine: "เก็บกุ้ยนั้ง บุ่งเชียง และดาวประกอบการอ่านไว้เป็นตัวเสริมท้ายเมื่อ Packet มีจริง",
    primaryEvidencePaths: ["support.markerBadges"],
    supportingEvidencePaths: [],
  },
];

const PROVENANCE_RULE_DEFINITIONS = [
  {
    provenance: "computed_chart_marker" as const,
    directive: "พูดเป็นข้อเท็จจริงจากดวงได้เฉพาะ marker หรือโครงสร้างที่ Truth Packet ให้มาอย่างชัดเจนเท่านั้น",
    promptLine: "computed_chart_marker = direct chart fact only when the Truth Packet explicitly gives that marker or structure.",
  },
  {
    provenance: "compatibility_profile" as const,
    directive: "เล่าเป็นสัญญาณหรือแนวโน้มระดับ profile เท่านั้น ห้ามยกระดับเป็นข้อเท็จจริงที่คำนวณตรงจากดวง",
    promptLine: "compatibility_profile = profile-level evidence only; speak as tendency or signal, not as a directly computed chart fact.",
  },
  {
    provenance: "supporting_context" as const,
    directive: "ใช้เป็นตัวช่วยอธิบายหรือกันอ่านเกินจริง ห้ามเอามาแซงลำดับดิถีและกำลังดิถี",
    promptLine: "supporting_context = supporting evidence only; use it to clarify or prevent overclaim, never to outrank day master and day-master strength.",
  },
  {
    provenance: "timing_context" as const,
    directive: "ใช้ล็อกช่วงเวลาและน้ำหนักของคำตอบ ห้ามใช้แทนแกนพื้นดวง",
    promptLine: "timing_context = timing-only evidence; use it to lock the answer window and weight, not to replace the base-chart reading.",
  },
] as const;

const DOMAIN_BOUNDARY_BY_BUCKET = {
  wealth: {
    primaryDomain: "wealth",
    disallowedDriftDomains: ["love", "career", "health"],
  },
  relationship: {
    primaryDomain: "love",
    disallowedDriftDomains: ["wealth", "career", "health"],
  },
  work: {
    primaryDomain: "career",
    disallowedDriftDomains: ["love", "wealth", "health"],
  },
  health: {
    primaryDomain: "health",
    disallowedDriftDomains: ["love", "wealth", "career"],
  },
  foundation: {
    primaryDomain: "general_reading",
    disallowedDriftDomains: [],
  },
  study: {
    primaryDomain: "study",
    disallowedDriftDomains: ["love", "wealth", "career", "health"],
  },
} as const;

const PRIMARY_DOMAIN_BY_REQUESTED_DOMAIN = {
  wealth: "wealth",
  love: "love",
  career: "career",
  health: "health",
  general_reading: "general_reading",
  study: "study",
  chit_chat: null,
} as const;

const DRIFT_PROMPT_LABEL_BY_DOMAIN = {
  wealth: "money",
  love: "romance",
  career: "work",
  health: "health",
  general_reading: "general reading",
  study: "study",
} as const;

type BaziSchoolPromptDomain = keyof typeof DRIFT_PROMPT_LABEL_BY_DOMAIN;

const SCHOOL_VOCABULARY = {
  anchorTerms: ["ดิถี", "กำลังดิถี"],
  fiveElementTerms: [
    "คู่ธาตุ",
    "ธาตุส่งเสริม",
    "ธาตุถ่ายเท",
    "ธาตุพิฆาต",
    "พิฆาตธาตุ",
  ],
  interactionTerms: ["ชง", "เฮ้ง", "ไห่", "ผั่ว", "ภาคี", "ซำเฮ้ง"],
  twelveQiTerms: ["12 เชี่ยงแซ", "เชี่ยงแซของเสานี้", "สภาพของธาตุในเสานี้"],
  starTerms: ["กุ้ยนั้ง", "บุ่งเชียง"],
  forbiddenPrimaryReplacements: [
    "แรงปะทะ",
    "แรงรั่ว",
    "แรงค้าง",
    "แรงกดกันเอง",
    "แรงดึง",
  ],
} as const;

const OWNERSHIP_BOUNDARIES = {
  answerContractOwns: [
    "schoolReadingOrder",
    "allowedSchoolVocabulary",
    "provenanceRules",
    "domainBoundaryLaw",
    "ageWindowLaw",
    "healthCautionLaw",
    "bucketFallbackPolicy",
  ],
  doctrinePacketOwns: [
    "questionContext",
    "chartIdentity",
    "anchors",
    "support",
    "timing",
  ],
  resolverOwns: [
    "job selection",
    "canonical bucket resolution",
    "selection mode",
    "packet breadth",
  ],
  promptPersonaOwns: [
    "chat voice",
    "tone",
    "verbosity",
    "two-block envelope",
  ],
} as const;

function hasSection(
  packet: BaziDoctrinePacket,
  area: "anchors" | "support" | "timing",
  key: string,
) {
  return packet[area].some((section) => section.key === key);
}

function collectEvidencePaths(packet: BaziDoctrinePacket, paths: string[]) {
  return paths.filter((path) => {
    if (path === "chartIdentity.dayMaster") {
      return packet.chartIdentity.dayMaster.trim().length > 0;
    }

    const [area, key] = path.split(".") as ["anchors" | "support" | "timing", string];
    return hasSection(packet, area, key);
  });
}

function resolveStageStatus(required: boolean, evidenceCount: number) {
  if (evidenceCount > 0) {
    return "present" as const;
  }

  return required ? "missing_required_evidence" as const : "optional_absent" as const;
}

function buildSchoolReadingOrder(packet: BaziDoctrinePacket) {
  return STAGE_DEFINITIONS.map((definition) => {
    const primaryEvidenceKeys = collectEvidencePaths(packet, definition.primaryEvidencePaths);
    const supportingEvidenceKeys = collectEvidencePaths(packet, definition.supportingEvidencePaths);

    return {
      key: definition.key,
      schoolLabel: definition.schoolLabel,
      required: definition.required,
      status: resolveStageStatus(
        definition.required,
        primaryEvidenceKeys.length + supportingEvidenceKeys.length,
      ),
      primaryEvidenceKeys,
      supportingEvidenceKeys,
      guidance: definition.guidance,
    };
  });
}

function buildProvenanceRules(packet: BaziDoctrinePacket) {
  const applicableSectionKeys = {
    computed_chart_marker: packet.anchors
      .filter((section) => section.provenance === "computed_chart_marker")
      .map((section) => section.key),
    compatibility_profile: packet.anchors
      .filter((section) => section.provenance === "compatibility_profile")
      .map((section) => section.key),
    supporting_context: packet.support
      .filter((section) => section.provenance === "supporting_context")
      .map((section) => section.key),
    timing_context: packet.timing
      .filter((section) => section.provenance === "timing_context")
      .map((section) => section.key),
  };

  return PROVENANCE_RULE_DEFINITIONS.map((definition) => ({
    provenance: definition.provenance,
    applicableSectionKeys: applicableSectionKeys[definition.provenance],
    directive: definition.directive,
  }));
}

function buildAgeWindowLaw(packet: BaziDoctrinePacket) {
  const anchorTimingKey = hasSection(packet, "timing", "activeTimingWindow")
    ? "timing.activeTimingWindow"
    : hasSection(packet, "timing", "currentDaYun")
      ? "timing.currentDaYun"
      : null;

  return {
    anchorTimingKey,
    directive: anchorTimingKey
      ? "ยึด active timing window หรือ current DaYun ที่แนบมาเป็นหน้าต่างคำตอบหลักก่อน และอย่ากระโดดไปช่วงอื่นเอง"
      : "ถ้า packet ไม่มี timing context ให้ตอบจากแกนดวงเท่าที่มี และอย่าเดาช่วงอายุหรือจังหวะเวลาเพิ่ม",
  };
}

function buildHealthCautionLaw(packet: BaziDoctrinePacket) {
  const applies = packet.questionContext.canonicalBucket === "health";

  return {
    applies,
    directive: applies
      ? "ตอบเป็นข้อควรระวังและแนวดูแลตัวเองที่ใช้ได้จริงเมื่อ packet รองรับ แต่ห้ามวินิจฉัยโรค ห้ามชี้ขาด และห้ามปฏิเสธเพียงเพราะเป็นหัวข้อสุขภาพ"
      : "อย่าแตกคำตอบไปเรื่องสุขภาพเอง เว้นแต่ผู้ใช้ถามตรงและ packet มีหลักฐานรองรับจริง",
  };
}

function resolvePrimaryDomainFromRuntimeContext(
  runtimeContext?: BaziSchoolAnswerScopedRuntimeContext | null,
) {
  const requestedDomain = runtimeContext?.requestedDomain;

  if (!requestedDomain) {
    return null;
  }

  return PRIMARY_DOMAIN_BY_REQUESTED_DOMAIN[requestedDomain];
}

function getDisallowedDriftDomainsForPrimaryDomain(
  primaryDomain: BaziSchoolAnswerContract["domainBoundaryLaw"]["primaryDomain"],
) {
  switch (primaryDomain) {
    case "wealth":
      return DOMAIN_BOUNDARY_BY_BUCKET.wealth.disallowedDriftDomains;

    case "love":
      return DOMAIN_BOUNDARY_BY_BUCKET.relationship.disallowedDriftDomains;

    case "career":
      return DOMAIN_BOUNDARY_BY_BUCKET.work.disallowedDriftDomains;

    case "health":
      return DOMAIN_BOUNDARY_BY_BUCKET.health.disallowedDriftDomains;

    case "study":
      return DOMAIN_BOUNDARY_BY_BUCKET.study.disallowedDriftDomains;

    case "general_reading":
      return [];
  }
}

function formatDisallowedDriftDomains(
  primaryDomain: BaziSchoolAnswerContract["domainBoundaryLaw"]["primaryDomain"],
  contract?: BaziSchoolAnswerContract | null,
) {
  const disallowedDomains = contract?.domainBoundaryLaw.primaryDomain === primaryDomain
    ? contract.domainBoundaryLaw.disallowedDriftDomains
    : getDisallowedDriftDomainsForPrimaryDomain(primaryDomain);

  return disallowedDomains
    .filter((domain): domain is BaziSchoolPromptDomain => domain in DRIFT_PROMPT_LABEL_BY_DOMAIN)
    .map((domain) => DRIFT_PROMPT_LABEL_BY_DOMAIN[domain])
    .join(", ");
}

export function buildBaziSchoolScopedAnswerContractPromptBlock(input: {
  packet?: BaziDoctrinePacket | null;
  runtimeContext?: BaziSchoolAnswerScopedRuntimeContext | null;
}) {
  const contract = input.packet ? composeBaziSchoolAnswerContract(input.packet) : null;
  const primaryDomain = resolvePrimaryDomainFromRuntimeContext(input.runtimeContext)
    ?? contract?.domainBoundaryLaw.primaryDomain
    ?? null;
  const lines: string[] = [];

  if (primaryDomain && primaryDomain !== "general_reading") {
    lines.push(
      `- Primary requested domain: ${primaryDomain}. Stay inside this domain unless the user explicitly asks to compare another domain or the Truth Packet explicitly proves a cross-domain link.`,
    );

    const disallowedDriftDomains = formatDisallowedDriftDomains(primaryDomain, contract);

    if (disallowedDriftDomains) {
      lines.push(
        `- Do not drift into unrelated lifestyle commentary, ${disallowedDriftDomains}, or personality advice when the current request is ${primaryDomain}-only or otherwise domain-bounded.`,
      );
    }
  }

  if (input.runtimeContext?.currentAgeWindowLabel) {
    lines.push(
      `- Primary age window: ${input.runtimeContext.currentAgeWindowLabel}. Treat this as the answer window unless the user explicitly asks about another period or a future transition.`,
    );
  }

  if (contract?.healthCautionLaw.applies || primaryDomain === "health") {
    lines.push(
      "- Health response contract: answer directly with practical cautions and self-care guidance when the Truth Packet supports it; do not diagnose disease, do not claim certainty, and do not refuse only because the topic is health.",
    );
  }

  if (lines.length === 0) {
    return null;
  }

  return ["Scoped answer contract:", ...lines].join("\n");
}

export function getBaziSchoolReasoningFlowPromptLines() {
  return STAGE_DEFINITIONS.map((definition) => definition.promptLine);
}

export function getBaziSchoolProvenancePromptLines() {
  return PROVENANCE_RULE_DEFINITIONS.map((definition) => definition.promptLine);
}

export function composeBaziSchoolAnswerContract(
  packet: BaziDoctrinePacket,
): BaziSchoolAnswerContract {
  const bucketBoundary = DOMAIN_BOUNDARY_BY_BUCKET[packet.questionContext.canonicalBucket];

  return BaziSchoolAnswerContractSchema.parse({
    kind: "bazi_school_answer_contract",
    canonicalBucket: packet.questionContext.canonicalBucket,
    selectionMode: packet.questionContext.selectionMode,
    bucketFallbackPolicy: packet.questionContext.selectionMode === "bucket_fallback"
      ? "คงลำดับสำนักเดิมไว้ตาม canonical bucket และถ้าหลักฐานแกนใดไม่พอให้ mark เป็น evidence gap แทนการเดาหรือข้ามขั้น"
      : "atomic packet อาจแคบลงได้ แต่ห้าม reorder school chain และห้ามข้าม required stage โดยไม่เปิดเผย evidence gap",
    packetHints: collectEvidencePaths(packet, ["support.readingOrderSteps"]),
    schoolReadingOrder: buildSchoolReadingOrder(packet),
    allowedSchoolVocabulary: SCHOOL_VOCABULARY,
    provenanceRules: buildProvenanceRules(packet),
    domainBoundaryLaw: {
      primaryDomain: bucketBoundary.primaryDomain,
      disallowedDriftDomains: [...bucketBoundary.disallowedDriftDomains],
      crossDomainRule: "ตอบอยู่ในโดเมนหลักก่อน และข้ามโดเมนได้เมื่อผู้ใช้ขอเองหรือ packet พิสูจน์เหตุเชื่อมโดยตรงเท่านั้น",
    },
    ageWindowLaw: buildAgeWindowLaw(packet),
    healthCautionLaw: buildHealthCautionLaw(packet),
    ownership: OWNERSHIP_BOUNDARIES,
  });
}