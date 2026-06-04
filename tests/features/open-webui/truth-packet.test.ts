import { describe, expect, test } from "vitest";

import { calculateBaziState } from "@/features/bazi-math/bazi-engine-adapter";
import {
  OpenWebUiTruthPacketSchema,
  selectOpenWebUiTruthPacket,
  stringifyOpenWebUiTruthPacket,
} from "@/features/open-webui/truth-packet";
import { BAZI_ATOMIC_QUESTION_MATRIX_VERSION } from "@/lib/bazi/atomic-question-matrix";
import { CalculatedStateSchema } from "@/lib/bazi/schema-types";

import { createTestKnowledgeRepository } from "../../helpers/bazi-test-knowledge-repository";

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
  ],
  baseChartReading: {
    roleBadges: [],
    stemInteractionBadges: [],
    branchInteractionBadges: [],
    markerBadges: [],
    groups: [],
    legendItems: [],
    readingOrderSteps: ["ดูดิถีก่อน", "ดูฤดูกาล", "ดูแรงหนุน"],
  },
});

describe("selectOpenWebUiTruthPacket", () => {
  test("returns a finance-focused packet with timing and no broad chart extras", () => {
    const packet = selectOpenWebUiTruthPacket({
      intent: "wealth",
      requiresBaziConsult: true,
      confidence: 0.94,
    }, SAMPLE_BAZI_STATE);

    expect(packet).toMatchObject({
      questionContext: {
        canonicalBucket: "wealth",
        selectionMode: "bucket_fallback",
        matrixVersion: BAZI_ATOMIC_QUESTION_MATRIX_VERSION,
      },
      anchors: [
        { key: "dayMasterStrengthProfile", provenance: "computed_chart_marker" },
        { key: "elementAnalysis", provenance: "computed_chart_marker" },
        { key: "financeTenGodHighlights", provenance: "computed_chart_marker", value: { yearStem: "正财", monthStem: "劫财" } },
      ],
      support: [],
      timing: [
        { key: "ageSnapshot", provenance: "timing_context", value: { thaiAge: 37, chineseAge: 38 } },
        {
          key: "currentDaYun",
          provenance: "timing_context",
          value: {
            influenceGradient: SAMPLE_BAZI_STATE.daYun[0]?.influenceGradient,
            upperPhase: { label: "35-39" },
            lowerPhase: { label: "40-44" },
          },
        },
        { key: "activeTimingWindow", provenance: "timing_context", value: { label: "35-39" } },
        {
          key: "nextTimingWindows",
          provenance: "timing_context",
          value: [
            { label: "40-44" },
            { label: "45-49" },
          ],
        },
        { key: "liuNian", provenance: "timing_context" },
      ],
    });

    expect(stringifyOpenWebUiTruthPacket({
      intent: "wealth",
      requiresBaziConsult: true,
      confidence: 0.94,
    }, SAMPLE_BAZI_STATE)).not.toContain("baseChartReading");
    expect(stringifyOpenWebUiTruthPacket({
      intent: "wealth",
      requiresBaziConsult: true,
      confidence: 0.94,
    }, SAMPLE_BAZI_STATE)).not.toContain("50-54");
  });

  test("returns a relationship-focused packet anchored on spouse palace and love compatibility", () => {
    const packet = selectOpenWebUiTruthPacket({
      intent: "love",
      requiresBaziConsult: true,
      confidence: 0.91,
    }, SAMPLE_BAZI_STATE);

    expect(packet?.questionContext).toMatchObject({
      canonicalBucket: "relationship",
      selectionMode: "bucket_fallback",
      matrixVersion: BAZI_ATOMIC_QUESTION_MATRIX_VERSION,
    });
    expect(packet?.anchors).toMatchObject([
      { key: "spousePalace", provenance: "computed_chart_marker" },
      { key: "relationshipTenGodHighlights", provenance: "computed_chart_marker" },
      { key: "loveCompatibilityProfile", provenance: "compatibility_profile" },
    ]);
    expect(packet?.support.map((section) => section.key)).toEqual([
    ]);
    expect(stringifyOpenWebUiTruthPacket({
      intent: "love",
      requiresBaziConsult: true,
      confidence: 0.91,
    }, SAMPLE_BAZI_STATE)).not.toContain("shenSha");
  });

  test("keeps intent packets strictly scoped to their requested domain", () => {
    const lovePacketText = stringifyOpenWebUiTruthPacket({
      intent: "love",
      requiresBaziConsult: true,
      confidence: 0.91,
    }, SAMPLE_BAZI_STATE);
    const careerPacketText = stringifyOpenWebUiTruthPacket({
      intent: "career",
      requiresBaziConsult: true,
      confidence: 0.88,
    }, SAMPLE_BAZI_STATE);
    const healthPacketText = stringifyOpenWebUiTruthPacket({
      intent: "health",
      requiresBaziConsult: true,
      confidence: 0.87,
    }, SAMPLE_BAZI_STATE);

    expect(lovePacketText).toContain("spousePalace");
    expect(lovePacketText).not.toContain("elementAnalysis");
    expect(lovePacketText).not.toContain("careerTenGodHighlights");
    expect(lovePacketText).not.toContain("seasonalInteraction");
    expect(careerPacketText).not.toContain("loveCompatibilityProfile");
    expect(careerPacketText).not.toContain("spousePalace");
    expect(healthPacketText).not.toContain("relationshipTenGodHighlights");
    expect(healthPacketText).not.toContain("financeTenGodHighlights");
  });

  test("maps shell intents onto canonical doctrine packet buckets", () => {
    const careerPacket = selectOpenWebUiTruthPacket({
      intent: "career",
      requiresBaziConsult: true,
      confidence: 0.88,
    }, SAMPLE_BAZI_STATE);
    const generalReadingPacket = selectOpenWebUiTruthPacket({
      intent: "general_reading",
      requiresBaziConsult: true,
      confidence: 0.9,
    }, SAMPLE_BAZI_STATE);

    expect(careerPacket?.questionContext).toMatchObject({
      canonicalBucket: "work",
      selectionMode: "bucket_fallback",
      matrixVersion: BAZI_ATOMIC_QUESTION_MATRIX_VERSION,
    });
    expect(generalReadingPacket?.questionContext).toMatchObject({
      canonicalBucket: "foundation",
      selectionMode: "bucket_fallback",
      matrixVersion: BAZI_ATOMIC_QUESTION_MATRIX_VERSION,
    });
  });

  test("returns null when the routed intent does not require Bazi consultation", () => {
    expect(selectOpenWebUiTruthPacket({
      intent: "chit_chat",
      requiresBaziConsult: false,
      confidence: 0.22,
    }, SAMPLE_BAZI_STATE)).toBeNull();

    expect(stringifyOpenWebUiTruthPacket({
      intent: "chit_chat",
      requiresBaziConsult: false,
      confidence: 0.22,
    }, SAMPLE_BAZI_STATE)).toBeNull();
  });
});

// Phase 8.3: prove the intent filter pulls fields from REAL engine output now
// that the adapter drives `calculateBaziChart` (Phase 1) under nodejs (Phase 2).
// The four pillars / dayMaster come from deterministic lunar math (no DB), so the
// chart identity is genuinely real. DB-backed enrichment is provided by an injected
// stub repository so the suite stays offline and deterministic. Optional fields the
// stub cannot resolve must degrade gracefully (no crash), not be asserted as present.
describe("selectOpenWebUiTruthPacket with live engine output (Phase 8.3)", () => {
  // 1981-03-17 Bangkok → day master 甲, day pillar 甲午 (distinct from the fixed mock 己).
  const LIVE_BIRTH = {
    birthAt: new Date("1981-03-17T10:22:00+07:00"),
    location: "Bangkok",
    gender: "male" as const,
  };

  async function calculateLiveState() {
    return calculateBaziState(LIVE_BIRTH.birthAt, LIVE_BIRTH.location, {
      gender: LIVE_BIRTH.gender,
      repository: createTestKnowledgeRepository(),
    });
  }

  test("wealth intent: packet parses and anchors include real elementAnalysis", async () => {
    const liveState = await calculateLiveState();

    const packet = selectOpenWebUiTruthPacket({
      intent: "wealth",
      requiresBaziConsult: true,
      confidence: 0.93,
    }, liveState);

    // (a) Schema-safe even when optional DB-backed fields are absent under the stub repo.
    expect(() => OpenWebUiTruthPacketSchema.parse(packet)).not.toThrow();

    // Chart identity reflects the live engine, not a fixed mock 己.
    expect(packet?.chartIdentity.dayMaster).toBe(liveState.dayMaster);
    expect(packet?.chartIdentity.dayMaster).not.toBe("己");

    // (b) Wealth anchors always carry the finance-oriented elementAnalysis section
    // sourced straight from the live engine output.
    const elementAnchor = packet?.anchors.find((section) => section.key === "elementAnalysis");
    expect(elementAnchor).toBeDefined();
    expect(elementAnchor?.value).toEqual(liveState.elementAnalysis);

    // financeTenGodHighlights is optional (only when a /财/ ten-god exists); if present
    // it must mirror live ten-gods, otherwise its absence must not crash the packet.
    const financeAnchor = packet?.anchors.find(
      (section) => section.key === "financeTenGodHighlights",
    );
    if (financeAnchor) {
      const matched = Object.values(financeAnchor.value as Record<string, string>);
      expect(matched.every((tenGod) => /财/u.test(tenGod))).toBe(true);
    }
  });

  test("love intent: spousePalace anchor mirrors the live day pillar", async () => {
    const liveState = await calculateLiveState();

    const packet = selectOpenWebUiTruthPacket({
      intent: "love",
      requiresBaziConsult: true,
      confidence: 0.9,
    }, liveState);

    // (a) Parses without throwing under the stub repo.
    expect(() => OpenWebUiTruthPacketSchema.parse(packet)).not.toThrow();

    // (c) Love anchors lead with the day-pillar spouse palace from the live chart.
    const spouseAnchor = packet?.anchors[0];
    expect(spouseAnchor?.key).toBe("spousePalace");
    expect(spouseAnchor?.value).toMatchObject({
      stem: liveState.fourPillars.day.stem,
      branch: liveState.fourPillars.day.branch,
    });

    // The day pillar identity is real (1981-03-17 → 甲午), never the fixed mock.
    expect(liveState.fourPillars.day.stem).toBe("甲");
    expect(liveState.fourPillars.day.branch).toBe("午");
  });

  test("live engine output satisfies the canonical CalculatedState schema", async () => {
    const liveState = await calculateLiveState();
    expect(() => CalculatedStateSchema.parse(liveState)).not.toThrow();
  });
});