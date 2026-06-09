import type {
  CalculatedStateValue,
  PillarValue,
} from "@/lib/bazi/schema-types";

import {
  BRANCH_ORDER,
  NOBLEMAN_BRANCHES_BY_DAY_STEM,
  SHEN_SHA_COPY,
  TIAN_DE_TARGET_BY_MONTH_BRANCH,
  WEN_CHANG_BRANCH_BY_DAY_STEM,
  YUE_DE_STEM_BY_MONTH_BRANCH,
} from "@/lib/bazi/symbolic-engine.constants";
import type { ReferencePillar } from "@/lib/bazi/symbolic-engine.types";

/** เป้าหมาย 天德 อาจเป็นก้าน (stem) หรือกิ่ง (branch) — ใช้ตรวจว่าเป็นกิ่งหรือไม่ */
const BRANCH_SET = new Set<string>(BRANCH_ORDER as readonly string[]);

function pushShenSha(
  collection: CalculatedStateValue["shenSha"],
  seen: Set<string>,
  starName: string,
  relatedPillar: string,
  meaning: string,
) {
  const key = `${starName}:${relatedPillar}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  collection.push({
    starName,
    relatedPillar,
    meaning,
  });
}

function findReferenceMatches(referencePillars: ReferencePillar[], targetBranch: string) {
  return referencePillars.filter((entry) => entry.pillar.branch === targetBranch);
}

/** จับคู่เป้าหมายที่อาจเป็นก้าน (เทียบ stem) หรือกิ่ง (เทียบ branch) */
function findReferenceMatchesByStemOrBranch(referencePillars: ReferencePillar[], target: string) {
  const matchByBranch = BRANCH_SET.has(target);
  return referencePillars.filter((entry) =>
    matchByBranch ? entry.pillar.branch === target : entry.pillar.stem === target,
  );
}

export function buildShenShaState(args: {
  pillars: CalculatedStateValue["fourPillars"];
  dayMasterStem: string;
  mingGong?: PillarValue;
  liuNian?: PillarValue;
  currentDaYun?: { stem: string; branch: string };
}) {
  const { pillars, dayMasterStem, mingGong, liuNian, currentDaYun } = args;
  const referencePillars: ReferencePillar[] = [
    { label: "ปี", pillar: pillars.year },
    { label: "เดือน", pillar: pillars.month },
    { label: "วัน", pillar: pillars.day },
    { label: "ยาม", pillar: pillars.hour },
    ...(mingGong ? [{ label: "ลัคนา", pillar: mingGong }] : []),
    ...(liuNian ? [{ label: "ปีจร", pillar: liuNian }] : []),
    ...(currentDaYun
      ? [{ label: `วัยจรปัจจุบัน (${currentDaYun.stem}${currentDaYun.branch})`, pillar: currentDaYun }]
      : []),
  ];
  const shenSha: CalculatedStateValue["shenSha"] = [];
  const seen = new Set<string>();

  const noblemanBranches = NOBLEMAN_BRANCHES_BY_DAY_STEM[
    dayMasterStem as keyof typeof NOBLEMAN_BRANCHES_BY_DAY_STEM
  ] ?? [];
  for (const branch of noblemanBranches) {
    for (const match of findReferenceMatches(referencePillars, branch)) {
      pushShenSha(
        shenSha,
        seen,
        SHEN_SHA_COPY.nobleman.starName,
        match.label,
        SHEN_SHA_COPY.nobleman.meaning,
      );
    }
  }

  const wenChangBranch = WEN_CHANG_BRANCH_BY_DAY_STEM[
    dayMasterStem as keyof typeof WEN_CHANG_BRANCH_BY_DAY_STEM
  ];
  if (wenChangBranch) {
    for (const match of findReferenceMatches(referencePillars, wenChangBranch)) {
      pushShenSha(
        shenSha,
        seen,
        SHEN_SHA_COPY.wenChang.starName,
        match.label,
        SHEN_SHA_COPY.wenChang.meaning,
      );
    }
  }

  // 天德 (เทียนเต๊ก) + 月德 (ง้วยเต๊ก) — อิงราศีล่างหลักเดือน แล้วหาเป้าหมายในสี่เสา/อ้างอิง
  const monthBranch = pillars.month.branch;

  const tianDeTarget = TIAN_DE_TARGET_BY_MONTH_BRANCH[
    monthBranch as keyof typeof TIAN_DE_TARGET_BY_MONTH_BRANCH
  ];
  if (tianDeTarget) {
    for (const match of findReferenceMatchesByStemOrBranch(referencePillars, tianDeTarget)) {
      pushShenSha(shenSha, seen, SHEN_SHA_COPY.tianDe.starName, match.label, SHEN_SHA_COPY.tianDe.meaning);
    }
  }

  const yueDeStem = YUE_DE_STEM_BY_MONTH_BRANCH[
    monthBranch as keyof typeof YUE_DE_STEM_BY_MONTH_BRANCH
  ];
  if (yueDeStem) {
    for (const entry of referencePillars.filter((p) => p.pillar.stem === yueDeStem)) {
      pushShenSha(shenSha, seen, SHEN_SHA_COPY.yueDe.starName, entry.label, SHEN_SHA_COPY.yueDe.meaning);
    }
  }

  return shenSha;
}