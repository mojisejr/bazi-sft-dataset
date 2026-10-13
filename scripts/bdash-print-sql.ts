/**
 * bdash — พิมพ์ SQL ที่ computeBdashSnapshot จะรัน (ค่าพารามิเตอร์ใส่ไว้ในตัว) เพื่อลองบนสำเนาฐาน staging ด้วย psql
 * แบบอ่านอย่างเดียว ก่อนปล่อย. ไม่ต่อฐานข้อมูลเอง.
 * Usage: npx tsx scripts/bdash-print-sql.ts 2026-10-01 > /tmp/bdash.sql
 */
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

import { computeBdashSnapshot } from "../src/lib/bdash/compute";

const asOf = process.argv[2];
if (!asOf || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
  console.error("usage: bdash-print-sql.ts <as_of YYYY-MM-DD>");
  process.exit(2);
}

const dialect = new PgDialect();
const literal = (v: unknown) => (typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const fake = {
  execute: async (q: SQL) => {
    const { sql, params } = dialect.sqlToQuery(q);
    const text = sql.replace(/\$(\d+)/g, (_, n) => literal(params[Number(n) - 1]));
    console.log(`${text};\n`);
    return [];
  },
};

console.log("SET default_transaction_read_only = on;\n\\timing on\n");
computeBdashSnapshot(fake as never, asOf).catch((e) => {
  console.error(e);
  process.exit(1);
});
