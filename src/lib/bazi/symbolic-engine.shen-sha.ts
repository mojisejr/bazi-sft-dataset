import type {
  CalculatedStateValue,
  PillarValue,
} from "@/lib/bazi/schema-types";

import {
  NOBLEMAN_BRANCHES_BY_DAY_STEM,
  SHEN_SHA_COPY,
  WEN_CHANG_BRANCH_BY_DAY_STEM,
} from "@/lib/bazi/symbolic-engine.constants";
import type { ReferencePillar } from "@/lib/bazi/symbolic-engine.types";

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

  return shenSha;
}