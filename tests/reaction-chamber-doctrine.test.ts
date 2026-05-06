import { describe, expect, test } from "vitest";

import type { BaseChartReadingValue } from "@/lib/bazi/schema-types";
import { buildReactionChamberDoctrineModel } from "@/lib/bazi/reaction-chamber-doctrine";

const reading = {
  roleBadges: [],
  stemInteractionBadges: [],
  branchInteractionBadges: [],
  markerBadges: [],
  groups: [
    {
      key: "roles",
      title: "บทบาทต่อดิถี",
      family: "role",
      badges: [],
    },
  ],
  strengthGate: {
    title: "กำลังดิถี",
    summary: "ดิถีอยู่ในจุดที่ต้องอ่านก่อน layer อื่น",
    displayLabel: "สมดุล",
    score: 3.2,
    readingOrderHint: "อ่านกำลังดิถีก่อนเสมอ",
  },
  schoolSections: [
    {
      key: "strength-gate",
      title: "กำลังดิถี",
      description: "ชี้ gate แรกของการอ่าน",
      readingOrder: 1,
      badges: [],
    },
    {
      key: "roles",
      title: "จับซิ้ง / บทบาทต่อดิถี",
      description: "อ่านบทบาทหลักก่อน interaction",
      readingOrder: 2,
      badges: [
        {
          id: "role-1",
          family: "role",
          label: "ปีบน · เจี้ยไช้",
          shortLabel: "เจี้ยไช้",
          priority: "secondary",
          status: "active",
          meaningShort: "ลาภที่เป็นระบบ",
          modal: {
            title: "ปีบน · เจี้ยไช้",
            family: "role",
            summary: "สรุป role",
            explanation: "อธิบาย role",
            readingOrderHint: "อ่านหลัง strength gate",
            details: [],
          },
          participants: [],
        },
      ],
    },
    {
      key: "markers",
      title: "ตัวประกอบพิเศษ",
      description: "ใช้เป็นชั้นเสริม",
      readingOrder: 5,
      badges: [],
    },
  ],
  legendItems: [
    { label: "strength", value: "กำลังดิถีเป็นด่านแรก" },
  ],
  readingOrderSteps: [
    "เริ่มจากดิถีและ ribbon พื้นดวงก่อน",
    "ล็อกกำลังดิถีให้ชัดก่อน ว่าดิถีแข็ง อ่อน หรือสมดุล",
  ],
} satisfies BaseChartReadingValue;

describe("buildReactionChamberDoctrineModel", () => {
  test("prefers schoolSections and carries strength gate into doctrine model", () => {
    const doctrine = buildReactionChamberDoctrineModel({
      dayMaster: "己",
      reading,
      hiddenSecondaryCount: 2,
    });

    expect(doctrine.title).toBe("ลำดับอ่านปฏิกิริยาของดวงนี้");
    expect(doctrine.subtitle).toBe("ดิถี 己");
    expect(doctrine.strengthGate?.title).toBe("กำลังดิถี");
    expect(doctrine.lanes.map((lane) => lane.key)).toEqual([
      "strength-gate",
      "roles",
      "markers",
    ]);
    expect(doctrine.lanes[1]).toMatchObject({
      title: "จับซิ้ง / บทบาทต่อดิถี",
      badgeCount: 1,
      previewLabels: ["เจี้ยไช้"],
    });
    expect(doctrine.lanes[2]?.description).toContain("2 รายการ");
    expect(doctrine.evidenceSummary).toContain("2 รายการ");
  });

  test("falls back to legacy groups when schoolSections are absent", () => {
    const doctrine = buildReactionChamberDoctrineModel({
      dayMaster: "甲",
      reading: {
        ...reading,
        schoolSections: [],
        strengthGate: undefined,
      },
    });

    expect(doctrine.lanes).toHaveLength(1);
    expect(doctrine.lanes[0]).toMatchObject({
      key: "roles",
      title: "บทบาทต่อดิถี",
      readingOrder: 1,
    });
  });
});
