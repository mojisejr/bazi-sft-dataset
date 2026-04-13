import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const migrationTag = "0002_phase16_annotation_truth";
const snapshotFileName = "0002_snapshot.json";
const requiredCheckValue = `(
        "bazi_dataset_records"."status" <> 'reviewed'
        OR (
          "bazi_dataset_records"."annotation_data" IS NOT NULL
          AND jsonb_typeof("bazi_dataset_records"."annotation_data") = 'object'
          AND jsonb_typeof("bazi_dataset_records"."annotation_data" -> 'dimensions') = 'array'
          AND jsonb_array_length("bazi_dataset_records"."annotation_data" -> 'dimensions') = 15
          AND NOT jsonb_path_exists(
            "bazi_dataset_records"."annotation_data",
            '$.dimensions[*] ? (@.dimension_name == null || @.dimension_name == "" || @.thought_process == null || @.thought_process == "" || @.final_prediction == null || @.final_prediction == "")'
          )
        )
      )`;

const migrationSql = `ALTER TABLE "bazi_dataset_records" DROP CONSTRAINT "bazi_dataset_records_reviewed_content_check";--> statement-breakpoint
ALTER TABLE "bazi_dataset_records" ADD COLUMN "annotation_data" jsonb;--> statement-breakpoint
ALTER TABLE "bazi_dataset_records" DROP COLUMN "chain_of_thought";--> statement-breakpoint
ALTER TABLE "bazi_dataset_records" DROP COLUMN "target_output";--> statement-breakpoint
ALTER TABLE "bazi_dataset_records" ADD CONSTRAINT "bazi_dataset_records_reviewed_content_check" CHECK ((
        "bazi_dataset_records"."status" <> 'reviewed'
        OR (
          "bazi_dataset_records"."annotation_data" IS NOT NULL
          AND jsonb_typeof("bazi_dataset_records"."annotation_data") = 'object'
          AND jsonb_typeof("bazi_dataset_records"."annotation_data" -> 'dimensions') = 'array'
          AND jsonb_array_length("bazi_dataset_records"."annotation_data" -> 'dimensions') = 15
          AND NOT jsonb_path_exists(
            "bazi_dataset_records"."annotation_data",
            '$.dimensions[*] ? (@.dimension_name == null || @.dimension_name == "" || @.thought_process == null || @.thought_process == "" || @.final_prediction == null || @.final_prediction == "")'
          )
        )
      ));
`;

type Snapshot = {
  id: string;
  prevId: string;
  version: string;
  dialect: string;
  tables: Record<string, unknown>;
  enums: Record<string, unknown>;
  schemas: Record<string, unknown>;
  sequences: Record<string, unknown>;
  roles: Record<string, unknown>;
  policies: Record<string, unknown>;
  views: Record<string, unknown>;
  _meta: Record<string, unknown>;
};

type Journal = {
  version: string;
  dialect: string;
  entries: Array<{
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
  }>;
};

async function main() {
  const drizzleDirectory = path.resolve(process.cwd(), "drizzle");
  const metaDirectory = path.resolve(drizzleDirectory, "meta");
  const latestSnapshotPath = path.resolve(metaDirectory, "0001_snapshot.json");
  const nextSnapshotPath = path.resolve(metaDirectory, snapshotFileName);
  const journalPath = path.resolve(metaDirectory, "_journal.json");
  const migrationPath = path.resolve(drizzleDirectory, `${migrationTag}.sql`);

  const latestSnapshot = JSON.parse(
    await readFile(latestSnapshotPath, "utf8"),
  ) as Snapshot;
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as Journal;

  const nextSnapshot: Snapshot = structuredClone(latestSnapshot);
  nextSnapshot.id = randomUUID();
  nextSnapshot.prevId = latestSnapshot.id;

  const datasetTable = nextSnapshot.tables["public.bazi_dataset_records"] as {
    columns: Record<string, unknown>;
    checkConstraints: Record<string, { name: string; value: string }>;
  };

  delete datasetTable.columns.chain_of_thought;
  delete datasetTable.columns.target_output;
  datasetTable.columns.annotation_data = {
    name: "annotation_data",
    type: "jsonb",
    primaryKey: false,
    notNull: false,
  };
  datasetTable.checkConstraints.bazi_dataset_records_reviewed_content_check = {
    name: "bazi_dataset_records_reviewed_content_check",
    value: requiredCheckValue,
  };

  const existingEntryIndex = journal.entries.findIndex((entry) => entry.tag === migrationTag);
  const nextEntry = {
    idx: 2,
    version: journal.version,
    when: Date.now(),
    tag: migrationTag,
    breakpoints: true,
  };

  if (existingEntryIndex >= 0) {
    journal.entries[existingEntryIndex] = nextEntry;
  } else {
    journal.entries.push(nextEntry);
  }

  await writeFile(migrationPath, migrationSql, "utf8");
  await writeFile(nextSnapshotPath, `${JSON.stringify(nextSnapshot, null, 2)}\n`, "utf8");
  await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`, "utf8");

  console.log(
    `Generated deterministic Phase 1.6 migration at ${path.basename(migrationPath)} and snapshot ${path.basename(nextSnapshotPath)}.`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
