import { and, asc, desc, eq, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import {
  baziDayMasterStrengthStates,
  baziDomainMatrices,
  baziSixtyJiaziNarratives,
  baziTimeSolarTerms,
} from "@/db/schema";
import type { BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine";
import { resolveCanonicalDayMasterStrengthState } from "@/lib/bazi/strength-state-vocabulary";

export function createDbKnowledgeRepository(databaseUrl?: string): BaziKnowledgeRepository {
  const db = createDbClient(databaseUrl);

  return {
    async findSolarTermBoundaryContext(birthAtHongKong) {
      const [previous] = await db
        .select({
          label: baziTimeSolarTerms.label,
          solarTermName: baziTimeSolarTerms.solarTermName,
          boundaryAt: baziTimeSolarTerms.boundaryAt,
        })
        .from(baziTimeSolarTerms)
        .where(sql`${baziTimeSolarTerms.boundaryAt} is not null and ${baziTimeSolarTerms.boundaryAt} <= ${birthAtHongKong}`)
        .orderBy(desc(baziTimeSolarTerms.boundaryAt))
        .limit(1);

      const [next] = await db
        .select({
          label: baziTimeSolarTerms.label,
          solarTermName: baziTimeSolarTerms.solarTermName,
          boundaryAt: baziTimeSolarTerms.boundaryAt,
        })
        .from(baziTimeSolarTerms)
        .where(sql`${baziTimeSolarTerms.boundaryAt} is not null and ${baziTimeSolarTerms.boundaryAt} > ${birthAtHongKong}`)
        .orderBy(asc(baziTimeSolarTerms.boundaryAt))
        .limit(1);

      return {
        previous: previous ?? null,
        next: next ?? null,
      };
    },

    async findSixtyJiaziPersona(dayMasterChinese, branchChinese) {
      const [persona] = await db
        .select({
          dayMasterChinese: baziSixtyJiaziNarratives.dayMasterChinese,
          branchChinese: baziSixtyJiaziNarratives.branchChinese,
          elementTone: baziSixtyJiaziNarratives.elementTone,
          twelveQiLabel: baziSixtyJiaziNarratives.twelveQiLabel,
          dayMasterNarrative: baziSixtyJiaziNarratives.dayMasterNarrative,
          branchNarrative: baziSixtyJiaziNarratives.branchNarrative,
          combinedNarrative: baziSixtyJiaziNarratives.combinedNarrative,
        })
        .from(baziSixtyJiaziNarratives)
        .where(
          and(
            eq(baziSixtyJiaziNarratives.dayMasterChinese, dayMasterChinese),
            eq(baziSixtyJiaziNarratives.branchChinese, branchChinese),
          ),
        )
        .limit(1);

      return persona ?? null;
    },

    async findDayMasterStrengthProfile(dayMasterChinese, strengthState, strengthScore) {
      const [profile] = await db
        .select({
          dayMaster: baziDayMasterStrengthStates.dayMasterChinese,
          strengthState: baziDayMasterStrengthStates.strengthState,
          narrative: baziDayMasterStrengthStates.narrativeSummary,
          qiLabel: baziDayMasterStrengthStates.qiLabel,
          scoreText: baziDayMasterStrengthStates.scoreText,
          rowOrder: baziDayMasterStrengthStates.rowOrder,
        })
        .from(baziDayMasterStrengthStates)
        .where(
          and(
            eq(baziDayMasterStrengthStates.dayMasterChinese, dayMasterChinese),
            eq(baziDayMasterStrengthStates.strengthState, strengthState),
          ),
        )
        .orderBy(asc(baziDayMasterStrengthStates.rowOrder))
        .limit(1);

      if (!profile?.dayMaster || !profile.strengthState || !profile.narrative) {
        const fallbackRows = await db
          .select({
            dayMaster: baziDayMasterStrengthStates.dayMasterChinese,
            strengthState: baziDayMasterStrengthStates.strengthState,
            narrative: baziDayMasterStrengthStates.narrativeSummary,
            qiLabel: baziDayMasterStrengthStates.qiLabel,
            scoreText: baziDayMasterStrengthStates.scoreText,
            rowOrder: baziDayMasterStrengthStates.rowOrder,
          })
          .from(baziDayMasterStrengthStates)
          .where(
            and(
              eq(baziDayMasterStrengthStates.dayMasterChinese, dayMasterChinese),
              sql`${baziDayMasterStrengthStates.narrativeSummary} is not null and trim(${baziDayMasterStrengthStates.narrativeSummary}) <> ''`,
            ),
          )
          .orderBy(asc(baziDayMasterStrengthStates.rowOrder));

        const fallbackProfile = fallbackRows
          .flatMap((row) => {
            const sourceResolution = resolveCanonicalDayMasterStrengthState(row.strengthState);
            const scoreResolution = sourceResolution
              ? null
              : resolveCanonicalDayMasterStrengthState(row.scoreText);
            const resolution = sourceResolution ?? scoreResolution;

            if (!row.dayMaster || !row.narrative || !resolution || resolution.lookupState !== strengthState) {
              return [];
            }

            const numericCandidate = row.strengthState?.trim() ?? row.scoreText?.trim() ?? "";
            const scoreDelta = typeof strengthScore === "number" && /^[0-9]+(?:\.[0-9]+)?$/.test(numericCandidate)
              ? Math.abs(Number.parseFloat(numericCandidate) - strengthScore)
              : Number.POSITIVE_INFINITY;
            const resolutionRank = resolution.matchKind === "canonical"
              ? 0
              : resolution.matchKind === "alias"
                ? 1
                : resolution.matchKind === "numeric"
                  ? 2
                  : 3;

            return [{
              ...row,
              lookupState: resolution.lookupState,
              sourceState: resolution.sourceState,
              resolutionRank,
              scoreDelta,
            }];
          })
          .sort((left, right) => (
            left.resolutionRank - right.resolutionRank
            || left.scoreDelta - right.scoreDelta
            || left.rowOrder - right.rowOrder
          ))[0];

        if (!fallbackProfile) {
          return null;
        }

        if (!fallbackProfile.dayMaster || !fallbackProfile.narrative) {
          return null;
        }

        return {
          dayMaster: fallbackProfile.dayMaster,
          strengthState,
          sourceState: fallbackProfile.sourceState,
          lookupState: fallbackProfile.lookupState,
          narrative: fallbackProfile.narrative,
          qiLabel: fallbackProfile.qiLabel,
          scoreText: fallbackProfile.scoreText,
        };
      }

      const dayMaster = profile.dayMaster;
      const narrative = profile.narrative;

      return {
        dayMaster,
        strengthState,
        sourceState: profile.strengthState,
        lookupState: strengthState,
        narrative,
        qiLabel: profile.qiLabel,
        scoreText: profile.scoreText,
      };
    },

    async findDomainMatrixRows(domain) {
      return db
        .select({
          domain: baziDomainMatrices.domain,
          sourceVariant: baziDomainMatrices.sourceVariant,
          pairKey: baziDomainMatrices.pairKey,
          rowOrder: baziDomainMatrices.rowOrder,
          code: baziDomainMatrices.code,
          label: baziDomainMatrices.label,
          scoreText: baziDomainMatrices.scoreText,
          narrative: baziDomainMatrices.narrative,
          rawCells: baziDomainMatrices.rawCells,
        })
        .from(baziDomainMatrices)
        .where(eq(baziDomainMatrices.domain, domain))
        .orderBy(asc(baziDomainMatrices.sourceVariant), asc(baziDomainMatrices.rowOrder));
    },
  };
}