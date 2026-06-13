/**
 * ค่าพลังรายด้าน (Domain Power)
 * ===============================
 * พอร์ตจากไฟล์ knownlage/การหาค่าพลัง/ (4 ไฟล์ Excel) → คะแนน 0–100% ต่อสกิลชีวิต.
 *
 * แกนกลางคือ "เมทริกซ์สัมประสิทธิ์คู่ก้าน-กิ่ง 60×60" (3,600 entries) ที่ map
 *   (หลักวัน, อีกหลักหนึ่ง) → สัมประสิทธิ์ 0–1
 * เมทริกซ์นี้ "เหมือนกันเป๊ะ" ข้ามไฟล์ การเงิน/การงาน/ความเข้าใจ (verify ใน
 * scripts/parse-domain-power-xlsx.py) แต่ละด้านต่างกันแค่ว่าเทียบ pillar คู่ไหน:
 *   - career   : matrix[หลักวัน | หลักเดือน]
 *   - learning : matrix[หลักวัน | หลักยาม]
 *   - friends  : ตารางแยกต่อหลักวัน (พร้อมข้อความตีความ)
 *   - wealth   : เฉลี่ย matrix ของ (หลักวัน, หลักเดือน) เทียบตำแหน่งลาภ (财)
 *
 * หมายเหตุด้านการเงิน: ต้นฉบับเลือกตำแหน่งลาภด้วย judgment ของซินแส (ลาภแท้/แฝง,
 * ลาภในกิ่งซ่อน, การนับซ้ำ) ที่ไม่เป็นกฎตายตัว — โมดูลนี้พอร์ต "วิธีหลัก" ที่
 * documented (ลาภแท้ก่อน, ก้านที่เห็นก่อน) จึงตรงเป๊ะกับเคสลาภตำแหน่งเดียว และ
 * เป็นค่าประมาณ (approximate=true) เมื่อมีหลายตำแหน่ง. ดู memory
 * [[sixty-jiazi-chen-encoding]] เรื่อง normalize 干支.
 */
import matrixJson from "@/lib/bazi/data/domain-power/matrix.json";
import friendsJson from "@/lib/bazi/data/domain-power/friends.json";
import { resolveTenGodForStem } from "@/lib/bazi/pillar-display";
import { BRANCH_HIDDEN_STEMS } from "@/lib/bazi/symbolic-engine.constants";
import type { DomainPowerBandValue, DomainPowerScoreValue, DomainPowerValue } from "@/lib/bazi/schema-types";

const MATRIX = matrixJson as Record<string, number>;
const FRIENDS = friendsJson as Record<
  string,
  { coefficient: number | null; interpretation: string | null }
>;

export interface DomainPowerPillar {
  stem: string;
  branch: string;
}

export interface DomainPowerChart {
  year: DomainPowerPillar;
  month: DomainPowerPillar;
  day: DomainPowerPillar;
  hour: DomainPowerPillar;
}

function nfkc(value: string): string {
  return (value ?? "").normalize("NFKC").trim();
}

function ganZhi(pillar: DomainPowerPillar): string {
  return `${nfkc(pillar.stem)}${nfkc(pillar.branch)}`;
}

/** สัมประสิทธิ์คู่ (หลักวัน-มุมมอง) จากเมทริกซ์ — null เมื่อไม่พบคู่ */
function lookupPair(base: DomainPowerPillar, other: DomainPowerPillar): number | null {
  const value = MATRIX[`${ganZhi(base)}|${ganZhi(other)}`];
  return typeof value === "number" ? value : null;
}

/** แปลงสัมประสิทธิ์ 0–1 เป็นช่วงพลัง (quintile) */
export function classifyDomainPowerBand(coefficient: number): DomainPowerBandValue {
  if (coefficient < 0.2) return "very-weak";
  if (coefficient < 0.4) return "weak";
  if (coefficient < 0.6) return "balanced";
  if (coefficient < 0.8) return "strong";
  return "very-strong";
}

function buildScore(
  coefficients: number[],
  basis: string[],
  extra: { interpretation?: string; approximate?: boolean } = {},
): DomainPowerScoreValue {
  const coefficient = coefficients.length
    ? coefficients.reduce((sum, value) => sum + value, 0) / coefficients.length
    : 0;
  const clamped = Math.min(1, Math.max(0, coefficient));
  return {
    score: Math.round(clamped * 100 * 100) / 100,
    coefficient: Math.round(clamped * 1e6) / 1e6,
    band: classifyDomainPowerBand(clamped),
    basis,
    ...(extra.interpretation ? { interpretation: extra.interpretation } : {}),
    ...(extra.approximate ? { approximate: true } : {}),
  };
}

function singlePairScore(base: DomainPowerPillar, other: DomainPowerPillar): DomainPowerScoreValue {
  const coeff = lookupPair(base, other);
  const key = `${ganZhi(base)}|${ganZhi(other)}`;
  return buildScore(coeff === null ? [] : [coeff], coeff === null ? [] : [key]);
}

/** การงาน/การเรียน = หลักวัน Vs หลักเดือน */
export function computeCareerPower(chart: DomainPowerChart): DomainPowerScoreValue {
  return singlePairScore(chart.day, chart.month);
}

/** ความเข้าใจ/บริวาร = หลักวัน Vs หลักยาม */
export function computeLearningPower(chart: DomainPowerChart): DomainPowerScoreValue {
  return singlePairScore(chart.day, chart.hour);
}

/** เพื่อน/比劫 = ตารางต่อหลักวัน (ค่า + ข้อความตีความ) */
export function computeFriendsPower(chart: DomainPowerChart): DomainPowerScoreValue {
  const key = ganZhi(chart.day);
  const entry = FRIENDS[key];
  const coeff = entry && typeof entry.coefficient === "number" ? entry.coefficient : null;
  return buildScore(
    coeff === null ? [] : [coeff],
    coeff === null ? [] : [key],
    { interpretation: entry?.interpretation ?? undefined },
  );
}

/**
 * การเงิน/财 — วิธีหลัก: หาตำแหน่งลาภ (正财 ก่อน, ไม่มีจึงใช้ 偏财) จากก้านที่เห็น
 * ก่อน ถ้าไม่มีก้านเลยจึงดูก้านซ่อนในกิ่ง; เทียบแต่ละตำแหน่งลาภกับหลักวัน+หลักเดือน
 * แล้วเฉลี่ย. approximate=true เมื่อมีหลายตำแหน่งลาภ (มี judgment ของซินแส).
 */
export function computeWealthPower(chart: DomainPowerChart): DomainPowerScoreValue {
  const dayMaster = nfkc(chart.day.stem);
  const positions: DomainPowerPillar[] = [chart.hour, chart.day, chart.month, chart.year];

  const visibleByGod = (god: string) =>
    positions.filter((pillar) => resolveTenGodForStem(dayMaster, nfkc(pillar.stem)) === god);
  const hiddenByGod = (god: string) =>
    positions.filter((pillar) =>
      (BRANCH_HIDDEN_STEMS[nfkc(pillar.branch) as keyof typeof BRANCH_HIDDEN_STEMS] ?? []).some(
        (hidden) => resolveTenGodForStem(dayMaster, nfkc(hidden)) === god,
      ),
    );

  // เลือกตำแหน่งลาภตามลำดับชั้น: ลาภแท้ (正财) ก่อน แล้วลาภแฝง (偏财);
  // ก้านที่เห็นก่อน แล้วจึงก้านซ่อนในกิ่ง (กรณีไม่มีลาภบนก้าน).
  // tier นี้ใช้ตัดสินว่าผลเป็น "พอร์ตเป๊ะ" หรือ "ประมาณ" — ดูหมายเหตุท้ายฟังก์ชัน.
  const tiers: Array<[boolean, DomainPowerPillar[]]> = [
    [true, visibleByGod("正财")], // exact path (ลาภแท้บนก้าน)
    [false, visibleByGod("偏财")],
    [false, hiddenByGod("正财")],
    [false, hiddenByGod("偏财")],
  ];
  const selected = tiers.find(([, pillars]) => pillars.length > 0);
  const isCleanTier = selected ? selected[0] : false;
  let wealthPillars = selected ? selected[1] : [];

  // dedupe ตาม ganZhi (ลาภเดียวกันหลายตำแหน่งนับครั้งเดียว)
  const seen = new Set<string>();
  wealthPillars = wealthPillars.filter((pillar) => {
    const key = ganZhi(pillar);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const coefficients: number[] = [];
  const basis: string[] = [];
  for (const wealthPillar of wealthPillars) {
    for (const base of [chart.day, chart.month]) {
      if (ganZhi(base) === ganZhi(wealthPillar)) continue;
      const coeff = lookupPair(base, wealthPillar);
      if (coeff !== null) {
        coefficients.push(coeff);
        basis.push(`${ganZhi(base)}|${ganZhi(wealthPillar)}`);
      }
    }
  }

  // "พอร์ตเป๊ะ" เฉพาะกรณีลาภแท้บนก้าน ตำแหน่งเดียว (วิธีที่ต้นฉบับทำสม่ำเสมอ).
  // กรณีอื่น (ลาภแฝง/ก้านซ่อน/หลายตำแหน่ง) ต้นฉบับใช้ judgment ของซินแสที่พิสูจน์
  // แล้วว่าไม่เป็นกฎเดียว (brute-force 100+ กฎ match ได้สูงสุด 2/6) → ค่าเป็นการประมาณ
  const exact = isCleanTier && wealthPillars.length === 1;
  return buildScore(coefficients, basis, { approximate: exact ? undefined : true });
}

/** คำนวณค่าพลังครบทั้ง 4 ด้านจาก 4 หลักของดวง */
export function computeDomainPower(chart: DomainPowerChart): DomainPowerValue {
  return {
    career: computeCareerPower(chart),
    learning: computeLearningPower(chart),
    friends: computeFriendsPower(chart),
    wealth: computeWealthPower(chart),
  };
}
