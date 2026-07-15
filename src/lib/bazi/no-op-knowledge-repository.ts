import type { BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine.types";

/**
 * No-DB stand-in for {@link BaziKnowledgeRepository} — for routes that only need the
 * deterministic calc pipeline (pillars/twelve-qi/strengthScore/daYun/liuNian) and must never
 * touch the DB (see tests/orthodox-twelve-qi-reference.test.ts for the same shape proven safe).
 */
export function createNoOpKnowledgeRepository(): BaziKnowledgeRepository {
  return {
    async findSolarTermBoundaryContext() {
      return { previous: null, next: null };
    },
    async findDayMasterStrengthProfile() {
      return null;
    },
    async findSixtyJiaziPersona() {
      return null;
    },
    async findDomainMatrixRows() {
      return [];
    },
  };
}
