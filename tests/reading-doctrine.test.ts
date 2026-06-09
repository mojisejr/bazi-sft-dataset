import { describe, expect, test } from "vitest";

import { TOPIC_PATH, getTopicDefinition } from "@/lib/bazi/topic-path";
import {
  mergeTopicDefinition,
  parseReadingDoctrineOverride,
  hasOverrideContent,
} from "@/lib/bazi/reading-doctrine-override";
import {
  getMergedReadingDoctrine,
  getMergedTopicDefinition,
} from "@/lib/bazi/reading-doctrine.server";
import type { ReadingDoctrineRepository } from "@/lib/bazi/reading-doctrine-repository";

function repoWith(overrides: Record<string, unknown>): ReadingDoctrineRepository {
  return {
    async listOverrides() {
      const map: Record<string, ReturnType<typeof parseReadingDoctrineOverride>> = {};
      for (const [id, raw] of Object.entries(overrides)) {
        const parsed = parseReadingDoctrineOverride(raw);
        if (parsed) map[id] = parsed;
      }
      return map as never;
    },
    async upsertOverride() {},
    async deleteOverride() {},
  };
}

const throwingRepo: ReadingDoctrineRepository = {
  async listOverrides() {
    throw new Error("DB down / table missing");
  },
  async upsertOverride() {},
  async deleteOverride() {},
};

describe("reading-doctrine override validation", () => {
  test("accepts valid override and rejects out-of-range / unknown keys", () => {
    expect(parseReadingDoctrineOverride({ lens: "x", stepNumbers: [1, 4, 7] })).not.toBeNull();
    expect(parseReadingDoctrineOverride({ relationKeys: ["output", "wealth"] })).not.toBeNull();
    // step เกิน 7 → null
    expect(parseReadingDoctrineOverride({ stepNumbers: [8] })).toBeNull();
    // relationKey ผิด → null
    expect(parseReadingDoctrineOverride({ relationKeys: ["bogus"] })).toBeNull();
    // key แปลกปลอม → null (strict)
    expect(parseReadingDoctrineOverride({ chapter: 99 })).toBeNull();
  });

  test("hasOverrideContent detects empty vs non-empty", () => {
    expect(hasOverrideContent({})).toBe(false);
    expect(hasOverrideContent({ lens: "x" })).toBe(true);
    expect(hasOverrideContent({ stepNumbers: [] })).toBe(false);
  });
});

describe("mergeTopicDefinition", () => {
  const base = getTopicDefinition("wealth_and_investment");

  test("applies overridden fields, keeps id/chapter/kind", () => {
    const merged = mergeTopicDefinition(base, {
      lens: "lens ใหม่",
      stepNumbers: [4, 5],
      relationKeys: ["wealth"],
      title: "หัวข้อใหม่",
    });
    expect(merged.lens).toBe("lens ใหม่");
    expect(merged.stepNumbers).toEqual([4, 5]);
    expect(merged.relationKeys).toEqual(["wealth"]);
    expect(merged.title).toBe("หัวข้อใหม่");
    expect(merged.id).toBe(base.id);
    expect(merged.chapter).toBe(base.chapter);
    expect(merged.kind).toBe(base.kind);
  });

  test("empty override returns base unchanged", () => {
    expect(mergeTopicDefinition(base, {})).toBe(base);
    expect(mergeTopicDefinition(base, null)).toBe(base);
  });
});

describe("getMergedReadingDoctrine", () => {
  test("merges DB override over code defaults", async () => {
    const merged = await getMergedReadingDoctrine({
      repository: repoWith({ chart_foundation: { lens: "lens จาก DB", stepNumbers: [1, 2] } }),
    });
    const cf = merged.find((t) => t.id === "chart_foundation")!;
    expect(cf.lens).toBe("lens จาก DB");
    expect(cf.stepNumbers).toEqual([1, 2]);
    // บทอื่นยังเป็น default
    const career = merged.find((t) => t.id === "career_potential")!;
    expect(career.lens).toBe(getTopicDefinition("career_potential").lens);
    // ครบทุกบทเท่า default
    expect(merged).toHaveLength(TOPIC_PATH.length);
  });

  test("falls back to code defaults when repository throws", async () => {
    const merged = await getMergedReadingDoctrine({ repository: throwingRepo });
    expect(merged).toHaveLength(TOPIC_PATH.length);
    expect(merged.find((t) => t.id === "chart_foundation")!.lens).toBe(
      getTopicDefinition("chart_foundation").lens,
    );
  });

  test("invalid override row is ignored (fallback to that topic default)", async () => {
    const merged = await getMergedReadingDoctrine({
      repository: repoWith({ health: { stepNumbers: [99] } }),
    });
    expect(merged.find((t) => t.id === "health")!.stepNumbers).toEqual(
      getTopicDefinition("health").stepNumbers,
    );
  });
});

describe("getMergedTopicDefinition", () => {
  test("returns merged topic", async () => {
    const def = await getMergedTopicDefinition("colors_directions", {
      repository: repoWith({ colors_directions: { title: "สีมงคล (ปรับ)" } }),
    });
    expect(def.title).toBe("สีมงคล (ปรับ)");
  });

  test("falls back to default on repo error", async () => {
    const def = await getMergedTopicDefinition("guardian_deities", { repository: throwingRepo });
    expect(def.lens).toBe(getTopicDefinition("guardian_deities").lens);
  });
});
