import { describe, expect, test } from "vitest";

import {
  buildDraftAnnotationDataFromPersonality,
  buildPersonalityFocusPayload,
  PersonalityPocResponseSchema,
  formatPersonalityPocGeneratedReport,
  formatPersonalityPocPreflightReport,
  buildPersonalityPocSystemInstruction,
  buildPersonalityPocUserPrompt,
} from "@/lib/bazi/personality-prompt-poc";
import { type RawInputValue } from "@/lib/bazi/schema-types";

const SAMPLE_SOURCE2_OVERLAY = {
  sourceId: "source-2",
  status: "ready",
  routing: {
    routeFrom: "dayMasterStrengthProfile",
    dayMaster: "己",
    strengthProfile: {
      dayMaster: "己",
      strengthState: "แข็งแรง/สมดุล",
      sourceState: "แข็งแรง/สมดุล",
      lookupState: "แข็งแรง/สมดุล",
      displayLabel: "ดิถีค่อนข้างมั่นคง",
      narrative: "ดิถีดินหยินมีแกนตัวตนชัด รับแรงกดดันได้ แต่จะดื้อเงียบเมื่อรู้สึกว่าถูกบีบมากเกินไป",
      qiLabel: "帝旺",
      scoreText: "3.25",
    },
    narrative: {
      text: "ดิถีดินหยินมีแกนตัวตนชัด รับแรงกดดันได้ แต่จะดื้อเงียบเมื่อรู้สึกว่าถูกบีบมากเกินไป",
      ownership: {
        lane: "routing",
        ownerTable: "bazi_day_master_strength_states",
        ownerField: "narrative_summary",
        status: "authored",
        note: "Routing narrative is authored in the strength-state corpus.",
      },
    },
  },
  refinement: {
    routeFrom: "sixtyJiaziCorePersona",
    dayPillarCode: "己巳",
    corePersona: {
      code: "己巳",
      narrative: "เป็นดินที่เก็บพลังและแสดงผลเมื่อจังหวะเปิด จึงดูนิ่งภายนอกแต่มีแรงขับภายในสูง",
      heavenNarrative: null,
      earthNarrative: null,
      elementTone: null,
      twelveQiLabel: "帝旺",
      semanticNotes: [],
      precedenceNotes: ["ใช้แกนดิถีเป็นตัวตั้ง ก่อนค่อยแต้มสีจาก 60 Jiazi"],
      precedenceNoteSignals: [],
    },
    dayPillarAdvice: {
      text: "เป็นดินที่เก็บพลังและแสดงผลเมื่อจังหวะเปิด จึงดูนิ่งภายนอกแต่มีแรงขับภายในสูง",
      ownership: {
        lane: "refinement",
        ownerTable: "bazi_sixty_jiazi_narratives",
        ownerField: "combined_narrative",
        status: "authored",
        note: "The combined 60 Jiazi narrative is the authored Source 2 owner.",
      },
    },
  },
  evidence: {
    twelveQi: {
      dayBranchStage: "帝旺",
      monthBranchStage: "绝",
      toneLabel: "帝旺",
      advice: {
        text: "จังหวะชี่วันค่อนข้างเร่งพลังด้านใน ทำให้ความมั่นใจจะออกมาตอนที่พร้อมแล้ว",
        ownership: {
          lane: "evidence",
          ownerTable: "typed-constant",
          ownerField: "SOURCE2_TWELVE_QI_ADVICE_POLICY",
          status: "shared-granularity",
          note: "Source 2 has no standalone authored 12 Qi advice lane.",
        },
      },
      precedenceNoteSignals: [],
    },
    supportingPackets: [
      {
        family: "role-of-element",
        sections: {
          roles: {
            provenance: "source1_contract",
            sourceFieldIds: ["seasonal-interaction"],
            value: {
              tenGods: {},
              seasonalInteraction: {
                dayMasterStem: "己",
                dayMasterElement: "earth",
                monthBranch: "子",
                season: "winter",
                phase: "peak",
                seasonLabel: "ฤดูหนาวกลางฤดู",
                metaphor: "ดินเย็นที่ต้องอาศัยไฟค่อย ๆ อุ่นก่อนจะแสดงพลังได้เต็มที่",
              },
            },
          },
          elementBalance: {
            provenance: "computed_fact_state",
            sourceFieldIds: ["element-analysis"],
            value: {
              dominantElements: ["earth"],
              missingElements: [],
              elementStrengths: [
                {
                  element: "earth",
                  rooted: true,
                  seasonalSupport: "seasonal-support",
                  strength: "strong",
                },
                {
                  element: "fire",
                  rooted: true,
                  seasonalSupport: "seasonal-drained",
                  strength: "weak",
                },
              ],
            },
          },
        },
      },
      {
        family: "twelve-qi-texture",
        sections: {
          texture: {
            provenance: "computed_fact_state",
            sourceFieldIds: ["twelve-qi"],
            value: {
              raw: {
                yearBranch: "衰",
                monthBranch: "绝",
                dayBranch: "帝旺",
                hourBranch: "衰",
                mingGongBranch: "衰",
              },
              display: {
                yearBranch: "衰",
                monthBranch: "绝",
                dayBranch: "帝旺",
                hourBranch: "衰",
                mingGongBranch: "衰",
              },
            },
          },
        },
      },
    ],
  },
} as const;

const SAMPLE_RAW_INPUT: RawInputValue = {
  birthDate: "1989-01-03",
  birthTime: "08:45",
  gender: "male",
  province: "Bangkok",
  calendarSystem: "solar",
  timezone: "Asia/Bangkok",
};

describe("personality prompt poc helpers", () => {
  test("builds a focused payload without interaction noise", () => {
    const payload = buildPersonalityFocusPayload(SAMPLE_SOURCE2_OVERLAY);

    expect(Object.keys(payload)).toEqual([
      "source2Overlay",
      "dayMasterStrengthProfile",
      "sixtyJiaziCorePersona",
      "evidence",
      "supportingPackets",
    ]);
    expect(payload.dayMasterStrengthProfile?.displayLabel).toBe("ดิถีค่อนข้างมั่นคง");
    expect("interactionState" in payload).toBe(false);
  });

  test("wraps the personality response into a schema-valid draft payload", () => {
    const annotationData = buildDraftAnnotationDataFromPersonality({
        reviewSummary: "นิสัยพื้นฐานมีแกนมั่นคงและควบคุมตัวเองสูง",
        personality: {
          thought_process: "ยึดแกนดิถีเป็นหลัก แล้วใช้ 60 Jiazi กับฤดูกาลเป็นตัวแต้มอารมณ์ของดวง",
          bridge_blocks: [
            {
              title: "ดิถีวางแกนตัวตน",
              signal: "ดิถีค่อนข้างมั่นคงและรับแรงกดดันได้",
              explanation: "คุณเป็นคนที่มีแกนในชัด เวลาตัดสินใจแล้วไม่เปลี่ยนง่าย",
              personality_impact: "จึงทำให้มักควบคุมอารมณ์และทิศทางชีวิตด้วยตัวเอง",
            },
            {
              title: "กะจื่อวันเติมแรงขับ",
              signal: "ฐานวัน己巳ทำให้ภายนอกนิ่งแต่ข้างในมีแรงส่ง",
              explanation: "พอมาเจอฐานวันแบบนี้ จึงไม่ใช่คนนิ่งเฉย แต่เป็นคนนิ่งแล้วค่อยขยับเมื่อเห็นจังหวะ",
              personality_impact: "จึงทำให้เดินหน้าเงียบ ๆ แต่ไม่ยอมแพ้ง่าย",
            },
            {
              title: "ฤดูกาลช่วยแต้มอารมณ์",
              signal: "ฤดูหนาวกลางฤดูทำให้ต้องค่อย ๆ อุ่นพลังตัวเองก่อน",
              explanation: "ด้านในจึงมีช่วงคิดนานและดูอึดอัดก่อนเปิดตัว",
              personality_impact: "จึงทำให้คนอื่นอาจมองว่าช้า แต่จริง ๆ เป็นคนระวังและคิดลึก",
            },
          ],
          final_prediction: "เป็นคนเก็บอาการ คิดลึก และไม่ชอบเสียการควบคุม แต่เมื่อมั่นใจแล้วจะเดินหน้าแบบเงียบ ๆ และต่อเนื่อง",
          supporting_signals: [
            "ดิถีค่อนข้างมั่นคงและรับแรงกดดันได้ดี",
            "ฐานวัน己巳เสริมแรงขับภายใน",
            "ฤดูหนาวกลางฤดูทำให้พลังออกช้าแต่ต่อเนื่อง",
          ],
        },
      });

    expect(annotationData.dimensions).toHaveLength(15);
    expect(
      annotationData.dimensions.find((dimension) => dimension.dimension_name === "personality_psychology"),
    ).toMatchObject({
      final_prediction: expect.stringContaining("เก็บอาการ"),
    });
  });

  test("states the hierarchy clearly in the system instruction and user prompt", () => {
    const instruction = buildPersonalityPocSystemInstruction();
    const prompt = buildPersonalityPocUserPrompt(
      SAMPLE_RAW_INPUT,
      buildPersonalityFocusPayload(SAMPLE_SOURCE2_OVERLAY),
    );

    expect(instruction).toContain("Source 2 routing first");
    expect(instruction).toContain("Stable-trait claims may come only from Source 2 routing");
    expect(instruction).toContain("When refinement or evidence contain warnings, phrase them as tendencies or cautions");
    expect(instruction).toContain("you may mention it once in Thai followed by the Chinese characters in parentheses");
    expect(instruction).toContain("Do not infer romance, sexuality, fame, social rank, or life-domain destiny unless the routing text states it directly");
    expect(instruction).toContain("Ignore interactionState");
    expect(instruction).toContain("Do not use gendered polite particles");
    expect(instruction).toContain("You own the interpretation and the sinsae wording");
    expect(instruction).toContain("reviewSummary should act as the opening frame of the reading");
    expect(instruction).toContain("Make the voice sound like one sinsae speaking directly to one client");
    expect(instruction).toContain("Prefer direct and decisive Thai wording for routing-backed traits");
    expect(instruction).toContain("Write final_prediction as 2 or 3 medium Thai paragraphs");
    expect(instruction).toContain("cover these six ideas in one smooth reading");
    expect(instruction).toContain("let final_prediction focus more on caution, guidance, and the emotional takeaway");
    expect(prompt).toContain("personality_psychology dimension only");
    expect(prompt).toContain("คุณเป็นคน... / พอมาเจอ... / จึงทำให้...");
    expect(prompt).toContain("Return exactly 3 or 4 bridge_blocks");
    expect(prompt).toContain("source2.routing -> source2.refinement -> source2.evidence -> source2.supportingPackets");
    expect(prompt).toContain("Curated Source 2 personality payload");
    expect(prompt).toContain("Lane guardrails:");
    expect(prompt).toContain("Let reviewSummary serve as the opening frame, and let final_prediction serve as the closing client-facing passage");
    expect(prompt).toContain("Write final_prediction as a smooth client-facing reading in 2 or 3 medium paragraphs");
    expect(prompt).toContain("Make it sound like you are talking to the client directly, not filing a report");
    expect(prompt).toContain("If a Chinese term from the payload sharpens the reading");
    expect(prompt).toContain("Do not write explicit headers like Intent, Core Reading, Risk, Action, or Symbolic Layer");
    expect(prompt).toContain("routing owner: ยืนยันจากข้อความหลักของตำรา; เขียนเป็นแกนนิสัยหลักได้");
    expect(prompt).toContain("evidence owner: ใช้เป็นบริบทเสริมเท่านั้น; ต้องใช้คำอย่าง \"มีแนวโน้ม\", \"อาจ\", หรือ \"ควรระวัง\" แทนคำฟันธง");
    expect(prompt).toContain("Do not turn side warnings into identity labels");
    expect(prompt).toContain('"precisionTerms"');
    expect(prompt).toContain('"role": "แกนนิสัยหลัก"');
    expect(prompt).toContain('"role": "สีบุคลิกย่อย"');
    expect(prompt).toContain('"role": "บริบทเสริมและข้อควรระวัง"');
    expect(prompt).not.toContain('"source2Overlay"');
    expect(prompt).not.toContain('"supportingPackets"');
  });

  test("rejects report content that leaks forbidden dev wording", () => {
    expect(() => PersonalityPocResponseSchema.parse({
      reviewSummary: "สรุปนิสัยจาก payload นี้ชัดเจน",
      personality: {
        thought_process: "ใช้ภาษาซินแสปกติ",
        bridge_blocks: [
          {
            title: "แกนแรก",
            signal: "ดิถีมั่นคง",
            explanation: "คุณเป็นคนมีแกน",
            personality_impact: "จึงทำให้ยืนระยะได้",
          },
          {
            title: "แกนสอง",
            signal: "กะจื่อวันหนุนแรงขับ",
            explanation: "พอมาเจอแรงขับภายใน",
            personality_impact: "จึงทำให้ไม่ยอมแพ้ง่าย",
          },
          {
            title: "แกนสาม",
            signal: "ฤดูหนาวแต้มอารมณ์",
            explanation: "ด้านในคิดนาน",
            personality_impact: "จึงทำให้เปิดใจช้า",
          },
        ],
        final_prediction: "เป็นคนมีวินัย",
        supporting_signals: ["ดิถีมั่นคง"],
      },
    })).toThrow("Forbidden report term detected");
  });

  test("allows Chinese precision terms when they are paired with readable Thai meaning", () => {
    expect(() => PersonalityPocResponseSchema.parse({
      reviewSummary: "สรุปภาพรวมปกติ",
      personality: {
        thought_process: "ใช้ภาษาซินแสปกติ",
        bridge_blocks: [
          {
            title: "แกนแรก",
            signal: "ตี้อ๋วง (帝旺) เด่น หมายถึงพลังขึ้นถึงจุดสูง",
            explanation: "คุณมีตี้อ๋วง (帝旺) ในดวง จึงแปลว่าช่วงพลังด้านในขึ้นแรงและมั่นใจมากเป็นพิเศษ",
            personality_impact: "จึงทำให้ใจแข็ง",
          },
          {
            title: "แกนสอง",
            signal: "ลิ่มกัว (臨官) หนุนแรงขับ",
            explanation: "พอมาเจอลิ่มกัว (臨官) จึงแปลว่าเป็นจังหวะที่ยืนกำลังและคุมตัวเองได้ดี",
            personality_impact: "จึงทำให้ไม่ยอมแพ้ง่าย",
          },
          {
            title: "แกนสาม",
            signal: "ฤดูหนาวแต้มอารมณ์",
            explanation: "ด้านในคิดนาน",
            personality_impact: "จึงทำให้เปิดใจช้า",
          },
        ],
        final_prediction: "เป็นคนที่มีตี้อ๋วง (帝旺) เด่น จึงกล้าตัดสินใจในเรื่องที่ตัวเองมั่นใจ และเมื่อเจอลิ่มกัว (臨官) ก็ยิ่งทำให้การวางตัวดูนิ่งแต่มีอำนาจในตัว",
        supporting_signals: ["ตี้อ๋วง (帝旺) เด่น"],
      },
    })).not.toThrow();
  });

  test("formats a preflight report in sinsae-readable Thai without debug headings", () => {
    const report = formatPersonalityPocPreflightReport({
      rawInput: SAMPLE_RAW_INPUT,
      focusPayload: buildPersonalityFocusPayload(SAMPLE_SOURCE2_OVERLAY),
    });

    expect(report).toContain("=== รายงานเตรียมอ่านนิสัยพื้นฐาน ===");
    expect(report).toContain("แกนหลักของดวง");
    expect(report).toContain("สัญญาณที่ใช้ในการอ่าน");
    expect(report).toContain("ลำดับการอ่าน");
    expect(report).toContain("Source 2 routing (แกนนิสัยหลัก)");
    expect(report).toContain("Source 2 refinement (สีบุคลิกย่อย)");
    expect(report).toContain("หลักฐาน 12 ชี่ (ใช้เป็นบริบทเสริม)");
    expect(report).toContain("ความพร้อมส่งต่อ");
    expect(report).toContain("source-5 ใช้ Source 2 routing เป็นแกนนิสัยหลักได้แล้ว");
    expect(report).toContain("Source 2 evidence และ supporting packets ใช้เป็นบริบทเสริมได้");
    expect(report).not.toContain("payload");
    expect(report).not.toContain("schema");
    expect(report).not.toContain("JSON");
  });

  test("formats a generated report with bridge blocks and client-facing ending", () => {
    const report = formatPersonalityPocGeneratedReport({
      rawInput: SAMPLE_RAW_INPUT,
      focusPayload: buildPersonalityFocusPayload(SAMPLE_SOURCE2_OVERLAY),
      model: "gemini-3-flash-preview",
      response: {
        reviewSummary: "แกนนิสัยชัดแต่ต้องอาศัยวินัยมาช่วยประคอง",
        personality: {
          thought_process: "ยึดดิถีเป็นแกน แล้วค่อยเติมสีจากกะจื่อและธาตุรวม",
          bridge_blocks: [
            {
              title: "ดิถีเป็นแกนใหญ่",
              signal: "ดิถีค่อนข้างมั่นคงและรับแรงกดดันได้",
              explanation: "คุณเป็นคนธาตุดินที่มีแกนชัด รับแรงกดดันได้ แต่จะปิดใจเมื่อถูกบีบมากเกินไป",
              personality_impact: "จึงทำให้เป็นคนเก็บอาการและอยากคุมจังหวะของตัวเอง",
            },
            {
              title: "พอมาเจอกะจื่อวัน",
              signal: "ฐานวัน己巳เติมแรงขับภายใน",
              explanation: "ฐานวัน己巳เติมแรงขับภายใน ทำให้ภายนอกดูนิ่งแต่ข้างในไม่ยอมแพ้ง่าย",
              personality_impact: "จึงทำให้เมื่อมั่นใจแล้วจะเดินหน้าแบบต่อเนื่องและเงียบ",
            },
            {
              title: "ฤดูกาลเข้ามาแต้มอารมณ์",
              signal: "ฤดูหนาวกลางฤดูทำให้พลังออกช้าแต่ไม่ดับ",
              explanation: "เมื่อมาอยู่ในจังหวะหนาว จึงมีด้านที่ระวังและต้องใช้เวลาอุ่นใจก่อนเปิดตัว",
              personality_impact: "จึงทำให้คนรอบตัวรู้สึกว่าเข้าถึงช้า แต่ถ้าไว้ใจแล้วจะไปยาว",
            },
          ],
          final_prediction: "คุณเป็นคนคิดลึกและถือแกนของตัวเองชัด เวลามั่นใจแล้วจะเดินเกมค่อนข้างเด็ดขาด ไม่ใช่คนเปลี่ยนใจง่าย แต่ข้อเสียคือถ้ากดดันสะสมมากไปก็จะเก็บอาการจนคนรอบตัวอ่านใจยาก\n\nในเชิงจังหวะของดวงยังมีภาพของตี้อ๋วง (帝旺) ซ่อนอยู่ คือพลังด้านในขึ้นได้แรงเมื่อถึงเวลาของตัวเอง จึงเหมาะกับการใช้ชีวิตแบบมีจังหวะ มีระบบ และค่อย ๆ เปิดเกมในสิ่งที่มั่นใจมากกว่าฝืนเร่งทุกเรื่องพร้อมกัน",
          supporting_signals: ["ดิถีค่อนข้างมั่นคง", "กะจื่อวัน己巳"],
          confidence_note: "มั่นใจระดับสูง เพราะแกนดิถีกับฐานวันไปในทิศเดียวกัน",
        },
      },
    });

    expect(report).toContain("=== รายงานนิสัยพื้นฐานแบบซินแส ===");
    expect(report).toContain("คำอธิบายแบบซินแส");
    expect(report).toContain("1. ดิถีเป็นแกนใหญ่");
    expect(report).toContain("สัญญาณ: ดิถีค่อนข้างมั่นคงและรับแรงกดดันได้");
    expect(report).toContain("จึงทำให้:");
    expect(report).toContain("คำทำนายพร้อมส่งลูกค้า\nจากโครงสร้างนิสัยพื้นฐานของดวงนี้ แกนนิสัยชัดแต่ต้องอาศัยวินัยมาช่วยประคอง");
    expect(report).toContain("\n\nคุณเป็นคนคิดลึกและถือแกนของตัวเองชัด เวลามั่นใจแล้วจะเดินเกมค่อนข้างเด็ดขาด");
    expect(report).toContain("ตี้อ๋วง (帝旺)");
    expect(report).toContain("ภาคผนวกเทคนิค");
    expect(report).toContain("- รุ่นที่ใช้: gemini-3-flash-preview");
    expect(report).not.toContain("สัญญาณประกอบที่ AI ถือไว้");
  });
});
