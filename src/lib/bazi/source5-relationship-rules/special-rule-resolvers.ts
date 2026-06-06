import type { BaziCallerContract } from "@/lib/bazi/symbolic-engine.caller-contract";
import {
  FAVORABLE_CHEINGSAE_ORDERS,
  WEALTHY_SPOUSE_CODES,
} from "@/lib/bazi/source5-relationship-rules/constants";
import {
  buildPillarCode,
  getChartPillars,
  lookupCheingsaeStage,
  unique,
} from "@/lib/bazi/source5-relationship-rules/helpers";
import { Source5SpecialRulesResultSchema } from "@/lib/bazi/source5-relationship-rules/schemas";
import type {
  Source5ConflictImpactResult,
  Source5Element,
  Source5RelationshipCheingsaeResult,
  Source5RelationshipStepComputation,
  Source5SpecialRulesResult,
  Source5SpecialSignal,
  Source5SpouseLookupResult,
} from "@/lib/bazi/source5-relationship-rules/schemas";

function resolveAgeDifferenceProfile(
  contract: BaziCallerContract,
  spouseLookup: Source5SpouseLookupResult,
  conflictImpact: Source5ConflictImpactResult,
) {
  if (conflictImpact.consequences.some((consequence) => consequence.consequenceKey === "day-internal-destruction")) {
    return {
      classification: "gap-or-prior-marriage" as const,
      evidence: "พบแรงผั่วในหลักวันเอง จึงมีสัญญาณอายุห่างกันมากหรือคู่มีตำหนิเดิม",
    };
  }

  const directPillarKeys = unique([
    ...spouseLookup.directMatches.stems.map((match) => match.pillarKey),
    ...spouseLookup.directMatches.branches.map((match) => match.pillarKey),
  ]);

  if (directPillarKeys.includes("year")) {
    return {
      classification: "older-or-farther" as const,
      evidence: "สัญญาณคู่ครองขึ้นไปผูกกับหลักปี จึงโน้มไปทางอายุมากกว่าหรือมาจากไกล",
    };
  }

  if (directPillarKeys.includes("hour")) {
    return {
      classification: "younger" as const,
      evidence: "สัญญาณคู่ครองเด่นที่หลักยาม จึงโน้มไปทางอายุน้อยกว่าหรือดูเด็กกว่า",
    };
  }

  if (directPillarKeys.includes("month")) {
    return {
      classification: "same-generation" as const,
      evidence: "สัญญาณคู่ครองเด่นที่หลักเดือน จึงโน้มไปทางวัยไล่เลี่ยกันหรือเจอกันผ่านงาน/การเรียน",
    };
  }

  return {
    classification: "same-generation" as const,
    evidence: "ยังไม่มีกฎพิเศษอื่นตัดหน้าสัญญาณพื้นฐาน จึงอ่านเป็นวัยใกล้เคียงกัน",
  };
}

function resolveNationalityProfile(
  spouseLookup: Source5SpouseLookupResult,
  cheingsae: Source5RelationshipCheingsaeResult,
) {
  const directPillarKeys = unique([
    ...spouseLookup.directMatches.stems.map((match) => match.pillarKey),
    ...spouseLookup.directMatches.branches.map((match) => match.pillarKey),
  ]);

  if (cheingsae.selectedStages.some((stage) => stage.stageOrder === 7) || directPillarKeys.includes("year")) {
    return {
      classification: "different-region-or-foreign" as const,
      evidence: "มีสัญญาณแป่หรือโยงกับหลักปี จึงชี้ไปทางคู่ต่างถิ่น ต่างภูมิหลัง หรือเดินทางไกล",
    };
  }

  return {
    classification: "not-explicit" as const,
    evidence: "ยังไม่มีกฎต่างถิ่นที่เด่นพอ จึงไม่ฟันธงเรื่องเชื้อชาติหรือภูมิหลังไกล",
  };
}

function resolveStatusProfile(contract: BaziCallerContract, spouseLookup: Source5SpouseLookupResult) {
  const directStemSet = new Set(spouseLookup.directRules.stemSymbols);
  const directBranchSet = new Set(spouseLookup.directRules.branchSymbols);
  const wealthySpousePillar = getChartPillars(contract).find(([, pillar]) => (
    WEALTHY_SPOUSE_CODES.has(buildPillarCode(pillar))
    && directStemSet.has(pillar.stem)
    && directBranchSet.has(pillar.branch)
  ));

  if (wealthySpousePillar) {
    return {
      classification: "well-off" as const,
      evidence: `พบเสาคู่ครองแบบ ${buildPillarCode(wealthySpousePillar[1])} อยู่ในชุดนั่งลาภ/ไฉ่โข่ว`,
    };
  }

  return {
    classification: "not-explicit" as const,
    evidence: "ยังไม่พบรหัสคู่ครองนั่งลาภ/ไฉ่โข่วแบบชัดเจนในดวงนี้",
  };
}

function resolveSpouseCountProfile(
  dayMaster: string,
  spouseLookup: Source5SpouseLookupResult,
  cheingsae: Source5RelationshipCheingsaeResult,
) {
  const favorableBranches = spouseLookup.directMatches.branches.filter((match) => (
    FAVORABLE_CHEINGSAE_ORDERS.has(lookupCheingsaeStage(dayMaster, match.symbol).stageOrder)
  ));
  const visibleMarkerCount = unique([
    ...spouseLookup.directMatches.stems.map((match) => `${match.pillarKey}:${match.symbol}`),
    ...spouseLookup.directMatches.branches.map((match) => `${match.pillarKey}:${match.symbol}`),
  ]).length;
  const multipleSignal = visibleMarkerCount >= 2 || favorableBranches.length >= 2 || cheingsae.selectedStages.length >= 2;

  return {
    classification: multipleSignal ? "multiple-spouse-signals" as const : "single-clear-spouse-signal" as const,
    evidence: multipleSignal
      ? "มี marker คู่ครองหรือเชี่ยงแซดีหลายจุด จึงเปิดความเป็นไปได้ของสัญญาณคู่มากกว่าหนึ่ง"
      : "marker คู่ครองหลักยังรวมตัวอยู่ไม่กี่จุด จึงอ่านเป็นสัญญาณคู่หลักชัดหนึ่งเส้น",
  };
}

function resolveAppearanceDescription(spouseElement: Source5Element) {
  if (spouseElement === "wood" || spouseElement === "fire") {
    return "สูงโปร่ง";
  }

  if (spouseElement === "earth") {
    return "เนื้อแน่น ตัวหนา";
  }

  if (spouseElement === "metal") {
    return "อ้วน ตัวใหญ่ มีพุง";
  }

  return "อ้วน เนื้อเหลว มีพุง";
}

function resolveCheingsaeAccent(cheingsae: Source5RelationshipCheingsaeResult) {
  if (cheingsae.selectedStages.some((stage) => stage.stageOrder === 2)) {
    return "เชี่ยงแซหมกยกเพิ่มภาพความมีเสน่ห์และแรงดึงดูด";
  }

  if (cheingsae.selectedStages.some((stage) => stage.stageOrder === 5)) {
    return "เชี่ยงแซตี้อ๋วงเพิ่มภาพศักดิ์ศรีและความมั่นใจสูง";
  }

  if (cheingsae.selectedStages.some((stage) => stage.stageOrder === 11 || stage.stageOrder === 12)) {
    return "เชี่ยงแซทอ/เอี้ยงเพิ่มภาพความน่ารัก หน้าเด็ก หรือชวนให้ดูแล";
  }

  return "บุคลิกภายนอกยึดตามธาตุคู่ครองเป็นหลัก";
}

function resolveSpecialSignals(
  spouseLookup: Source5SpouseLookupResult,
  cheingsae: Source5RelationshipCheingsaeResult,
  conflictImpact: Source5ConflictImpactResult,
) {
  const signals: Source5SpecialSignal[] = [];

  if (spouseLookup.presenceMode === "hidden-only") {
    signals.push({
      signalKey: "hidden-spouse-only",
      label: "สัญญาณความสัมพันธ์ไม่เปิดเผย",
      evidence: "พบแต่ธาตุคู่ครองแฝง จึงตีความเป็นความสัมพันธ์เงียบ แอบคบ หรือยังไม่เปิดตัว",
    });
  }

  if (cheingsae.selectedStages.some((stage) => stage.stageOrder === 2)) {
    signals.push({
      signalKey: "bath-stage-charm",
      label: "เสน่ห์แรงหรือมีแรงเจ้าชู้",
      evidence: "มีเชี่ยงแซหมกยกใน lane คู่ครอง จึงยกสัญญาณเสน่ห์แรงหรือมีแรงดึงดูดเชิงรักซ้อน",
    });
  }

  if (conflictImpact.consequences.filter((consequence) => consequence.relationType === "combination").length >= 2) {
    signals.push({
      signalKey: "multiple-combination-network",
      label: "เครือข่ายคนเข้าหาเยอะ",
      evidence: "ฐานคู่เกิดภาคีหลายจุด จึงอ่านเป็นคู่มีสังคมหรือมีคนเข้าหามาก",
    });
  }

  if (
    cheingsae.selectedStages.some((stage) => stage.stageOrder === 7)
    && conflictImpact.consequences.some((consequence) => consequence.relationType === "combination")
  ) {
    signals.push({
      signalKey: "distance-affair-risk",
      label: "สัญญาณรักไกลหรือคบซ้อนจากการเดินทาง/สังคม",
      evidence: "เชี่ยงแซแป่ทำงานร่วมกับภาคี จึงยกสัญญาณรักไกลหรือความสัมพันธ์หลายเส้นพร้อมกัน",
    });
  }

  return signals;
}

export function resolveSpecialRulesResult(
  contract: BaziCallerContract,
  spouseLookup: Source5SpouseLookupResult,
  cheingsae: Source5RelationshipCheingsaeResult,
  conflictImpact: Source5ConflictImpactResult,
): Source5RelationshipStepComputation<Source5SpecialRulesResult> {
  return {
    packetFamilies: ["role-of-element", "conflict-context"],
    result: Source5SpecialRulesResultSchema.parse({
      kind: "special-rules-and-spouse-profile",
      specialSignals: resolveSpecialSignals(spouseLookup, cheingsae, conflictImpact),
      spouseProfile: {
        appearance: {
          spouseElement: spouseLookup.spouseElement,
          description: resolveAppearanceDescription(spouseLookup.spouseElement),
          cheingsaeAccent: resolveCheingsaeAccent(cheingsae),
        },
        ageDifference: resolveAgeDifferenceProfile(contract, spouseLookup, conflictImpact),
        nationality: resolveNationalityProfile(spouseLookup, cheingsae),
        status: resolveStatusProfile(contract, spouseLookup),
        spouseCountSignal: resolveSpouseCountProfile(contract.sharedPacketSpine.chartIdentity.dayMaster, spouseLookup, cheingsae),
      },
    }),
  };
}