import { z } from "zod";

export const SOURCE5_RELATIONSHIP_STEP_IDS = [
  "step-1-relationship-potential",
  "step-2-day-stem-vs-spouse-base",
  "step-3-spouse-element-lookup",
  "step-4-relationship-12-cheingsae",
  "step-5-conflict-and-interaction",
  "step-6-marriage-timing",
  "step-7-special-rules-and-spouse-profile",
] as const;

export const SOURCE5_TERMINOLOGY_IDS = [
  "spouse-element",
  "hidden-spouse-element",
  "relationship-12-cheingsae",
  "twelve-qi-texture",
  "special-relationship-rules",
] as const;

const Source5RelationshipStepIdSchema = z.enum(SOURCE5_RELATIONSHIP_STEP_IDS);
const Source5TerminologyIdSchema = z.enum(SOURCE5_TERMINOLOGY_IDS);

const Source5Source1ReuseSchema = z.object({
  fieldId: z.string().trim().min(1),
  ownerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source5Source2FlavorReuseSchema = z.object({
  allowed: z.literal(true),
  mode: z.literal("flavor-only"),
  surfaces: z.array(z.string().trim().min(1)),
  note: z.string().trim().min(1),
  guardrails: z.array(z.string().trim().min(1)).min(1),
});

const Source5OwnerTargetSchema = z.object({
  module: z.string().trim().min(1),
  ownerKey: z.string().trim().min(1),
  status: z.enum(["existing-owner", "new-owner-required", "gap-classified"]),
  note: z.string().trim().min(1),
});

const Source5LocalLogicSchema = z.object({
  ownerTarget: Source5OwnerTargetSchema,
  responsibilities: z.array(z.string().trim().min(1)).min(1),
});

const Source5RelationshipDoctrineStepSchema = z.object({
  stepId: Source5RelationshipStepIdSchema,
  manualStep: z.number().int().min(1).max(7),
  label: z.string().trim().min(1),
  manualIntent: z.string().trim().min(1),
  source1Reuse: z.array(Source5Source1ReuseSchema).min(1),
  source2FlavorReuse: Source5Source2FlavorReuseSchema,
  source5LocalLogic: Source5LocalLogicSchema,
  terminologyIds: z.array(Source5TerminologyIdSchema).min(1),
});

const Source5TerminologyFreezeSchema = z.object({
  termId: Source5TerminologyIdSchema,
  canonicalLabel: z.string().trim().min(1),
  meaning: z.string().trim().min(1),
  ownerSource: z.enum(["source1", "source5"]),
  ownerSurface: z.string().trim().min(1),
  mustNotBeNamedAs: z.array(z.string().trim().min(1)).default([]),
  note: z.string().trim().min(1),
});

export const Source5RelationshipDoctrineSchema = z.object({
  sourceId: z.literal("source-5"),
  preserveSource1Authority: z.literal(true),
  allowSource2FlavorOnly: z.literal(true),
  terminologyFreeze: z.array(Source5TerminologyFreezeSchema).length(SOURCE5_TERMINOLOGY_IDS.length),
  steps: z.array(Source5RelationshipDoctrineStepSchema).length(SOURCE5_RELATIONSHIP_STEP_IDS.length),
});

export type Source5RelationshipDoctrine = z.infer<typeof Source5RelationshipDoctrineSchema>;

export function buildSource5RelationshipDoctrine(): Source5RelationshipDoctrine {
  return Source5RelationshipDoctrineSchema.parse({
    sourceId: "source-5",
    preserveSource1Authority: true,
    allowSource2FlavorOnly: true,
    terminologyFreeze: [
      {
        termId: "spouse-element",
        canonicalLabel: "spouse element",
        meaning: "ธาตุคู่ครองหลักที่ต้อง resolve จาก day master, gender, และ role-of-element rules ก่อนตีความคำทำนาย Source 5.",
        ownerSource: "source5",
        ownerSurface: "source5-relationship-overlay.resolveSpouseElement",
        mustNotBeNamedAs: ["personality route", "12 qi", "love matrix mood"],
        note: "นี่คือ owner truth ของ Step 3 และห้ามถูกแทนที่ด้วย wording จาก Source 2.",
      },
      {
        termId: "hidden-spouse-element",
        canonicalLabel: "hidden spouse element",
        meaning: "ธาตุคู่ครองแฝงที่ต้องอ่านจาก hidden stems ในฐานคู่ก่อนตัดสินกำลังหรือ profile คู่ครอง.",
        ownerSource: "source5",
        ownerSurface: "source5-relationship-overlay.resolveSpouseElement",
        mustNotBeNamedAs: ["secondary personality", "hidden mood"],
        note: "ถือเป็นกฎ Source 5-local ไม่ใช่ refinement lane ของ Source 2.",
      },
      {
        termId: "relationship-12-cheingsae",
        canonicalLabel: "relationship 12 cheingsae",
        meaning: "ระบบ 12 เชี่ยงแซสำหรับคุณภาพความรักและชีวิตคู่ ต้องมี owner แยกจาก packet texture ของ Source 1.",
        ownerSource: "source5",
        ownerSurface: "source5-relationship-overlay.interpretRelationshipTwelveCheingsae",
        mustNotBeNamedAs: ["12 qi", "twelve qi texture", "growth phase"],
        note: "Step 4 ต้องใช้คำนี้เท่านั้นเมื่อพูดถึง quality lane ของความสัมพันธ์.",
      },
      {
        termId: "twelve-qi-texture",
        canonicalLabel: "12 qi texture",
        meaning: "packet เชิงโครงสร้างจาก Source 1 ที่ใช้เป็น evidence texture เท่านั้น ไม่ใช่ quality owner ของความรัก.",
        ownerSource: "source1",
        ownerSurface: "symbolic-engine.shared-packets.twelve-qi-texture",
        mustNotBeNamedAs: ["relationship 12 cheingsae", "marriage quality scale"],
        note: "อนุญาตให้เป็น context ได้ แต่ห้ามใช้แทน Step 4.",
      },
      {
        termId: "special-relationship-rules",
        canonicalLabel: "special relationship rules",
        meaning: "กฎพิเศษเรื่อง affair, spouse profile, และเงื่อนไขเฉพาะสำนักที่เกินกว่า conflict-context packet ปกติ.",
        ownerSource: "source5",
        ownerSurface: "source5-relationship-overlay.evaluateSpecialRelationshipRules",
        mustNotBeNamedAs: ["conflict packet", "source2 refinement"],
        note: "Step 7 ต้องแยก owner จาก Step 5 แม้จะ reuse structural anchors บางตัวร่วมกัน.",
      },
    ],
    steps: [
      {
        stepId: "step-1-relationship-potential",
        manualStep: 1,
        label: "Relationship potential by gender and strength",
        manualIntent: "ดูโอกาสการมีคู่จากเพศและความแข็งแรงดิถีโดยไม่ recompute Source 1 anchors.",
        source1Reuse: [
          {
            fieldId: "weighted-strength",
            ownerKey: "source1-operating-system-contract.buildSource1StrengthContract",
            note: "strength state เป็น structural truth หลักของ step นี้",
          },
          {
            fieldId: "gender",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "เพศใช้เป็น input owner ของตารางโอกาสการมีคู่",
          },
        ],
        source2FlavorReuse: {
          allowed: true,
          mode: "flavor-only",
          surfaces: ["routing narrative"],
          note: "อนุญาตให้ Source 2 เติมน้ำเสียงการรักหลังตัดสิน potential แล้วเท่านั้น.",
          guardrails: [
            "Source 2 ห้ามตัดสินว่ามีคู่ยากง่ายแทน Step 1",
            "ต้องอ่านผล Step 1 ได้ครบแม้ไม่มี Source 2 wording",
          ],
        },
        source5LocalLogic: {
          ownerTarget: {
            module: "source5-relationship-doctrine",
            ownerKey: "step1-potential-by-gender-strength",
            status: "existing-owner",
            note: "Phase 1 freeze logic ownership here before runtime interpreter exists.",
          },
          responsibilities: [
            "lock the gender x strength interpretation lane",
            "prevent Source 2 routing from becoming primary logic",
          ],
        },
        terminologyIds: ["spouse-element"],
      },
      {
        stepId: "step-2-day-stem-vs-spouse-base",
        manualStep: 2,
        label: "Day stem versus spouse base reaction",
        manualIntent: "ดูปฏิกิริยาระหว่างดิถีกับฐานคู่เพื่อแปลภาษาความสัมพันธ์ของ Source 5.",
        source1Reuse: [
          {
            fieldId: "four-pillars",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "day stem/day branch เป็น anchor ของการตีความฐานคู่",
          },
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "ใช้เช็คความหมายเชิง relation ก่อนแปลภาษารัก",
          },
        ],
        source2FlavorReuse: {
          allowed: true,
          mode: "flavor-only",
          surfaces: ["day-pillar refinement"],
          note: "ใช้ refinement เป็น texture ของ reaction ได้ แต่ห้ามเป็น owner ของ rule table.",
          guardrails: [
            "Source 2 refinement ห้าม override reaction owner ของ Step 2",
            "ต้องมี deterministic Step 2 output แม้ไม่มี 60 Jiazi narrative",
          ],
        },
        source5LocalLogic: {
          ownerTarget: {
            module: "source5-relationship-overlay",
            ownerKey: "interpretDayStemVsSpouseBase",
            status: "new-owner-required",
            note: "ต้องสร้าง runtime interpreter แยกใน Phase 3.",
          },
          responsibilities: [
            "interpret day stem vs spouse-base reaction",
            "separate structural relation from wording flavor",
          ],
        },
        terminologyIds: ["spouse-element"],
      },
      {
        stepId: "step-3-spouse-element-lookup",
        manualStep: 3,
        label: "Spouse element lookup and strength",
        manualIntent: "หา spouse element, hidden spouse element, และกำลังของคู่แบบสำนัก Source 5.",
        source1Reuse: [
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "ใช้เป็นฐานหา spouse element ตรงตามเพศและดิถี",
          },
          {
            fieldId: "four-pillars",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "day branch และ hidden stems เป็น anchor ของ hidden spouse element",
          },
          {
            fieldId: "weighted-strength",
            ownerKey: "source1-operating-system-contract.buildSource1StrengthContract",
            note: "ใช้ตีความกำลังของคู่หลัง resolve ธาตุแล้ว",
          },
        ],
        source2FlavorReuse: {
          allowed: true,
          mode: "flavor-only",
          surfaces: ["routing narrative", "day-pillar refinement"],
          note: "ใช้บรรยายสไตล์คู่ครองได้หลัง resolve spouse element แล้วเท่านั้น.",
          guardrails: [
            "Source 2 ห้าม derive spouse element หรือ hidden spouse element",
            "Source 2 ห้าม classify spouse strength",
          ],
        },
        source5LocalLogic: {
          ownerTarget: {
            module: "source5-relationship-overlay",
            ownerKey: "resolveSpouseElement",
            status: "new-owner-required",
            note: "owner หลักของ Step 3 ยังต้องสร้าง runtime surface.",
          },
          responsibilities: [
            "resolve spouse element and hidden spouse element",
            "classify spouse strength with Source 5 doctrine rules",
          ],
        },
        terminologyIds: ["spouse-element", "hidden-spouse-element"],
      },
      {
        stepId: "step-4-relationship-12-cheingsae",
        manualStep: 4,
        label: "Relationship 12 cheingsae quality",
        manualIntent: "ตีความ 12 เชี่ยงแซด้านความรักโดยแยก owner ออกจาก 12 Qi texture.",
        source1Reuse: [
          {
            fieldId: "four-pillars",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "ใช้ anchor structural ที่เกี่ยวกับฐานคู่และตำแหน่งในดวง",
          },
        ],
        source2FlavorReuse: {
          allowed: true,
          mode: "flavor-only",
          surfaces: [],
          note: "Step 4 ไม่ต้องพึ่ง Source 2 เพื่อทำ quality classification.",
          guardrails: [
            "Source 2 ห้ามตั้งชื่อหรือตีความ 12 cheingsae",
            "12 qi texture ห้ามถูกนำมาแทน quality owner ของ Step 4",
          ],
        },
        source5LocalLogic: {
          ownerTarget: {
            module: "source5-relationship-overlay",
            ownerKey: "interpretRelationshipTwelveCheingsae",
            status: "new-owner-required",
            note: "owner หลักของ Step 4 ยังไม่มี runtime surface ปัจจุบัน.",
          },
          responsibilities: [
            "compute relationship quality from Source 5 12 cheingsae rules",
            "keep quality lane separate from twelve-qi texture evidence",
          ],
        },
        terminologyIds: ["relationship-12-cheingsae", "twelve-qi-texture"],
      },
      {
        stepId: "step-5-conflict-and-interaction",
        manualStep: 5,
        label: "Conflict and interaction impact on relationship",
        manualIntent: "อ่านฮะ ชง เฮ้ง ผั่ว ภาคี ที่กระทบคู่ โดยรักษา precedence ของ conflict-context packet.",
        source1Reuse: [
          {
            fieldId: "conflict-context",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "packet นี้เป็น owner structural หลักของ interaction precedence",
          },
          {
            fieldId: "four-pillars",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "ใช้ระบุตำแหน่งที่โดนกระทบในดวง",
          },
        ],
        source2FlavorReuse: {
          allowed: true,
          mode: "flavor-only",
          surfaces: ["routing narrative", "twelve-qi evidence"],
          note: "ใช้เสริม emotional texture หลัง precedence ถูกตัดสินแล้ว.",
          guardrails: [
            "Source 2 evidence ห้ามเปลี่ยน precedence ของ conflict-context",
            "Source 2 ห้ามตัดสินว่าฮะ/ชง/เฮ้ง/ผั่วใดเด่นกว่าใน Step 5",
          ],
        },
        source5LocalLogic: {
          ownerTarget: {
            module: "source5-relationship-overlay",
            ownerKey: "mapConflictContextForRelationship",
            status: "new-owner-required",
            note: "ต้องแปล conflict packet เป็นภาษาความรักของ Source 5.",
          },
          responsibilities: [
            "map conflict precedence into relationship consequences",
            "keep structural packet ownership inside Source 1",
          ],
        },
        terminologyIds: ["special-relationship-rules"],
      },
      {
        stepId: "step-6-marriage-timing",
        manualStep: 6,
        label: "Marriage timing interpretation",
        manualIntent: "อ่านช่วงเวลาความรักและแต่งงานจาก timing packet ร่วมกับ strength และ role-of-element.",
        source1Reuse: [
          {
            fieldId: "timing",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "timing packet เป็นฐาน deterministic ของจังหวะเวลา",
          },
          {
            fieldId: "weighted-strength",
            ownerKey: "source1-operating-system-contract.buildSource1StrengthContract",
            note: "ใช้คุมความแรง/อ่อนของ timing interpretation",
          },
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "ใช้เชื่อมช่วงเวลากับบทบาทธาตุคู่ครอง",
          },
        ],
        source2FlavorReuse: {
          allowed: true,
          mode: "flavor-only",
          surfaces: ["routing narrative"],
          note: "Source 2 ใช้เติมภาษาจังหวะความสัมพันธ์ได้หลัง rule timing ถูกตัดสินแล้ว.",
          guardrails: [
            "Source 2 ห้ามเลือกช่วงเวลาแต่งงานแทน timing packet",
            "Step 6 ต้องอธิบาย provenance จาก timing/strength/role-of-element ได้ชัด",
          ],
        },
        source5LocalLogic: {
          ownerTarget: {
            module: "source5-relationship-overlay",
            ownerKey: "interpretMarriageTiming",
            status: "new-owner-required",
            note: "ยังต้องสร้าง interpreter เฉพาะ Source 5.",
          },
          responsibilities: [
            "interpret marriage timing from timing packet plus Source 5 rules",
            "bind timing output to spouse-role context",
          ],
        },
        terminologyIds: ["spouse-element"],
      },
      {
        stepId: "step-7-special-rules-and-spouse-profile",
        manualStep: 7,
        label: "Special rules and spouse profile",
        manualIntent: "ประเมินกฎพิเศษและลักษณะคู่ครองโดยไม่ให้ conflict packet หรือ Source 2 ปะปนเป็น owner หลัก.",
        source1Reuse: [
          {
            fieldId: "four-pillars",
            ownerKey: "symbolic-engine.os-core.calculateBaziFactState",
            note: "ใช้ anchors หลักสำหรับ spouse profile และกฎพิเศษ",
          },
          {
            fieldId: "role-of-element",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "ใช้ผูกลักษณะคู่กับบทบาทธาตุ",
          },
          {
            fieldId: "conflict-context",
            ownerKey: "symbolic-engine.shared-packets.buildBaziSharedPacketSpine",
            note: "ใช้เป็น supporting context ไม่ใช่ owner เดียวของกฎพิเศษ",
          },
        ],
        source2FlavorReuse: {
          allowed: true,
          mode: "flavor-only",
          surfaces: ["routing narrative", "day-pillar refinement"],
          note: "Source 2 ใช้เสริมภาพบุคลิกคู่ครองหลัง Source 5 special rules ตัดสินแล้ว.",
          guardrails: [
            "Source 2 ห้ามตัดสิน affair rule หรือ spouse profile rule",
            "Step 7 ต้องอยู่ได้แม้ไม่มี Source 2 wording",
          ],
        },
        source5LocalLogic: {
          ownerTarget: {
            module: "source5-relationship-overlay",
            ownerKey: "evaluateSpecialRelationshipRules",
            status: "new-owner-required",
            note: "ต้องมี evaluator แยกเพื่อกัน scope leak จาก Step 5.",
          },
          responsibilities: [
            "evaluate affair and spouse-profile rules",
            "keep special-rule ownership separate from conflict and flavor layers",
          ],
        },
        terminologyIds: ["special-relationship-rules", "spouse-element", "hidden-spouse-element"],
      },
    ],
  });
}
