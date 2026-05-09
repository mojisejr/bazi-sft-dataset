import { calculateBaziStructuralState } from '../../src/lib/bazi/symbolic-engine';
import { buildGeneralizedInteractionState, resolveBranchInteractionEffects } from '../../src/lib/bazi/symbolic-engine.interactions';

const payload = {
  id: "test",
  name: "Test",
  birthDate: "1989-01-03",
  birthTime: "12:00",
  province: "Bangkok",
  gender: "M" as const
};

const state = calculateBaziStructuralState(payload);
const interactionResolution = resolveBranchInteractionEffects(state.fourPillars);

// Just calling buildGeneralizedInteractionState manually
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

console.log(JSON.stringify(interactions, null, 2));
