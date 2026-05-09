import { calculateBaziStructuralState } from './src/lib/bazi/symbolic-engine';
import { buildGeneralizedInteractionState, resolveBranchInteractionEffects } from './src/lib/bazi/symbolic-engine.interactions';

const payload = {
  id: "test2",
  name: "Test 2",
  birthDate: "1989-01-03",
  birthTime: "08:45",
  province: "Bangkok",
  gender: "M" as const
};

const state = calculateBaziStructuralState(payload);
const interactionResolution = resolveBranchInteractionEffects(state.fourPillars);

const interactions = buildGeneralizedInteractionState({
  pillars: state.fourPillars,
  dayMasterStem: state.dayMaster,
  twelveQiByBranch: {
    year: "test",
    month: "test",
    day: "test",
    hour: "test",
  },
  resolution: interactionResolution,
});

console.log("CHART:");
console.log(JSON.stringify(state.fourPillars, null, 2));
console.log("\nINTERACTIONS:");
console.log(JSON.stringify(interactions.relations, null, 2));
