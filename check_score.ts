import { RawInputSchema } from "./src/lib/bazi/schema-types";
import { calculateBaziChart } from "./src/lib/bazi/symbolic-engine";
import { createTestKnowledgeRepository } from "./tests/helpers/bazi-test-knowledge-repository";

async function main() {
  const result = await calculateBaziChart(
    RawInputSchema.parse({
      birthDate: "2018-12-08",
      birthTime: "17:13",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    }),
    createTestKnowledgeRepository()
  );
  console.log("Score:", result.strengthScore);
  console.log("Stems:", result.fourPillars.year.stem, result.fourPillars.month.stem, result.fourPillars.day.stem, result.fourPillars.hour.stem);
  console.log("Branches:", result.fourPillars.year.branch, result.fourPillars.month.branch, result.fourPillars.day.branch, result.fourPillars.hour.branch);
  console.log("Trace:", JSON.stringify(result.strengthTrace, null, 2));
}

main().catch(console.error);
