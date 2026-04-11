import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { getDatabaseUrl } from "@/lib/env";
import * as schema from "@/db/schema";

export function createDbClient(databaseUrl = getDatabaseUrl()) {
  const client = neon(databaseUrl);

  return drizzle({ client, schema });
}