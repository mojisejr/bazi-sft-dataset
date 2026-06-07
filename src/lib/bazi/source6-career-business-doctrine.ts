import { z } from "zod";

export const SOURCE6_CAREER_BUSINESS_STEP_IDS = [
  "step-1-career-element-routing",
  "step-2-official-star-lookup",
  "step-3-career-status-by-official-star-phase",
  "step-4-job-transition-weighted-timing",
  "step-5-career-growth-grouping",
  "step-6-work-location-domestic-vs-international",
  "step-7-business-nature-and-investment",
  "step-8-customer-analysis",
] as const;

export const SOURCE6_TERMINOLOGY_IDS = [
  "career-element-lane",
  "official-star",
  "career-12-cheingsae",
  "transition-weighting",
  "month-base",
  "wealth-star",
  "output-star",
  "year-pillar-customer-lane",
] as const;

const Source6CareerBusinessStepIdSchema = z.enum(SOURCE6_CAREER_BUSINESS_STEP_IDS);
const Source6TerminologyIdSchema = z.enum(SOURCE6_TERMINOLOGY_IDS);

const Source6Source1ReuseSchema = z.object({
  fieldId: z.string().trim().min(1),
  ownerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source6RetrievalContextReuseSchema = z.object({
  allowed: z.boolean(),
  mode: z.enum(["not-used", "context-only"]),
  surfaces: z.array(z.string().trim().min(1)),
  note: z.string().trim().min(1),
  guardrails: z.array(z.string().trim().min(1)).min(1),
});

const Source6OwnerTargetSchema = z.object({
  module: z.string().trim().min(1),
  ownerKey: z.string().trim().min(1),
  status: z.enum(["existing-owner", "new-owner-required", "gap-classified"]),
  note: z.string().trim().min(1),
});

const Source6LocalLogicSchema = z.object({
  ownerTarget: Source6OwnerTargetSchema,
  responsibilities: z.array(z.string().trim().min(1)).min(1),
});

const Source6CareerBusinessDoctrineStepSchema = z.object({
  stepId: Source6CareerBusinessStepIdSchema,
  manualStep: z.number().int().min(1).max(8),
  label: z.string().trim().min(1),
  manualIntent: z.string().trim().min(1),
  source1Reuse: z.array(Source6Source1ReuseSchema).min(1),
  retrievalContextReuse: Source6RetrievalContextReuseSchema,
  source6LocalLogic: Source6LocalLogicSchema,
  terminologyIds: z.array(Source6TerminologyIdSchema).min(1),
});

const Source6TerminologyFreezeSchema = z.object({
  termId: Source6TerminologyIdSchema,
  canonicalLabel: z.string().trim().min(1),
  meaning: z.string().trim().min(1),
  ownerSource: z.enum(["source1", "source6"]),
  ownerSurface: z.string().trim().min(1),
  mustNotBeNamedAs: z.array(z.string().trim().min(1)).default([]),
  note: z.string().trim().min(1),
});

export const Source6CareerBusinessDoctrineSchema = z.object({
  sourceId: z.literal("source-6"),
  preserveSource1Authority: z.literal(true),
  allowRetrievalContextOnly: z.literal(true),
  terminologyFreeze: z.array(Source6TerminologyFreezeSchema).length(SOURCE6_TERMINOLOGY_IDS.length),
  steps: z.array(Source6CareerBusinessDoctrineStepSchema).length(SOURCE6_CAREER_BUSINESS_STEP_IDS.length),
});

export type Source6CareerBusinessDoctrine = z.infer<typeof Source6CareerBusinessDoctrineSchema>;

const CAREER_DELIVERY_SURFACES = [
  "topic-registry.suitable_career",
  "careerPotentialDictionary",
  "hybrid-retrieval.career_potential",
] as const;

const RETRIEVAL_UNUSED = {
  allowed: false,
  mode: "not-used",
  surfaces: [],
  note: "Current topic and retrieval surfaces do not own this reasoning lane during the doctrine-freeze phase.",
  guardrails: [
    "Prompt or retrieval wording cannot be promoted into primary logic for this step",
  ],
} as const;

export function buildSource6CareerBusinessDoctrine(): Source6CareerBusinessDoctrine {
  return Source6CareerBusinessDoctrineSchema.parse({
    sourceId: "source-6",
    preserveSource1Authority: true,
    allowRetrievalContextOnly: true,
    terminologyFreeze: [
      {
        termId: "career-element-lane",
        canonicalLabel: "career element lane",
        meaning: "ชุดธาตุอาชีพที่ Source 6 ต้องเลือกจาก weighted strength ของ Source 1 ก่อน แล้วจึงค่อย map เป็นกลุ่มอาชีพตามธาตุ.",
        ownerSource: "source6",
        ownerSurface: "source6-career-business-doctrine.step1-career-element-routing",
        mustNotBeNamedAs: ["useful god", "prompt career vibe", "generic favorable element"],
        note: "Step 1 ต้อง lock owner ของการเลือกธาตุอาชีพก่อนจะพูดถึงรายการอาชีพหรือ prose ภายนอก.",
      },
      {
        termId: "official-star",
        canonicalLabel: "official star",
        meaning: "พิฆาตธาตุของดิถีที่ Source 6 ใช้เป็น owner lane สำหรับหน้าที่การงาน สถานะ และบทบาทงาน.",
        ownerSource: "source6",
        ownerSurface: "source6-career-business-overlay.resolveOfficialStarLane",
        mustNotBeNamedAs: ["wealth star", "output star", "generic power vibe"],
        note: "สถานะงานของ Source 6 ต้องเริ่มจากพิฆาตธาตุ ไม่ใช่ธาตุลาภหรือธาตุถ่ายเท.",
      },
      {
        termId: "career-12-cheingsae",
        canonicalLabel: "career 12 cheingsae",
        meaning: "ระบบ 12 เชี่ยงแซของ Source 6 ที่ใช้ตีความสถานะงาน การเปลี่ยนงาน ความก้าวหน้า และลูกค้าในบริบทการงาน/ธุรกิจ.",
        ownerSource: "source6",
        ownerSurface: "source6-career-business-overlay.interpretCareerStatusByOfficialStarPhase",
        mustNotBeNamedAs: ["12 qi", "twelve-qi-texture", "source1 growth phase"],
        note: "ห้ามยุบ Source 6 cheingsae ไปเป็น texture packet ของ Source 1.",
      },
      {
        termId: "transition-weighting",
        canonicalLabel: "transition weighting",
        meaning: "น้ำหนักมาตรฐานของ Step 4 โดยให้วัยจร 60% และปีจร 40% เมื่อประเมินการเปลี่ยนงานหรือสมัครงาน.",
        ownerSource: "source6",
        ownerSurface: "source6-career-business-overlay.interpretJobTransitionTiming",
        mustNotBeNamedAs: ["equal weighting", "prompt judgment", "generic timing feel"],
        note: "ถ้าไม่มี weighting นี้ Step 4 จะ reopen เป็น prose judgment ทันที.",
      },
      {
        termId: "month-base",
        canonicalLabel: "month base",
        meaning: "ราศีบนหลักเดือนที่ Source 6 ใช้เป็นฐานงานหรือฐานธุรกิจสำหรับ step การเปลี่ยนงาน ความก้าวหน้า ทำเล และลักษณะธุรกิจ.",
        ownerSource: "source6",
        ownerSurface: "source6-career-business-doctrine.month-base-policy",
        mustNotBeNamedAs: ["year customer lane", "prompt business context"],
        note: "ต้องแยก owner ของ month-base ออกจากปีจรและหลักปีซึ่งใช้คนละ lane.",
      },
      {
        termId: "wealth-star",
        canonicalLabel: "wealth star",
        meaning: "ธาตุลาภเชิงโครงสร้างจาก role-of-element packet ของ Source 1 ที่ Source 6 ยืมมาใช้เฉพาะ lane ธุรกิจและการลงทุน.",
        ownerSource: "source1",
        ownerSurface: "symbolic-engine.shared-packets.role-of-element",
        mustNotBeNamedAs: ["official star", "output star"],
        note: "Source 6 ใช้ wealth lane ได้ แต่ห้ามเปลี่ยน owner เชิงโครงสร้างออกจาก Source 1 packet.",
      },
      {
        termId: "output-star",
        canonicalLabel: "output star",
        meaning: "ธาตุถ่ายเทเชิงโครงสร้างจาก role-of-element packet ของ Source 1 ที่ Source 6 ใช้กับทำเลงานและ lane การลงทุน.",
        ownerSource: "source1",
        ownerSurface: "symbolic-engine.shared-packets.role-of-element",
        mustNotBeNamedAs: ["wealth star", "official star"],
        note: "output lane เป็น Source 1 truth ที่ Source 6 หยิบไปตีความต่อ ไม่ใช่ lookup ใหม่ของ Source 6.",
      },
      {
        termId: "year-pillar-customer-lane",
        canonicalLabel: "year pillar customer lane",
        meaning: "lane ลูกค้าของ Source 6 ที่ต้องอ่านจากราศีบนหลักปีเทียบราศีล่างหลักปีในระบบ 12 เชี่ยงแซของสำนัก.",
        ownerSource: "source6",
        ownerSurface: "source6-career-business-overlay.interpretCustomerProfile",
        mustNotBeNamedAs: ["audience persona", "month base", "generic market segment"],
        note: "ลูกค้าของ Source 6 เป็น year-pillar lane โดยตรง ไม่ใช่ผลพลอยได้จาก suitable career topic.",
      },
    ],
    steps: [
      {
        stepId: "step-1-career-element-routing",
        manualStep: 1,
        label: "Career element routing",
        manualIntent: "เลือก career element lane จาก weighted strength ก่อน แล้วค่อย map เป็นกลุ่มอาชีพตามธาตุโดยไม่ให้ topic retrieval เลือกธาตุแทน.",
        source1Reuse: [
          {
            fieldId: "weighted-strength",
            ownerKey: "source1-operating-system-contract.buildSource1StrengthContract",
            note: "strength band เป็น structural owner ของการแยก strong/balanced/weak lanes.",
          },
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "role-of-element packet เป็น owner truth ของ output/wealth/peer/resource labels.",
          },
        ],
        retrievalContextReuse: {
          allowed: true,
          mode: "context-only",
          surfaces: [...CAREER_DELIVERY_SURFACES],
          note: "Current career_potential surfaces may deliver career examples after the deterministic element lane is chosen.",
          guardrails: [
            "topic registry and hybrid retrieval cannot choose output/wealth/peer/resource on their own",
            "Step 1 must still resolve even when Source 6 prose is absent",
          ],
        },
        source6LocalLogic: {
          ownerTarget: {
            module: "source6-career-business-doctrine",
            ownerKey: "step1-career-element-routing",
            status: "existing-owner",
            note: "Phase 1 freezes the routing doctrine here before a runtime resolver exists.",
          },
          responsibilities: [
            "lock the strength-to-career-element mapping",
            "prevent retrieval or prompt prose from becoming the primary routing owner",
          ],
        },
        terminologyIds: ["career-element-lane", "wealth-star", "output-star"],
      },
      {
        stepId: "step-2-official-star-lookup",
        manualStep: 2,
        label: "Official-star lookup",
        manualIntent: "หา official star ของดิถีจาก day master และ role-of-element ก่อนค่อยไปดูตำแหน่งจริงในดวงหรือคำทำนายสถานะงาน.",
        source1Reuse: [
          {
            fieldId: "day-master",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "day master เป็น anchor ต้นทางของ official-star lookup.",
          },
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "role-of-element packet คือ structural truth ของดาวอำนาจก่อนแปลงเป็น Source 6 official-star table.",
          },
          {
            fieldId: "four-pillars",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "ใช้ตรวจว่าพิฆาตธาตุที่ lookup ได้ไปปรากฏตรง stem/branch ใดของดวง.",
          },
        ],
        retrievalContextReuse: RETRIEVAL_UNUSED,
        source6LocalLogic: {
          ownerTarget: {
            module: "source6-career-business-overlay",
            ownerKey: "resolveOfficialStarLane",
            status: "new-owner-required",
            note: "Phase 2 should implement a dedicated official-star resolver instead of borrowing topic prose.",
          },
          responsibilities: [
            "freeze the official-star lookup boundary",
            "keep official-star ownership separate from wealth and output lanes",
          ],
        },
        terminologyIds: ["official-star"],
      },
      {
        stepId: "step-3-career-status-by-official-star-phase",
        manualStep: 3,
        label: "Career status by official-star phase",
        manualIntent: "เทียบ official star กับดิถีในระบบ career 12 cheingsae เพื่อแปลสถานะงานและบทบาทหน้าที่โดยไม่ยืม Source 1 twelve-qi texture มาแทน.",
        source1Reuse: [
          {
            fieldId: "day-master",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "day master เป็นแกนต้นทางของ phase comparison ในสำนัก Source 6.",
          },
          {
            fieldId: "four-pillars",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "ใช้ยืนยันตำแหน่งที่ official star ไปปรากฏจริงในดวงก่อนสรุปสถานะงาน.",
          },
        ],
        retrievalContextReuse: RETRIEVAL_UNUSED,
        source6LocalLogic: {
          ownerTarget: {
            module: "source6-career-business-overlay",
            ownerKey: "interpretCareerStatusByOfficialStarPhase",
            status: "new-owner-required",
            note: "Phase 2 should keep status interpretation behind a dedicated Source 6 phase mapper.",
          },
          responsibilities: [
            "map official-star phase into job-role/status meaning",
            "keep Source 6 cheingsae separate from Source 1 twelve-qi texture",
          ],
        },
        terminologyIds: ["official-star", "career-12-cheingsae"],
      },
      {
        stepId: "step-4-job-transition-weighted-timing",
        manualStep: 4,
        label: "Job transition weighted timing",
        manualIntent: "ประเมินการเปลี่ยนงานและสมัครงานจาก timing packet โดยให้น้ำหนักวัยจร 60/40 กับปีจร แล้วเทียบทั้ง day master และ month-base.",
        source1Reuse: [
          {
            fieldId: "timing",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "timing packet เป็น owner หลักของวัยจรและปีจร.",
          },
          {
            fieldId: "day-master",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "day master เป็น anchor ตัวแรกของ transition scoring.",
          },
          {
            fieldId: "four-pillars",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "month stem จาก four pillars คือ month-base สำหรับงานและธุรกิจ.",
          },
        ],
        retrievalContextReuse: RETRIEVAL_UNUSED,
        source6LocalLogic: {
          ownerTarget: {
            module: "source6-career-business-overlay",
            ownerKey: "interpretJobTransitionTiming",
            status: "new-owner-required",
            note: "Phase 2 should implement the weighted transition scorer explicitly.",
          },
          responsibilities: [
            "lock the 60/40 weighting contract",
            "keep transition scoring separate from broader growth grouping",
          ],
        },
        terminologyIds: ["transition-weighting", "month-base", "career-12-cheingsae"],
      },
      {
        stepId: "step-5-career-growth-grouping",
        manualStep: 5,
        label: "Career growth grouping",
        manualIntent: "จัดกลุ่มความก้าวหน้าเป็น good/neutral/bad จาก timing เทียบ day master และ month-base โดยไม่เอา Step 4 weighting ไปแทนคำทำนายกลุ่มสุดท้าย.",
        source1Reuse: [
          {
            fieldId: "timing",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "ความก้าวหน้าของ Step 5 ยังคงยืนบน timing packet เหมือน Step 4.",
          },
          {
            fieldId: "day-master",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "day master เป็นแกนของ group forecast ตาม school corpus.",
          },
          {
            fieldId: "four-pillars",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "month-base ใช้เป็นฐานงาน/ธุรกิจของ Step 5 เช่นเดียวกับ corpus ต้นฉบับ.",
          },
        ],
        retrievalContextReuse: {
          allowed: true,
          mode: "context-only",
          surfaces: [...CAREER_DELIVERY_SURFACES],
          note: "career_potential surfaces may deliver the final wording for growth outcomes after grouping is already fixed.",
          guardrails: [
            "retrieval surfaces cannot decide which qi phases count as good, neutral, or bad",
            "Step 5 must remain explainable from timing plus month-base provenance",
          ],
        },
        source6LocalLogic: {
          ownerTarget: {
            module: "source6-career-business-overlay",
            ownerKey: "classifyCareerGrowthGroup",
            status: "new-owner-required",
            note: "Phase 2 should keep growth grouping explicit instead of burying it in prose.",
          },
          responsibilities: [
            "group career/business progression outcomes",
            "keep grouped forecast separate from weighted transition scoring",
          ],
        },
        terminologyIds: ["career-12-cheingsae", "month-base"],
      },
      {
        stepId: "step-6-work-location-domestic-vs-international",
        manualStep: 6,
        label: "Work location domestic vs international",
        manualIntent: "เอา output star ไปเทียบ month-base สำหรับงานในประเทศ และเทียบหลักปีสำหรับต่างประเทศ โดยให้ conflict-context เป็นตัวกลับความหมายเมื่อชง เฮ้ง หรือผั่วแรง.",
        source1Reuse: [
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "output star มาจาก role-of-element packet ของ Source 1 โดยตรง.",
          },
          {
            fieldId: "four-pillars",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "month-base และ year anchors ใช้เทียบในประเทศ/ต่างประเทศตาม corpus.",
          },
          {
            fieldId: "conflict-context",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "conflict-context packet เป็น owner ของกฎกลับความหมายเมื่อ interaction เปลี่ยนผลดี/เสีย.",
          },
        ],
        retrievalContextReuse: RETRIEVAL_UNUSED,
        source6LocalLogic: {
          ownerTarget: {
            module: "source6-career-business-overlay",
            ownerKey: "evaluateWorkLocationPreference",
            status: "new-owner-required",
            note: "Phase 2 should build a dedicated location evaluator with explicit inversion rules.",
          },
          responsibilities: [
            "compare output star against month and year lanes",
            "apply conflict-driven inversion without leaking into business-nature ownership",
          ],
        },
        terminologyIds: ["output-star", "month-base"],
      },
      {
        stepId: "step-7-business-nature-and-investment",
        manualStep: 7,
        label: "Business nature and investment",
        manualIntent: "ใช้ wealth star เทียบ month-base เพื่อได้ business nature A/B แล้วค่อยใช้ output star เสริม lane การลงทุน โดยไม่ให้ output กลายเป็น owner แทน wealth lane.",
        source1Reuse: [
          {
            fieldId: "weighted-strength",
            ownerKey: "source1-operating-system-contract.buildSource1StrengthContract",
            note: "ใช้คุม guardrail ว่าธุรกิจควรถูกแนะนำเมื่อดวงและพลังพร้อมแค่ไหน.",
          },
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "wealth star และ output star ต่างมาจาก role-of-element packet เดียวกันแต่คนละ owner lane.",
          },
          {
            fieldId: "four-pillars",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "month-base เป็นฐานธุรกิจของทั้ง business nature และ investment coupling.",
          },
        ],
        retrievalContextReuse: {
          allowed: true,
          mode: "context-only",
          surfaces: [...CAREER_DELIVERY_SURFACES],
          note: "career_potential retrieval may later contribute keyword examples, but it cannot own the A/B wealth logic or the investment coupling.",
          guardrails: [
            "retrieval surfaces cannot blend wealth-lane result A with business-base result B",
            "output-star investment hints cannot replace wealth-star business ownership",
          ],
        },
        source6LocalLogic: {
          ownerTarget: {
            module: "source6-career-business-overlay",
            ownerKey: "interpretBusinessNatureAndInvestment",
            status: "new-owner-required",
            note: "Phase 2 should keep business and investment coupling behind a typed owner.",
          },
          responsibilities: [
            "blend wealth-star business nature results with month-base context",
            "attach output-star investment hints without overwriting wealth ownership",
          ],
        },
        terminologyIds: ["wealth-star", "output-star", "month-base"],
      },
      {
        stepId: "step-8-customer-analysis",
        manualStep: 8,
        label: "Customer analysis",
        manualIntent: "อ่านลักษณะกลุ่มลูกค้าจาก year stem เทียบ year branch ในระบบ career 12 cheingsae แล้วใช้ conflict-context เป็นตัวกลับความหมายเมื่อหลักปีมีปฏิกิริยาแรง.",
        source1Reuse: [
          {
            fieldId: "four-pillars",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "หลักปีเป็น owner anchor ของ customer lane ตาม corpus ต้นฉบับ.",
          },
          {
            fieldId: "conflict-context",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "ใช้เป็น flip rule เมื่อ year pillar เจอ interaction ที่เปลี่ยนความหมาย.",
          },
        ],
        retrievalContextReuse: RETRIEVAL_UNUSED,
        source6LocalLogic: {
          ownerTarget: {
            module: "source6-career-business-overlay",
            ownerKey: "interpretCustomerProfile",
            status: "new-owner-required",
            note: "Phase 2 should keep customer profiling in its own evaluator rather than piggybacking on suitable-career output.",
          },
          responsibilities: [
            "map year-pillar cheingsae into customer profile meanings",
            "keep customer analysis separate from month-base business reasoning",
          ],
        },
        terminologyIds: ["year-pillar-customer-lane", "career-12-cheingsae"],
      },
    ],
  });
}