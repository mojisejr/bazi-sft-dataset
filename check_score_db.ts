import { RawInputSchema } from "./src/lib/bazi/schema-types";
import { calculateBaziChart, createDbKnowledgeRepository } from "./src/lib/bazi/symbolic-engine";

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
    createDbKnowledgeRepository()
  );
  
  if (result.explainable?.strengthScore?.trace) {
      console.log(JSON.stringify(result.explainable.strengthScore.trace, null, 2));
  } else {
      console.log("No Trace", result);
  }

  process.exit(0);
}

main().catch(console.error);
