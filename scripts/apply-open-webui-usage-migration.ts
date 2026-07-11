/**
 * Apply migration 0031: ตาราง open_webui_usage (additive, idempotent)
 * Usage: node --env-file=.env --import tsx scripts/apply-open-webui-usage-migration.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { createDbSqlClient } from "../src/db/client";

async function main() {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0031_open_webui_usage.sql");
  const ddl = readFileSync(sqlPath, "utf8");
  const sql = createDbSqlClient();

  const statements = ddl
    .split("--> statement-breakpoint")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await sql.unsafe(statement);
    console.log("ok:", statement.split("\n")[0]);
  }
  console.log("done");
}

main().then(() => process.exit(0));
