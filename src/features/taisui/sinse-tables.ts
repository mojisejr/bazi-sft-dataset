// The Sinse's reaction tables that the frozen engine does not hold (ciel-os mumate-taisui-2570-001,
// design/SINSE-REACTIONS.md, from his ชง / เฮ้ง / ไห่ / ผั่ว / ซำเฮ้ง documents of 2026-11-20).
// Everything else comes from src/lib/bazi/symbolic-engine.constants.ts; the tests check that these
// agree with the engine where the two overlap.
import { normalizeBranchPairKey } from "@/lib/bazi/symbolic-engine.constants";

/**
 * เฮ้ง, as the Sinse's document lists it: twelve pairs. Six of them are the engine's DESTRUCTION_PAIRS
 * (filed there as 破) and one is its PUNISHMENT_PAIR_KEYS 子卯; the naming is the Sinse's to settle.
 */
export const SINSE_HENG_PAIRS = new Set(
  [
    ["寅", "亥"], ["午", "卯"], ["戌", "未"], ["卯", "子"], ["未", "辰"], ["亥", "申"],
    ["辰", "丑"], ["申", "巳"], ["子", "酉"], ["巳", "寅"], ["酉", "午"], ["丑", "戌"],
  ].map(([a, b]) => normalizeBranchPairKey(a, b)),
);

/** ผั่ว: a pillar whose own stem sits badly on its own branch, in the Sinse's four groups. */
export const PHUA_GROUPS = {
  drain: ["甲午", "乙巳", "丙辰", "庚子"], // ถ่ายเทจนหมดตัว
  poison: ["丁卯", "庚戌", "壬申"], // ส่งเสริมแต่แฝงพิษ
  self: ["戊寅", "己亥", "癸未"], // พิฆาตกันเองภายใน
  leak: ["己丑", "辛酉"], // คู่ธาตุและขุมคลังรั่วไหล
} as const;
export type PhuaGroup = keyof typeof PHUA_GROUPS;

export function phuaGroupOf(stem: string, branch: string): PhuaGroup | null {
  const pillar = stem + branch;
  for (const [group, list] of Object.entries(PHUA_GROUPS)) if ((list as readonly string[]).includes(pillar)) return group as PhuaGroup;
  return null;
}

/** ซำเฮ้ง: any three of one group of four. */
export const SAMHENG_GROUPS = {
  carrier: ["寅", "巳", "申", "亥"], // กลุ่มพาหะ
  mother: ["子", "卯", "午", "酉"], // กลุ่มแม่ธาตุ
  vault: ["辰", "未", "戌", "丑"], // กลุ่มขุนคลัง
} as const;
export type SamhengGroup = keyof typeof SAMHENG_GROUPS;
