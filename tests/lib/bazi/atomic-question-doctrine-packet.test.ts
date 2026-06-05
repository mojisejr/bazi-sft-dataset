import { describe, expect, test } from "vitest";

import { composeBaziDoctrinePacket } from "@/lib/bazi/atomic-question-doctrine-packet";
import type { BaziAtomicCanonicalBucket, BaziAtomicQuestionJobId } from "@/lib/bazi/atomic-question-matrix";
import { CalculatedStateSchema } from "@/lib/bazi/schema-types";

import {
  HEALTH_BUCKET_SAFE_TIMING_SENSITIVE_FIXTURE,
  HEALTH_CONSTITUTION_BASELINE_FIXTURE,
  HEALTH_RECOVERY_CAUTION_FIXTURE,
  WEALTH_ACCUMULATION_CAPACITY_FIXTURE,
  WEALTH_BUCKET_SAFE_INCOME_SOURCE_FIXTURE,
  WEALTH_TIMING_WINDOW_FIXTURE,
} from "../../helpers/atomic-question-resolver-fixtures";

const SAMPLE_BAZI_STATE = CalculatedStateSchema.parse({
  fourPillars: {
    year: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
    month: { stem: "戊", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
    day: { stem: "己", branch: "巳", hiddenStems: ["丙", "庚", "戊"] },
    hour: { stem: "辛", branch: "未", hiddenStems: ["己", "丁", "乙"] },
  },
  ageSnapshot: {
    referenceDate: "2026-06-03",
    thaiAge: 37,
    chineseAge: 38,
  },
  dayMaster: "己",
  strengthScore: 3.07,
  tenGods: {
    yearStem: "正财",
    monthStem: "劫财",
    hourStem: "食神",
  },
  twelveQi: {
    yearBranch: "沐浴",
    monthBranch: "沐浴",
    dayBranch: "帝旺",
    hourBranch: "冠带",
  },
  daYun: [
    {
      startAge: 35,
      endAge: 44,
      stem: "辛",
      branch: "酉",
      isCurrent: true,
      currentPhase: "upper",
      upperStageDisplay: "冠带",
      lowerStageDisplay: "临官",
      influenceGradient: {
        targetAge: 42,
        cycleYearIndex: 0,
        stemWeight: 0.9,
        branchWeight: 0.1,
        dominantSource: "stem",
        ratioLabel: "90:10",
      },
      upperPhase: {
        startAge: 35,
        endAge: 39,
        symbol: "辛",
        source: "stem",
        isCurrent: true,
        twelveQiDisplay: "冠带",
      },
      lowerPhase: {
        startAge: 40,
        endAge: 44,
        symbol: "酉",
        source: "branch",
        isCurrent: false,
        twelveQiDisplay: "临官",
      },
    },
    {
      startAge: 45,
      endAge: 54,
      stem: "壬",
      branch: "戌",
      upperStageDisplay: "帝旺",
      lowerStageDisplay: "衰",
      upperPhase: {
        startAge: 45,
        endAge: 49,
        symbol: "壬",
        source: "stem",
        isCurrent: false,
        twelveQiDisplay: "帝旺",
      },
      lowerPhase: {
        startAge: 50,
        endAge: 54,
        symbol: "戌",
        source: "branch",
        isCurrent: false,
        twelveQiDisplay: "衰",
      },
    },
  ],
  liuNian: { stem: "丙", branch: "午", hiddenStems: ["丁", "己"] },
  shenSha: [
    { starName: "天乙贵人", relatedPillar: "日柱", meaning: "มีคนช่วยเหลือยามคับขัน" },
    { starName: "文昌", relatedPillar: "时柱", meaning: "เด่นเรื่องการเรียนรู้และคำพูด" },
  ],
  elementAnalysis: {
    visibleCounts: {
      wood: 0,
      fire: 0,
      earth: 2,
      metal: 2,
      water: 1,
    },
    hiddenCounts: {
      wood: 1,
      fire: 2,
      earth: 3,
      metal: 2,
      water: 2,
    },
    totalCounts: {
      wood: 1,
      fire: 2,
      earth: 5,
      metal: 4,
      water: 3,
    },
    missingElements: [],
    dominantElements: ["earth"],
    elementStrengths: [
      {
        element: "earth",
        rooted: true,
        seasonalSupport: "seasonal-peak",
        strength: "strong",
      },
      {
        element: "wood",
        rooted: false,
        seasonalSupport: "seasonal-drained",
        strength: "weak",
      },
    ],
  },
  seasonalInteraction: {
    dayMasterStem: "己",
    dayMasterElement: "earth",
    monthBranch: "申",
    season: "autumn",
    phase: "peak",
    seasonLabel: "ฤดูใบไม้ร่วงช่วงต้น",
    metaphor: "ดินที่ต้องอาศัยไฟช่วยประคองก่อนจะจับรูปได้มั่นคง",
  },
  dayMasterStrengthProfile: {
    dayMaster: "己",
    strengthState: "strong",
    displayLabel: "ดวงแข็งแรง",
    narrative: "ดิถีมีกำลังและยืนได้ด้วยฐานของตัวเอง",
    qiLabel: "帝旺",
  },
  sixtyJiaziCorePersona: {
    code: "己巳",
    narrative: "Measured earth that grows through patience and timing.",
    precedenceNotes: ["Respect seasonal balance before reading annual timing."],
  },
  compatibilityMatrixProfiles: [
    {
      domain: "love",
      pairKey: "day-branch",
      entries: [
        {
          code: "harmonic",
          label: "คู่ที่คุยกันรู้เรื่อง",
          counterpartBranch: "酉",
          narrative: "สัมพันธ์ดีเมื่อค่อย ๆ สร้างความไว้ใจ",
        },
      ],
    },
    {
      domain: "work",
      pairKey: "day-master",
      entries: [
        {
          code: "builder",
          label: "งานที่ค่อย ๆ สร้างฐาน",
          counterpartBranch: "辰",
          narrative: "เหมาะกับงานที่ต้องเก็บรายละเอียดและสร้างระบบ",
        },
      ],
    },
  ],
  baseChartReading: {
    roleBadges: [
      {
        id: "role-output",
        family: "role",
        label: "ดาวผลงานเด่น",
        priority: "primary",
        status: "active",
        meaningShort: "สื่อสารผลงานแล้วมีคนเห็น",
        semanticKind: "role-stem",
        modal: {
          title: "บทบาทงานเด่น",
          family: "role",
          summary: "บทบาทนี้เด่นเมื่อใช้ฝีมือและการสื่อสาร",
          explanation: "พลังของดาวผลงานช่วยดันงานที่ต้องโชว์ความสามารถ",
          readingOrderHint: "ดูหลังแกนดิถีแต่ก่อนจับจังหวะเวลา",
        },
      },
    ],
    stemInteractionBadges: [
      {
        id: "stem-combo",
        family: "interaction",
        label: "ก้านสัมพันธ์",
        priority: "secondary",
        status: "supplementary",
        meaningShort: "มีกลไกผสานบางส่วนในระดับก้าน",
        semanticKind: "stem-combination",
        modal: {
          title: "ปฏิสัมพันธ์ก้าน",
          family: "interaction",
          summary: "ความสัมพันธ์ระดับก้านช่วยอธิบายแรงเสริม",
          explanation: "ใช้เป็นตัวช่วยอ่านว่าพลังบางส่วนจับคู่กันอย่างไร",
          readingOrderHint: "ดูหลังโครงสร้างหลักเพื่อกันอ่านเกินจริง",
        },
      },
    ],
    branchInteractionBadges: [
      {
        id: "branch-clash",
        family: "interaction",
        label: "กิ่งปะทะ",
        priority: "secondary",
        status: "supplementary",
        meaningShort: "มีแรงเสียดทานบางช่วง",
        semanticKind: "branch-clash",
        modal: {
          title: "ปฏิสัมพันธ์กิ่ง",
          family: "interaction",
          summary: "กิ่งบางคู่ตีกันและสร้างแรงสั่น",
          explanation: "ใช้ตีความเป็นแรงเสียดทาน ไม่ใช่คำตัดสินเดี่ยว",
          readingOrderHint: "ดูหลังฐานดวงและก่อนคำเตือนเชิงเวลา",
        },
      },
    ],
    markerBadges: [
      {
        id: "marker-wenchang",
        family: "marker",
        label: "文昌",
        priority: "secondary",
        status: "supplementary",
        meaningShort: "เสริมการเรียนรู้และการเขียน",
        semanticKind: "marker-wenchang",
        modal: {
          title: "ดาว文昌",
          family: "marker",
          summary: "ตัวช่วยด้านการเรียนรู้และการสื่อสาร",
          explanation: "เป็น marker เสริม ไม่ใช่ตัวตัดสินผลลัพธ์เดี่ยว",
          readingOrderHint: "อ่านท้าย ๆ หลังเข้าใจแกนและแรงปฏิสัมพันธ์แล้ว",
        },
      },
    ],
    groups: [],
    legendItems: [],
    readingOrderSteps: ["ดูดิถีก่อน", "ดูฤดูกาล", "ดูแรงหนุน", "ค่อยเปิดช่วงเวลา"],
  },
});

const FULL_STATE_TEXT = JSON.stringify(SAMPLE_BAZI_STATE);

function composeAtomicJobPacket(
  canonicalBucket: BaziAtomicCanonicalBucket,
  jobId: BaziAtomicQuestionJobId,
) {
  return composeBaziDoctrinePacket({
    questionContext: {
      canonicalBucket,
      jobId,
      selectionMode: "atomic_job",
    },
    payload: SAMPLE_BAZI_STATE,
  });
}

function summarizePacketFixture(packet: ReturnType<typeof composeBaziDoctrinePacket>) {
  return {
    questionContext: packet.questionContext,
    anchorKeys: packet.anchors.map((section) => section.key),
    supportKeys: packet.support.map((section) => section.key),
    timingKeys: packet.timing.map((section) => section.key),
  };
}

function expectBoundedPacket(packet: ReturnType<typeof composeBaziDoctrinePacket>, maxRatio: number) {
  expect(JSON.stringify(packet).length).toBeLessThan(FULL_STATE_TEXT.length * maxRatio);
}

type Phase5BPacketProofCase = {
  label: string;
  questionContext: {
    canonicalBucket: BaziAtomicCanonicalBucket;
    selectionMode: "atomic_job" | "bucket_fallback";
    jobId?: BaziAtomicQuestionJobId;
  };
  expectedAnchorKeys: string[];
  expectedSupportKeys: string[];
  expectedTimingKeys: string[];
  forbiddenKeys: string[];
  maxRatio: number;
};

const PHASE_5B_PACKET_PROOF_CASES: Phase5BPacketProofCase[] = [
  {
    label: "wealth accumulation capacity stays structural and non-timing",
    questionContext: {
      canonicalBucket: WEALTH_ACCUMULATION_CAPACITY_FIXTURE.canonicalBucket,
      jobId: WEALTH_ACCUMULATION_CAPACITY_FIXTURE.expectedJobId,
      selectionMode: WEALTH_ACCUMULATION_CAPACITY_FIXTURE.expectedSelectionMode,
    },
    expectedAnchorKeys: [
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "financeTenGodHighlights",
    ],
    expectedSupportKeys: [],
    expectedTimingKeys: [],
    forbiddenKeys: [
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
      "loveCompatibilityProfile",
      "relationshipTenGodHighlights",
    ],
    maxRatio: 0.5,
  },
  {
    label: "wealth timing window stays money-scoped and explicitly timed",
    questionContext: {
      canonicalBucket: WEALTH_TIMING_WINDOW_FIXTURE.canonicalBucket,
      jobId: WEALTH_TIMING_WINDOW_FIXTURE.expectedJobId,
      selectionMode: WEALTH_TIMING_WINDOW_FIXTURE.expectedSelectionMode,
    },
    expectedAnchorKeys: [
      "dayMasterStrengthProfile",
      "financeTenGodHighlights",
    ],
    expectedSupportKeys: [],
    expectedTimingKeys: [
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    forbiddenKeys: [
      "elementAnalysis",
      "loveCompatibilityProfile",
      "seasonalInteraction",
      "careerTenGodHighlights",
      "ageSnapshot",
    ],
    maxRatio: 0.5,
  },
  {
    label: "wealth bucket fallback stays wealth-bounded without promoting a work job",
    questionContext: {
      canonicalBucket: WEALTH_BUCKET_SAFE_INCOME_SOURCE_FIXTURE.canonicalBucket,
      selectionMode: WEALTH_BUCKET_SAFE_INCOME_SOURCE_FIXTURE.expectedSelectionMode,
    },
    expectedAnchorKeys: [
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "financeTenGodHighlights",
    ],
    expectedSupportKeys: [],
    expectedTimingKeys: [
      "ageSnapshot",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    forbiddenKeys: [
      "loveCompatibilityProfile",
      "relationshipTenGodHighlights",
      "seasonalInteraction",
      "workCompatibilityProfile",
      '"jobId"',
    ],
    maxRatio: 0.65,
  },
  {
    label: "health constitution baseline stays non-diagnostic and non-timing",
    questionContext: {
      canonicalBucket: HEALTH_CONSTITUTION_BASELINE_FIXTURE.canonicalBucket,
      jobId: HEALTH_CONSTITUTION_BASELINE_FIXTURE.expectedJobId,
      selectionMode: HEALTH_CONSTITUTION_BASELINE_FIXTURE.expectedSelectionMode,
    },
    expectedAnchorKeys: [
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "seasonalInteraction",
    ],
    expectedSupportKeys: [],
    expectedTimingKeys: [],
    forbiddenKeys: [
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
      "financeTenGodHighlights",
      "relationshipTenGodHighlights",
    ],
    maxRatio: 0.5,
  },
  {
    label: "health recovery caution adds only the near-term caution window",
    questionContext: {
      canonicalBucket: HEALTH_RECOVERY_CAUTION_FIXTURE.canonicalBucket,
      jobId: HEALTH_RECOVERY_CAUTION_FIXTURE.expectedJobId,
      selectionMode: HEALTH_RECOVERY_CAUTION_FIXTURE.expectedSelectionMode,
    },
    expectedAnchorKeys: [
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "seasonalInteraction",
    ],
    expectedSupportKeys: [],
    expectedTimingKeys: ["activeTimingWindow"],
    forbiddenKeys: [
      "currentDaYun",
      "nextTimingWindows",
      "liuNian",
      "financeTenGodHighlights",
      "relationshipTenGodHighlights",
    ],
    maxRatio: 0.5,
  },
  {
    label: "health bucket fallback stays health-bounded without pretending to be a specific reviewed job",
    questionContext: {
      canonicalBucket: HEALTH_BUCKET_SAFE_TIMING_SENSITIVE_FIXTURE.canonicalBucket,
      selectionMode: HEALTH_BUCKET_SAFE_TIMING_SENSITIVE_FIXTURE.expectedSelectionMode,
    },
    expectedAnchorKeys: [
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "seasonalInteraction",
    ],
    expectedSupportKeys: [],
    expectedTimingKeys: [
      "ageSnapshot",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    forbiddenKeys: [
      "financeTenGodHighlights",
      "relationshipTenGodHighlights",
      "loveCompatibilityProfile",
      '"jobId"',
    ],
    maxRatio: 0.65,
  },
];

function composePacketForPhase5BProof(proofCase: Phase5BPacketProofCase) {
  return composeBaziDoctrinePacket({
    questionContext: proofCase.questionContext,
    payload: SAMPLE_BAZI_STATE,
  });
}

describe("composeBaziDoctrinePacket atomic-job planning", () => {
  test("builds a work timing packet that stays narrower than full CalculatedState", () => {
    const packet = composeBaziDoctrinePacket({
      questionContext: {
        canonicalBucket: "work",
        jobId: "work.job_switch_timing",
        selectionMode: "atomic_job",
      },
      payload: SAMPLE_BAZI_STATE,
    });

    expect(packet.anchors.map((section) => section.key)).toEqual([
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
    ]);
    expect(packet.support).toEqual([]);
    expect(packet.timing.map((section) => section.key)).toEqual([
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ]);

    const packetText = JSON.stringify(packet);
    expect(packetText.length).toBeLessThan(JSON.stringify(SAMPLE_BAZI_STATE).length);
    expect(packetText).not.toContain("loveCompatibilityProfile");
    expect(packetText).not.toContain("readingOrderSteps");
    expect(packetText).not.toContain("markerBadges");
    expect(packetText).not.toContain("ageSnapshot");
  });

  test("builds a foundation persona packet with chart core and reading-order notes only", () => {
    const packet = composeBaziDoctrinePacket({
      questionContext: {
        canonicalBucket: "foundation",
        jobId: "foundation.base_chart_persona",
        selectionMode: "atomic_job",
      },
      payload: SAMPLE_BAZI_STATE,
    });

    expect(packet.anchors.map((section) => section.key)).toEqual([
      "dayMasterStrengthProfile",
      "sixtyJiaziCorePersona",
      "elementAnalysis",
      "seasonalInteraction",
    ]);
    expect(packet.support.map((section) => section.key)).toEqual([
      "readingOrderSteps",
    ]);
    expect(packet.timing).toEqual([]);

    const packetText = JSON.stringify(packet);
    expect(packetText.length).toBeLessThan(JSON.stringify(SAMPLE_BAZI_STATE).length);
    expect(packetText).not.toContain("currentDaYun");
    expect(packetText).not.toContain("careerTenGodHighlights");
  });

  test("can opt into role, interaction, and marker evidence families for foundation timing focus", () => {
    const packet = composeBaziDoctrinePacket({
      questionContext: {
        canonicalBucket: "foundation",
        jobId: "foundation.general_timing_focus",
        selectionMode: "atomic_job",
      },
      payload: SAMPLE_BAZI_STATE,
    });

    expect(packet.anchors.map((section) => section.key)).toEqual([
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "seasonalInteraction",
    ]);
    expect(packet.support.map((section) => section.key)).toEqual([
      "roleBadges",
      "stemInteractionBadges",
      "branchInteractionBadges",
      "markerBadges",
    ]);
    expect(packet.timing.map((section) => section.key)).toEqual([
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ]);
    expect(JSON.stringify(packet)).not.toContain("readingOrderSteps");
  });

  test("locks deterministic work fixtures so career fit and switch timing stay materially different", () => {
    const careerFitPacket = composeAtomicJobPacket("work", "work.career_fit");
    const jobSwitchTimingPacket = composeAtomicJobPacket("work", "work.job_switch_timing");

    expect(summarizePacketFixture(careerFitPacket)).toMatchInlineSnapshot(`
      {
        "anchorKeys": [
          "dayMasterStrengthProfile",
          "careerTenGodHighlights",
          "elementAnalysis",
          "workCompatibilityProfile",
        ],
        "questionContext": {
          "canonicalBucket": "work",
          "jobId": "work.career_fit",
          "matrixVersion": "phase1c-v1",
          "selectionMode": "atomic_job",
        },
        "supportKeys": [],
        "timingKeys": [],
      }
    `);

    expect(summarizePacketFixture(jobSwitchTimingPacket)).toMatchInlineSnapshot(`
      {
        "anchorKeys": [
          "dayMasterStrengthProfile",
          "careerTenGodHighlights",
        ],
        "questionContext": {
          "canonicalBucket": "work",
          "jobId": "work.job_switch_timing",
          "matrixVersion": "phase1c-v1",
          "selectionMode": "atomic_job",
        },
        "supportKeys": [],
        "timingKeys": [
          "currentDaYun",
          "activeTimingWindow",
          "nextTimingWindows",
          "liuNian",
        ],
      }
    `);

    const careerFitText = JSON.stringify(careerFitPacket);
    const jobSwitchTimingText = JSON.stringify(jobSwitchTimingPacket);

    expect(careerFitText).toContain("workCompatibilityProfile");
    expect(careerFitText).toContain("elementAnalysis");
    expect(careerFitText).not.toContain("currentDaYun");
    expect(careerFitText).not.toContain("liuNian");

    expect(jobSwitchTimingText).toContain("currentDaYun");
    expect(jobSwitchTimingText).toContain("activeTimingWindow");
    expect(jobSwitchTimingText).not.toContain("workCompatibilityProfile");
    expect(jobSwitchTimingText).not.toContain("elementAnalysis");

    expectBoundedPacket(careerFitPacket, 0.5);
    expectBoundedPacket(jobSwitchTimingPacket, 0.5);
  });

  test("locks deterministic relationship fixtures so profile and timing packets cannot collapse together", () => {
    const partnerProfilePacket = composeAtomicJobPacket(
      "relationship",
      "relationship.partner_profile",
    );
    const relationshipTimingPacket = composeAtomicJobPacket(
      "relationship",
      "relationship.timing_window",
    );

    expect(summarizePacketFixture(partnerProfilePacket)).toMatchInlineSnapshot(`
      {
        "anchorKeys": [
          "spousePalace",
          "relationshipTenGodHighlights",
          "dayMasterStrengthProfile",
          "loveCompatibilityProfile",
        ],
        "questionContext": {
          "canonicalBucket": "relationship",
          "jobId": "relationship.partner_profile",
          "matrixVersion": "phase1c-v1",
          "selectionMode": "atomic_job",
        },
        "supportKeys": [],
        "timingKeys": [],
      }
    `);

    expect(summarizePacketFixture(relationshipTimingPacket)).toMatchInlineSnapshot(`
      {
        "anchorKeys": [
          "spousePalace",
          "relationshipTenGodHighlights",
        ],
        "questionContext": {
          "canonicalBucket": "relationship",
          "jobId": "relationship.timing_window",
          "matrixVersion": "phase1c-v1",
          "selectionMode": "atomic_job",
        },
        "supportKeys": [],
        "timingKeys": [
          "currentDaYun",
          "activeTimingWindow",
          "nextTimingWindows",
          "liuNian",
        ],
      }
    `);

    const partnerProfileText = JSON.stringify(partnerProfilePacket);
    const relationshipTimingText = JSON.stringify(relationshipTimingPacket);

    expect(partnerProfileText).toContain("dayMasterStrengthProfile");
    expect(partnerProfileText).toContain("loveCompatibilityProfile");
    expect(partnerProfileText).not.toContain("currentDaYun");
    expect(partnerProfileText).not.toContain("nextTimingWindows");

    expect(relationshipTimingText).toContain("currentDaYun");
    expect(relationshipTimingText).toContain("activeTimingWindow");
    expect(relationshipTimingText).not.toContain("dayMasterStrengthProfile");
    expect(relationshipTimingText).not.toContain("loveCompatibilityProfile");

    expectBoundedPacket(partnerProfilePacket, 0.5);
    expectBoundedPacket(relationshipTimingPacket, 0.5);
  });

  test("locks deterministic Phase 5B reviewed packet summaries without making snapshots the truth source", () => {
    const summaries = PHASE_5B_PACKET_PROOF_CASES.map((proofCase) => ({
      label: proofCase.label,
      summary: summarizePacketFixture(composePacketForPhase5BProof(proofCase)),
    }));

    expect(summaries).toMatchInlineSnapshot(`
      [
        {
          "label": "wealth accumulation capacity stays structural and non-timing",
          "summary": {
            "anchorKeys": [
              "dayMasterStrengthProfile",
              "elementAnalysis",
              "financeTenGodHighlights",
            ],
            "questionContext": {
              "canonicalBucket": "wealth",
              "jobId": "wealth.accumulation_capacity",
              "matrixVersion": "phase1c-v1",
              "selectionMode": "atomic_job",
            },
            "supportKeys": [],
            "timingKeys": [],
          },
        },
        {
          "label": "wealth timing window stays money-scoped and explicitly timed",
          "summary": {
            "anchorKeys": [
              "dayMasterStrengthProfile",
              "financeTenGodHighlights",
            ],
            "questionContext": {
              "canonicalBucket": "wealth",
              "jobId": "wealth.timing_window",
              "matrixVersion": "phase1c-v1",
              "selectionMode": "atomic_job",
            },
            "supportKeys": [],
            "timingKeys": [
              "currentDaYun",
              "activeTimingWindow",
              "nextTimingWindows",
              "liuNian",
            ],
          },
        },
        {
          "label": "wealth bucket fallback stays wealth-bounded without promoting a work job",
          "summary": {
            "anchorKeys": [
              "dayMasterStrengthProfile",
              "elementAnalysis",
              "financeTenGodHighlights",
            ],
            "questionContext": {
              "canonicalBucket": "wealth",
              "matrixVersion": "phase1c-v1",
              "selectionMode": "bucket_fallback",
            },
            "supportKeys": [],
            "timingKeys": [
              "ageSnapshot",
              "currentDaYun",
              "activeTimingWindow",
              "nextTimingWindows",
              "liuNian",
            ],
          },
        },
        {
          "label": "health constitution baseline stays non-diagnostic and non-timing",
          "summary": {
            "anchorKeys": [
              "dayMasterStrengthProfile",
              "elementAnalysis",
              "seasonalInteraction",
            ],
            "questionContext": {
              "canonicalBucket": "health",
              "jobId": "health.constitution_baseline",
              "matrixVersion": "phase1c-v1",
              "selectionMode": "atomic_job",
            },
            "supportKeys": [],
            "timingKeys": [],
          },
        },
        {
          "label": "health recovery caution adds only the near-term caution window",
          "summary": {
            "anchorKeys": [
              "dayMasterStrengthProfile",
              "elementAnalysis",
              "seasonalInteraction",
            ],
            "questionContext": {
              "canonicalBucket": "health",
              "jobId": "health.recovery_caution",
              "matrixVersion": "phase1c-v1",
              "selectionMode": "atomic_job",
            },
            "supportKeys": [],
            "timingKeys": [
              "activeTimingWindow",
            ],
          },
        },
        {
          "label": "health bucket fallback stays health-bounded without pretending to be a specific reviewed job",
          "summary": {
            "anchorKeys": [
              "dayMasterStrengthProfile",
              "elementAnalysis",
              "seasonalInteraction",
            ],
            "questionContext": {
              "canonicalBucket": "health",
              "matrixVersion": "phase1c-v1",
              "selectionMode": "bucket_fallback",
            },
            "supportKeys": [],
            "timingKeys": [
              "ageSnapshot",
              "currentDaYun",
              "activeTimingWindow",
              "nextTimingWindows",
              "liuNian",
            ],
          },
        },
      ]
    `);
  });

  test.each(PHASE_5B_PACKET_PROOF_CASES)(
    "$label",
    ({ expectedAnchorKeys, expectedSupportKeys, expectedTimingKeys, forbiddenKeys, maxRatio, ...proofCase }) => {
      const packet = composePacketForPhase5BProof(proofCase);
      const packetText = JSON.stringify(packet);

      expect(packet.chartIdentity.dayMaster).toBe(SAMPLE_BAZI_STATE.dayMaster);
      expect(packet.anchors.map((section) => section.key)).toEqual(expectedAnchorKeys);
      expect(packet.support.map((section) => section.key)).toEqual(expectedSupportKeys);
      expect(packet.timing.map((section) => section.key)).toEqual(expectedTimingKeys);

      for (const forbiddenKey of forbiddenKeys) {
        expect(packetText).not.toContain(forbiddenKey);
      }

      expectBoundedPacket(packet, maxRatio);
    },
  );
});