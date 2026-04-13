import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test } from "vitest";

import { BaziTrainerWorkspace, createDefaultFormState } from "@/app/page";
import { resetAnnotationStore } from "@/lib/bazi/annotation-store";
import { CalculatedStateSchema } from "@/lib/bazi/schema-types";

describe("BaziTrainerWorkspace", () => {
  beforeEach(() => {
    resetAnnotationStore();
  });

  test("renders the branding and calm empty state before calculation", () => {
    const html = renderToStaticMarkup(createElement(BaziTrainerWorkspace));

    expect(html).toContain("Bazi Trainer that makes ซินแส ซินแส !");
    expect(html).toContain("ตั้งข้อมูลเพื่อดูภาพรวมดวง");
    expect(html).toContain("คำนวณภาพรวมดวง");
  });

  test("renders calculated chart data in the engine column", () => {
    const initialCalculatedState = CalculatedStateSchema.parse({
      fourPillars: {
        year: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
        month: { stem: "戊", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
        day: { stem: "己", branch: "巳", hiddenStems: ["丙", "庚", "戊"] },
        hour: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
      },
      dayMaster: "己",
      strengthScore: 3.07,
      tenGods: {
        yearStem: "正财",
        yearBranch: "伤官,正财,劫财",
        monthStem: "劫财",
        monthBranch: "伤官,正财,劫财",
        dayStem: "比肩",
        dayBranch: "正印,伤官,劫财",
        hourStem: "正财",
        hourBranch: "伤官,正财,劫财",
      },
      twelveQi: {
        yearBranch: "沐浴",
        monthBranch: "沐浴",
        dayBranch: "帝旺",
        hourBranch: "沐浴",
      },
      elementMetaphors: [
        {
          element: "earth",
          metaphor: "fertile cultivated soil that nurtures, absorbs, and organizes",
        },
        {
          element: "fire",
          metaphor: "fire that bakes the soil into useful ground",
        },
      ],
      sixtyJiaziCorePersona: {
        code: "己巳",
        narrative: "Builds influence patiently, then turns preparation into visible results when timing opens.",
        precedenceNotes: ["Near solar-term boundary."],
      },
    });

    const html = renderToStaticMarkup(
      createElement(BaziTrainerWorkspace, {
        initialFormState: createDefaultFormState(),
        initialSubmittedInput: {
          birthDate: "1992-08-21",
          birthTime: "14:35",
          gender: "female",
          province: "Bangkok",
          calendarSystem: "solar",
          timezone: "Asia/Hong_Kong",
        },
        initialCalculatedState,
        initialSubmissionState: "ready",
      }),
    );

    expect(html).toContain("ภาพรวมพร้อมอ่าน");
    expect(html).toContain("Four Pillars");
    expect(html).toContain("สมุดวิเคราะห์ 15 มิติ");
    expect(html).toContain("ฐานดวงเดิม และภาพรวม");
    expect(html).toContain("己");
    expect(html).toContain("3.07");
    expect(html).toContain("fertile cultivated soil that nurtures, absorbs, and organizes");
    expect(html).toContain(
      "Builds influence patiently, then turns preparation into visible results when timing opens.",
    );
  });
});