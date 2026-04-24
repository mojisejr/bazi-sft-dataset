import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { getDatabaseUrl } from "@/lib/env";
import * as schema from "@/db/schema";

export function createDbSqlClient(databaseUrl = getDatabaseUrl()) {
  return neon(databaseUrl);
}

export function createDbClient(databaseUrl = getDatabaseUrl()) {
  const client = createDbSqlClient(databaseUrl);

  return drizzle({ client, schema });
}