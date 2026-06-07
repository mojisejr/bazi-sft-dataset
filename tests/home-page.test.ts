import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => "User menu",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import {
  default as HomePage,
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
    expect(html).toContain("สิทธิ์เข้าถึงระบบ");
    expect(html).toContain("User menu");
    expect(html).toContain("คิวตรวจงาน AI");
    expect(html).toContain("พยากรณ์เอง");
    expect(html).toContain("workspace mode switch");
    expect(html).not.toContain("เลือกโหมดการทำงาน");
    expect(html).not.toContain("เริ่มจาก manual add หรือ proof queue ได้ทันที");
    expect(html).toContain("ตั้งข้อมูลเพื่อเปิดแกนดวงและจังหวะการเดินของเคสนี้");
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

  test("HomePage defaults the root route to the manual app surface", async () => {
    const page = await HomePage({});
    const html = renderToStaticMarkup(page);

    expect(html).toContain("พยากรณ์เอง");
    expect(html).toContain("ตั้งข้อมูลเพื่อเปิดแกนดวงและจังหวะการเดินของเคสนี้");
    expect(html).not.toContain("กำลังโหลด draft queue จากฐานข้อมูล");
  });

  test("HomePage switches the root route to queue mode only when searchParams asks for it", async () => {
    const page = await HomePage({
      searchParams: Promise.resolve({ workspace: "queue" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("พร้อมตรวจงาน AI");
    expect(html).toContain("กำลังโหลด draft queue จากฐานข้อมูล");
    expect(html).not.toContain("ตั้งข้อมูลเพื่อเปิดแกนดวงและจังหวะการเดินของเคสนี้");
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
        year: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"], tenGod: "正财", stemTranslation: "น้ำ", branchTranslation: "วอก", sittingStage: "ลิ่มกัว", lookingStage: "หมกยก", upperStageDisplay: "เชี่ยงแซ/ลิ่มกัว", lowerStageDisplay: "หมกยก/ลิ่มกัว" },
        month: { stem: "戊", branch: "申", hiddenStems: ["庚", "壬", "戊"], tenGod: "劫财", stemTranslation: "ดิน", branchTranslation: "วอก", sittingStage: "แป่", lookingStage: "หมกยก", upperStageDisplay: "เจ๊าะ/แป่", lowerStageDisplay: "หมกยก/แป่" },
        day: { stem: "己", branch: "巳", hiddenStems: ["丙", "庚", "戊"], tenGod: "ดิถี", stemTranslation: "ดิน", branchTranslation: "มะเส็ง", sittingStage: "ตี้อ๋วง", lookingStage: "ตี้อ๋วง", lowerStageDisplay: "ตี้อ๋วง/ตี้อ๋วง" },
        hour: { stem: "辛", branch: "未", hiddenStems: ["己", "丁", "乙"], tenGod: "食神", stemTranslation: "ทอง", branchTranslation: "มะแม", sittingStage: "เอี้ยง", lookingStage: "กวงตั่ว", upperStageDisplay: "เจ๊าะ/เอี้ยง", lowerStageDisplay: "กวงตั่ว/เอี้ยง" },
      },
      ageSnapshot: {
        referenceDate: "2026-06-15",
        thaiAge: 33,
        chineseAge: 34,
      },
      mingGong: { stem: "壬", branch: "寅", hiddenStems: ["甲", "丙", "戊"], tenGod: "正财", stemTranslation: "น้ำ", branchTranslation: "ขาล", sittingStage: "ลิ่มกัว", lookingStage: "หมกยก" },
      daYun: [
        {
          startAge: 4,
          endAge: 13,
          stem: "丁",
          branch: "未",
          upperStageDisplay: "กวงตั่ว",
          lowerStageDisplay: "เอี้ยง",
          upperPhase: { startAge: 4, endAge: 8, symbol: "丁", source: "stem", twelveQiDisplay: "กวงตั่ว" },
          lowerPhase: { startAge: 9, endAge: 13, symbol: "未", source: "branch", twelveQiDisplay: "เอี้ยง" },
        },
        {
          startAge: 14,
          endAge: 23,
          stem: "丙",
          branch: "午",
          upperStageDisplay: "เจี๋ยง",
          lowerStageDisplay: "ลิ้ม官",
          upperPhase: { startAge: 14, endAge: 18, symbol: "丙", source: "stem", twelveQiDisplay: "เจี๋ยง" },
          lowerPhase: { startAge: 19, endAge: 23, symbol: "午", source: "branch", twelveQiDisplay: "ลิ้ม官" },
        },
        {
          startAge: 24,
          endAge: 33,
          stem: "乙",
          branch: "巳",
          isCurrent: true,
          currentPhase: "lower",
          upperStageDisplay: "เชี่ยงแซ",
          lowerStageDisplay: "ตี้อ๋วง",
          upperPhase: { startAge: 24, endAge: 28, symbol: "乙", source: "stem", twelveQiDisplay: "เชี่ยงแซ" },
          lowerPhase: {
            startAge: 29,
            endAge: 33,
            symbol: "巳",
            source: "branch",
            twelveQiDisplay: "ตี้อ๋วง",
            isCurrent: true,
          },
        },
      ],
      liuNian: {
        stem: "丙",
        branch: "午",
        hiddenStems: ["丁", "己"],
        upperStageDisplay: "เจี๋ยง",
        lowerStageDisplay: "ลิ่มกัว",
      },
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
        yearBranch: "หมกยก",
        monthBranch: "หมกยก",
        dayBranch: "ตี้อ๋วง",
        hourBranch: "กวงตั่ว",
        mingGongBranch: "หมกยก",
        currentDaYunBranch: "ตี้อ๋วง",
        currentLiuNianBranch: "ลิ่มกัว",
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
      dayMasterStrengthProfile: {
        dayMaster: "己",
        strengthState: "อ่อนแอ",
        sourceState: "อ่อนแอ",
        lookupState: "อ่อนแอ",
        displayBand: "ดวงอ่อน",
        displayLabel: "ดิถีอ่อน",
        narrative: "ดิถีดินหยินกำลังอ่อน ต้องอาศัยแรงหนุนและจังหวะที่ค่อยเป็นค่อยไปจึงจะออกผลดี",
        qiLabel: "帝旺",
        scoreText: "3.07",
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
      baseChartReading: {
        roleBadges: [
          {
            id: "year-stem-role",
            family: "role",
            label: "ปีบน · เจี้ยไช้",
            shortLabel: "เจี้ยไช้",
            priority: "secondary",
            status: "active",
            meaningShort: "ลาภที่เป็นระบบ การเงิน ทรัพย์ และผลประโยชน์ที่ต้องรักษา",
            schoolLabel: "เจี้ยไช้",
            participants: [
              {
                pillarKey: "year",
                pillarLabel: "ปี",
                type: "stem",
                symbol: "壬",
                translation: "น้ำ",
              },
            ],
            modal: {
              title: "ปีบน · เจี้ยไช้",
              family: "role",
              summary: "ราศีบนของปีทำหน้าที่แบบเจี้ยไช้เมื่อเทียบกับดิถี",
              explanation: "ใช้เพื่ออ่านบทบาทของราศีบนเทียบกับดิถี",
              readingOrderHint: "อ่านหลัง ribbon",
              details: [
                { label: "ราศีบน", value: "壬" },
              ],
            },
          },
        ],
        stemInteractionBadges: [],
        branchInteractionBadges: [
          {
            id: "branch-combination-month-year",
            family: "interaction",
            label: "ภาคี 申巳",
            shortLabel: "申巳",
            priority: "primary",
            status: "active",
            meaningShort: "คู่ที่ดึงเข้าหากันและเปลี่ยนแรงของพื้นดวง",
            schoolLabel: "ภาคี",
            participants: [
              {
                pillarKey: "month",
                pillarLabel: "เดือน",
                type: "branch",
                symbol: "申",
                translation: "วอก",
              },
              {
                pillarKey: "day",
                pillarLabel: "วัน",
                type: "branch",
                symbol: "巳",
                translation: "มะเส็ง",
              },
            ],
            modal: {
              title: "ภาคี 申巳",
              family: "interaction",
              summary: "เดือนกับวันเกิดภาคีกัน",
              explanation: "คู่ภาคีนี้เป็นแรงหลักของราศีล่าง",
              readingOrderHint: "อ่านหลังบทบาทต่อดิถี",
              details: [
                { label: "คู่", value: "申 ↔ 巳" },
              ],
            },
          },
        ],
        markerBadges: [
          {
            id: "marker-nobleman",
            family: "marker",
            label: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
            shortLabel: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
            priority: "secondary",
            status: "active",
            meaningShort: "มีผู้ใหญ่เข้ามาช่วยเมื่อจังหวะเปิด",
            schoolLabel: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
            participants: [
              {
                pillarLabel: "ปี",
                type: "marker",
                symbol: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
              },
            ],
            modal: {
              title: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
              family: "marker",
              summary: "marker นี้อยู่ที่ปี",
              explanation: "มีผู้ใหญ่เข้ามาช่วยเมื่อจังหวะเปิด",
              readingOrderHint: "อ่านท้ายสุด",
              details: [
                { label: "ฐาน", value: "ปี" },
              ],
            },
          },
        ],
        groups: [
          {
            key: "roles",
            title: "บทบาทต่อดิถี",
            description: "อ่านว่าแต่ละตัวทำหน้าที่แบบไหนเมื่อเทียบกับดิถี",
            family: "role",
            badges: [
              {
                id: "year-stem-role-group",
                family: "role",
                label: "ปีบน · เจี้ยไช้",
                shortLabel: "เจี้ยไช้",
                priority: "secondary",
                status: "active",
                meaningShort: "ลาภที่เป็นระบบ การเงิน ทรัพย์ และผลประโยชน์ที่ต้องรักษา",
                schoolLabel: "เจี้ยไช้",
                participants: [
                  {
                    pillarKey: "year",
                    pillarLabel: "ปี",
                    type: "stem",
                    symbol: "壬",
                    translation: "น้ำ",
                  },
                ],
                modal: {
                  title: "ปีบน · เจี้ยไช้",
                  family: "role",
                  summary: "ราศีบนของปีทำหน้าที่แบบเจี้ยไช้เมื่อเทียบกับดิถี",
                  explanation: "ใช้เพื่ออ่านบทบาทของราศีบนเทียบกับดิถี",
                  readingOrderHint: "อ่านหลัง ribbon",
                  details: [
                    { label: "ราศีบน", value: "壬" },
                  ],
                },
              },
            ],
          },
          {
            key: "branch-interactions",
            title: "ดิน-ดิน interactions",
            description: "ภาคี ชง ไห่ ผั่ว และเฮ้งของราศีล่างในดวงกำเนิด",
            family: "interaction",
            badges: [
              {
                id: "branch-combination-month-year-group",
                family: "interaction",
                label: "ภาคี 申巳",
                shortLabel: "申巳",
                priority: "primary",
                status: "active",
                meaningShort: "คู่ที่ดึงเข้าหากันและเปลี่ยนแรงของพื้นดวง",
                schoolLabel: "ภาคี",
                participants: [
                  {
                    pillarKey: "month",
                    pillarLabel: "เดือน",
                    type: "branch",
                    symbol: "申",
                    translation: "วอก",
                  },
                ],
                modal: {
                  title: "ภาคี 申巳",
                  family: "interaction",
                  summary: "เดือนกับวันเกิดภาคีกัน",
                  explanation: "คู่ภาคีนี้เป็นแรงหลักของราศีล่าง",
                  readingOrderHint: "อ่านหลังบทบาทต่อดิถี",
                  details: [
                    { label: "คู่", value: "申 ↔ 巳" },
                  ],
                },
              },
            ],
          },
          {
            key: "markers",
            title: "ตัวประกอบพิเศษ",
            description: "กุ้ยนั้งและ marker เสริม",
            family: "marker",
            badges: [
              {
                id: "marker-nobleman-group",
                family: "marker",
                label: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
                shortLabel: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
                priority: "secondary",
                status: "active",
                meaningShort: "มีผู้ใหญ่เข้ามาช่วยเมื่อจังหวะเปิด",
                schoolLabel: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
                participants: [
                  {
                    pillarLabel: "ปี",
                    type: "marker",
                    symbol: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
                  },
                ],
                modal: {
                  title: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
                  family: "marker",
                  summary: "marker นี้อยู่ที่ปี",
                  explanation: "มีผู้ใหญ่เข้ามาช่วยเมื่อจังหวะเปิด",
                  readingOrderHint: "อ่านท้ายสุด",
                  details: [
                    { label: "ฐาน", value: "ปี" },
                  ],
                },
              },
            ],
          },
        ],
        legendItems: [
          { label: "role", value: "บทบาทต่อดิถี" },
          { label: "interaction", value: "แรงที่กระทบกันในดวง" },
        ],
        readingOrderSteps: [
          "เริ่มจากดิถีและ ribbon พื้นดวงก่อน",
          "อ่านบทบาทต่อดิถีของตัวสำคัญ",
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
              visibleContributions: [
                { label: "monthStem", symbol: "戊", weight: 1.25 },
                { label: "hourStem", symbol: "辛", weight: 1 },
              ],
              qiAdjustments: [
                { label: "yearZone", symbol: "沐浴", weight: -0.18 },
              ],
              relationAdjustments: [],
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

    expect(html).toContain("พร้อมอ่านดวง");
    expect(html).toContain('data-case-rail="true"');
    expect(html).toContain("อ่านจากพื้นดวงก่อน แล้วค่อยไล่กำลังดิถี วัยจร และแกนบุคลิก");
    expect(html).toContain("ดูวิธีคำนวณ");
    expect(html).toContain("พื้นดวง");
    expect(html).toContain("เริ่มจากโครงดวงก่อน แล้วค่อยเปิดข้อมูลรองตามลำดับ");
    expect(html).toContain("壬 (น้ำ)");
    expect(html).toContain("寅 (ขาล)");
    expect(html).toContain("ตี้อ๋วง");
    expect(html).toContain("ลิ่มกัว");
    expect(html).toContain('data-day-master-column="true"');
    expect(html).toContain("pillar-day-master-tag");
    expect(html).not.toContain("วัน เชี่ยงแซกลาง");
    expect(html).toContain("เดือน เชี่ยงแซกลาง");
    expect(html).toContain("ปี เชี่ยงแซกลาง");
    expect(html).toContain("เชี่ยงแซ/ลิ่มกัว");
    expect(html).toContain("ตี้อ๋วง/ตี้อ๋วง");
    expect(html).not.toContain("正财");
    expect(html).not.toContain("劫财");
    expect(html).not.toContain("食神");
    expect(html).toContain("เปิดแผนภาพปฏิกิริยา");
    expect(html).toContain("pillar-ribbon-section__cta");
    expect(html).not.toContain("zone พื้นดวง");
    expect(html).not.toContain("จับซิ้ง ปฏิกิริยา และตัวประกอบพิเศษของดวงกำเนิดอยู่ในชั้นเดียว");
    expect(html).not.toContain("ปีบน · เจี้ยไช้");
    expect(html).not.toContain("ภาคี 申巳");
    expect(html).toContain("วัยจร");
    expect(html).toContain("ดูช่วงที่กำลังเดิน ก้าวปัจจุบัน และปีจรบนถนนชีวิตเดียว");
    expect(html).toContain("ช่วงที่กำลังเดิน");
    expect(html).toContain("เปิดถนนชีวิต");
    expect(html).toContain("อายุไทย 33 · อายุจีน 34 (อ้างอิง 2026-06-15)");
    expect(html).toContain("พิมพ์รายงาน");
    expect(html).not.toContain("ดูวิธีคำนวณคะแนนพลัง");
    expect(html).toContain("แกนบุคลิกพื้นฐาน");
    expect(html).toContain('data-core-persona="available"');
    expect(html).toContain('data-core-persona-detail-open="false"');
    expect(html).toContain("นิสัยพื้นฐาน 1.1");
    expect(html).toContain("ดิถีอ่อน");
    expect(html).toContain("ดิถีดินหยินกำลังอ่อน ต้องอาศัยแรงหนุนและจังหวะที่ค่อยเป็นค่อยไปจึงจะออกผลดี");
    expect(html).toContain("นิสัยวันเกิด 1.2");
    expect(html).toContain("หลักฐาน 12 เชี่ยงแซ 1.3");
    expect(html).toContain("ดิถี vs เดือน");
    expect(html).toContain("ดิถี vs วัยจร");
    expect(html).toContain("ธาตุนำ ดิน");
    expect(html).toContain("ธาตุนำ ทอง");
    expect(html).toContain("โทนธาตุ fire");
    expect(html).toContain("12 เชี่ยงแซ 帝旺");
    expect(html).toContain("เปิดบริบทธาตุ");
    expect(html).not.toContain("ดุลธาตุและกำลังธาตุ");
    expect(html).not.toContain("ควรตรวจเคสคาบเกี่ยวด้วยมืออีกครั้ง");
    expect(html).toContain("แผนผังกำลังดิถี");
    expect(html.indexOf("แผนผังกำลังดิถี")).toBeLessThan(html.indexOf("เปิดถนนชีวิต"));
    expect(html).toContain('data-strength-breakdown="available"');
    expect(html).toContain("strength-breakdown--compact");
    expect(html).toContain('data-strength-detail-open="false"');
    expect(html).toContain("เปิดรายละเอียดกำลังดิถี");
    expect(html).not.toContain("แรงที่หนุนดิถี");
    expect(html).not.toContain("คะแนนตั้งต้นของระบบ");
    expect(html).not.toContain('aria-label="Da Yun track"');
    expect(html).not.toContain("ข้อมูลอ้างอิงเพิ่มเติม");
    expect(html).not.toContain("ดูความสัมพันธ์ของดิถีกับเสาหลัก วัยจร และปีจรในบล็อกเดียว");
    expect(html).not.toContain("แกะจังหวะดิถีกับเสาหลัก วัยจร และปีจรในมุมเดียว");
    expect(html).not.toContain('aria-label="twelve qi interactions"');
    expect(html).toContain("dynamic-luck-badge-list");
    expect(html).toContain("dynamic-luck-badge--value-only");
    expect(html).toContain("เชี่ยงแซ");
    expect(html).toContain("ตี้อ๋วง");
    expect(html).toContain("เจี๋ยง");
    expect(html).not.toContain('<div class="dynamic-luck-badge-list" aria-label="รอบหลัก 12 เชี่ยงแซ"><article class="dynamic-luck-badge"><span class="dynamic-luck-badge__label">ราศีบน</span>');
    expect(html).not.toContain("ความสัมพันธ์ที่ต้องใช้ตีความต่อ");
    expect(html).toContain("เกิดวันที่ 21 สิงหาคม พ.ศ.2535 เวลา 14.35 น.");
    expect(html).not.toContain("พูดด้วยเสียง");
    expect(html).not.toContain("เริ่มเขียนคำพยากรณ์");
    expect(html).not.toContain("เมื่ออ่านภาพรวมด้านบนจบแล้ว ค่อยเข้าสู่ 15 มิติ");
    expect(html).not.toContain("ปิดงานคำพยากรณ์");
    expect(html).not.toContain("Accept Annotation");
    expect(html).toContain("ล้างข้อมูลเพื่อผูกดวงใหม่");
    expect(html).not.toContain("Asia/Hong_Kong");
    expect(html).not.toContain("Asia/Bangkok");
    expect(html).toContain("己");
    expect(html).toContain("壬 (น้ำ)");
    expect(html).toContain("寅 (ขาล)");
    expect(html).not.toContain('class="pillar-ribbon-card__code"');
    expect(html).toContain("ปีจร");
    expect(html).not.toContain("วัยจร 10 ปี");
    expect(html).toContain('data-current-luck-symbol="巳"');
    expect(html).toContain('data-luck-timeline-open="false"');
    expect(html).toContain("ก้าวปัจจุบัน 29-33 · ราศีล่าง");
    expect(html).toContain("รอบวัยจร 24-33 · 乙巳");
    expect(html).not.toContain('data-dayun-direction="rtl"');
    expect(html).not.toContain("16-20");
    expect(html).not.toContain("6-10");
    expect(html).toContain("3.07");
    expect(html).toContain("หญิง");
    expect(html).not.toContain("fertile cultivated soil that nurtures, absorbs, and organizes");
    expect(html).toContain(
      "Builds influence patiently, then turns preparation into visible results when timing opens.",
    );
    expect(html).not.toContain("ตัวอย่างรายงาน (Print DNA)");
    expect(html).not.toContain("Static Destiny");
    expect(html).not.toContain("Dynamic Luck");
    expect(html).not.toContain("Deep Analysis");
    expect(html).not.toContain("Complete Annotation");

    expect(html).not.toContain("จังหวะที่กำลังเดิน");
    expect(html).toContain("แกนบุคลิกพื้นฐาน");
  });

  test("restores the queue workspace when the URL asks for workspace=queue", () => {
    const html = renderToStaticMarkup(createElement(BaziTrainerWorkspace, { initialWorkspace: "queue" }));

    expect(html).toContain("พร้อมตรวจงาน AI");
    expect(html).toContain("กำลังโหลด draft queue จากฐานข้อมูล");
    expect(html).not.toContain("ตั้งข้อมูลเพื่อเปิด 3 โซนของรายงานให้ครบ");
  });
});
