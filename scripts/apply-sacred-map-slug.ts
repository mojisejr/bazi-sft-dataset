/**
 * Apply migration 0048 (slug column) + backfill slugs สำหรับสถานที่ที่มีอยู่แล้ว.
 * Usage: node --env-file=.env --import tsx scripts/apply-sacred-map-slug.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { createDbSqlClient } from "../src/db/client";
import { baseSlugFor } from "../src/lib/bazi/sacred-map/slug";

const DUPLICATE_OBJECT = "42710";

async function main() {
  const sql = createDbSqlClient();

  // 1) apply DDL (idempotent)
  const ddl = readFileSync(path.resolve(process.cwd(), "drizzle/0048_sacred_map_slug.sql"), "utf8");
  const statements = ddl
    .split("--> statement-breakpoint")
    .map((c) => c.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    try { await sql.unsafe(stmt); }
    catch (e) { if ((e as { code?: string })?.code === DUPLICATE_OBJECT) continue; throw e; }
  }

  // 2) backfill: ทุกแถวที่ slug ยังว่าง
  const rows = (await sql.unsafe(
    `select id, name, slug from bazi_sacred_map_location where slug is null or slug = ''`,
  )) as unknown as { id: string; name: string; slug: string | null }[];

  const used = new Set(
    ((await sql.unsafe(`select slug from bazi_sacred_map_location where slug is not null and slug <> ''`)) as unknown as { slug: string }[])
      .map((r) => r.slug),
  );

  for (const row of rows) {
    const base = baseSlugFor(row.name) || `place-${row.id.slice(0, 8)}`;
    let slug = base;
    for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
    used.add(slug);
    await sql.unsafe(`update bazi_sacred_map_location set slug = $1 where id = $2`, [slug, row.id]);
    console.log(`  ${row.name}  →  ${slug}`);
  }

  const all = (await sql.unsafe(`select name, slug from bazi_sacred_map_location order by created_at`)) as unknown as { name: string; slug: string }[];
  console.log(`\nslug ทั้งหมด (${all.length}):`);
  for (const r of all) console.log(`  ${r.slug}\t${r.name}`);

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
