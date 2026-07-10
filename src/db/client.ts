import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getDatabaseUrl } from "@/lib/env";
import * as schema from "@/db/schema";

// Runtime: Supabase TRANSACTION pooler (:6543) for serverless API routes.
// `prepare: false` is REQUIRED for the transaction pooler (no prepared statements).
// ssl 'require' = use SSL without strict CA verify (Supabase self-signed chain).
const globalForDb = globalThis as unknown as {
  _pgByUrl?: Map<string, ReturnType<typeof postgres>>;
};

export function createDbSqlClient(databaseUrl = getDatabaseUrl()) {
  const clients = globalForDb._pgByUrl ?? new Map<string, ReturnType<typeof postgres>>();
  globalForDb._pgByUrl = clients;

  const existing = clients.get(databaseUrl);
  if (existing) return existing;

  const client = postgres(databaseUrl, { prepare: false, ssl: "require", max: 1 });
  clients.set(databaseUrl, client);
  return client;
}

export function createDbClient(databaseUrl = getDatabaseUrl()) {
  const client = createDbSqlClient(databaseUrl);

  return drizzle(client, { schema });
}
