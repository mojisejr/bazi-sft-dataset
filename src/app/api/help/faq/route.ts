import { asc, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziHelpArticle } from "@/db/schema";

export const runtime = "nodejs";

/**
 * /api/help/faq — บทความช่วยเหลือ (เฟรม help-faq + document-reader — template).
 *   GET        → { articles: [{slug,title,body}] } (เรียง position)
 *   GET ?slug= → บทความเดียว (สำหรับหน้าอ่านเอกสารเต็ม); ไม่พบ → 404
 * ข้อมูล seed ด้วย scripts/seed-help-articles.ts — แก้เนื้อหาไม่ต้อง deploy
 */

export async function GET(request: Request) {
  try {
    const slug = new URL(request.url).searchParams.get("slug")?.trim();
    const db = createDbClient();
    if (slug) {
      const [article] = await db
        .select({ slug: baziHelpArticle.slug, title: baziHelpArticle.title, body: baziHelpArticle.body })
        .from(baziHelpArticle)
        .where(eq(baziHelpArticle.slug, slug))
        .limit(1);
      if (!article) return Response.json({ error: "ไม่พบบทความนี้" }, { status: 404 });
      return Response.json(article, { status: 200 });
    }
    const articles = await db
      .select({ slug: baziHelpArticle.slug, title: baziHelpArticle.title, body: baziHelpArticle.body })
      .from(baziHelpArticle)
      .orderBy(asc(baziHelpArticle.position));
    return Response.json({ articles }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown faq error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
