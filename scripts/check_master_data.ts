import { createDbClient } from "../src/db/client";
import { baziDayMasterStrengthStates, baziSixtyJiaziNarratives } from "../src/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  const db = createDbClient();
  
  console.log("=== baziDayMasterStrengthStates (Sample) ===");
  const strengthData = await db.select().from(baziDayMasterStrengthStates).limit(2);
  console.log(JSON.stringify(strengthData, null, 2));

  console.log("\n=== baziSixtyJiaziNarratives (Sample) ===");
  const narrativeData = await db.select().from(baziSixtyJiaziNarratives).limit(2);
  console.log(JSON.stringify(narrativeData, null, 2));

  // Get total counts
  const strengthCount = await db.select({ count: sql`count(*)` }).from(baziDayMasterStrengthStates);
  const narrativeCount = await db.select({ count: sql`count(*)` }).from(baziSixtyJiaziNarratives);
  console.log(`\n--- Summary ---`);
  console.log(`Total strength records: ${strengthCount[0].count}`);
  console.log(`Total narrative records: ${narrativeCount[0].count}`);
}

main().catch(console.error);
