// Hour Rectification v2 — rules.ts (#hour-rectification-engine, event-based lane). ★ THE HEART and
// the ONE artifact บอง + ซินแส refine. Pure declarative data: each rule is a predicate over a
// YearSignal + a weight + a Thai rationale.
//
// ⚠️ DESIGN NOTE (goo, verified — pending บอง/ซินแส refinement):
// The 12 hour candidates share identical year/month/day pillars and 大運; they differ ONLY in the
// hour pillar (時柱) + its 藏干. So EVERY discriminating rule is anchored on the hour pillar — bong's
// original starter anchored some events on FIXED palaces (配偶宮=day, 提綱=month, parents=year),
// which score all 12 hours equally and cannot rank the hour. Per bong's refinement, the anchor is
// moved to 時柱 + 藏干: the 財/官/食傷 "stars" a rule looks for now live in the hour pillar's hidden
// stems (which differ per hour), and the 合/冲/刑/害 are measured 流年/大運 ↔ hour branch/stem.
// bong's 6 events + weight palette + rationale intent are preserved; only the anchor moved. Rules
// flagged `weak: true` are ones whose classical anchor is a fixed palace, so the hour reframe is a
// stretch (bong + ซินแส decide whether to keep) — they still discriminate but on thinner grounds.

import type { EventType } from "./events";
import type { YearSignal } from "./signals";

export type RuleContext = { gender: string }; // "male" | "female"

export type Rule = {
  id: string;
  event: EventType;
  when: (s: YearSignal, ctx: RuleContext) => boolean;
  weight: number; // + supports this hour / − argues against it
  because: (s: YearSignal, hourLabel: string) => string;
  // Documentation flags (do not affect scoring): every rule here discriminates (touches the hour);
  // `weak` marks a rule whose classical anchor is really a fixed palace so the reframe is thin.
  weak?: boolean;
};

const isMale = (ctx: RuleContext) => ctx.gender === "male";
const lnCombinesHour = (s: YearSignal) => s.lnBranchVsHour.sixHe || s.lnBranchVsHour.halfSanHe;
const lnStirsHour = (s: YearSignal) =>
  lnCombinesHour(s) || s.lnBranchVsHour.clash || s.lnStemVsHour.combine || s.lnStemVsHour.clash;
const dyClashesHour = (s: YearSignal) => s.dyBranchVsHour?.clash ?? false;
const dyCombinesHour = (s: YearSignal) =>
  (s.dyBranchVsHour?.sixHe ?? false) || (s.dyBranchVsHour?.halfSanHe ?? false);

function ln(s: YearSignal): string {
  return `流年${s.liuNian.stem}${s.liuNian.branch}`;
}

export const RULES: Rule[] = [
  // ── marriage — spouse star (財 male / 官 female) in the hour, activated by the marriage-year 流年 ──
  {
    id: "MAR-1",
    event: "marriage",
    when: (s, ctx) => (isMale(ctx) ? s.hourStars.wealth : s.hourStars.authority) && lnCombinesHour(s),
    weight: 3,
    because: (s, h) =>
      `ปี ${s.year} ${ln(s)} เข้าคู่ (六合/三合) กับเสายาม${h} ที่มีดาวคู่ครองใน藏干 → เข้าจังหวะแต่งงาน`,
  },
  {
    id: "MAR-2",
    event: "marriage",
    when: (s) => lnCombinesHour(s),
    weight: 2,
    because: (s, h) => `ปี ${s.year} ${ln(s)} 六合/三合 กิ่งยาม${h} → ปีนั้นกระตุ้นเสายามนี้โดยตรง`,
  },
  {
    id: "MAR-3",
    event: "marriage",
    when: (s) => s.hourIsPeachBlossom,
    weight: 1,
    because: (_s, h) => `เสายาม${h} เป็นดาวโรแมนซ์ (桃花) ในดวง → หนุนเรื่องคู่`,
  },
  {
    id: "MAR-4",
    event: "marriage",
    when: (s) => s.lnBranchVsHour.clash,
    weight: -1,
    because: (s, h) => `ปี ${s.year} ${ln(s)} 冲 กิ่งยาม${h} → ปะทะ ไม่เข้าจังหวะคู่ (flag)`,
  },

  // ── career_change — 官殺/食傷 star in the hour, stirred by 流年/大運 ──
  {
    id: "CAR-1",
    event: "career_change",
    when: (s) => (s.hourStars.authority || s.hourStars.output) && lnStirsHour(s),
    weight: 3,
    because: (s, h) =>
      `ปี ${s.year} ${ln(s)} กระตุ้นดาวอำนาจ/ผลงาน (官殺/食傷) ในเสายาม${h} → ตรงจังหวะเปลี่ยนงาน`,
  },
  {
    id: "CAR-2",
    event: "career_change",
    when: (s) => s.lnBranchVsHour.clash,
    weight: 2,
    because: (s, h) => `ปี ${s.year} ${ln(s)} 冲 กิ่งยาม${h} → แรงขยับ/เปลี่ยนตำแหน่ง`,
  },
  {
    id: "CAR-3",
    event: "career_change",
    when: (s) => dyCombinesHour(s) || dyClashesHour(s),
    weight: 1,
    because: (s, h) => `大運${s.daYun?.stem ?? ""}${s.daYun?.branch ?? ""} ปะทะ/เข้าคู่กิ่งยาม${h} ในช่วงนั้น`,
  },

  // ── serious_illness — 流年 冲/刑 the hour branch ──
  {
    id: "ILL-1",
    event: "serious_illness",
    when: (s) => s.lnBranchVsHour.clash,
    weight: 3,
    because: (s, h) => `ปี ${s.year} ${ln(s)} 冲 กิ่งยาม${h} → กระทบร่างกาย/สุขภาพช่วงนั้น`,
  },
  {
    id: "ILL-2",
    event: "serious_illness",
    when: (s) => s.lnBranchVsHour.punishment,
    weight: 2,
    because: (s, h) => `ปี ${s.year} ${ln(s)} 刑 กิ่งยาม${h} → พลังปะทะสะสม`,
  },
  {
    id: "ILL-3",
    event: "serious_illness",
    when: (s) => dyClashesHour(s),
    weight: 2,
    because: (s, h) => `大運${s.daYun?.stem ?? ""}${s.daYun?.branch ?? ""} 冲 กิ่งยาม${h} ในช่วงนั้น`,
  },

  // ── major_loss — WEAK reframe: classical anchor is the parents palace (year/month, fixed). Kept
  //    on the hour branch's clash/harm/刑 so it discriminates, but on thin grounds. บอง/ซินแส decide.
  {
    id: "LOSS-1",
    event: "major_loss",
    when: (s) => s.lnBranchVsHour.clash,
    weight: 2,
    because: (s, h) => `ปี ${s.year} ${ln(s)} 冲 กิ่งยาม${h} → ปีปะทะหนัก`,
    weak: true,
  },
  {
    id: "LOSS-2",
    event: "major_loss",
    when: (s) => s.lnBranchVsHour.harm || s.lnBranchVsHour.punishment,
    weight: 1,
    because: (s, h) => `ปี ${s.year} ${ln(s)} 害/刑 กิ่งยาม${h}`,
    weak: true,
  },

  // ── childbirth — 子女宮 = the hour pillar itself → HIGHEST diagnostic (bong). Output star (female)
  //    / authority star (male) in the hour, activated by 流年; plus direct 流年/大運 combination. ──
  {
    id: "CHI-1",
    event: "childbirth",
    when: (s) => lnCombinesHour(s),
    weight: 3,
    because: (s, h) => `ปี ${s.year} ${ln(s)} 六合/三合 เสายาม${h} (子女宮) → ตรงจังหวะมีบุตร`,
  },
  {
    id: "CHI-2",
    event: "childbirth",
    when: (s, ctx) => (isMale(ctx) ? s.hourStars.authority : s.hourStars.output) && lnStirsHour(s),
    weight: 3,
    because: (s, h) => `ปี ${s.year} ${ln(s)} กระตุ้นดาวลูก (${s.hourHiddenTenGods.join("/")}) ในเสายาม${h}`,
  },
  {
    id: "CHI-3",
    event: "childbirth",
    when: (s) => dyCombinesHour(s),
    weight: 2,
    because: (s, h) => `大運${s.daYun?.stem ?? ""}${s.daYun?.branch ?? ""} เข้าคู่เสายาม${h} (子女宮)`,
  },

  // ── relocation — 驿马/movement measured as 流年 冲 the hour branch ──
  {
    id: "REL-1",
    event: "relocation",
    when: (s) => s.lnBranchVsHour.clash,
    weight: 3,
    because: (s, h) => `ปี ${s.year} ${ln(s)} 冲 กิ่งยาม${h} → แรงเคลื่อนย้าย (驿马)`,
  },
  {
    id: "REL-2",
    event: "relocation",
    when: (s) => s.lnBranchVsHour.sixHe,
    weight: 1,
    because: (s, h) => `ปี ${s.year} ${ln(s)} 六合 กิ่งยาม${h} → ผูกจังหวะย้าย`,
  },
  {
    id: "REL-3",
    event: "relocation",
    when: (s) => dyClashesHour(s),
    weight: 1,
    because: (s, h) => `大運${s.daYun?.stem ?? ""}${s.daYun?.branch ?? ""} 冲 กิ่งยาม${h}`,
  },
];

export function rulesForEvent(event: EventType): Rule[] {
  return RULES.filter((rule) => rule.event === event);
}
