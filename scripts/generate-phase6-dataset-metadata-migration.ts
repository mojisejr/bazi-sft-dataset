import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const migrationTag = "0006_phase6_dataset_metadata";
const migrationSql = `ALTER TABLE "bazi_dataset_records"
  ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb;
`;

function normalizeSql(value: string) {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

async function main() {
  const migrationPath = path.resolve(process.cwd(), "drizzle", `${migrationTag}.sql`);

  try {
    const existingSql = await readFile(migrationPath, "utf8");

    if (normalizeSql(existingSql) !== normalizeSql(migrationSql)) {
      throw new Error(
        `${path.basename(migrationPath)} already exists with unexpected contents. Refusing to overwrite migration history.`,
      );
    }

    console.log(`Verified deterministic migration file ${path.basename(migrationPath)}.`);
    return;
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("ENOENT")) {
      throw error;
    }
  }

  await writeFile(migrationPath, migrationSql, "utf8");
  console.log(`Generated deterministic dataset metadata migration at ${path.basename(migrationPath)}.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});