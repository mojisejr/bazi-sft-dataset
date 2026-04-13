import path from "node:path";

import { config as loadEnv } from "dotenv";
import { eq } from "drizzle-orm";

import { createDbClient } from "../src/db/client";
import { baziDatasetRecords } from "../src/db/schema";
import {
  AnnotationDataSchema,
  CalculatedStateSchema,
  RawInputSchema,
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
} from "../src/lib/bazi/schema-types";

const isDryRun = process.argv.includes("--dry-run") || !process.argv.includes("--write");

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const rawInput = RawInputSchema.parse({
  birthDate: "1992-08-21",
  birthTime: "14:35",
  gender: "female",
  province: "Bangkok",
  calendarSystem: "solar",
  timezone: "Asia/Bangkok",
});

const calculatedState = CalculatedStateSchema.parse({
  fourPillars: {
    year: { stem: "ren", branch: "shen", hiddenStems: ["geng", "ren", "wu"] },
    month: { stem: "wu", branch: "shen", hiddenStems: ["geng", "ren", "wu"] },
    day: { stem: "ji", branch: "mao", hiddenStems: ["yi"] },
    hour: { stem: "xin", branch: "wei", hiddenStems: ["ji", "ding", "yi"] },
  },
  dayMaster: "ji-earth",
  strengthScore: 2.75,
  tenGods: {
    yearStem: "indirect_wealth",
    monthStem: "direct_resource",
    hourStem: "eating_god",
  },
  twelveQi: {
    yearBranch: "chang_sheng",
    monthBranch: "mu_yu",
    dayBranch: "lin_guan",
    hourBranch: "shuai",
  },
  elementMetaphors: [
    { element: "earth", metaphor: "fertile cultivated soil" },
    { element: "metal", metaphor: "refined tools shaped by discipline" },
  ],
  sixtyJiaziCorePersona: {
    code: "ji_mao",
    narrative: "Measured earth that grows through patience and timing.",
    precedenceNotes: ["60-jiazi narrative supports but does not override clash resolution."],
  },
});

const annotationData = AnnotationDataSchema.parse({
  version: "1.6",
  dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
    dimension_name: dimensionName,
    thought_process: `Reasoning trace for ${dimensionName}.`,
    final_prediction: `Final prediction for ${dimensionName}.`,
    supporting_signals: ["signal-a", "signal-b"],
  })),
  reviewSummary: "Sample phase 1.6 record validated successfully.",
});

async function main() {
  const payload = {
    rawInput,
    calculatedState,
    intentDomain: "general" as const,
    annotationData,
    status: "draft" as const,
  };

  console.log(
    JSON.stringify(
      {
        mode: isDryRun ? "dry-run" : "write",
        datasetPreview: {
          rawInput,
          calculatedState,
          annotationDimensionCount: annotationData.dimensions.length,
        },
      },
      null,
      2,
    ),
  );

  if (isDryRun) {
    return;
  }

  const db = createDbClient();
  const insertedRows = await db
    .insert(baziDatasetRecords)
    .values(payload)
    .returning({ id: baziDatasetRecords.id });

  const insertedId = insertedRows[0]?.id;

  if (!insertedId) {
    throw new Error("Failed to insert the phase 1.6 validation sample.");
  }

  await db.delete(baziDatasetRecords).where(eq(baziDatasetRecords.id, insertedId));
  console.log(`Inserted and cleaned up validation record ${insertedId}.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
