import { calculateBaziChart, createDbKnowledgeRepository } from "./src/lib/bazi/symbolic-engine";

const rawInput = {
    birthDate: "1989-01-03",
    birthTime: "08:30",
    gender: "male",
    province: "Bangkok",
    calendarSystem: "solar" as const,
    timezone: "Asia/Bangkok",
};

const repo = createDbKnowledgeRepository(process.env.DATABASE_URL);
calculateBaziChart(rawInput, repo).then((state) => {
    console.log("Day Master:", state.dayMaster);
    console.log("Strength Score:", state.strengthScore);
    console.log("Day Master Strength Profile:", state.dayMasterStrengthProfile);
    console.log("Sixty Jiazi Core Persona:", !!state.sixtyJiaziCorePersona);
});
