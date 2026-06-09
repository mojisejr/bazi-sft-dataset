import { z } from "zod";

import { RELATION_SEMANTIC_MEANING_TH, SHEN_SHA_COPY } from "@/lib/bazi/symbolic-engine.constants";

/**
 * Doctrine config v2 — ส่วน "นิยาม 7 ขั้น / ป้าย-ความหมาย role / ตารางดาว (copy)" ที่ซินแสปรับออนไลน์ได้
 * โมดูลนี้ client-safe (ไม่ import DB) ใช้ได้ทั้ง admin UI และ server
 *
 * แก้ได้เฉพาะ "ข้อความ" (title/auditFocus/label/meaning/starName) — ไม่แตะอัลกอริทึม/ตารางก้าน-กิ่ง
 * ของดาว (ว่าดวงไหนได้ดาวอะไร ยังคงคำนวณในโค้ด)
 */

// ---------- keys ----------
export const STEP_KEYS = [
  "balance-core",
  "day-pillar-identity",
  "standard-energies",
  "output-transfer",
  "result-wealth",
  "context-mapping",
  "advanced-signals",
] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export const ROLE_KEYS = ["same", "resource", "output", "power", "wealth"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const STAR_KEYS = ["nobleman", "wenChang", "tianDe", "yueDe"] as const;
export type StarKey = (typeof STAR_KEYS)[number];

// ---------- defaults (single source of truth) ----------
export type StepText = { stepNumber: number; title: string; auditFocus: string };

/** ค่า default ของ title/auditFocus รายขั้น — buildStepInsights ใช้ตัวนี้เป็นแกน (กัน drift) */
export const STEP_TEXT_DEFAULTS: Record<StepKey, StepText> = {
  "balance-core": {
    stepNumber: 1,
    title: "สมดุลดวงและแกนหลัก",
    auditFocus: "ดูว่าดวงนี้ยืนด้วยความแข็ง อ่อน หรือสมดุล และธาตุใดพยุงหรือดึงกำลังดวง",
  },
  "day-pillar-identity": {
    stepNumber: 2,
    title: "หลักวันและตัวตน",
    auditFocus: "ยึดดิถีและราศีล่างวันเป็นตัวตนหลัก แล้วค่อยใช้ 60 กะจื่อแต้มคาแรกเตอร์",
  },
  "standard-energies": {
    stepNumber: 3,
    title: "พลังมาตรฐาน: 5 บทบาทธาตุ (คู่ธาตุ ถ่ายเท โชคลาภ ภาระหน้าที่ ส่งเสริม)",
    auditFocus:
      "ดู 5 บทบาทธาตุทั้งหมด เรียงลำดับ คู่ธาตุ (same) / ถ่ายเท (output) / โชคลาภ (wealth) / ภาระหน้าที่ (power) / ส่งเสริม (resource) — ว่ามีจุดมองเห็นกี่จุด จุดไหนแรงสุด มีแรงรบกวนอะไร (ชง เฮ้ง จื่อเฮ้ง ซำเฮ้ง ไห่ ผั่ว) มีแรงดึงดูดอะไร (ฮะ ภาคี ครึ่งภาคี ไตรภาคี ไตรทิศ) 12 เชี่ยงแซเป็นอย่างไร และฮะแก้ชงหรือไม่ ส่วนที่ซ่อนเก็บไว้อ่านขั้นสูง",
  },
  "output-transfer": {
    stepNumber: 4,
    title: "การอ่านตัวถ่ายเท",
    auditFocus:
      "ไล่ธาตุถ่ายเทตามลำดับ: ระดับ 1 ธาตุแท้ (ราศีบน=ฟ้ากำหนด / ราศีล่าง=ฝึกฝนพัฒนาตน, แสดงออกชัดสุด) ถ้าไม่มีจึงดู ระดับ 2 แฝงจากกลุ่มภาคีที่แปรเป็นธาตุถ่ายเท / ระดับ 3 ลีลา 12 เชี่ยงแซรายหลัก / ระดับ 4 ราศีแฝง = จิตใต้สำนึก สัญชาตญาณ (ที่หลักยาม = จิตใจภายในไม่แสดงออก)",
  },
  "result-wealth": {
    stepNumber: 5,
    title: "ผลลัพธ์และโชคลาภ",
    auditFocus:
      "ดูว่าดิถีพิฆาตธาตุไหน มีจุดมองเห็นกี่จุด จุดไหนแรงสุด ศักยภาพคว้าโชคเป็นอย่างไร มีลาภเปีย (ต่างขั้ว) หรือลาภหมกยกไหม และลีลา 12 เซงแซเป็นอย่างไร ส่วนที่ซ่อนอยู่เก็บไว้อ่านขั้นสูง",
  },
  "context-mapping": {
    stepNumber: 6,
    title: "บริบทสี่เสา",
    auditFocus:
      "ดูว่าพลังเดียวกันไปตกคนละเสาแล้วให้ความหมายคนละเรื่องอย่างไร และชั้นฟ้า/ดินเปลี่ยนธรรมชาติของพลังอย่างไร",
  },
  "advanced-signals": {
    stepNumber: 7,
    title: "ดาวพิเศษ ราศีแฝง และสัญญาณขั้นสูง",
    auditFocus:
      "ใช้ดาวพิเศษ ราศีแฝง คลังทรัพย์/อำนาจแฝง รวมถึงฤดูกาลและลำดับอ่านจากฐานชาร์ตเป็นตัวเก็บปลาย โดยไม่ให้แย่งแกนหลัก",
  },
};

export type RoleText = { label: string; meaning: string };

/** ป้าย "ความสัมพันธ์ธาตุ" (ใช้ในบรรทัด "อ่าน X") — ตรงกับ school-lexicon */
const ROLE_LABEL_DEFAULTS: Record<RoleKey, string> = {
  same: "คู่ธาตุ",
  resource: "ธาตุส่งเสริม",
  output: "ธาตุถ่ายเท",
  power: "ธาตุพิฆาต",
  wealth: "พิฆาตธาตุ",
};

export const ROLE_TEXT_DEFAULTS: Record<RoleKey, RoleText> = {
  same: { label: ROLE_LABEL_DEFAULTS.same, meaning: RELATION_SEMANTIC_MEANING_TH.same },
  resource: { label: ROLE_LABEL_DEFAULTS.resource, meaning: RELATION_SEMANTIC_MEANING_TH.resource },
  output: { label: ROLE_LABEL_DEFAULTS.output, meaning: RELATION_SEMANTIC_MEANING_TH.output },
  power: { label: ROLE_LABEL_DEFAULTS.power, meaning: RELATION_SEMANTIC_MEANING_TH.power },
  wealth: { label: ROLE_LABEL_DEFAULTS.wealth, meaning: RELATION_SEMANTIC_MEANING_TH.wealth },
};

export type StarText = { starName: string; meaning: string };

export const STAR_TEXT_DEFAULTS: Record<StarKey, StarText> = {
  nobleman: { starName: SHEN_SHA_COPY.nobleman.starName, meaning: SHEN_SHA_COPY.nobleman.meaning },
  wenChang: { starName: SHEN_SHA_COPY.wenChang.starName, meaning: SHEN_SHA_COPY.wenChang.meaning },
  tianDe: { starName: SHEN_SHA_COPY.tianDe.starName, meaning: SHEN_SHA_COPY.tianDe.meaning },
  yueDe: { starName: SHEN_SHA_COPY.yueDe.starName, meaning: SHEN_SHA_COPY.yueDe.meaning },
};

/** map: ชื่อดาว default → starKey (ใช้จับคู่ override กับ entry ใน calculatedState.shenSha) */
export const DEFAULT_STAR_NAME_TO_KEY: Record<string, StarKey> = Object.fromEntries(
  STAR_KEYS.map((key) => [STAR_TEXT_DEFAULTS[key].starName, key]),
) as Record<string, StarKey>;

// ---------- zod (override payloads) ----------
export const StepConfigSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    auditFocus: z.string().trim().min(1).max(4000).optional(),
  })
  .strict();
export const RoleConfigSchema = z
  .object({
    label: z.string().trim().min(1).max(200).optional(),
    meaning: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();
export const StarConfigSchema = z
  .object({
    starName: z.string().trim().min(1).max(200).optional(),
    meaning: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

export type StepConfig = z.infer<typeof StepConfigSchema>;
export type RoleConfig = z.infer<typeof RoleConfigSchema>;
export type StarConfig = z.infer<typeof StarConfigSchema>;

export type DoctrineConfigV2 = {
  steps: Partial<Record<StepKey, StepConfig>>;
  roles: Partial<Record<RoleKey, RoleConfig>>;
  stars: Partial<Record<StarKey, StarConfig>>;
};

export const EMPTY_DOCTRINE_CONFIG_V2: DoctrineConfigV2 = { steps: {}, roles: {}, stars: {} };

export const DOCTRINE_CONFIG_SCOPES = ["step", "role", "star"] as const;
export type DoctrineConfigScope = (typeof DOCTRINE_CONFIG_SCOPES)[number];

/** validate ค่าดิบจาก DB ตาม scope — คืน null ถ้าผิดรูป (เพื่อ fallback) */
export function parseDoctrineConfigValue(
  scope: DoctrineConfigScope,
  raw: unknown,
): StepConfig | RoleConfig | StarConfig | null {
  const schema =
    scope === "step" ? StepConfigSchema : scope === "role" ? RoleConfigSchema : StarConfigSchema;
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}

// ---------- pure apply (duck-typed, immutable) ----------
type StepLike = { stepKey: string; titleThai: string; auditFocusThai: string };
type SummaryLike = { relationKey: string; relationLabelThai: string; semanticMeaningThai: string };
type ShenShaLike = { starName: string; meaning: string };

/** override title/auditFocus ของแต่ละขั้นตาม config (คงฟิลด์อื่นเดิม) */
export function applyStepConfig<T extends StepLike>(
  steps: readonly T[],
  cfg: DoctrineConfigV2["steps"],
): T[] {
  return steps.map((step) => {
    const o = cfg[step.stepKey as StepKey];
    if (!o || (o.title === undefined && o.auditFocus === undefined)) {
      return step;
    }
    return {
      ...step,
      ...(o.title !== undefined ? { titleThai: o.title } : {}),
      ...(o.auditFocus !== undefined ? { auditFocusThai: o.auditFocus } : {}),
    };
  });
}

/** override label/meaning ของแต่ละบทบาทธาตุตาม config */
export function applyRoleConfig<T extends SummaryLike>(
  summaries: readonly T[],
  cfg: DoctrineConfigV2["roles"],
): T[] {
  return summaries.map((summary) => {
    const o = cfg[summary.relationKey as RoleKey];
    if (!o || (o.label === undefined && o.meaning === undefined)) {
      return summary;
    }
    return {
      ...summary,
      ...(o.label !== undefined ? { relationLabelThai: o.label } : {}),
      ...(o.meaning !== undefined ? { semanticMeaningThai: o.meaning } : {}),
    };
  });
}

/** override ชื่อ/ความหมายดาว ตาม config (จับคู่ด้วยชื่อดาว default → starKey) */
export function applyStarConfig<T extends ShenShaLike>(
  shenSha: readonly T[],
  cfg: DoctrineConfigV2["stars"],
): T[] {
  return shenSha.map((entry) => {
    const key = DEFAULT_STAR_NAME_TO_KEY[entry.starName];
    if (!key) {
      return entry;
    }
    const o = cfg[key];
    if (!o || (o.starName === undefined && o.meaning === undefined)) {
      return entry;
    }
    return {
      ...entry,
      ...(o.starName !== undefined ? { starName: o.starName } : {}),
      ...(o.meaning !== undefined ? { meaning: o.meaning } : {}),
    };
  });
}
