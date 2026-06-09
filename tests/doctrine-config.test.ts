import { describe, expect, test } from "vitest";

import { buildDayMasterRelationPacket } from "@/lib/bazi/day-master-relation-reading-poc";
import { CalculatedStateSchema, type RawInputValue } from "@/lib/bazi/schema-types";
import {
  calculateBaziStructuralState,
  resolveBranchInteractionEffects,
  buildGeneralizedInteractionState,
} from "@/lib/bazi/symbolic-engine";
import {
  STEP_KEYS,
  STEP_TEXT_DEFAULTS,
  applyRoleConfig,
  applyStarConfig,
  applyStepConfig,
  parseDoctrineConfigValue,
} from "@/lib/bazi/doctrine-config";
import { getDoctrineConfigV2 } from "@/lib/bazi/doctrine-config.server";
import type { DoctrineConfigRepository } from "@/lib/bazi/doctrine-config-repository";

const SAMPLE: RawInputValue = {
  birthDate: "1989-01-03",
  birthTime: "08:45",
  gender: "male",
  province: "Bangkok",
  calendarSystem: "solar",
  timezone: "Asia/Bangkok",
};

function buildPacket() {
  const structural = calculateBaziStructuralState(SAMPLE);
  const resolution = resolveBranchInteractionEffects(structural.fourPillars);
  const interactionState = buildGeneralizedInteractionState({
    pillars: structural.fourPillars,
    dayMasterStem: structural.dayMaster,
    twelveQiByBranch: {},
    resolution,
  });
  // structural state ไม่มี field ครบสำหรับ packet → ใช้ตัวจาก reading test แทน
  const state = CalculatedStateSchema.parse({
    fourPillars: structural.fourPillars,
    dayMaster: structural.dayMaster,
    strengthScore: 3,
    tenGods: {},
    twelveQi: {},
    elementAnalysis: {
      visibleCounts: { wood: 1, fire: 1, earth: 2, metal: 0, water: 1 },
      hiddenCounts: { wood: 2, fire: 0, earth: 2, metal: 0, water: 3 },
      totalCounts: { wood: 3, fire: 1, earth: 4, metal: 0, water: 4 },
      missingElements: ["metal"],
      dominantElements: ["water", "earth"],
      elementStrengths: [],
    },
    interactionState,
    shenSha: [
      { starName: "ง้วยเต๊ก (月德)", relatedPillar: "เดือน", meaning: "ความหมายเดิม" },
    ],
  });
  return buildDayMasterRelationPacket(state);
}

describe("doctrine-config v2 — drift guard", () => {
  test("STEP_TEXT_DEFAULTS ตรงกับ title/auditFocus จริงใน packet ทุกขั้น", () => {
    const packet = buildPacket();
    for (const step of packet.stepInsights) {
      const def = STEP_TEXT_DEFAULTS[step.stepKey as keyof typeof STEP_TEXT_DEFAULTS];
      expect(def, `missing default for ${step.stepKey}`).toBeDefined();
      expect(step.titleThai).toBe(def.title);
      expect(step.auditFocusThai).toBe(def.auditFocus);
      expect(step.stepNumber).toBe(def.stepNumber);
    }
    expect(packet.stepInsights).toHaveLength(STEP_KEYS.length);
  });
});

describe("doctrine-config v2 — validation", () => {
  test("step/role/star value validation", () => {
    expect(parseDoctrineConfigValue("step", { title: "x", auditFocus: "y" })).not.toBeNull();
    expect(parseDoctrineConfigValue("step", { bogus: 1 })).toBeNull();
    expect(parseDoctrineConfigValue("role", { meaning: "ม" })).not.toBeNull();
    expect(parseDoctrineConfigValue("star", { starName: "ดาว", meaning: "ม" })).not.toBeNull();
    expect(parseDoctrineConfigValue("star", { title: "x" })).toBeNull();
  });
});

describe("doctrine-config v2 — pure apply", () => {
  test("applyStepConfig overrides title/auditFocus by stepKey", () => {
    const steps = [
      { stepKey: "balance-core", titleThai: "เดิม", auditFocusThai: "focus เดิม" },
      { stepKey: "result-wealth", titleThai: "เดิม2", auditFocusThai: "focus2" },
    ];
    const out = applyStepConfig(steps, { "balance-core": { title: "ใหม่" } });
    expect(out[0].titleThai).toBe("ใหม่");
    expect(out[0].auditFocusThai).toBe("focus เดิม");
    expect(out[1]).toBe(steps[1]);
  });

  test("applyRoleConfig overrides label/meaning by relationKey", () => {
    const summaries = [
      { relationKey: "power", relationLabelThai: "ธาตุพิฆาต", semanticMeaningThai: "เดิม" },
    ];
    const out = applyRoleConfig(summaries, { power: { meaning: "ภาระหน้าที่ใหม่" } });
    expect(out[0].semanticMeaningThai).toBe("ภาระหน้าที่ใหม่");
    expect(out[0].relationLabelThai).toBe("ธาตุพิฆาต");
  });

  test("applyStarConfig matches by default star name and overrides", () => {
    const shenSha = [{ starName: "ง้วยเต๊ก (月德)", meaning: "เดิม" }];
    const out = applyStarConfig(shenSha, { yueDe: { meaning: "ความหมายใหม่" } });
    expect(out[0].meaning).toBe("ความหมายใหม่");
    // ดาวที่ไม่มีใน config คงเดิม
    const out2 = applyStarConfig([{ starName: "ดาวแปลก", meaning: "ม" }], { yueDe: { meaning: "x" } });
    expect(out2[0].meaning).toBe("ม");
  });
});

describe("doctrine-config v2 — loader fallback", () => {
  const throwingRepo: DoctrineConfigRepository = {
    async load() {
      throw new Error("table missing");
    },
    async upsert() {},
    async remove() {},
  };

  test("falls back to empty config when repository throws", async () => {
    const cfg = await getDoctrineConfigV2({ repository: throwingRepo });
    expect(cfg).toEqual({ steps: {}, roles: {}, stars: {} });
  });

  test("returns overrides from repository", async () => {
    const repo: DoctrineConfigRepository = {
      async load() {
        return { steps: { "balance-core": { title: "T" } }, roles: {}, stars: {} };
      },
      async upsert() {},
      async remove() {},
    };
    const cfg = await getDoctrineConfigV2({ repository: repo });
    expect(cfg.steps["balance-core"]?.title).toBe("T");
  });
});
