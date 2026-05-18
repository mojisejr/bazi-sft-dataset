import type { AnnotationDimensionName } from "@/lib/bazi/schema-types";
import type { HybridDictionarySpec } from "@/lib/bazi/dictionaries/shared";
import { careerPotentialDictionary } from "@/lib/bazi/dictionaries/career-potential";
import { healthOverviewDictionary } from "@/lib/bazi/dictionaries/health-overview";
import { loveAndFamilyDictionary } from "@/lib/bazi/dictionaries/love-and-family";
import { majorLuckCyclesDictionary } from "@/lib/bazi/dictionaries/major-luck-cycles";
import { personalityPsychologyDictionary } from "@/lib/bazi/dictionaries/personality-psychology";
import { pillarRelationsDictionary } from "@/lib/bazi/dictionaries/pillar-relations";
import { twelveQiCycleDictionary } from "@/lib/bazi/dictionaries/twelve-qi-cycle";
import { wealthAndInvestmentDictionary } from "@/lib/bazi/dictionaries/wealth-and-investment";

export const HYBRID_DICTIONARY_SPECS: Partial<Record<AnnotationDimensionName, HybridDictionarySpec>> = {
  personality_psychology: personalityPsychologyDictionary,
  health_overview: healthOverviewDictionary,
  career_potential: careerPotentialDictionary,
  wealth_and_investment: wealthAndInvestmentDictionary,
  love_and_family: loveAndFamilyDictionary,
  twelve_qi_cycle: twelveQiCycleDictionary,
  pillar_relations: pillarRelationsDictionary,
  major_luck_cycles: majorLuckCyclesDictionary,
};

export function getHybridDictionarySpec(dimensionName: AnnotationDimensionName) {
  return HYBRID_DICTIONARY_SPECS[dimensionName];
}
