import { readFile } from "node:fs/promises";
import path from "node:path";

const migrationTag = "0006_phase6_dataset_metadata";
const expectedSql = `ALTER TABLE "bazi_dataset_records"
  ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb;
`;

const forbiddenPatterns = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+TYPE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
];

function normalizeSql(value: string) {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

async function main() {
  const migrationPath = path.resolve(process.cwd(), "drizzle", `${migrationTag}.sql`);
  const migrationSql = await readFile(migrationPath, "utf8");

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(migrationSql)) {
      throw new Error(
        `Unsafe migration detected in ${path.basename(migrationPath)}: pattern ${pattern} is forbidden.`,
      );
    }
  }

  if (normalizeSql(migrationSql) !== normalizeSql(expectedSql)) {
    throw new Error(
      `${path.basename(migrationPath)} diverged from the approved append-only SQL for dataset metadata.`,
    );
  }

  console.log(`Verified ${path.basename(migrationPath)}: append-only metadata column migration is safe.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});