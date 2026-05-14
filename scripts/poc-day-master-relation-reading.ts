import path from "node:path";
import { pathToFileURL } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  DEFAULT_DAY_MASTER_RELATION_POC_MODEL,
  buildDayMasterRelationPacket,
  formatDayMasterRelationPocGeneratedReport,
  formatDayMasterRelationPocPreflightReport,
  generateDayMasterRelationReadingPoc,
} from "@/lib/bazi/day-master-relation-reading-poc";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart, createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const DEFAULT_TEST_CASE = RawInputSchema.parse({
  birthDate: "1989-01-03",
  birthTime: "08:45",
  gender: "male",
  province: "Bangkok",
  calendarSystem: "solar",
  timezone: "Asia/Bangkok",
});

function parseCliOptions(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const modelArg = argv.find((entry) => entry.startsWith("--model="));

  return {
    dryRun,
    model: modelArg?.slice("--model=".length) || DEFAULT_DAY_MASTER_RELATION_POC_MODEL,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCliOptions(argv);
  const repository = createDbKnowledgeRepository();
  const calculatedState = await calculateBaziChart(DEFAULT_TEST_CASE, repository);
  const packet = buildDayMasterRelationPacket(calculatedState);

  console.log(formatDayMasterRelationPocPreflightReport({
    rawInput: DEFAULT_TEST_CASE,
    packet,
  }));

  if (options.dryRun) {
    return;
  }

  const result = await generateDayMasterRelationReadingPoc({
    rawInput: DEFAULT_TEST_CASE,
    calculatedState,
    model: options.model,
  });

  console.log("");
  console.log(formatDayMasterRelationPocGeneratedReport({
    rawInput: DEFAULT_TEST_CASE,
    packet: result.packet,
    response: result.response,
    model: result.model,
  }));
}

if (
  typeof process.argv[1] === "string"
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
