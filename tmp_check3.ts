import { createDbClient } from "./src/db/client";
import { baziDayMasterStrengthStates } from "./src/db/schema";
import { eq } from 'drizzle-orm';
async function test() {
  const db = createDbClient();
  const rows = await db.select().from(baziDayMasterStrengthStates).where(eq(baziDayMasterStrengthStates.dayMasterChinese, '癸'));
  console.log(rows.map(r => r.strengthState));
  process.exit();
}
test();
