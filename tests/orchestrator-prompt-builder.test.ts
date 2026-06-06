import { describe, expect, test, vi } from "vitest";

import {
  buildChunkPromptBundle,
  buildChunkSystemInstruction,
} from "@/lib/bazi/orchestrator/prompt-builder";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

describe("orchestrator prompt builder", () => {
  test("builds a strict phase-2 system instruction for one chunk", () => {
    const instruction = buildChunkSystemInstruction("life_path");

    expect(instruction).toContain("Mumate");
    expect(instruction).toContain("life_path");
    expect(instruction).toContain("keys exactly match the requested topic ids");
    expect(instruction).toContain("Do not add extra keys");
    expect(instruction).toContain("never fabricate missing chart detail");
  });

  test("assembles chunk prompts from deterministic rules and facts without raw corpus noise", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));

    const rawInput = {
      birthDate: "1992-08-21",
      birthTime: "14:35",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Hong_Kong",
    } as const;

    const chart = await calculateBaziChart(rawInput, createTestKnowledgeRepository());
    const bundle = buildChunkPromptBundle(rawInput, chart, "life_path");

    expect(bundle.topicIds).toEqual([
      "suitable_career",
      "wealth_luck",
      "solo_vs_teamwork",
      "study_path",
      "major_luck_cycles",
    ]);
    expect(bundle.responseSchemaKeys).toEqual(bundle.topicIds);
    expect(bundle.topics).toHaveLength(5);

    expect(bundle.userPrompt).toContain("Chunk id: life_path");
    expect(bundle.userPrompt).toContain("Topic: suitable_career");
    expect(bundle.userPrompt).toContain("อ้างอิงจากความแข็ง-อ่อนของดิถีเป็นหลัก");
    expect(bundle.userPrompt).toContain("useful_god (Useful God): ไฟ — ดวงอ่อนจึงให้น้ำหนักกับธาตุส่งเสริมและธาตุคู่ก่อน");
    expect(bundle.userPrompt).toContain("wealth_star (Wealth Star): yearStem=正财, yearBranch=正财, monthBranch=正财, mingGongStem=正财");
    expect(bundle.userPrompt).toContain("dayun_cycles (Da Yun Cycles): 4-13:丁未, 14-23:丙午, 24-33:乙巳(current), 34-43:甲辰, 44-53:癸卯, 54-63:壬寅, 64-73:辛丑, 74-83:庚子, 84-93:己亥");
    expect(bundle.userPrompt).not.toContain("Reference style excerpts");
    expect(bundle.userPrompt).not.toContain("sourceRoot");
    expect(bundle.userPrompt).not.toContain("combinedNormalizedContent");
  });
});