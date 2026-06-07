import { z } from "zod";

export const SOURCE4_WEALTH_INVESTMENT_STEP_IDS = [
  "step-1-wealth-capacity-routing",
  "step-2-wealth-element-storage-destroyer-lookup",
  "step-3-money-source-storage-and-leakage",
  "step-4-spending-and-investment-behavior",
  "step-5-wealth-solution-lane",
  "step-6-wealth-timing-and-risk-window",
] as const;

export const SOURCE4_TERMINOLOGY_IDS = [
  "wealth-capacity-band",
  "wealth-element-lane",
  "wealth-storage-vault",
  "vault-destroyer-pressure",
  "output-investment-lane",
  "wealth-solution-lane",
  "wealth-timing-window",
] as const;

const Source4WealthInvestmentStepIdSchema = z.enum(SOURCE4_WEALTH_INVESTMENT_STEP_IDS);
const Source4TerminologyIdSchema = z.enum(SOURCE4_TERMINOLOGY_IDS);

const Source4Source1ReuseSchema = z.object({
  fieldId: z.enum(["weighted-strength", "role-of-element", "timing"]),
  ownerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source4RetrievalContextReuseSchema = z.object({
  allowed: z.boolean(),
  mode: z.enum(["not-used", "context-only"]),
  surfaces: z.array(z.string().trim().min(1)),
  note: z.string().trim().min(1),
  guardrails: z.array(z.string().trim().min(1)).min(1),
});

const Source4OwnerTargetSchema = z.object({
  module: z.string().trim().min(1),
  ownerKey: z.string().trim().min(1),
  status: z.enum(["existing-owner", "new-owner-required", "gap-classified"]),
  note: z.string().trim().min(1),
});

const Source4LocalLogicSchema = z.object({
  ownerTarget: Source4OwnerTargetSchema,
  responsibilities: z.array(z.string().trim().min(1)).min(1),
});

const Source4WealthInvestmentDoctrineStepSchema = z.object({
  stepId: Source4WealthInvestmentStepIdSchema,
  manualStep: z.number().int().min(1).max(6),
  label: z.string().trim().min(1),
  manualIntent: z.string().trim().min(1),
  source1Reuse: z.array(Source4Source1ReuseSchema).min(1),
  retrievalContextReuse: Source4RetrievalContextReuseSchema,
  source4LocalLogic: Source4LocalLogicSchema,
  terminologyIds: z.array(Source4TerminologyIdSchema).min(1),
});

const Source4TerminologyFreezeSchema = z.object({
  termId: Source4TerminologyIdSchema,
  canonicalLabel: z.string().trim().min(1),
  meaning: z.string().trim().min(1),
  ownerSource: z.enum(["source1", "source4"]),
  ownerSurface: z.string().trim().min(1),
  mustNotBeNamedAs: z.array(z.string().trim().min(1)).default([]),
  note: z.string().trim().min(1),
});

export const Source4WealthInvestmentDoctrineSchema = z.object({
  sourceId: z.literal("source-4"),
  preserveSource1Authority: z.literal(true),
  allowRetrievalContextOnly: z.literal(true),
  forbidSource7LuckSmuggling: z.literal(true),
  terminologyFreeze: z.array(Source4TerminologyFreezeSchema).length(SOURCE4_TERMINOLOGY_IDS.length),
  steps: z.array(Source4WealthInvestmentDoctrineStepSchema).length(SOURCE4_WEALTH_INVESTMENT_STEP_IDS.length),
});

export type Source4WealthInvestmentDoctrine = z.infer<typeof Source4WealthInvestmentDoctrineSchema>;

const WEALTH_DELIVERY_SURFACES = [
  "topic-registry.wealth_luck",
  "wealthAndInvestmentDictionary",
  "hybrid-retrieval.wealth_and_investment",
] as const;

const RETRIEVAL_UNUSED = {
  allowed: false,
  mode: "not-used",
  surfaces: [],
  note: "Current wealth topic and retrieval surfaces do not own this deterministic lane during the doctrine-freeze phase.",
  guardrails: [
    "Prompt or retrieval wording cannot be promoted into primary logic for this step",
  ],
} as const;

export function buildSource4WealthInvestmentDoctrine(): Source4WealthInvestmentDoctrine {
  return Source4WealthInvestmentDoctrineSchema.parse({
    sourceId: "source-4",
    preserveSource1Authority: true,
    allowRetrievalContextOnly: true,
    forbidSource7LuckSmuggling: true,
    terminologyFreeze: [
      {
        termId: "wealth-capacity-band",
        canonicalLabel: "wealth capacity band",
        meaning: "ระดับความสามารถหาและถือเงินที่ Source 4 ต้องอ่านจาก weighted strength ก่อน แล้วค่อยแปลเป็นคำทำนายการเงิน.",
        ownerSource: "source4",
        ownerSurface: "source4-wealth-investment-doctrine.step1-wealth-capacity-routing",
        mustNotBeNamedAs: ["fortune score", "wealth luck promise", "source7 money remedy"],
        note: "Step 1 ต้อง lock ความต่างระหว่างหาเงินได้กับเก็บเงินอยู่ก่อนมี prose หรือ timing wording ใดๆ.",
      },
      {
        termId: "wealth-element-lane",
        canonicalLabel: "wealth element lane",
        meaning: "ธาตุลาภเชิงโครงสร้างจาก role-of-element packet ของ Source 1 ที่ Source 4 ใช้เป็น anchor ก่อนแตกเป็น storage, leakage, และ timing meaning.",
        ownerSource: "source1",
        ownerSurface: "symbolic-engine.shared-packets.role-of-element",
        mustNotBeNamedAs: ["career wealth vibe", "relationship money mood"],
        note: "Source 4 reuse ได้ แต่ห้ามย้าย owner structural wealth lane ออกจาก Source 1 packet.",
      },
      {
        termId: "wealth-storage-vault",
        canonicalLabel: "wealth storage vault",
        meaning: "คลังทรัพย์ที่ Source 4 ต้อง resolve เป็น owner lane ของการสะสมและความมั่นคง ก่อนพูดถึงรายได้หรือรั่วไหล.",
        ownerSource: "source4",
        ownerSurface: "source4-wealth-investment-rules.resolveWealthStorageVault",
        mustNotBeNamedAs: ["career vault", "partner palace", "generic asset bucket"],
        note: "Lookup นี้เป็น Source 4-local rule table แม้จะตั้งต้นจาก wealth element lane เดียวกัน.",
      },
      {
        termId: "vault-destroyer-pressure",
        canonicalLabel: "vault destroyer pressure",
        meaning: "แรงเปิดคลังหรือแรงทำลายคลังที่ Source 4 ใช้แยก usable storage ออกจาก leakage pressure และห้ามลดเหลือเพียง prose เตือนการเงิน.",
        ownerSource: "source4",
        ownerSurface: "source4-wealth-investment-rules.classifyVaultPressure",
        mustNotBeNamedAs: ["bad money luck", "generic leak vibe", "relationship conflict"],
        note: "ต้องแยกแรงเปิดคลังที่ใช้เงินได้ออกจากแรงทำลายที่ทำให้เก็บไม่อยู่.",
      },
      {
        termId: "output-investment-lane",
        canonicalLabel: "output investment lane",
        meaning: "lane การใช้จ่ายและการลงทุนที่ Source 4 อ่านจาก output relation ใน role-of-element packet แล้วค่อยจำกัดความหมายด้าน risk/behavior ของตนเอง.",
        ownerSource: "source4",
        ownerSurface: "source4-wealth-investment-rules.interpretOutputInvestmentLane",
        mustNotBeNamedAs: ["source6 business lane", "career investment advice", "windfall trigger"],
        note: "ถึงจะแตะเรื่องลงทุนได้ แต่ owner ของ behavior นี้ยังอยู่ที่ Source 4 ไม่ใช่ Source 6.",
      },
      {
        termId: "wealth-solution-lane",
        canonicalLabel: "wealth solution lane",
        meaning: "lane คำแนะนำปรับสมดุลการเงินของ Source 4 ที่จำกัดอยู่ในกรอบธาตุและธุรกิจที่สอดคล้องกับ capacity band เท่านั้น.",
        ownerSource: "source4",
        ownerSurface: "source4-wealth-investment-rules.resolveWealthSolutionLane",
        mustNotBeNamedAs: ["source7 remedy", "lucky color shortcut", "fortune enhancement"],
        note: "Step 5 ให้คำแนะนำเชิงสมดุลได้ แต่ห้ามข้ามไปเป็นการเสริมดวงแบบ Source 7.",
      },
      {
        termId: "wealth-timing-window",
        canonicalLabel: "wealth timing window",
        meaning: "หน้าต่างเวลาการเงินที่ Source 4 ต้องอ่านจาก timing packet เทียบ capacity และ wealth lane เพื่อสรุปโอกาส/ความเสี่ยงอย่างมีขอบเขต.",
        ownerSource: "source4",
        ownerSurface: "source4-wealth-investment-rules.interpretWealthTimingWindow",
        mustNotBeNamedAs: ["guaranteed rich year", "source7 luck cycle", "jackpot promise"],
        note: "Step 6 ต้องจบที่ bounded timing guidance ไม่ใช่คำสัญญาเรื่องลาภลอย.",
      },
    ],
    steps: [
      {
        stepId: "step-1-wealth-capacity-routing",
        manualStep: 1,
        label: "Wealth capacity routing",
        manualIntent: "จัด wealth capacity band จาก weighted strength ก่อน แล้วค่อยให้ delivery surfaces พูดเรื่องหาเงิน/เก็บเงินได้ โดยไม่ให้ prose หรือ timing lane ตัดสินแทน.",
        source1Reuse: [
          {
            fieldId: "weighted-strength",
            ownerKey: "source1-operating-system-contract.buildSource1StrengthContract",
            note: "strength band เป็น structural owner ของความสามารถหาและถือเงิน.",
          },
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "wealth/output labels จาก shared packet ใช้เป็น supporting anchors หลังจาก band ถูกเลือกแล้ว.",
          },
        ],
        retrievalContextReuse: {
          allowed: true,
          mode: "context-only",
          surfaces: [...WEALTH_DELIVERY_SURFACES],
          note: "wealth topic surfaces อาจช่วยบรรยายผลหลัง wealth capacity band ถูกเลือกแล้วเท่านั้น.",
          guardrails: [
            "topic registry and hybrid retrieval cannot choose the wealth capacity band",
            "Step 1 must remain readable even when Source 4 prose is absent",
          ],
        },
        source4LocalLogic: {
          ownerTarget: {
            module: "source4-wealth-investment-doctrine",
            ownerKey: "step1-wealth-capacity-routing",
            status: "existing-owner",
            note: "Phase 1 freezes the capacity doctrine here before a runtime classifier exists.",
          },
          responsibilities: [
            "lock the strength-to-wealth-capacity mapping",
            "prevent delivery wording from becoming the primary owner of money capacity",
          ],
        },
        terminologyIds: ["wealth-capacity-band", "wealth-element-lane"],
      },
      {
        stepId: "step-2-wealth-element-storage-destroyer-lookup",
        manualStep: 2,
        label: "Wealth element, storage, and destroyer lookup",
        manualIntent: "freeze wealth element, storage vault, and destroyer lookup as a Source 4 owner lane using role-of-element truth, without widening the caller contract beyond Source 1 shared packets.",
        source1Reuse: [
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "role-of-element packet is the structural anchor for identifying the wealth lane before Source 4 maps its storage rules.",
          },
        ],
        retrievalContextReuse: RETRIEVAL_UNUSED,
        source4LocalLogic: {
          ownerTarget: {
            module: "source4-wealth-investment-rules",
            ownerKey: "resolveWealthElementAndStorageLookup",
            status: "new-owner-required",
            note: "Phase 2 should implement the typed wealth/storage/destroyer lookup explicitly.",
          },
          responsibilities: [
            "freeze the wealth lane lookup boundary",
            "separate structural wealth storage from later leakage or investment wording",
          ],
        },
        terminologyIds: ["wealth-element-lane", "wealth-storage-vault", "vault-destroyer-pressure"],
      },
      {
        stepId: "step-3-money-source-storage-and-leakage",
        manualStep: 3,
        label: "Money source, storage, and leakage",
        manualIntent: "ตีความว่าเงินมาจาก lane ใด เก็บได้มากน้อยแค่ไหน และมีแรงรั่วไหลแบบใด โดยยืนบน wealth lane กับ timing pressure แทนการยืม Source 5 หรือ Source 6 มาเป็น owner ความหมาย.",
        source1Reuse: [
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "wealth lane และ output relation ยังคงเป็น Source 1 truth ก่อนแตกเป็นที่มาและ leakage language.",
          },
          {
            fieldId: "timing",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "timing packet ใช้กด/ผ่อนแรง storage pressure โดยไม่ต้องเปิด overlay อื่นเพิ่ม.",
          },
        ],
        retrievalContextReuse: {
          allowed: true,
          mode: "context-only",
          surfaces: [...WEALTH_DELIVERY_SURFACES],
          note: "wealth delivery surfaces อาจช่วยบอกตัวอย่างรายได้หรือคำอธิบายหลัง source/storage/leakage ถูก fix แล้ว.",
          guardrails: [
            "delivery surfaces cannot decide money source or leakage severity",
            "Step 3 must stay separate from partner or career narrative by default",
          ],
        },
        source4LocalLogic: {
          ownerTarget: {
            module: "source4-wealth-investment-rules",
            ownerKey: "interpretWealthStorageAndLeakage",
            status: "new-owner-required",
            note: "Phase 2 should keep source/storage/leakage interpretation behind a typed owner.",
          },
          responsibilities: [
            "map wealth storage into source and leakage meanings",
            "prevent relationship or work overlays from becoming the default money explanation",
          ],
        },
        terminologyIds: ["wealth-storage-vault", "vault-destroyer-pressure", "wealth-element-lane"],
      },
      {
        stepId: "step-4-spending-and-investment-behavior",
        manualStep: 4,
        label: "Spending and investment behavior",
        manualIntent: "อ่านพฤติกรรมใช้จ่ายและการลงทุนจาก output-investment lane โดยให้ Source 6 business wording เป็น context-only ได้ แต่ห้ามย้าย owner ของ money-risk behavior ออกนอก Source 4.",
        source1Reuse: [
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "output relation remains the structural anchor for behavior and investment posture.",
          },
          {
            fieldId: "timing",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "timing packet bounds whether a behavior should be interpreted as active risk or delayed caution.",
          },
        ],
        retrievalContextReuse: {
          allowed: true,
          mode: "context-only",
          surfaces: [...WEALTH_DELIVERY_SURFACES],
          note: "delivery surfaces may narrate examples after the spending/investment lane is already fixed.",
          guardrails: [
            "retrieval surfaces cannot decide whether the chart is aggressive, conservative, or leakage-prone",
            "Source 6 business examples cannot replace Source 4 money-risk ownership",
          ],
        },
        source4LocalLogic: {
          ownerTarget: {
            module: "source4-wealth-investment-rules",
            ownerKey: "interpretSpendingAndInvestmentBehavior",
            status: "new-owner-required",
            note: "Phase 2 should keep spending and investment behavior typed and separate from work fit.",
          },
          responsibilities: [
            "map output lane into spending and investment behavior",
            "keep money-risk meaning separate from Source 6 operational business advice",
          ],
        },
        terminologyIds: ["output-investment-lane", "wealth-element-lane"],
      },
      {
        stepId: "step-5-wealth-solution-lane",
        manualStep: 5,
        label: "Wealth solution lane",
        manualIntent: "ให้คำแนะนำเชิงสมดุลเรื่องธาตุและธุรกิจตาม capacity band โดยจำกัดขอบเขตไว้ที่ Source 4 และห้าม smuggle คำอธิบายหรือคำแก้ดวงแบบ Source 7 เข้ามา.",
        source1Reuse: [
          {
            fieldId: "weighted-strength",
            ownerKey: "source1-operating-system-contract.buildSource1StrengthContract",
            note: "capacity band ยังคงเป็นเจ้าของการตัดสินว่าควรเสริมหรือระบายพลังแบบไหน.",
          },
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "element roles constrain which business/element lanes are legitimate advice surfaces.",
          },
        ],
        retrievalContextReuse: RETRIEVAL_UNUSED,
        source4LocalLogic: {
          ownerTarget: {
            module: "source4-wealth-investment-rules",
            ownerKey: "resolveWealthSolutionLane",
            status: "new-owner-required",
            note: "Phase 2 should keep wealth-solution recommendations explicitly bounded.",
          },
          responsibilities: [
            "translate capacity and element truth into bounded wealth advice",
            "forbid Source 7 remedy logic from becoming the owner of Source 4 guidance",
          ],
        },
        terminologyIds: ["wealth-solution-lane", "wealth-capacity-band"],
      },
      {
        stepId: "step-6-wealth-timing-and-risk-window",
        manualStep: 6,
        label: "Wealth timing and risk window",
        manualIntent: "ตัดสิน wealth timing window และขอบเขตความเสี่ยงจาก timing packet เทียบ capacity กับ wealth lane โดยไม่ให้ Source 7 luck logic หรือ Source 6 job timing กลายเป็น owner แทน.",
        source1Reuse: [
          {
            fieldId: "weighted-strength",
            ownerKey: "source1-operating-system-contract.buildSource1StrengthContract",
            note: "capacity band constrains how much timing can be safely acted on.",
          },
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "wealth/output lanes still anchor what kind of money movement is being timed.",
          },
          {
            fieldId: "timing",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "timing packet is the only allowed temporal owner for Source 4 windowing during this phase.",
          },
        ],
        retrievalContextReuse: {
          allowed: true,
          mode: "context-only",
          surfaces: [...WEALTH_DELIVERY_SURFACES],
          note: "delivery surfaces may narrate a wealth window after the timing window is fixed deterministically.",
          guardrails: [
            "delivery surfaces cannot promise windfalls or guaranteed rich years",
            "Step 6 must stay explainable from timing plus Source 4 wealth doctrine",
          ],
        },
        source4LocalLogic: {
          ownerTarget: {
            module: "source4-wealth-investment-rules",
            ownerKey: "interpretWealthTimingWindow",
            status: "new-owner-required",
            note: "Phase 2 should implement the wealth timing classifier with explicit risk boundaries.",
          },
          responsibilities: [
            "map timing packet truth into a bounded wealth window",
            "prevent Source 7 luck promises and Source 6 job timing from overwriting money timing",
          ],
        },
        terminologyIds: ["wealth-timing-window", "wealth-capacity-band", "output-investment-lane"],
      },
    ],
  });
}