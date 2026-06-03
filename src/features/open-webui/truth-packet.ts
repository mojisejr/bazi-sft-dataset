import { z } from "zod";

import { type BaziStatePayload } from "@/features/bazi-math/bazi-engine-adapter";
import { type OpenWebUiIntentClassification } from "@/features/open-webui/intent-router";
import { type DaYunPillarValue, PillarValueSchema } from "@/lib/bazi/schema-types";

const OpenWebUiTruthPacketIntentSchema = z.enum([
  "wealth",
  "love",
  "career",
  "health",
  "general_reading",
]);

const OpenWebUiTruthPacketSectionProvenanceSchema = z.enum([
  "computed_chart_marker",
  "compatibility_profile",
  "supporting_context",
  "timing_context",
]);

const TruthPacketPillarSchema = PillarValueSchema.pick({
  stem: true,
  branch: true,
  hiddenStems: true,
  tenGod: true,
  sittingStage: true,
  lookingStage: true,
  upperStageDisplay: true,
  lowerStageDisplay: true,
});

const OpenWebUiTruthPacketSectionSchema = z.object({
  key: z.string().trim().min(1),
  provenance: OpenWebUiTruthPacketSectionProvenanceSchema,
  value: z.unknown(),
});

export const OpenWebUiTruthPacketSchema = z.object({
  intent: OpenWebUiTruthPacketIntentSchema,
  chartIdentity: z.object({
    dayMaster: z.string().trim().min(1),
    fourPillars: z.object({
      year: TruthPacketPillarSchema,
      month: TruthPacketPillarSchema,
      day: TruthPacketPillarSchema,
      hour: TruthPacketPillarSchema,
    }),
  }),
  anchors: z.array(OpenWebUiTruthPacketSectionSchema).min(1),
  support: z.array(OpenWebUiTruthPacketSectionSchema).default([]),
  timing: z.array(OpenWebUiTruthPacketSectionSchema).default([]),
});

export type OpenWebUiTruthPacket = z.infer<typeof OpenWebUiTruthPacketSchema>;

type OpenWebUiTruthPacketIntent = z.infer<typeof OpenWebUiTruthPacketIntentSchema>;
type OpenWebUiTruthPacketSectionProvenance = z.infer<typeof OpenWebUiTruthPacketSectionProvenanceSchema>;
type OpenWebUiTruthPacketSection = z.infer<typeof OpenWebUiTruthPacketSectionSchema>;

function toTruthPacketPillar(pillar: BaziStatePayload["fourPillars"]["year"]) {
  return TruthPacketPillarSchema.parse({
    stem: pillar.stem,
    branch: pillar.branch,
    hiddenStems: pillar.hiddenStems ?? [],
    tenGod: pillar.tenGod,
  });
}

function buildChartIdentity(payload: BaziStatePayload) {
  return {
    dayMaster: payload.dayMaster,
    fourPillars: {
      year: toTruthPacketPillar(payload.fourPillars.year),
      month: toTruthPacketPillar(payload.fourPillars.month),
      day: toTruthPacketPillar(payload.fourPillars.day),
      hour: toTruthPacketPillar(payload.fourPillars.hour),
    },
  };
}

function createSection(
  key: string,
  value: unknown,
  provenance: OpenWebUiTruthPacketSectionProvenance = "computed_chart_marker",
): OpenWebUiTruthPacketSection {
  return { key, provenance, value };
}

function getCurrentDaYun(payload: BaziStatePayload): DaYunPillarValue | null {
  return payload.daYun.find((pillar) => pillar.isCurrent) ?? payload.daYun.at(-1) ?? null;
}

function buildTimingSections(payload: BaziStatePayload): OpenWebUiTruthPacketSection[] {
  const sections: OpenWebUiTruthPacketSection[] = [];
  const currentDaYun = getCurrentDaYun(payload);

  if (currentDaYun) {
    sections.push(createSection("currentDaYun", {
      startAge: currentDaYun.startAge,
      endAge: currentDaYun.endAge,
      stem: currentDaYun.stem,
      branch: currentDaYun.branch,
      currentPhase: currentDaYun.currentPhase,
      upperStageDisplay: currentDaYun.upperStageDisplay,
      lowerStageDisplay: currentDaYun.lowerStageDisplay,
      influenceGradient: currentDaYun.influenceGradient,
    }, "timing_context"));
  }

  if (payload.liuNian) {
    sections.push(createSection("liuNian", toTruthPacketPillar(payload.liuNian), "timing_context"));
  }

  return sections;
}

function buildTenGodHighlights(
  payload: BaziStatePayload,
  key: string,
  matcher: RegExp,
): OpenWebUiTruthPacketSection | null {
  const entries = Object.entries(payload.tenGods).filter(([, value]) => matcher.test(value));

  if (entries.length === 0) {
    return null;
  }

  return createSection(key, Object.fromEntries(entries));
}

function buildAnchorSections(
  intent: OpenWebUiTruthPacketIntent,
  payload: BaziStatePayload,
): OpenWebUiTruthPacketSection[] {
  const anchors: OpenWebUiTruthPacketSection[] = [];

  switch (intent) {
    case "wealth": {
      if (payload.dayMasterStrengthProfile) {
        anchors.push(createSection("dayMasterStrengthProfile", payload.dayMasterStrengthProfile));
      }

      anchors.push(createSection("elementAnalysis", payload.elementAnalysis));

      const financeTenGods = buildTenGodHighlights(payload, "financeTenGodHighlights", /财/u);

      if (financeTenGods) {
        anchors.push(financeTenGods);
      }

      return anchors;
    }

    case "love": {
      anchors.push(createSection("spousePalace", toTruthPacketPillar(payload.fourPillars.day)));

      const relationshipTenGods = buildTenGodHighlights(
        payload,
        "relationshipTenGodHighlights",
        /官|殺|杀|财/u,
      );

      if (relationshipTenGods) {
        anchors.push(relationshipTenGods);
      }

      const loveCompatibilityProfile = payload.compatibilityMatrixProfiles.find(
        (profile) => profile.domain === "love",
      );

      if (loveCompatibilityProfile) {
        anchors.push(createSection(
          "loveCompatibilityProfile",
          loveCompatibilityProfile,
          "compatibility_profile",
        ));
      }

      return anchors;
    }

    case "career": {
      if (payload.dayMasterStrengthProfile) {
        anchors.push(createSection("dayMasterStrengthProfile", payload.dayMasterStrengthProfile));
      }

      const careerTenGods = buildTenGodHighlights(
        payload,
        "careerTenGodHighlights",
        /官|殺|杀|印|食神|伤官/u,
      );

      if (careerTenGods) {
        anchors.push(careerTenGods);
      }

      const workCompatibilityProfile = payload.compatibilityMatrixProfiles.find(
        (profile) => profile.domain === "work",
      );

      if (workCompatibilityProfile) {
        anchors.push(createSection(
          "workCompatibilityProfile",
          workCompatibilityProfile,
          "compatibility_profile",
        ));
      }

      anchors.push(createSection("elementAnalysis", payload.elementAnalysis));
      return anchors;
    }

    case "health": {
      if (payload.dayMasterStrengthProfile) {
        anchors.push(createSection("dayMasterStrengthProfile", payload.dayMasterStrengthProfile));
      }

      anchors.push(createSection("elementAnalysis", payload.elementAnalysis));

      if (payload.seasonalInteraction) {
        anchors.push(createSection("seasonalInteraction", payload.seasonalInteraction));
      }

      return anchors;
    }

    case "general_reading": {
      if (payload.dayMasterStrengthProfile) {
        anchors.push(createSection("dayMasterStrengthProfile", payload.dayMasterStrengthProfile));
      }

      if (payload.sixtyJiaziCorePersona) {
        anchors.push(createSection("sixtyJiaziCorePersona", payload.sixtyJiaziCorePersona));
      }

      anchors.push(createSection("elementAnalysis", payload.elementAnalysis));

      if (payload.seasonalInteraction) {
        anchors.push(createSection("seasonalInteraction", payload.seasonalInteraction));
      }

      return anchors;
    }
  }
}

function buildSupportSections(
  intent: OpenWebUiTruthPacketIntent,
  payload: BaziStatePayload,
): OpenWebUiTruthPacketSection[] {
  const support: OpenWebUiTruthPacketSection[] = [];

  switch (intent) {
    case "wealth":
    case "love":
    case "career":
    case "health":
      break;

    case "general_reading":
      if (payload.baseChartReading?.readingOrderSteps.length) {
        support.push(createSection(
          "readingOrderSteps",
          payload.baseChartReading.readingOrderSteps.slice(0, 4),
          "supporting_context",
        ));
      }
      break;
  }

  return support;
}

export function selectOpenWebUiTruthPacket(
  classification: OpenWebUiIntentClassification,
  payload: BaziStatePayload,
): OpenWebUiTruthPacket | null {
  if (!classification.requiresBaziConsult || classification.intent === "chit_chat") {
    return null;
  }

  const intent = OpenWebUiTruthPacketIntentSchema.parse(classification.intent);

  return OpenWebUiTruthPacketSchema.parse({
    intent,
    chartIdentity: buildChartIdentity(payload),
    anchors: buildAnchorSections(intent, payload),
    support: buildSupportSections(intent, payload),
    timing: buildTimingSections(payload),
  });
}

export function stringifyOpenWebUiTruthPacket(
  classification: OpenWebUiIntentClassification,
  payload: BaziStatePayload,
): string | null {
  const truthPacket = selectOpenWebUiTruthPacket(classification, payload);

  return truthPacket ? JSON.stringify(truthPacket, null, 2) : null;
}