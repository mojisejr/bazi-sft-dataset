import { calculateBaziStructuralState } from './src/lib/bazi/symbolic-engine';
import { buildGeneralizedInteractionState } from './src/lib/bazi/symbolic-engine.interactions';
import { getTwelveQiStage } from './src/lib/bazi/symbolic-engine.strength'; // or wherever it is

const payload = {
  id: "test",
  name: "Test",
  birthDate: "1989-01-03",
  birthTime: "12:00",
  province: "Bangkok",
  gender: "M" as const
};

const state = calculateBaziStructuralState(payload);

// Just calling buildGeneralizedInteractionState manually
const interactions = buildGeneralizedInteractionState({
  pillars: state.baseChart.pillars,
  dayMasterStem: state.dayMaster,
  twelveQiByBranch: {}, // mock
  resolution: { 
    sixCombinations: [], 
    threeCombinations: [], 
    halfCombinations: [], 
    directionalCombinations: [], 
    clashes: [], 
    harms: [], 
    destructions: [], 
    punishments: [] 
  } // mock resolution or find a way to get it
});

console.log(JSON.stringify(interactions, null, 2));
