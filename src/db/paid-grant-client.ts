import postgres from "postgres";

import { getDatabaseUrl } from "@/lib/env";
import { createResilientSql } from "@/db/bounded-sql";

// Paid grants must never enter the generic engine pool's automatic write retry.
// Keep this two-connection pool separate, bounded and shared across Next chunks.
const shared = globalThis as unknown as { _paidQiGrantSql?: Map<string, ReturnType<typeof postgres>> };

export function createPaidGrantSqlClient(databaseUrl = getDatabaseUrl()) {
  const clients = shared._paidQiGrantSql ??= new Map();
  const found = clients.get(databaseUrl);
  if (found) return found;
  // postgres 3.4.9 parses max_pipeline (src/index.js), but omits it from its
  // published Options type. Keep the pinned runtime setting explicit here.
  const options: postgres.Options<Record<string, never>> & { max_pipeline: number } = {
    prepare: false,
    ssl: "require",
    max: 2,
    max_pipeline: 1,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  };
  const client = createResilientSql(() => postgres(databaseUrl, options));
  clients.set(databaseUrl, client);
  return client;
}
