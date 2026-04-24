import { createDbClient } from "./src/db/client";
import { baziTwelveQiStages } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = createDbClient();
  const rs = await db.select().from(baziTwelveQiStages).where(eq(baziTwelveQiStages.dayMaster, "甲"));
  console.log("Jia interactions:");
  for (const r of rs) {
      console.log(r.branch, "stage:", r.stageNameChinese);
  }
}

main().catch(console.error);
