import { describe, expect, test } from "vitest";

import { retrieveHybridEvidencePacket } from "@/lib/bazi/hybrid-retrieval";
import { CalculatedStateSchema } from "@/lib/bazi/schema-types";

const SAMPLE_CALCULATED_STATE = CalculatedStateSchema.parse({
  fourPillars: {
    year: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
    month: { stem: "戊", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
    day: { stem: "己", branch: "巳", hiddenStems: ["丙", "庚", "戊"] },
    hour: { stem: "辛", branch: "未", hiddenStems: ["己", "丁", "乙"] },
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
  elementMetaphors: [],
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
  dayMasterStrengthProfile: {
    dayMaster: "己",
    strengthState: "แข็งแรง/สมดุล",
    narrative: "ดินมีฐานและยังตอบสนองต่อแรงหนุนได้ดี",
    qiLabel: "帝旺",
    scoreText: "3.07",
  },
  sixtyJiaziCorePersona: {
    code: "己巳",
    narrative: "Measured earth that grows through patience and timing.",
    twelveQiLabel: "帝旺",
    semanticNotes: [],
    precedenceNotes: [],
    precedenceNoteSignals: [],
  },
  baseChartReading: {
    roleBadges: [],
    stemInteractionBadges: [],
    branchInteractionBadges: [],
    markerBadges: [],
    groups: [],
    legendItems: [],
    readingOrderSteps: ["day-master", "season", "interactions"],
  },
  daYun: [
    {
      startAge: 41,
      endAge: 50,
      stem: "辛",
      branch: "酉",
      isCurrent: true,
    },
  ],
});

describe("retrieveHybridEvidencePacket", () => {
  test("returns dictionary-backed evidence for personality psychology", async () => {
    const packet = await retrieveHybridEvidencePacket(
      "personality_psychology",
      SAMPLE_CALCULATED_STATE,
    );

    expect(packet.tier).toBe("TierA");
    expect(packet.fallbackRequired).toBe(false);
    expect(packet.evidence.length).toBeGreaterThanOrEqual(2);
    expect(packet.evidence.some((entry) => entry.sourcePath.includes("1.นิสัยโดยพื้นฐาน"))).toBe(true);
  });

  test("returns direct-hit evidence for health and career dimensions", async () => {
    const [healthPacket, careerPacket] = await Promise.all([
      retrieveHybridEvidencePacket("health_overview", SAMPLE_CALCULATED_STATE),
      retrieveHybridEvidencePacket("career_potential", SAMPLE_CALCULATED_STATE),
    ]);

    expect(healthPacket.tier).toBe("TierA");
    expect(healthPacket.evidence.some((entry) => entry.sourcePath.includes("สุขภาพ(พื้นฐาน)"))).toBe(true);
    expect(careerPacket.tier).toBe("TierA");
    expect(careerPacket.evidence.some((entry) => entry.sourcePath.includes("การงานและธุรกิจ"))).toBe(true);
  });

  test("returns merge packets from direct-folder retrieval for chart foundation and balance", async () => {
    const [foundationPacket, balancePacket] = await Promise.all([
      retrieveHybridEvidencePacket("chart_foundation", SAMPLE_CALCULATED_STATE),
      retrieveHybridEvidencePacket("balance_element", SAMPLE_CALCULATED_STATE),
    ]);

    expect(foundationPacket.tier).toBe("TierB");
    expect(foundationPacket.fallbackRequired).toBe(true);
    expect(foundationPacket.evidence.some((entry) => entry.sourcePath.includes("Step การอ่านดวง"))).toBe(true);

    expect(balancePacket.tier).toBe("TierB");
    expect(balancePacket.evidence.some((entry) => entry.sourcePath.includes("ตารางปฏิกิริยาธาตุ"))).toBe(true);
  });

  test("classifies ten gods reaction as fallback-required with no canonical evidence packet", async () => {
    const packet = await retrieveHybridEvidencePacket(
      "ten_gods_reaction",
      SAMPLE_CALCULATED_STATE,
    );

    expect(packet.tier).toBe("TierC");
    expect(packet.fallbackRequired).toBe(true);
    expect(packet.evidence).toEqual([]);
    expect(packet.notes.join(" ")).toMatch(/fallback/i);
  });

  test("resolves twelve_qi_cycle evidence from the repo-local distilled mirror (docx→md)", async () => {
    // external corpus อาจไม่อยู่บนเครื่องนี้ → ต้อง fallback มาที่ knownlage/distilled
    const packet = await retrieveHybridEvidencePacket("twelve_qi_cycle", SAMPLE_CALCULATED_STATE);

    expect(packet.tier).toBe("TierA");
    expect(packet.evidence.length).toBeGreaterThanOrEqual(2);
    expect(packet.evidence.some((entry) => entry.sourcePath.includes("12 เชี่ยงแซ"))).toBe(true);
    // เนื้อหาจาก md จริงต้องไม่ว่าง
    expect(packet.evidence.every((entry) => entry.excerpt.length > 0)).toBe(true);
  });
});
