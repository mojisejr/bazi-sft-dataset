/**
 * เกณฑ์ตัดสิน 12 เซียงแซ (十二長生) แบบ 5 ระดับ ตามที่ซินแสเคาะสำหรับ **แชทฮีลใจ**
 *
 * ที่มา: "รวมคำถามสำหรับ AI.xlsx" คอลัมน์ C — ซินแสเลิกให้ตอบด้วย bundle กว้าง ๆ
 * (วัยจร + ปีจร + ดิถี) แล้วสั่งให้อ่าน "สภาวะเซียงแซที่เสาไหน" เป็นตัวตัดสินแทน
 * รายละเอียดรายคำถามอยู่ใน src/lib/louise-hay/data/chat-routing-rules.json
 *
 * ⚠️ ระดับชุดนี้ **ไม่ตรงกับ** classifyQiTier ใน topic-knowledge.ts ที่หน้าอ่านดวง 15 บทใช้อยู่
 * (ดู DIVERGENCE_FROM_READING_TIERS ข้างล่าง) — ต่างกัน 5 จุด
 *
 * 🔒 **ซินแสตัดสินแล้วว่าเกณฑ์ 5 ระดับนี้ใช้กับ "แชทฮีลใจ" เท่านั้น** ไม่ใช้กับหน้าอ่านดวง 15 บท
 * ความต่างนี้จึงเป็น "สถานะถาวรที่ตั้งใจให้ต่าง" ไม่ใช่หนี้ที่รอตามเก็บ
 * ห้ามรวม 2 เกณฑ์เข้าด้วยกัน และห้ามแก้ classifyQiTier / RISING_QI / FALLING_QI ให้ตรงกับไฟล์นี้
 * (จะเปลี่ยนคำอ่าน 15 บทของผู้ใช้ทุกคน) — มีเทสกันไว้ที่ tests/xiangsha-verdict.test.ts
 *
 * คะแนน 0–110 ไม่ได้นิยามใหม่ที่นี่ — เรียก lifeStageScore() ของ almanac-engine
 * (ตรวจแล้วว่าให้ผลตรงกับ resolveCanonicalTwelveQiStage() ของ pillar-display ทั้ง 120 คู่)
 */
import { lifeStageScore } from "@/lib/bazi/almanac/almanac-engine";
import {
  getBranchTranslation,
  getStemElementTranslation,
  resolveCanonicalTwelveQiStage,
  resolveStemReferenceBranch,
} from "@/lib/bazi/pillar-display";
import { TWELVE_QI_LABELS_TH } from "@/lib/bazi/symbolic-engine.constants";

export type XiangshaVerdict = "ดีมาก" | "ดี" | "กลาง" | "เสีย" | "เสียมาก";

/** เรียงจากคะแนนสูงไปต่ำ — ตัวแรกที่ score >= min คือคำตอบ */
export const XIANGSHA_VERDICT_BANDS: { verdict: XiangshaVerdict; min: number }[] = [
  { verdict: "ดีมาก", min: 90 }, // ตี้อ๋วง 110 · ลิ่มกัว 100 · กวงตั่ว 90
  { verdict: "ดี", min: 70 }, //    เชี่ยงแซ 80 · เอี้ยง 70
  { verdict: "กลาง", min: 50 }, //  ทอ 60 · หมอ 50
  { verdict: "เสีย", min: 30 }, //  หมกยก 40 · ซวย 30
  { verdict: "เสียมาก", min: 0 }, // แป่ 20 · ซี่ 10 · เจ๊าะ 0
];

/**
 * จุดที่เกณฑ์ซินแส (แชท) ต่างจาก classifyQiTier (หน้าอ่านดวง 15 บท) — บันทึกไว้ให้เห็นชัด
 * ไม่ใช่โค้ดที่รัน แต่เป็นหลักฐานว่ารู้ตัวว่าต่าง ไม่ได้เผลอ fork
 *
 * `readingSet` = ชุดที่ stage นั้นอยู่ในฝั่งอ่านดวง ใช้เป็นคีย์ให้เทสตรวจ source ว่ายังไม่มีใครไปรวมกัน
 */
export const DIVERGENCE_FROM_READING_TIERS: {
  stage: string;
  reading: string;
  readingSet: "RISING_QI" | "FALLING_QI" | "transitional";
  shinseChat: XiangshaVerdict;
}[] = [
  { stage: "แป่", reading: "transitional (50/50)", readingSet: "transitional", shinseChat: "เสียมาก" },
  { stage: "หมกยก", reading: "transitional (50/50)", readingSet: "transitional", shinseChat: "เสีย" },
  { stage: "เอี้ยง", reading: "transitional (50/50)", readingSet: "transitional", shinseChat: "ดี" },
  { stage: "เชี่ยงแซ", reading: "rising (ชั้นบนสุด)", readingSet: "RISING_QI", shinseChat: "ดี" },
  { stage: "ซวย", reading: "falling + รุนแรง (ดอกจัน 3 ดอก)", readingSet: "FALLING_QI", shinseChat: "เสีย" },
];

export function xiangshaVerdict(score: number): XiangshaVerdict {
  return XIANGSHA_VERDICT_BANDS.find((b) => score >= b.min)!.verdict;
}

export type XiangshaRead = {
  /** สภาวะเป็นจีน (长生/沐浴/…) — คีย์ canonical ของเอนจิน */
  stage: string;
  /** ชื่อสภาวะภาษาไทยที่ซินแสเรียก (เชี่ยงแซ/หมกยก/…) */
  labelTh: string;
  score: number;
  verdict: XiangshaVerdict;
};

/** อ่านสภาวะเซียงแซของ "ดิถี × ราศีล่างที่กำหนด" (เช่น ดิถี × ราศีล่างหลักเดือน) */
export function readXiangsha(dayMasterStem: string, branch: string): XiangshaRead | null {
  const stage = resolveCanonicalTwelveQiStage(dayMasterStem, branch);
  if (!stage) return null;
  const labelTh = TWELVE_QI_LABELS_TH[stage as keyof typeof TWELVE_QI_LABELS_TH];
  if (!labelTh) return null;
  const score = lifeStageScore(dayMasterStem, branch);
  return { stage, labelTh, score, verdict: xiangshaVerdict(score) };
}

/**
 * อ่านสภาวะเซียงแซของ "ดิถี × ราศีบน (ก้าน) ที่กำหนด"
 *
 * ซินแสอ้าง "ราศีบนหลักเดือน" บ่อยมาก (14 แถว) ซึ่งเป็นคนละการคำนวณกับราศีล่าง —
 * ก้านไม่มีสภาวะในตัวเอง ต้องแปลงเป็นกิ่งอ้างอิง (กิ่งที่ก้านนั้นเป็น 长生) ก่อน
 * แล้วจึงอ่านสภาวะของดิถีที่กิ่งนั้น — ใช้ helper เดิมของโปรเจกต์ ไม่คิดสูตรใหม่
 */
export function readXiangshaForStem(dayMasterStem: string, targetStem: string): XiangshaRead | null {
  const referenceBranch = resolveStemReferenceBranch(targetStem);
  if (!referenceBranch) return null;
  return readXiangsha(dayMasterStem, referenceBranch);
}

export type XiangshaBoardRow = {
  /** ชื่อตำแหน่งตามที่ซินแสเรียก เช่น "หลักเดือน", "ปีจร" */
  position: string;
  /** "ราศีบน" (ก้าน) หรือ "ราศีล่าง" (กิ่ง) — ซินแสระบุแยกกันชัดเจน */
  place: "ราศีบน" | "ราศีล่าง";
  /** ตัวอักษรจีนของก้าน/กิ่งนั้น (เก็บไว้ให้ผู้เรียก ไม่ส่งเข้าข้อความ LLM) */
  symbol: string;
  /** ชื่อไทยของก้าน(ธาตุ)/กิ่ง(นักษัตร) — ตัวที่ใช้ในข้อความจริง */
  symbolTh: string;
  read: XiangshaRead;
};

export type XiangshaPillar = { stem: string; branch: string };

/** ตารางเซียงแซตามตำแหน่งที่ซินแสสั่งให้ดู — 4 เสาในดวง (ราศีบน+ราศีล่าง) + ชั้นจรที่ส่งเข้ามา */
export function buildXiangshaBoard(input: {
  dayMasterStem: string;
  pillars: { year: XiangshaPillar; month: XiangshaPillar; day: XiangshaPillar; hour: XiangshaPillar };
  transits?: { label: string; pillar: XiangshaPillar }[];
}): XiangshaBoardRow[] {
  const targets: { position: string; pillar: XiangshaPillar }[] = [
    { position: "หลักปี", pillar: input.pillars.year },
    { position: "หลักเดือน", pillar: input.pillars.month },
    { position: "หลักวัน", pillar: input.pillars.day },
    { position: "หลักยาม", pillar: input.pillars.hour },
    ...(input.transits ?? []).map((t) => ({ position: t.label, pillar: t.pillar })),
  ];
  const rows: XiangshaBoardRow[] = [];
  for (const t of targets) {
    const upper = readXiangshaForStem(input.dayMasterStem, t.pillar.stem);
    if (upper) {
      const el = getStemElementTranslation(t.pillar.stem);
      rows.push({
        position: t.position,
        place: "ราศีบน",
        symbol: t.pillar.stem,
        symbolTh: el ? `ธาตุ${el}` : "",
        read: upper,
      });
    }
    const lower = readXiangsha(input.dayMasterStem, t.pillar.branch);
    if (lower) {
      rows.push({
        position: t.position,
        place: "ราศีล่าง",
        symbol: t.pillar.branch,
        symbolTh: getBranchTranslation(t.pillar.branch) ?? "",
        read: lower,
      });
    }
  }
  return rows;
}

/**
 * ตารางเซียงแซเป็นข้อความสำหรับป้อน LLM
 *
 * กติกา 2 ข้อที่ต้องรักษา:
 *  1. ไม่ใส่คะแนนดิบ 0–110 (ค่าหลังบ้าน โมเดลเคยเผลอพูดตัวเลขออกไปให้ผู้ใช้เห็น — ดู dithiLine)
 *  2. ไม่ใส่ตัวอักษรจีน — ปลายทาง (chat route) มี stripInternalJargon ที่ลบ CJK ทิ้งก่อนส่งเข้า LLM
 *     ถ้าเขียนกิ่งเป็น 辰 ข้อมูลจะหายทั้งตัว เหลือ "(ราศีล่าง)" ลอย ๆ → ใช้ชื่อไทยแทน (ชวด/ฉลู/…)
 */
export function formatXiangshaBoard(rows: XiangshaBoardRow[]): string {
  return rows
    .map((r) => `- ${r.position} ${r.place}${r.symbolTh ? ` ${r.symbolTh}` : ""}: ${r.read.labelTh} → ${r.read.verdict}`)
    .join("\n");
}
