import { describe, expect, test } from "vitest";

import {
  BaziDoctrinePacketSchema,
  type BaziDoctrinePacket,
} from "@/lib/bazi/atomic-question-doctrine-packet";
import {
  buildBaziSchoolScopedAnswerContractPromptBlock,
  composeBaziSchoolAnswerContract,
  getBaziSchoolProvenancePromptLines,
  getBaziSchoolReasoningFlowPromptLines,
} from "@/lib/bazi/atomic-question-answer-contract";

function buildPacket(packet: BaziDoctrinePacket) {
  return BaziDoctrinePacketSchema.parse(packet);
}

const BASE_CHART_IDENTITY = {
  dayMaster: "己",
  fourPillars: {
    year: { stem: "壬", branch: "申", hiddenStems: ["庚"], tenGod: "正财" },
    month: { stem: "戊", branch: "申", hiddenStems: ["庚"], tenGod: "劫财" },
    day: { stem: "己", branch: "巳", hiddenStems: ["丙"], tenGod: "日主" },
    hour: { stem: "辛", branch: "未", hiddenStems: ["己"], tenGod: "食神" },
  },
};

describe("composeBaziSchoolAnswerContract", () => {
  test("freezes the canonical school order for a work atomic packet without skipping strength", () => {
    const packet = buildPacket({
      questionContext: {
        canonicalBucket: "work",
        jobId: "work.job_switch_timing",
        selectionMode: "atomic_job",
        matrixVersion: "phase1c-v1",
      },
      chartIdentity: BASE_CHART_IDENTITY,
      anchors: [
        {
          key: "dayMasterStrengthProfile",
          provenance: "computed_chart_marker",
          value: { displayLabel: "ดวงแข็งแรง" },
        },
        {
          key: "careerTenGodHighlights",
          provenance: "computed_chart_marker",
          value: { hourStem: "食神" },
        },
      ],
      support: [
        {
          key: "roleBadges",
          provenance: "supporting_context",
          value: [{ label: "ดาวผลงานเด่น" }],
        },
      ],
      timing: [
        {
          key: "activeTimingWindow",
          provenance: "timing_context",
          value: { label: "35-39" },
        },
      ],
    });

    const contract = composeBaziSchoolAnswerContract(packet);

    expect(contract.schoolReadingOrder.map((stage) => stage.key)).toEqual([
      "day_master",
      "day_master_strength",
      "five_element_reaction_and_role_evidence",
      "interaction_markers",
      "twelve_qi",
      "stars_and_supporting_markers",
    ]);
    expect(contract.schoolReadingOrder[1]).toMatchObject({
      schoolLabel: "กำลังดิถี",
      required: true,
      status: "present",
      primaryEvidenceKeys: ["anchors.dayMasterStrengthProfile"],
    });
    expect(contract.schoolReadingOrder[2]).toMatchObject({
      status: "present",
      primaryEvidenceKeys: ["anchors.careerTenGodHighlights"],
      supportingEvidenceKeys: ["support.roleBadges"],
    });
    expect(contract.domainBoundaryLaw).toMatchObject({
      primaryDomain: "career",
      disallowedDriftDomains: ["love", "wealth", "health"],
    });
    expect(contract.ageWindowLaw).toMatchObject({
      anchorTimingKey: "timing.activeTimingWindow",
    });
  });

  test("keeps compatibility profiles as profile-level evidence instead of direct chart fact", () => {
    const packet = buildPacket({
      questionContext: {
        canonicalBucket: "relationship",
        jobId: "relationship.partner_profile",
        selectionMode: "atomic_job",
        matrixVersion: "phase1c-v1",
      },
      chartIdentity: BASE_CHART_IDENTITY,
      anchors: [
        {
          key: "dayMasterStrengthProfile",
          provenance: "computed_chart_marker",
          value: { displayLabel: "ดวงแข็งแรง" },
        },
        {
          key: "relationshipTenGodHighlights",
          provenance: "computed_chart_marker",
          value: { monthStem: "正官" },
        },
        {
          key: "loveCompatibilityProfile",
          provenance: "compatibility_profile",
          value: { entries: [{ label: "คู่ที่คุยกันรู้เรื่อง" }] },
        },
      ],
      support: [],
      timing: [],
    });

    const contract = composeBaziSchoolAnswerContract(packet);
    const compatibilityRule = contract.provenanceRules.find(
      (rule) => rule.provenance === "compatibility_profile",
    );

    expect(compatibilityRule).toMatchObject({
      applicableSectionKeys: ["loveCompatibilityProfile"],
    });
    expect(compatibilityRule?.directive).toContain("แนวโน้มระดับ profile");
    expect(compatibilityRule?.directive).not.toContain("คำนวณตรงจากดวงได้เลย");
  });

  test("makes bucket fallback explicit by marking missing required evidence instead of skipping it", () => {
    const packet = buildPacket({
      questionContext: {
        canonicalBucket: "health",
        selectionMode: "bucket_fallback",
        matrixVersion: "phase1c-v1",
      },
      chartIdentity: BASE_CHART_IDENTITY,
      anchors: [
        {
          key: "elementAnalysis",
          provenance: "computed_chart_marker",
          value: { dominantElements: ["earth"] },
        },
      ],
      support: [
        {
          key: "readingOrderSteps",
          provenance: "supporting_context",
          value: ["ดูดิถี", "ดูกำลังดิถี"],
        },
      ],
      timing: [
        {
          key: "currentDaYun",
          provenance: "timing_context",
          value: { label: "35-44" },
        },
      ],
    });

    const contract = composeBaziSchoolAnswerContract(packet);

    expect(contract.selectionMode).toBe("bucket_fallback");
    expect(contract.packetHints).toEqual(["support.readingOrderSteps"]);
    expect(contract.schoolReadingOrder[1]).toMatchObject({
      key: "day_master_strength",
      required: true,
      status: "missing_required_evidence",
    });
    expect(contract.bucketFallbackPolicy).toContain("mark เป็น evidence gap");
    expect(contract.healthCautionLaw).toMatchObject({
      applies: true,
    });
    expect(contract.healthCautionLaw.directive).toContain("ห้ามวินิจฉัยโรค");
  });

  test("exports prompt lines in the same canonical school order used by the contract", () => {
    expect(getBaziSchoolReasoningFlowPromptLines()).toEqual([
      "ตรวจดิถี (Day Master) ก่อนเสมอ เพราะเป็นตัวตั้งของการอ่าน",
      "ตรวจกำลังดิถีให้ชัดก่อนข้ามไปเรื่องงาน ความรัก หรือจังหวะเวลา",
      "ไล่ปฏิกิริยาธาตุทั้ง 5 และ role evidence ตามหัวข้อที่ผู้ใช้ถาม",
      "ค่อยดูชง เฮ้ง ไห่ ผั่ว ภาคี และแรงปฏิสัมพันธ์ที่ Truth Packet ให้มา",
      "ใช้ 12 เชี่ยงแซเป็นตัวขยายจังหวะและน้ำหนักของสิ่งที่อ่านมาแล้ว",
      "เก็บกุ้ยนั้ง บุ่งเชียง และดาวประกอบการอ่านไว้เป็นตัวเสริมท้ายเมื่อ Packet มีจริง",
    ]);
  });

  test("exports reusable provenance prompt lines from the shared answer contract", () => {
    expect(getBaziSchoolProvenancePromptLines()).toEqual([
      "computed_chart_marker = direct chart fact only when the Truth Packet explicitly gives that marker or structure.",
      "compatibility_profile = profile-level evidence only; speak as tendency or signal, not as a directly computed chart fact.",
      "supporting_context = supporting evidence only; use it to clarify or prevent overclaim, never to outrank day master and day-master strength.",
      "timing_context = timing-only evidence; use it to lock the answer window and weight, not to replace the base-chart reading.",
    ]);
  });

  test("builds scoped guardrail prompt text from the shared answer contract instead of shell-local strings", () => {
    const packet = buildPacket({
      questionContext: {
        canonicalBucket: "work",
        jobId: "work.job_switch_timing",
        selectionMode: "atomic_job",
        matrixVersion: "phase1c-v1",
      },
      chartIdentity: BASE_CHART_IDENTITY,
      anchors: [
        {
          key: "dayMasterStrengthProfile",
          provenance: "computed_chart_marker",
          value: { displayLabel: "ดวงแข็งแรง" },
        },
        {
          key: "careerTenGodHighlights",
          provenance: "computed_chart_marker",
          value: { hourStem: "食神" },
        },
      ],
      support: [],
      timing: [
        {
          key: "activeTimingWindow",
          provenance: "timing_context",
          value: { label: "42-46" },
        },
      ],
    });

    const promptBlock = buildBaziSchoolScopedAnswerContractPromptBlock({
      packet,
      runtimeContext: {
        requestedDomain: "career",
        currentAgeWindowLabel: "42-46",
      },
    });

    expect(promptBlock).toContain("Scoped answer contract:");
    expect(promptBlock).toContain("Primary requested domain: career. Stay inside this domain unless the user explicitly asks to compare another domain");
    expect(promptBlock).toContain("Do not drift into unrelated lifestyle commentary, romance, money, health, or personality advice when the current request is career-only or otherwise domain-bounded.");
    expect(promptBlock).toContain("Primary age window: 42-46. Treat this as the answer window unless the user explicitly asks about another period or a future transition.");
  });
});