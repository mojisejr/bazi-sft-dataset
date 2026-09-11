import { and, eq, sql } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziEntitlement } from "@/db/schema";

export const runtime = "nodejs";

/**
 * /api/ops/entitlement — แอดมิน (/ops หลังบ้าน engine) จัดการ "แพ็กเกจ/สิทธิ์" ของผู้ใช้โดยตรง.
 * secret-gated ด้วย OPS_ADMIN_SECRET (fail-closed) เหมือน endpoint /ops อื่น ๆ.
 *   GET    ?secret=&anonId=            → { entitlements: [{ kind, sku, credits, expiresAt, updatedAt }] }
 *   POST   { secret, anonId, kind, sku?, credits?, expiresAt? }  → upsert (ทับแถว kind+sku เดิม)
 *              kind: card_use|chat_question|matching_slot|course|book|tier · sku: destiny|lifecode|plus|''
 *              tier มักใช้ expiresAt (null = ไม่หมดอายุ); credit-based ใช้ credits
 *   DELETE { secret, anonId, kind, sku? }                        → ถอนสิทธิ์แถวนั้น
 * เขียน DB ตรง (ตาราง bazi_entitlement) — unique(anonId,kind,sku) ทำให้ upsert ปลอดภัย.
 */
const KIND = z.enum(["card_use", "chat_question", "matching_slot", "course", "book", "tier", "unlimited"]);

const PostSchema = z.object({
  secret: z.string().trim().min(1),
  anonId: z.string().trim().min(1).max(128),
  kind: KIND,
  sku: z.string().trim().max(64).optional().default(""),
  credits: z.number().int().min(0).max(1_000_000).optional(),
  // ISO datetime หรือ null (ไม่หมดอายุ); ไม่ส่ง = ไม่แตะ expiresAt เดิมตอน upsert
  expiresAt: z.string().datetime().nullish(),
});

const DeleteSchema = z.object({
  secret: z.string().trim().min(1),
  anonId: z.string().trim().min(1).max(128),
  kind: KIND,
  sku: z.string().trim().max(64).optional().default(""),
});

function ensureSecret(bodySecret: string): Response | null {
  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret || bodySecret !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  return null;
}

export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  const url = new URL(request.url);
  if (!secret || url.searchParams.get("secret") !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const anonId = url.searchParams.get("anonId")?.trim();
  if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });
  try {
    const db = createDbClient();
    const rows = await db
      .select({
        kind: baziEntitlement.kind,
        sku: baziEntitlement.sku,
        credits: baziEntitlement.credits,
        expiresAt: baziEntitlement.expiresAt,
        updatedAt: baziEntitlement.updatedAt,
      })
      .from(baziEntitlement)
      .where(eq(baziEntitlement.anonId, anonId));
    return Response.json({ anonId, entitlements: rows }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown entitlement error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: z.infer<typeof PostSchema>;
  try {
    body = PostSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid entitlement payload.", details: error.issues }, { status: 400 });
    }
    return Response.json({ error: "Invalid entitlement payload." }, { status: 400 });
  }
  const denied = ensureSecret(body.secret);
  if (denied) return denied;

  try {
    const db = createDbClient();
    const expiresAt = body.expiresAt === undefined ? undefined : body.expiresAt ? new Date(body.expiresAt) : null;
    const insertRow = {
      anonId: body.anonId,
      kind: body.kind,
      sku: body.sku ?? "",
      credits: body.credits ?? 0,
      expiresAt: expiresAt ?? null,
    };
    // upsert บน unique(anon_id,kind,sku) — แก้เฉพาะ field ที่ส่งมา (credits/expiresAt ถ้าไม่ส่งไม่ทับ)
    const setOnConflict: Record<string, unknown> = { updatedAt: sql`now()` };
    if (body.credits !== undefined) setOnConflict.credits = body.credits;
    if (body.expiresAt !== undefined) setOnConflict.expiresAt = expiresAt ?? null;

    const saved = await db
      .insert(baziEntitlement)
      .values(insertRow)
      .onConflictDoUpdate({
        target: [baziEntitlement.anonId, baziEntitlement.kind, baziEntitlement.sku],
        set: setOnConflict,
      })
      .returning({
        kind: baziEntitlement.kind,
        sku: baziEntitlement.sku,
        credits: baziEntitlement.credits,
        expiresAt: baziEntitlement.expiresAt,
        updatedAt: baziEntitlement.updatedAt,
      });

    return Response.json({ anonId: body.anonId, entitlement: saved[0] ?? null }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown entitlement error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let body: z.infer<typeof DeleteSchema>;
  try {
    body = DeleteSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid entitlement payload.", details: error.issues }, { status: 400 });
    }
    return Response.json({ error: "Invalid entitlement payload." }, { status: 400 });
  }
  const denied = ensureSecret(body.secret);
  if (denied) return denied;

  try {
    const db = createDbClient();
    const removed = await db
      .delete(baziEntitlement)
      .where(
        and(
          eq(baziEntitlement.anonId, body.anonId),
          eq(baziEntitlement.kind, body.kind),
          eq(baziEntitlement.sku, body.sku ?? ""),
        ),
      )
      .returning({ kind: baziEntitlement.kind, sku: baziEntitlement.sku });
    return Response.json({ anonId: body.anonId, removed: removed.length > 0 }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown entitlement error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
