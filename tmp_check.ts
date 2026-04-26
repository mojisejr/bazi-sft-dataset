import { calculateBaziChart, calculateBaziStructuralState, createDbKnowledgeRepository } from "./src/lib/bazi/symbolic-engine";
async function run() {
  const repo = createDbKnowledgeRepository();
  const rawInput = { birthDate: "1989-01-03", birthTime: "08:30", gender: "m", province: "Bangkok", city: "" };
  const struct = calculateBaziStructuralState(rawInput as any);
  console.log("Stem:", struct.dayMaster);
  console.log("Four Pillars:", struct.fourPillars);
  
  try {
     const chart = await calculateBaziChart(rawInput as any, repo);
     console.log("Score:", chart.strengthScore);
     console.log("Profile:", chart.dayMasterStrengthProfile);
     console.log("Persona:", chart.sixtyJiaziCorePersona?.code, chart.sixtyJiaziCorePersona?.twelveQiLabel, chart.sixtyJiaziCorePersona?.elementTone);
  } catch (e) { console.error(e) }
  process.exit(0);
}
run();
