import { desc, eq } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziConsent } from "@/db/schema";

export const runtime = "nodejs";

/**
 * /api/account/consent — ความยินยอม (เฟรม privacy-consent).
 *   GET  ?anonId= → { consents: [{kind, version, accepted, createdAt}], latest: {...} | null }
 *   POST { anonId, kind, version, accepted } → บันทึกเรคคอร์ดใหม่ (insert-only = มีประวัติถอน/ยอมรับ)
 */

const PostSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  kind: z.string().trim().min(1).max(32),
  version: z.string().trim().min(1).max(32),
  accepted: z.boolean().optional().default(true),
});

export async function GET(request: Request) {
  try {
    const anonId = new URL(request.url).searchParams.get("anonId")?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });
    const db = createDbClient();
    const consents = await db
      .select({ kind: baziConsent.kind, version: baziConsent.version, accepted: baziConsent.accepted, createdAt: baziConsent.createdAt })
      .from(baziConsent)
      .where(eq(baziConsent.anonId, anonId))
      .orderBy(desc(baziConsent.createdAt))
      .limit(50);
    return Response.json({ anonId, consents, latest: consents[0] ?? null }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown consent error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());
    const db = createDbClient();
    const [row] = await db
      .insert(baziConsent)
      .values({ anonId: body.anonId, kind: body.kind, version: body.version, accepted: body.accepted })
      .returning({ id: baziConsent.id, createdAt: baziConsent.createdAt });
    return Response.json({ ok: true, id: row.id, createdAt: row.createdAt }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid consent payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown consent error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
