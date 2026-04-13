import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import {
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  type AnnotationDimensionName,
  type DraftAnnotationDataValue,
} from "@/lib/bazi/schema-types";

export type AnnotationProgressState = "not-started" | "draft" | "complete";

export type AnnotationDimensionMeta = {
  dimensionName: AnnotationDimensionName;
  step: number;
  title: string;
  guidance: string;
  thoughtPrompt: string;
  predictionPrompt: string;
};

export type AnnotationDimensionDraft = {
  thoughtProcess: string;
  finalPrediction: string;
};

export type AnnotationDimensionDraftState = Record<
  AnnotationDimensionName,
  AnnotationDimensionDraft
>;

export type AnnotationProgressSummary = {
  completeCount: number;
  draftCount: number;
  notStartedCount: number;
};

export type AnnotationDraftContentState = "empty" | "active";

export const ANNOTATION_DIMENSION_META: readonly AnnotationDimensionMeta[] = [
  {
    dimensionName: "chart_foundation",
    step: 1,
    title: "ฐานดวงเดิม และภาพรวม",
    guidance: "สรุปโครงสร้างหลักของดวงนี้ก่อนแตะหัวข้อย่อยอื่น",
    thoughtPrompt: "ดวงนี้ตั้งอยู่บนรูปแบบใด อะไรคือภาพรวมที่ต้องเห็นก่อน",
    predictionPrompt: "สรุปภาพรวมดวงให้เป็นภาษาที่ซินแสพร้อมส่งต่อได้ทันที",
  },
  {
    dimensionName: "balance_element",
    step: 2,
    title: "ธาตุปรับสมดุล (ย่งซิ้ง)",
    guidance: "จับแกนธาตุให้คุณและธาตุที่ต้องระวังแบบตรงไปตรงมา",
    thoughtPrompt: "ธาตุใดช่วยพยุงดวงนี้ และธาตุใดทำให้เสียสมดุล",
    predictionPrompt: "สรุปสิ่งที่ควรเสริมและสิ่งที่ควรหลีกเลี่ยงจากมุมธาตุ",
  },
  {
    dimensionName: "ten_gods_reaction",
    step: 3,
    title: "ปฏิกิริยา 10 เทพ",
    guidance: "มองบทบาทตัวเด่น ตัวแฝง และแรงตีกันของ 10 เทพ",
    thoughtPrompt: "10 เทพตัวไหนเป็นตัวหลัก และมันกำลังผลักชีวิตไปทางใด",
    predictionPrompt: "แปลผล 10 เทพให้อยู่ในภาษาการใช้ชีวิตจริง",
  },
  {
    dimensionName: "twelve_qi_cycle",
    step: 4,
    title: "วัฏจักร 12 เชี่ยงแซ",
    guidance: "ใช้รอบพลังเพื่อบอกระดับแรงของสถานการณ์และอายุจร",
    thoughtPrompt: "เชี่ยงแซแต่ละหลักกำลังส่งเสริมหรือกดดันเจ้าชะตาอย่างไร",
    predictionPrompt: "สรุประดับพลังของดวงนี้จากมุม 12 เชี่ยงแซ",
  },
  {
    dimensionName: "pillar_relations",
    step: 5,
    title: "ความสัมพันธ์ระดับราศี",
    guidance: "ตรวจชง ภาคี เฮ้ง ไห่ ผั่ว แบบไม่ข้ามบริบท",
    thoughtPrompt: "มีคู่ปะทะหรือการจับคู่ใดที่ต้องยกเป็นประเด็นหลัก",
    predictionPrompt: "สรุปผลกระทบจากความสัมพันธ์ของราศีต่อชีวิตจริง",
  },
  {
    dimensionName: "health_overview",
    step: 6,
    title: "ภาพรวมสุขภาพ",
    guidance: "เน้นจุดอ่อนไหวและสิ่งที่ต้องเฝ้าระวังแบบจับต้องได้",
    thoughtPrompt: "องค์ประกอบไหนในดวงชี้ไปยังภาวะสุขภาพที่ต้องดูแลเป็นพิเศษ",
    predictionPrompt: "สรุปคำเตือนและแนวทางดูแลสุขภาพอย่างกระชับ",
  },
  {
    dimensionName: "career_potential",
    step: 7,
    title: "ศักยภาพและการงาน",
    guidance: "ชี้ภาพงานที่เหมาะกับโครงสร้างดวงจริง ไม่ขายฝัน",
    thoughtPrompt: "จุดเด่นในดวงนี้ส่งให้เหมาะกับงานหรือบทบาทแบบใด",
    predictionPrompt: "สรุปทิศทางอาชีพที่ควรไปและสิ่งที่ไม่ควรฝืน",
  },
  {
    dimensionName: "wealth_and_investment",
    step: 8,
    title: "การเงินและการลงทุน",
    guidance: "ดูวิธีหาเงิน ความเสี่ยง และจังหวะการถือทรัพย์",
    thoughtPrompt: "โครงสร้างเงินของดวงนี้ได้มาจากทางไหนและเสี่ยงตรงจุดใด",
    predictionPrompt: "สรุปภาพการเงินและแนวทางลงทุนที่เหมาะกับเจ้าชะตา",
  },
  {
    dimensionName: "love_and_family",
    step: 9,
    title: "ความรักและครอบครัว",
    guidance: "อ่านความสัมพันธ์ให้ลึกแต่ไม่ล้นเกินข้อเท็จจริงของดวง",
    thoughtPrompt: "ดวงนี้สะท้อนรูปแบบความรัก คู่ครอง หรือครอบครัวอย่างไร",
    predictionPrompt: "สรุปแนวโน้มความรักและบทเรียนเรื่องครอบครัวอย่างชัดเจน",
  },
  {
    dimensionName: "personality_psychology",
    step: 10,
    title: "บุคลิกและจิตวิทยา",
    guidance: "แปลแกนนิสัยให้เป็นภาษาที่ซินแสใช้สนทนากับลูกค้าได้",
    thoughtPrompt: "จุดแข็ง จุดอ่อน และแรงขับลึกของเจ้าชะตาอยู่ตรงไหน",
    predictionPrompt: "สรุปลักษณะนิสัยและภาวะทางใจที่ควรรู้",
  },
  {
    dimensionName: "major_luck_cycles",
    step: 11,
    title: "ช่วงวัยจร",
    guidance: "จับภาพถนนชีวิตใหญ่ 10 ปีแบบเห็นทิศทาง ไม่หลุดบริบท",
    thoughtPrompt: "วัยจรใหญ่กำลังพาเจ้าชะตาไปทิศไหน และมีอะไรต้องระวัง",
    predictionPrompt: "สรุปภาพรวมถนนชีวิตใหญ่ในช่วงที่เกี่ยวข้อง",
  },
  {
    dimensionName: "annual_star_energy",
    step: 12,
    title: "พลังดาวประจำปีจร",
    guidance: "ระบุแรงกระทบของปีนี้ให้เชื่อมกับดวงเดิมอย่างมีหลัก",
    thoughtPrompt: "ปีจรปัจจุบันกระทบโครงดวงเดิมตรงจุดไหนบ้าง",
    predictionPrompt: "สรุปจังหวะปีนี้ว่าควรรับมือหรือใช้โอกาสอย่างไร",
  },
  {
    dimensionName: "red_flags",
    step: 13,
    title: "คำเตือน (Red Flags)",
    guidance: "ยกเฉพาะเรื่องที่ถ้าไม่เตือนจะเสี่ยงจริง",
    thoughtPrompt: "สัญญาณอันตรายหรือข้อห้ามในดวงนี้คืออะไร",
    predictionPrompt: "สรุปสิ่งที่เจ้าชะตาต้องเลี่ยงอย่างตรงประเด็น",
  },
  {
    dimensionName: "actionable_advice",
    step: 14,
    title: "คำแนะนำ (Actionable Advice)",
    guidance: "เปลี่ยนการอ่านดวงให้เป็นการลงมือทำที่จับต้องได้",
    thoughtPrompt: "ถ้าจะช่วยเจ้าชะตาให้ขยับชีวิต ควรเริ่มจากอะไร",
    predictionPrompt: "สรุปคำแนะนำที่นำไปใช้ได้จริงทันที",
  },
  {
    dimensionName: "core_prediction",
    step: 15,
    title: "คำตอบตรงธง",
    guidance: "ปิดท้ายด้วยคำทำนายสรุปที่ตอบโจทย์หลักของเคสนี้",
    thoughtPrompt: "เมื่อรวมทุกมิติแล้ว คำตอบกลางของดวงนี้คืออะไร",
    predictionPrompt: "สรุปฟันธงคำตอบสุดท้ายแบบมั่นใจและกระชับ",
  },
] as const;

export function createEmptyAnnotationDimensions(): AnnotationDimensionDraftState {
  return REQUIRED_ANNOTATION_DIMENSION_NAMES.reduce((accumulator, dimensionName) => {
    accumulator[dimensionName] = {
      thoughtProcess: "",
      finalPrediction: "",
    };

    return accumulator;
  }, {} as AnnotationDimensionDraftState);
}

export function getDimensionProgress(
  dimension: AnnotationDimensionDraft,
): AnnotationProgressState {
  const hasThoughtProcess = dimension.thoughtProcess.trim().length > 0;
  const hasPrediction = dimension.finalPrediction.trim().length > 0;

  if (hasThoughtProcess && hasPrediction) {
    return "complete";
  }

  if (hasThoughtProcess || hasPrediction) {
    return "draft";
  }

  return "not-started";
}

export function getAnnotationProgressSummary(
  dimensions: AnnotationDimensionDraftState,
): AnnotationProgressSummary {
  return REQUIRED_ANNOTATION_DIMENSION_NAMES.reduce(
    (summary, dimensionName) => {
      const progress = getDimensionProgress(dimensions[dimensionName]);

      if (progress === "complete") {
        summary.completeCount += 1;
      } else if (progress === "draft") {
        summary.draftCount += 1;
      } else {
        summary.notStartedCount += 1;
      }

      return summary;
    },
    {
      completeCount: 0,
      draftCount: 0,
      notStartedCount: 0,
    },
  );
}

export function getAnnotationDraftContentState(
  dimensions: AnnotationDimensionDraftState,
): AnnotationDraftContentState {
  const summary = getAnnotationProgressSummary(dimensions);

  if (summary.completeCount > 0 || summary.draftCount > 0) {
    return "active";
  }

  return "empty";
}

export function isAnnotationReadyForReview(
  dimensions: AnnotationDimensionDraftState,
) {
  const summary = getAnnotationProgressSummary(dimensions);

  return summary.completeCount === REQUIRED_ANNOTATION_DIMENSION_NAMES.length;
}

export function createDraftAnnotationData(
  dimensions: AnnotationDimensionDraftState,
): DraftAnnotationDataValue {
  return {
    version: "1.6",
    dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
      dimension_name: dimensionName,
      thought_process: dimensions[dimensionName].thoughtProcess,
      final_prediction: dimensions[dimensionName].finalPrediction,
      supporting_signals: [],
    })),
  };
}

type AnnotationStoreState = {
  dimensions: AnnotationDimensionDraftState;
  expandedDimensionName: AnnotationDimensionName;
  setExpandedDimension: (dimensionName: AnnotationDimensionName) => void;
  updateThoughtProcess: (
    dimensionName: AnnotationDimensionName,
    thoughtProcess: string,
  ) => void;
  updateFinalPrediction: (
    dimensionName: AnnotationDimensionName,
    finalPrediction: string,
  ) => void;
  reset: () => void;
};

export function createAnnotationStore() {
  return createStore<AnnotationStoreState>((set) => ({
    dimensions: createEmptyAnnotationDimensions(),
    expandedDimensionName: REQUIRED_ANNOTATION_DIMENSION_NAMES[0],
    setExpandedDimension: (dimensionName) => {
      set({ expandedDimensionName: dimensionName });
    },
    updateThoughtProcess: (dimensionName, thoughtProcess) => {
      set((state) => {
        const trimmedValue = thoughtProcess.trim();
        const currentDimension = state.dimensions[dimensionName];

        return {
          dimensions: {
            ...state.dimensions,
            [dimensionName]: {
              ...currentDimension,
              thoughtProcess,
              finalPrediction:
                trimmedValue.length > 0 ? currentDimension.finalPrediction : "",
            },
          },
        };
      });
    },
    updateFinalPrediction: (dimensionName, finalPrediction) => {
      set((state) => ({
        dimensions: {
          ...state.dimensions,
          [dimensionName]: {
            ...state.dimensions[dimensionName],
            finalPrediction,
          },
        },
      }));
    },
    reset: () => {
      set({
        dimensions: createEmptyAnnotationDimensions(),
        expandedDimensionName: REQUIRED_ANNOTATION_DIMENSION_NAMES[0],
      });
    },
  }));
}

const annotationStore = createAnnotationStore();

export function useAnnotationStore<Selected>(
  selector: (state: AnnotationStoreState) => Selected,
) {
  return useStore(annotationStore, selector);
}

export function resetAnnotationStore() {
  annotationStore.getState().reset();
}