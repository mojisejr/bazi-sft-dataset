import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziUserIntent } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * /api/user/intent — เก็บ/อ่าน "ด้านที่อยากเน้นดูแล" จากจอ onboarding 02-intent-check.
 * key ด้วย anonId (localStorage) เพราะยังไม่มีระบบ user/auth (merge เข้า user จริงภายหลังได้).
 *   POST { anonId, focus: string[] }  → upsert
 *   GET  ?anonId=...                   → { anonId, focus }
 */

/** ค่าที่รับได้ (ตรงจอ): พัฒนาตนเอง = self_development ที่ enum เดิมไม่มี */
const FOCUS_VALUES = ["love", "work", "wealth", "health", "family", "self_development"] as const;

const PostSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  focus: z.array(z.enum(FOCUS_VALUES)).max(FOCUS_VALUES.length),
});

export async function POST(request: Request) {
  try {
    const { anonId, focus } = PostSchema.parse(await request.json());
    // กันค่าซ้ำ + รักษาลำดับที่เลือก
    const unique = Array.from(new Set(focus));

    const db = createDbClient();
    await db
      .insert(baziUserIntent)
      .values({ anonId, focus: unique })
      .onConflictDoUpdate({
        target: baziUserIntent.anonId,
        set: { focus: unique, updatedAt: sql`now()` },
      });

    return Response.json({ anonId, focus: unique }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid intent payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown intent error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const anonId = new URL(request.url).searchParams.get("anonId")?.trim();
    if (!anonId) {
      return Response.json({ error: "anonId is required." }, { status: 400 });
    }
    const db = createDbClient();
    const rows = await db
      .select()
      .from(baziUserIntent)
      .where(eq(baziUserIntent.anonId, anonId))
      .limit(1);

    return Response.json({ anonId, focus: rows[0]?.focus ?? [] }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown intent error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
