import type { BaziAtomicCrossDomainRule } from "./types";

export const crossDomainDecomposition = [
  {
    ruleId: "wealth_and_work",
    promptPattern: "money plus work",
    resultPolicy: "Split into one wealth job plus one work job.",
  },
  {
    ruleId: "relationship_and_timing",
    promptPattern: "love plus timing",
    resultPolicy:
      "Split into one relationship timing job and only add partner profile when the prompt explicitly asks for it.",
  },
  {
    ruleId: "work_and_study",
    promptPattern: "work plus study",
    resultPolicy:
      "Keep study result or exam outcome separate from work-entry or role-fit outcome.",
  },
  {
    ruleId: "relationship_wealth_work",
    promptPattern: "love plus money plus work",
    resultPolicy:
      "Split by domain first, then narrow into one atomic job per domain-specific ask.",
  },
  {
    ruleId: "family_and_work",
    promptPattern: "family or child plus work",
    resultPolicy:
      "Keep family or child questions outside this matrix and do not collapse them into a work job.",
  },
] as const satisfies readonly BaziAtomicCrossDomainRule[];