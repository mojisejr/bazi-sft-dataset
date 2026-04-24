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
  
  if (result.explainable?.strengthScore?.trace) {
      console.log(JSON.stringify(result.explainable.strengthScore.trace, null, 2));
  } else {
      console.log("No Trace");
  }
}

main().catch(console.error);
