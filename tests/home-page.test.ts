import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => "User menu",
}));

import {
  BaziTrainerWorkspace,
  createDefaultFormState,
  getResetActionCopy,
  shouldConfirmSessionReset,
} from "@/app/page";
import { resetAnnotationStore } from "@/lib/bazi/annotation-store";
import { CalculatedStateSchema } from "@/lib/bazi/schema-types";

describe("BaziTrainerWorkspace", () => {
  beforeEach(() => {
    resetAnnotationStore();
  });

  test("renders the branding and calm empty state before calculation", () => {
    const html = renderToStaticMarkup(createElement(BaziTrainerWorkspace));

    expect(html).toContain("Bazi Trainer that makes ซินแส ซินแส !");
    expect(html).toContain("Secure Operator Access");
    expect(html).toContain("User menu");
    expect(html).toContain("ตั้งข้อมูลเพื่อดูผังดวงแบบ classic");
    expect(html).toContain("คำนวณภาพรวมดวง");
    expect(html).toContain("ปี พ.ศ.");
    expect(html).toContain("เลือกปี พ.ศ.");
    expect(html).toContain("มีนาคม");
    expect(html).toContain("thai-province-options");
    expect(html).toContain("กรุงเทพมหานคร");
    expect(html).toContain("00-23");
    expect(html).toContain("00-59");
    expect(html).not.toContain("ระบบปฏิทิน");
    expect(html).not.toContain("Asia/Hong_Kong");
  });

  test("requires confirmation only for active unfinished dataset sessions", () => {
    expect(shouldConfirmSessionReset(null, null)).toBe(false);
    expect(shouldConfirmSessionReset("record-1", "draft")).toBe(true);
    expect(shouldConfirmSessionReset("record-1", "reviewed")).toBe(false);
  });

  test("switches reset copy after annotation is reviewed", () => {
    expect(getResetActionCopy(null)).toEqual({
      label: "ล้างข้อมูลเพื่อผูกดวงใหม่",
      detail:
        "หากต้องการคำนวณดวงใหม่ ต้องรีเซ็ต session นี้ก่อน เพื่อกันข้อมูลปนกันระหว่าง record",
      tone: "secondary",
    });

    expect(getResetActionCopy("reviewed")).toEqual({
      label: "ผูกดวงใหม่",
      detail: "annotation ชุดนี้ถูกปิดแล้ว หากต้องการอ่านดวงใหม่ให้เริ่มรอบใหม่จากปุ่มนี้",
      tone: "primary",
    });
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
          timezone: "Asia/Bangkok",
        },
        initialCalculatedState,
        initialSubmissionState: "ready",
      }),
    );

    expect(html).toContain("ภาพรวมพร้อมอ่าน");
    expect(html).toContain('data-form-locked="true"');
    expect(html).toContain("classic bazi report");
    expect(html).toContain("จัดผังให้อ่านตามลำดับเดียวกับใบรายงานอ้างอิง");
    expect(html).toContain("ตัวอย่างรายงาน (Print DNA)");
    expect(html).toContain("สมุดวิเคราะห์ 15 มิติ");
    expect(html).toContain("เกิดวันที่ 21 สิงหาคม พ.ศ.2535 เวลา 14.35 น.");
    expect(html).toContain("พูดด้วยเสียง");
    expect(html).toContain("Complete Annotation");
    expect(html).not.toContain("Accept Annotation");
    expect(html).toContain("ล้างข้อมูลเพื่อผูกดวงใหม่");
    expect(html).toContain("Asia/Bangkok");
    expect(html).not.toContain("Asia/Hong_Kong");
    expect(html).toContain("己");
    expect(html).toContain("3.07");
    expect(html).toContain("fertile cultivated soil that nurtures, absorbs, and organizes");
    expect(html).toContain(
      "Builds influence patiently, then turns preparation into visible results when timing opens.",
    );
  });
});
