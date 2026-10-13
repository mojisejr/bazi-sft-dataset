import { describe, expect, test } from "vitest";

import {
  GUIDE_CHAPTER_BONUS,
  GUIDE_CHAPTER_QI,
  GUIDE_CHAPTERS,
  GUIDE_COMPLETE_QI,
  GUIDE_STEP_IDS,
  GUIDE_STEP_QI,
  MISSION_BY_ID,
  MISSION_DEFS,
} from "@/lib/bazi/manifest/missions";

// เส้นทางมือใหม่ 6 บท (เอ็ม 2026-10-13) — FE features/v2-guide/quests.ts ยิง guide_<id> / guide_ch<n> / guide_complete
describe("guide missions", () => {
  test("6 บท 25 ภารกิจ", () => {
    expect(GUIDE_CHAPTERS.length).toBe(6);
    expect(GUIDE_STEP_IDS.length).toBe(25);
  });

  test("ทุกขั้นมีนิยาม ทำครั้งเดียว รางวัล GUIDE_STEP_QI", () => {
    for (const id of GUIDE_STEP_IDS) {
      const def = MISSION_BY_ID.get(id);
      expect(def, id).toBeDefined();
      expect(def?.category).toBe("guide");
      expect(def?.period).toBe("once");
      expect(def?.rewardCoins).toBe(GUIDE_STEP_QI);
    }
  });

  test("โบนัสจบบท + จบทั้งหมด", () => {
    for (const [id, steps] of GUIDE_CHAPTER_BONUS) {
      expect(MISSION_BY_ID.get(id)?.rewardCoins).toBe(GUIDE_CHAPTER_QI);
      expect(steps.length).toBeGreaterThan(0);
    }
    expect(MISSION_BY_ID.get("guide_complete")?.rewardCoins).toBe(GUIDE_COMPLETE_QI);
  });

  test("id ภารกิจไม่ซ้ำ", () => {
    expect(new Set(MISSION_DEFS.map((m) => m.id)).size).toBe(MISSION_DEFS.length);
  });
});
