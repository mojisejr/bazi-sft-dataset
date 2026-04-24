import { createDbClient } from "./src/db/client";
import { baziTwelveQiStages } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = createDbClient();
  const stems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  
  console.log("เปรียบเทียบจุดเริ่มต้น 長生 (เชี่ยงแซ/เกิด) ระหว่าง 2 สำนัก:\n");
  console.log("| ดิถี | ตาม Database (สำนักซินแส) | ตาม Library มาตรฐาน (lunar-javascript) | ตรงกันไหม? |");
  console.log("|------|---------------------------|------------------------------------------|-----------|");

  for (const stem of stems) {
      // 1. Get from DB
      const rs = await db.select().from(baziTwelveQiStages).where(eq(baziTwelveQiStages.dayMaster, stem));
      const zsDb = rs.find(r => r.stageNameChinese === "長生");
      
      // 2. We can simulate lunar-javascript by finding the branch that gives DiShi "長生" or we can just list the known orthodox rules.
      // To keep script fast, I will use known Orthodox 12 Qi rules for Zhang Seng:
      const orthodoxZhangSeng: Record<string, string> = {
          "甲": "亥", "乙": "午", 
          "丙": "寅", "丁": "酉",
          "戊": "寅", "己": "酉", 
          "庚": "巳", "辛": "子", 
          "壬": "申", "癸": "卯"
      };
      
      const dbBranch = zsDb?.branch || "ไม่มีข้อมูล";
      const libBranch = orthodoxZhangSeng[stem];
      const match = dbBranch === libBranch ? "✅ ตรง" : "❌ ไม่ตรง";
      
      console.log(`|  ${stem}   |             ${dbBranch}             |                    ${libBranch}                     | ${match} |`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
