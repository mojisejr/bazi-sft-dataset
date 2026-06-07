import { z } from "zod";

import { getHybridDictionarySpec } from "@/lib/bazi/dictionaries";
import { getHybridRetrievalRegistryEntry } from "@/lib/bazi/hybrid-retrieval-registry";
import { getBaziTopicDefinition } from "@/lib/bazi/knowledge/topic-registry";
import {
  Source6CareerBusinessOverlaySchema,
  type Source6CareerBusinessOverlay,
} from "@/lib/bazi/source6-career-business-overlay";
import type { Source6CareerBusinessStepResult } from "@/lib/bazi/source6-career-business-rules";
import { buildSource6KnowledgeOwnership } from "@/lib/bazi/source6-knowledge-ownership";

const Source6SourceRefSchema = z.object({
  directoryLabel: z.string().trim().min(1),
  primarySource: z.string().trim().min(1),
  supportingSources: z.array(z.string().trim().min(1)),
  reasoningFocus: z.string().trim().min(1),
});

const Source6RoleElementPairSchema = z.object({
  role: z.enum(["resource", "parallel", "output", "wealth", "power"]),
  element: z.enum(["wood", "fire", "earth", "metal", "water"]),
  elementLabel: z.string().trim().min(1),
});

const Source6InterpretationDeliveryContextSchema = z.object({
  topic: z.object({
    id: z.literal("suitable_career"),
    thaiLabel: z.string().trim().min(1),
    annotationDimension: z.literal("career_potential"),
    sourceRefs: z.array(Source6SourceRefSchema).min(1),
  }),
  dictionary: z.object({
    specKey: z.literal("careerPotentialDictionary"),
    dimensionName: z.literal("career_potential"),
    sourceRelativePaths: z.array(z.string().trim().min(1)).min(1),
  }),
  retrieval: z.object({
    dimensionName: z.literal("career_potential"),
    strategy: z.enum(["dictionary-first", "folder-merge", "ai-fallback"]),
    coverage: z.enum(["direct", "merge", "missing"]),
    sourceRelativePaths: z.array(z.string().trim().min(1)).min(1),
    fallbackRequired: z.boolean(),
  }),
  contract: z.object({
    verdict: z.literal("source-reference-and-delivery-context-only"),
    allowedContextSteps: z.array(z.string().trim().min(1)).min(1),
    rejectedAssumptions: z.array(z.string().trim().min(1)).min(1),
    note: z.string().trim().min(1),
  }),
});

const Source6ReadingIntentSchema = z.object({
  summary: z.string().trim().min(1),
  detail: z.string().trim().min(1),
  guardrails: z.array(z.string().trim().min(1)).min(1),
});

const Source6CareerDirectionInterpretationSchema = z.object({
  sourceStepIds: z.tuple([z.literal("step-1-career-element-routing")]),
  facts: z.object({
    strengthBandId: z.enum(["very-weak", "weak", "balanced", "strong", "very-strong"]),
    primaryLane: Source6RoleElementPairSchema,
    supportingLanes: z.array(Source6RoleElementPairSchema).min(1),
  }),
  readingIntent: Source6ReadingIntentSchema,
});

const Source6CareerStatusInterpretationSchema = z.object({
  sourceStepIds: z.tuple([
    z.literal("step-2-official-star-lookup"),
    z.literal("step-3-career-status-by-official-star-phase"),
    z.literal("step-4-job-transition-weighted-timing"),
    z.literal("step-5-career-growth-grouping"),
  ]),
  facts: z.object({
    officialElement: z.enum(["wood", "fire", "earth", "metal", "water"]),
    officialElementLabel: z.string().trim().min(1),
    presenceMode: z.enum(["direct-present", "hidden-only", "absent"]),
    statusKey: z.enum([
      "authority-rising",
      "authority-established",
      "authority-transitional",
      "authority-pressured",
      "official-star-not-manifest",
    ]),
    combinedSignal: z.enum(["supportive", "mixed", "resistant"]),
    growthGroup: z.enum(["good", "neutral", "bad"]),
  }),
  readingIntent: z.object({
    roleFrame: z.string().trim().min(1),
    timingFrame: z.string().trim().min(1),
    growthFrame: z.string().trim().min(1),
    guardrails: z.array(z.string().trim().min(1)).min(1),
  }),
});

const Source6BusinessInterpretationSchema = z.object({
  sourceStepIds: z.tuple([
    z.literal("step-6-work-location-domestic-vs-international"),
    z.literal("step-7-business-nature-and-investment"),
    z.literal("step-8-customer-analysis"),
  ]),
  facts: z.object({
    preferredLane: z.enum(["domestic", "international", "balanced"]),
    businessNature: z.enum(["wealth-aligned", "service-led", "cashflow-fragile"]),
    investmentHint: z.enum(["favorable", "selective", "cautious"]),
    customerProfile: z.enum(["established-network", "adaptive-market", "volatile-demand"]),
  }),
  readingIntent: z.object({
    workStyleFrame: z.string().trim().min(1),
    businessFrame: z.string().trim().min(1),
    customerFrame: z.string().trim().min(1),
    guardrails: z.array(z.string().trim().min(1)).min(1),
  }),
});

export const Source6CareerBusinessInterpretationSchema = z.object({
  sourceId: z.literal("source-6"),
  routeFrom: z.literal("source6-career-business-overlay"),
  status: z.literal("ready-for-reading"),
  deliveryContext: Source6InterpretationDeliveryContextSchema,
  careerDirection: Source6CareerDirectionInterpretationSchema,
  careerStatus: Source6CareerStatusInterpretationSchema,
  businessOutlook: Source6BusinessInterpretationSchema,
});

export type Source6CareerBusinessInterpretation = z.infer<typeof Source6CareerBusinessInterpretationSchema>;

const ROLE_INTENT_SUMMARY: Record<
  Source6CareerBusinessInterpretation["careerDirection"]["facts"]["primaryLane"]["role"],
  string
> = {
  resource: "งานที่อาศัยองค์ความรู้ ระบบสนับสนุน หรือผู้ใหญ่ช่วยหนุน",
  parallel: "งานที่โตผ่านทีม คู่คิด หรือแรงร่วมจากเครือข่าย",
  output: "งานที่เด่นเมื่อได้ผลิตผลงาน ถ่ายทอด หรือสร้างของให้เห็นชัด",
  wealth: "งานที่ขับด้วยเป้าผลลัพธ์ รายได้ การค้า หรือการบริหารมูลค่า",
  power: "งานที่มีกรอบ หน้าที่ ตำแหน่ง หรือแรงรับผิดชอบสูง",
};

const OFFICIAL_PRESENCE_FRAME: Record<
  Source6CareerBusinessInterpretation["careerStatus"]["facts"]["presenceMode"],
  string
> = {
  "direct-present": "ดาวอำนาจขึ้นตรงในดวง จึงอ่านบทบาทงานและสถานะได้ชัด",
  "hidden-only": "ดาวอำนาจมีอยู่แต่ซ่อน ต้องอาศัยจังหวะหรือบริบทช่วยเปิดบทบาท",
  absent: "ดาวอำนาจไม่ขึ้นตรง จึงต้องอ่านน้ำหนักหน้าที่ผ่านจังหวะและรูปแบบงานแทน",
};

const CAREER_STATUS_FRAME: Record<
  Source6CareerBusinessInterpretation["careerStatus"]["facts"]["statusKey"],
  string
> = {
  "authority-rising": "สถานะงานกำลังไต่ขึ้น เหมาะกับบทบาทที่ถือความรับผิดชอบมากขึ้น",
  "authority-established": "สถานะงานนิ่งและมีกรอบชัด เหมาะกับงานที่ต้องรับตำแหน่งหรือดูระบบ",
  "authority-transitional": "สถานะงานอยู่ในช่วงเปลี่ยนผ่าน ต้องจัดสมดุลบทบาทและความคาดหวังให้ดี",
  "authority-pressured": "สถานะงานมีแรงกดสูง ควรวางขอบเขตหน้าที่และภาระให้ชัดก่อนขยับ",
  "official-star-not-manifest": "สถานะงานยังไม่ขึ้นจาก lane ดาวอำนาจโดยตรง ควรอ่านผ่านทางเลือกงานและจังหวะเป็นหลัก",
};

const TIMING_FRAME: Record<
  Source6CareerBusinessInterpretation["careerStatus"]["facts"]["combinedSignal"],
  string
> = {
  supportive: "จังหวะเปลี่ยนงานหรือสมัครงานเปิด โดยยังคงอ่านน้ำหนักวัยจร 60% และปีจร 40% เป็นแกน",
  mixed: "จังหวะเปลี่ยนงานมีทั้งแรงหนุนและแรงต้าน ควรเลือก move ที่ตรง lane มากกว่าขยับทุกทาง",
  resistant: "จังหวะเปลี่ยนงานยังต้าน ควรซ่อมฐานงานหรือรอหน้าต่างที่เหมาะก่อนขยับใหญ่",
};

const GROWTH_FRAME: Record<
  Source6CareerBusinessInterpretation["careerStatus"]["facts"]["growthGroup"],
  string
> = {
  good: "ภาพรวมความก้าวหน้าเข้ากลุ่มดี ดันเรื่องการเติบโตและเครดิตงานได้",
  neutral: "ภาพรวมความก้าวหน้าอยู่กลาง ๆ ต้องคัดบทบาทที่ส่งเสริม lane หลักจริง ๆ",
  bad: "ภาพรวมความก้าวหน้าอ่อน ควรระวังการเร่งโตในบริบทที่ยังไม่หนุน",
};

const LOCATION_FRAME: Record<
  Source6CareerBusinessInterpretation["businessOutlook"]["facts"]["preferredLane"],
  string
> = {
  domestic: "รูปแบบงานเด่นกว่าเมื่อยืนบนฐานในประเทศหรือบริบทที่ควบคุมความสัมพันธ์ได้ใกล้",
  international: "รูปแบบงานเด่นกว่าเมื่อโยงต่างประเทศ ออนไลน์ หรือบริบทที่ต้องขยายวงออกไป",
  balanced: "รูปแบบงานถือได้ทั้งในประเทศและต่างประเทศ จึงเลือกจาก lane ธุรกิจและจังหวะประกอบกันได้",
};

const BUSINESS_FRAME: Record<
  Source6CareerBusinessInterpretation["businessOutlook"]["facts"]["businessNature"],
  string
> = {
  "wealth-aligned": "ลักษณะธุรกิจเข้าทางการค้า การถือมูลค่า หรือการคุมผลตอบแทนโดยตรง",
  "service-led": "ลักษณะธุรกิจเข้าทางบริการ งานฝีมือ หรือคุณค่าที่ต้องส่งมอบต่อเนื่อง",
  "cashflow-fragile": "ลักษณะธุรกิจต้องระวังกระแสเงินสดและจังหวะหมุนทุนเป็นพิเศษ",
};

const INVESTMENT_FRAME: Record<
  Source6CareerBusinessInterpretation["businessOutlook"]["facts"]["investmentHint"],
  string
> = {
  favorable: "จังหวะลงทุนรับได้มากขึ้นเมื่อยังยึด lane ธุรกิจหลัก",
  selective: "ลงทุนได้แบบคัดเฉพาะดีลที่ตรง lane และไม่ดึงทรัพยากรเกินตัว",
  cautious: "ควรถือวินัยสูงกับการลงทุนและกันแรงเหวี่ยงของเงินสดก่อน",
};

const CUSTOMER_FRAME: Record<
  Source6CareerBusinessInterpretation["businessOutlook"]["facts"]["customerProfile"],
  string
> = {
  "established-network": "ฐานลูกค้าเด่นกับเครือข่ายที่มีความสัมพันธ์และเครดิตอยู่แล้ว",
  "adaptive-market": "ฐานลูกค้าเด่นกับตลาดที่เปลี่ยนเร็วและต้องปรับข้อเสนอให้ทัน",
  "volatile-demand": "ฐานลูกค้ามีความผันผวนสูง ต้องวางระบบคัดลูกค้าและคุมความเสี่ยงให้ดี",
};

function getStepResult<K extends Source6CareerBusinessStepResult["kind"]>(
  overlay: Source6CareerBusinessOverlay,
  stepId: Source6CareerBusinessOverlay["steps"][number]["stepId"],
  kind: K,
) {
  const step = overlay.steps.find((candidate) => candidate.stepId === stepId);

  if (!step) {
    throw new Error(`Missing Source 6 overlay step: ${stepId}`);
  }

  if (step.result.kind !== kind) {
    throw new Error(`Unexpected Source 6 step result kind for ${stepId}: ${step.result.kind}`);
  }

  return step.result as Extract<Source6CareerBusinessStepResult, { kind: K }>;
}

function buildDeliveryContext() {
  const ownership = buildSource6KnowledgeOwnership();
  const contract = ownership.deliverySurfaceContract;
  const topic = getBaziTopicDefinition(contract.topicId);
  const dictionarySpec = getHybridDictionarySpec(contract.annotationDimension);
  const retrievalEntry = getHybridRetrievalRegistryEntry(contract.retrievalRegistryDimension);

  if (!topic) {
    throw new Error(`Missing Source 6 delivery topic: ${contract.topicId}`);
  }

  if (!dictionarySpec) {
    throw new Error(`Missing Source 6 dictionary spec: ${contract.annotationDimension}`);
  }

  if (topic.annotationDimension !== contract.annotationDimension) {
    throw new Error("Source 6 topic contract drifted away from the career_potential dimension.");
  }

  return {
    topic: {
      id: topic.id,
      thaiLabel: topic.thaiLabel,
      annotationDimension: topic.annotationDimension,
      sourceRefs: topic.sourceRefs,
    },
    dictionary: {
      specKey: contract.dictionarySpec,
      dimensionName: dictionarySpec.dimensionName,
      sourceRelativePaths: [...dictionarySpec.sourceRelativePaths],
    },
    retrieval: {
      dimensionName: retrievalEntry.dimensionName,
      strategy: retrievalEntry.strategy,
      coverage: retrievalEntry.coverage,
      sourceRelativePaths: [...retrievalEntry.sourceRelativePaths],
      fallbackRequired: retrievalEntry.fallbackRequired,
    },
    contract: {
      verdict: contract.contractVerdict,
      allowedContextSteps: [...contract.allowedContextSteps],
      rejectedAssumptions: [...contract.rejectedAssumptions],
      note: contract.note,
    },
  };
}

export function buildSource6CareerBusinessInterpretation(
  overlayInput: Source6CareerBusinessOverlay,
): Source6CareerBusinessInterpretation {
  const overlay = Source6CareerBusinessOverlaySchema.parse(overlayInput);
  const step1 = getStepResult(overlay, "step-1-career-element-routing", "career-element-routing");
  const step2 = getStepResult(overlay, "step-2-official-star-lookup", "official-star-lookup");
  const step3 = getStepResult(overlay, "step-3-career-status-by-official-star-phase", "career-status-by-official-star-phase");
  const step4 = getStepResult(overlay, "step-4-job-transition-weighted-timing", "job-transition-weighting");
  const step5 = getStepResult(overlay, "step-5-career-growth-grouping", "career-growth-group");
  const step6 = getStepResult(overlay, "step-6-work-location-domestic-vs-international", "work-location-preference");
  const step7 = getStepResult(overlay, "step-7-business-nature-and-investment", "business-nature-and-investment");
  const step8 = getStepResult(overlay, "step-8-customer-analysis", "customer-profile");
  const deliveryContext = buildDeliveryContext();

  return Source6CareerBusinessInterpretationSchema.parse({
    sourceId: overlay.sourceId,
    routeFrom: "source6-career-business-overlay",
    status: "ready-for-reading",
    deliveryContext,
    careerDirection: {
      sourceStepIds: ["step-1-career-element-routing"],
      facts: {
        strengthBandId: step1.strengthBandId,
        primaryLane: step1.primaryLane,
        supportingLanes: step1.supportingLanes,
      },
      readingIntent: {
        summary: `แกนอาชีพหลักควรเริ่มจาก ${ROLE_INTENT_SUMMARY[step1.primaryLane.role]} ในธาตุ${step1.primaryLane.elementLabel}`,
        detail: "ใช้ topic suitable_career และ dictionary career_potential เพื่อยกตัวอย่างอาชีพได้หลังจาก lane หลักถูกตรึงแล้วเท่านั้น",
        guardrails: [
          "ห้ามให้ retrieval หรือ prompt prose เลือกธาตุอาชีพแทน Step 1",
          "ตัวอย่างอาชีพต้องตาม lane หลัก ไม่ย้อนมาคุม lane หลักเอง",
        ],
      },
    },
    careerStatus: {
      sourceStepIds: [
        "step-2-official-star-lookup",
        "step-3-career-status-by-official-star-phase",
        "step-4-job-transition-weighted-timing",
        "step-5-career-growth-grouping",
      ],
      facts: {
        officialElement: step2.officialElement,
        officialElementLabel: step2.officialElementLabel,
        presenceMode: step2.presenceMode,
        statusKey: step3.statusKey,
        combinedSignal: step4.combinedSignal,
        growthGroup: step5.growthGroup,
      },
      readingIntent: {
        roleFrame: `${OFFICIAL_PRESENCE_FRAME[step2.presenceMode]} ${CAREER_STATUS_FRAME[step3.statusKey]}`,
        timingFrame: TIMING_FRAME[step4.combinedSignal],
        growthFrame: GROWTH_FRAME[step5.growthGroup],
        guardrails: [
          "ห้ามดึง Source 1 twelve-qi texture มาแทน Source 6 career status",
          "ห้ามยุบการอ่านจังหวะเปลี่ยนงานให้เป็นความเห็น prompt ล้วนโดยไม่อ้าง 60/40 weighting",
        ],
      },
    },
    businessOutlook: {
      sourceStepIds: [
        "step-6-work-location-domestic-vs-international",
        "step-7-business-nature-and-investment",
        "step-8-customer-analysis",
      ],
      facts: {
        preferredLane: step6.preferredLane,
        businessNature: step7.businessNature,
        investmentHint: step7.investmentHint,
        customerProfile: step8.profileKey,
      },
      readingIntent: {
        workStyleFrame: LOCATION_FRAME[step6.preferredLane],
        businessFrame: `${BUSINESS_FRAME[step7.businessNature]} ${INVESTMENT_FRAME[step7.investmentHint]}`,
        customerFrame: CUSTOMER_FRAME[step8.profileKey],
        guardrails: [
          "ทำเลงาน ลักษณะธุรกิจ การลงทุน และลูกค้าต้องอ่านเป็น downstream จาก facts ของ Source 6 เท่านั้น",
          "delivery surface ใช้ได้เพื่อขยายตัวอย่างหรือภาษาคนอ่าน แต่ห้ามเป็น primary owner ของ logic ธุรกิจ",
        ],
      },
    },
  });
}