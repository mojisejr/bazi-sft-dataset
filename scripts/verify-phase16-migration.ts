import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const protectedTableNames = [
  "bazi_canonical_raw_rows",
  "bazi_canonical_sources",
  "bazi_reference_documents",
  "bazi_time_solar_terms",
  "bazi_faq_taxonomies",
  "bazi_element_interactions",
  "bazi_twelve_qi_stages",
  "bazi_day_master_profiles",
  "bazi_day_master_strength_states",
  "bazi_sixty_jiazi_narratives",
  "bazi_domain_matrices",
];

async function main() {
  const drizzleDirectory = path.resolve(process.cwd(), "drizzle");
  const metaDirectory = path.resolve(drizzleDirectory, "meta");

  const sqlFiles = (await readdir(drizzleDirectory))
    .filter((entry) => entry.endsWith(".sql"))
    .sort();

  if (sqlFiles.length === 0) {
    throw new Error("No drizzle SQL migration files were found.");
  }

  const latestSqlFile = path.join(drizzleDirectory, sqlFiles.at(-1)!);
  const latestSql = await readFile(latestSqlFile, "utf8");

  if (/\bDROP\s+TABLE\b/i.test(latestSql)) {
    throw new Error(
      `Unsafe migration detected in ${path.basename(latestSqlFile)}: DROP TABLE is forbidden during Phase 1.6.`,
    );
  }

  if (/\bDROP\s+TYPE\b/i.test(latestSql)) {
    throw new Error(
      `Unsafe migration detected in ${path.basename(latestSqlFile)}: DROP TYPE is forbidden during Phase 1.6.`,
    );
  }

  for (const protectedTableName of protectedTableNames) {
    if (latestSql.includes(`\"${protectedTableName}\"`)) {
      throw new Error(
        `Unsafe migration detected in ${path.basename(latestSqlFile)}: canonical table ${protectedTableName} must remain untouched.`,
      );
    }
  }

  const metaFiles = (await readdir(metaDirectory))
    .filter((entry) => entry.endsWith("_snapshot.json"))
    .sort();

  if (metaFiles.length === 0) {
    throw new Error("No drizzle snapshot metadata files were found.");
  }

  const latestSnapshotFile = path.join(metaDirectory, metaFiles.at(-1)!);
  const latestSnapshotRaw = await readFile(latestSnapshotFile, "utf8");
  const latestSnapshot = JSON.parse(latestSnapshotRaw) as {
    tables?: Record<string, unknown>;
  };

  const snapshotTables = new Set(Object.keys(latestSnapshot.tables ?? {}));
  const missingProtectedTables = protectedTableNames.filter(
    (tableName) => !snapshotTables.has(`public.${tableName}`),
  );

  if (missingProtectedTables.length > 0) {
    throw new Error(
      `Schema drift detected: protected tables missing from latest snapshot: ${missingProtectedTables.join(", ")}`,
    );
  }

  console.log(
    `Verified ${path.basename(latestSqlFile)} and ${path.basename(latestSnapshotFile)}: latest dataset migration only touches dataset schema surfaces.`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
