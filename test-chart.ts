import { calculateBaziChart, createDbKnowledgeRepository } from "./src/lib/bazi/symbolic-engine.ts";

const rawInput = {
    birthDate: "1989-01-03",
    birthTime: "08:30",
    gender: "M",
    country: "TH",
    province: "กรุงเทพมหานคร"
};

const repo = createDbKnowledgeRepository(process.env.DATABASE_URL);
calculateBaziChart(rawInput as any, repo).then(state => {
    console.log("Day Master:", state.dayMaster);
    console.log("Strength Score:", state.strengthScore);
    console.log("Day Master Strength Profile:", state.dayMasterStrengthProfile);
    console.log("Sixty Jiazi Core Persona:", !!state.sixtyJiaziCorePersona);
});
