import type { BaziAtomicFaqBinding } from "./types";

export const FAQ_TAXONOMY = {
  foundation: {
    primaryIntents: ["other"],
    rawTypeLabels: ["Others"],
  },
  health: {
    primaryIntents: ["health"],
    rawTypeLabels: ["Health"],
  },
  relationship: {
    primaryIntents: ["love"],
    rawTypeLabels: ["Love"],
  },
  study: {
    primaryIntents: ["study"],
    rawTypeLabels: ["Study"],
  },
  wealth: {
    primaryIntents: ["wealth"],
    rawTypeLabels: ["Wealth"],
  },
  work: {
    primaryIntents: ["work"],
    rawTypeLabels: ["Work"],
  },
} as const satisfies Record<string, BaziAtomicFaqBinding>;