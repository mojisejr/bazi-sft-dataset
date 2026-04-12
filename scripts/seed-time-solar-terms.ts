import path from "node:path";

import { config as loadEnv } from "dotenv";

import { createDbClient } from "../src/db/client";
import { baziTimeSolarTerms } from "../src/db/schema";
import { buildGeneratedSolarTermRows } from "../src/lib/bazi/solar-terms";

const CHUNK_SIZE = 250;

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

async function insertInChunks(values: ReturnType<typeof buildGeneratedSolarTermRows>) {
  if (values.length === 0) {
    console.log("No solar terms generated.");
    return;
  }

  const db = createDbClient();
  await db.delete(baziTimeSolarTerms);

  for (let index = 0; index < values.length; index += CHUNK_SIZE) {
    const chunk = values.slice(index, index + CHUNK_SIZE);
    await db.insert(baziTimeSolarTerms).values(chunk);
  }
}

async function main() {
  const startYear = 1900;
  const endYear = 2100;
  const isDryRun = process.argv.includes("--dry-run");
  const rows = buildGeneratedSolarTermRows(startYear, endYear);

  console.log(
    JSON.stringify(
      {
        startYear,
        endYear,
        totalRows: rows.length,
        years: endYear - startYear + 1,
        rowsPerYear: 24,
        sample: {
          first: rows[0],
          last: rows[rows.length - 1],
        },
      },
      null,
      2,
    ),
  );

  if (isDryRun) {
    return;
  }

  await insertInChunks(rows);
  console.log(`Seeded ${rows.length} solar-term rows into bazi_time_solar_terms.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});