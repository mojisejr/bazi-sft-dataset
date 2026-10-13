import { describe, expect, test } from "vitest";

import { GUIDE_COMPLETE_QI, GUIDE_STEP_IDS, GUIDE_STEP_QI, MISSION_BY_ID, MISSION_DEFS } from "@/lib/bazi/manifest/missions";

// เส้นทางมือใหม่ (เอ็ม 2026-10-13): 6 ขั้น + โบนัสจบ — FE (features/v2-guide/quests.ts) ยิง guide_<id>
describe("guide missions", () => {
  test("ทุกขั้นมีนิยาม ทำครั้งเดียว เป้า 1 รางวัลตาม GUIDE_STEP_QI", () => {
    for (const id of GUIDE_STEP_IDS) {
      const def = MISSION_BY_ID.get(id);
      expect(def, id).toBeDefined();
      expect(def?.category).toBe("guide");
      expect(def?.period).toBe("once");
      expect(def?.target).toBe(1);
      expect(def?.rewardCoins).toBe(GUIDE_STEP_QI);
    }
  });

  test("โบนัสจบ guide_complete", () => {
    const def = MISSION_BY_ID.get("guide_complete");
    expect(def?.rewardCoins).toBe(GUIDE_COMPLETE_QI);
    expect(def?.category).toBe("guide");
  });

  test("id ภารกิจไม่ซ้ำ", () => {
    expect(new Set(MISSION_DEFS.map((m) => m.id)).size).toBe(MISSION_DEFS.length);
  });
});
