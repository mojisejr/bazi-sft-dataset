import path from "node:path";
import { pathToFileURL } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  DEFAULT_PERSONALITY_POC_MODEL,
  PERSONALITY_TRUTH_HIERARCHY,
  buildPersonalityFocusPayload,
  generatePersonalityPromptPoc,
} from "@/lib/bazi/personality-prompt-poc";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import {
  calculateBaziChart,
  createDbKnowledgeRepository,
} from "@/lib/bazi/symbolic-engine";

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
    model: modelArg?.slice("--model=".length) || DEFAULT_PERSONALITY_POC_MODEL,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCliOptions(argv);
  const repository = createDbKnowledgeRepository();
  const calculatedState = await calculateBaziChart(DEFAULT_TEST_CASE, repository);
  const focusPayload = buildPersonalityFocusPayload(calculatedState);

  console.log(
    JSON.stringify(
      {
        mode: options.dryRun ? "dry-run" : "generate",
        testCase: DEFAULT_TEST_CASE,
        truthHierarchy: PERSONALITY_TRUTH_HIERARCHY,
        focusPayload,
      },
      null,
      2,
    ),
  );

  if (options.dryRun) {
    return;
  }

  const result = await generatePersonalityPromptPoc({
    rawInput: DEFAULT_TEST_CASE,
    calculatedState,
    model: options.model,
  });

  console.log(
    JSON.stringify(
      {
        model: result.model,
        reviewSummary: result.response.reviewSummary,
        personality: result.response.personality,
        annotationDimensionCount: result.annotationData.dimensions.length,
      },
      null,
      2,
    ),
  );
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
