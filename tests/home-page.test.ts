import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => "User menu",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import {
  BaziTrainerWorkspace,
  createDefaultFormState,
  getResetActionCopy,
  shouldConfirmSessionReset,
} from "@/app/page";
import { resetAnnotationStore } from "@/lib/bazi/annotation-store";
import { CalculatedStateSchema } from "@/lib/bazi/schema-types";
import { TRACE_STEP_KEYS } from "@/lib/bazi/trace-keys";

describe("BaziTrainerWorkspace", () => {
  beforeEach(() => {
    resetAnnotationStore();
  });

  test("renders the branding and calm empty state before calculation", () => {
    const html = renderToStaticMarkup(createElement(BaziTrainerWorkspace));

    expect(html).toContain("Bazi Trainer that makes ซินแส ซินแส !");
    expect(html).toContain("Secure Operator Access");
    expect(html).toContain("User menu");
    expect(html).toContain("คิวตรวจงาน AI");
    expect(html).toContain("พยากรณ์เอง");
    expect(html).toContain("workspace mode switch");
    expect(html).not.toContain("เลือกโหมดการทำงาน");
    expect(html).not.toContain("เริ่มจาก manual add หรือ proof queue ได้ทันที");
    expect(html).toContain("ตั้งข้อมูลเพื่อเปิด 3 โซนของรายงานให้ครบ");
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
    expect(shouldConfirmSessionReset("record-1", "rejected")).toBe(false);
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
      detail: "งานชุดนี้ถูกปิดแล้ว หากต้องการอ่านดวงใหม่ให้เริ่มรอบใหม่จากปุ่มนี้",
      tone: "primary",
    });

    expect(getResetActionCopy("rejected")).toEqual({
      label: "ผูกดวงใหม่",
      detail: "งานชุดนี้ถูกปิดแล้ว หากต้องการอ่านดวงใหม่ให้เริ่มรอบใหม่จากปุ่มนี้",
      tone: "primary",
    });
  });

  test("renders calculated chart data in the engine column", () => {
    const initialCalculatedState = CalculatedStateSchema.parse({
      fourPillars: {
        year: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
        month: { stem: "戊", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
        day: { stem: "己", branch: "巳", hiddenStems: ["丙", "庚", "戊"] },
        hour: { stem: "辛", branch: "未", hiddenStems: ["己", "丁", "乙"] },
      },
      mingGong: { stem: "壬", branch: "寅", hiddenStems: ["甲", "丙", "戊"] },
      daYun: [
        {
          startAge: 6,
          endAge: 15,
          stem: "丁",
          branch: "未",
          upperPhase: { startAge: 6, endAge: 10, symbol: "丁", source: "stem" },
          lowerPhase: { startAge: 11, endAge: 15, symbol: "未", source: "branch" },
        },
        {
          startAge: 16,
          endAge: 25,
          stem: "丙",
          branch: "午",
          upperPhase: { startAge: 16, endAge: 20, symbol: "丙", source: "stem" },
          lowerPhase: { startAge: 21, endAge: 25, symbol: "午", source: "branch" },
        },
        {
          startAge: 26,
          endAge: 35,
          stem: "乙",
          branch: "巳",
          isCurrent: true,
          currentPhase: "lower",
          upperPhase: { startAge: 26, endAge: 30, symbol: "乙", source: "stem" },
          lowerPhase: {
            startAge: 31,
            endAge: 35,
            symbol: "巳",
            source: "branch",
            isCurrent: true,
          },
        },
      ],
      liuNian: { stem: "丙", branch: "午", hiddenStems: ["丁", "己"] },
      shenSha: [
        {
          starName: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
          relatedPillar: "ปี",
          meaning: "มีผู้ใหญ่หรือกุ้ยนั้งเข้ามาช่วยยามสำคัญ",
        },
        {
          starName: "ดอกท้อ (桃花)",
          relatedPillar: "ปีจร",
          meaning: "ปีนี้แรงดึงดูดและเรื่องสัมพันธ์เด่นกว่าปกติ",
        },
      ],
      dayMaster: "己",
      strengthScore: 3.07,
      tenGods: {
        yearStem: "正财",
        yearBranch: "伤官,正财,劫财",
        monthStem: "劫财",
        monthBranch: "伤官,正财,劫财",
        dayStem: "比肩",
        dayBranch: "正印,伤官,劫财",
        hourStem: "食神",
        hourBranch: "比肩,偏印,七杀",
      },
      twelveQi: {
        yearBranch: "沐浴",
        monthBranch: "沐浴",
        dayBranch: "帝旺",
        hourBranch: "冠带",
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
      elementAnalysis: {
        visibleCounts: {
          wood: 0,
          fire: 0,
          earth: 2,
          metal: 1,
          water: 1,
        },
        hiddenCounts: {
          wood: 1,
          fire: 2,
          earth: 2,
          metal: 3,
          water: 2,
        },
        totalCounts: {
          wood: 1,
          fire: 2,
          earth: 4,
          metal: 4,
          water: 3,
        },
        missingElements: [],
        dominantElements: ["earth", "metal"],
        elementStrengths: [
          { element: "wood", rooted: false, seasonalSupport: "seasonal-drained", strength: "weak" },
          { element: "fire", rooted: true, seasonalSupport: "seasonal-drained", strength: "balanced" },
          { element: "earth", rooted: true, seasonalSupport: "seasonal-support", strength: "strong" },
          { element: "metal", rooted: true, seasonalSupport: "seasonal-peak", strength: "strong" },
          { element: "water", rooted: true, seasonalSupport: "seasonal-support", strength: "balanced" },
        ],
      },
      seasonalInteraction: {
        dayMasterStem: "己",
        dayMasterElement: "earth",
        monthBranch: "申",
        season: "autumn",
        phase: "early",
        seasonLabel: "ต้นฤดูใบไม้ร่วง",
        metaphor: "ดินเพาะปลูกในต้นฤดูใบไม้ร่วง",
      },
      sixtyJiaziCorePersona: {
        code: "己巳",
        narrative: "Builds influence patiently, then turns preparation into visible results when timing opens.",
        elementTone: "fire",
        twelveQiLabel: "帝旺",
        semanticNotes: [
          "โทนธาตุของ 60 กะจื่อวันนี้คือ fire",
          "ชั้น 12 เชี่ยงแซของกะจื่อวันอยู่ที่ 帝旺",
        ],
        precedenceNotes: ["Near solar-term boundary."],
        precedenceNoteSignals: [
          {
            key: "SOLAR_TERM_BOUNDARY_NEAR",
            params: {
              hours: "1.50",
              solarTermName: "立秋",
              boundaryAt: "1992-08-21T15:00:00",
            },
          },
        ],
      },
      explainable: {
        mingGong: {
          value: { stem: "壬", branch: "寅", hiddenStems: ["甲", "丙", "戊"] },
          trace: {
            engine: "orthodox-override",
            ruleName: "MingGong_ZhongQi_Adjustment",
            stepKeys: [
              TRACE_STEP_KEYS.mingGong.readBranches,
              TRACE_STEP_KEYS.mingGong.resolveBoundary,
              TRACE_STEP_KEYS.mingGong.finalize,
            ],
            rawVariables: {
              monthBranch: "申",
              adjustedMonthBranch: "申",
              timeBranch: "未",
              zhongQiName: "处暑",
              isPastZhongQi: false,
              monthZhiIndex: 7,
              timeZhiIndex: 8,
              result: "壬寅",
            },
          },
        },
        strengthScore: {
          value: 3.07,
          trace: {
            engine: "orthodox-override",
            ruleName: "StrengthScore_WeightedSeasonalSupport",
            stepKeys: [
              TRACE_STEP_KEYS.strengthScore.weightStages,
              TRACE_STEP_KEYS.strengthScore.addRelations,
              TRACE_STEP_KEYS.strengthScore.applyPenalties,
            ],
            rawVariables: {
              dayMasterStem: "己",
              monthBranchSeasonalFactor: 1,
              stageContribution: 0.82,
              visibleContributions: [
                { label: "monthStem", stem: "戊", hidden: false, weight: 0.75 },
                { label: "hourStem", stem: "辛", hidden: false, weight: 0.4 },
              ],
              hiddenContributions: [
                { label: "dayHiddenStem1", stem: "丙", hidden: true, weight: 0.3 },
                { label: "hourHiddenStem2", stem: "丁", hidden: true, weight: 0.2 },
              ],
              penalties: {
                clashes: 0.2,
                punishments: 0,
                harms: 0,
                destructions: 0,
              },
              result: 3.07,
            },
          },
        },
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
    expect(html).toContain("Static Destiny");
    expect(html).toContain("Dynamic Luck");
    expect(html).toContain("Deep Analysis");
    expect(html).toContain("Ming Gong");
    expect(html).toContain("ตัวอย่างรายงาน (Print DNA)");
    expect(html).toContain("ดูวิธีคำนวณลัคนา");
    expect(html).toContain("ดูวิธีคำนวณคะแนนพลัง");
    expect(html).toContain("แกนบุคลิกพื้นฐาน");
    expect(html).toContain('data-core-persona="available"');
    expect(html).toContain('data-seasonal-metaphor="available"');
    expect(html).toContain('data-element-analysis="available"');
    expect(html).toContain("ดินเพาะปลูกในต้นฤดูใบไม้ร่วง");
    expect(html).toContain("ธาตุนำ ดิน");
    expect(html).toContain("ธาตุนำ ทอง");
    expect(html).toContain("ดุลธาตุและกำลังธาตุ");
    expect(html).toContain("กำลังเด่น");
    expect(html).toContain("มีราก");
    expect(html).toContain("ฤดูหนุนสูง");
    expect(html).toContain("โทนธาตุ fire");
    expect(html).toContain("12 เชี่ยงแซ 帝旺");
    expect(html).toContain("ควรตรวจเคสคาบเกี่ยวด้วยมืออีกครั้ง");
    expect(html).toContain("สมการคะแนนพลัง");
    expect(html).toContain("แรงจากก้านฟ้าที่มองเห็น");
    expect(html).toContain("ก้านฟ้าเดือน · 戊");
    expect(html).toContain("แรงชง");
    expect(html).toContain('data-strength-breakdown="available"');
    expect(html).toContain("สมุดวิเคราะห์ 15 มิติ");
    expect(html).toContain("เกิดวันที่ 21 สิงหาคม พ.ศ.2535 เวลา 14.35 น.");
    expect(html).toContain("พูดด้วยเสียง");
    expect(html).toContain("Complete Annotation");
    expect(html).not.toContain("Accept Annotation");
    expect(html).toContain("ล้างข้อมูลเพื่อผูกดวงใหม่");
    expect(html).toContain("Asia/Bangkok");
    expect(html).not.toContain("Asia/Hong_Kong");
    expect(html).toContain("己");
    expect(html).toContain("壬寅");
    expect(html).toContain("ปีจรปัจจุบัน");
    expect(html).toContain("วัยจร 10 ปี");
    expect(html).toContain('data-current-luck-symbol="巳"');
    expect(html).toContain("ช่วงอายุ 31-35 · ราศีล่าง");
    expect(html).toContain("รอบวัยจร 26-35 · 乙巳");
    expect(html).toContain('data-dayun-direction="rtl"');
    expect(html).toContain("26-30");
    expect(html).toContain("31-35");
    expect(html).toContain("ขุนนาง/อุปถัมภ์ (天乙贵人)");
    expect(html).toContain("3.07");
    expect(html).toContain("fertile cultivated soil that nurtures, absorbs, and organizes");
    expect(html).toContain(
      "Builds influence patiently, then turns preparation into visible results when timing opens.",
    );

    expect(html.indexOf("16-20")).toBeLessThan(html.indexOf("6-10"));
  });

  test("restores the queue workspace when the URL asks for workspace=queue", () => {
    const html = renderToStaticMarkup(createElement(BaziTrainerWorkspace, { initialWorkspace: "queue" }));

    expect(html).toContain("พร้อมตรวจงาน AI");
    expect(html).toContain("กำลังโหลด draft queue จากฐานข้อมูล");
    expect(html).not.toContain("ตั้งข้อมูลเพื่อเปิด 3 โซนของรายงานให้ครบ");
  });
});
