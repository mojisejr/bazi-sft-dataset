// /api/ops/user-delete — แอดมิน (/ops หลังบ้าน engine) ลบบัญชีออกจาก data จริง (ให้ผู้ใช้ต้องสมัครใหม่).
// secret-gated ด้วย OPS_ADMIN_SECRET (fail-closed) เหมือน endpoint /ops อื่น ๆ.
//   POST { secret, anonId } → ลบ user_provider(mapping LINE)+subscription+entitlement+ledger+wallet+
//                             profile+"user". คืน { ok, anonId, deleted:{table:n}, errors:[] }
// ⚠️ ลบถาวร กู้คืนไม่ได้ — ใช้กับบัญชีเทสต์เท่านั้น.
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { deleteAccountEverywhere } from "@/lib/bazi/ops/delete-account";

export const runtime = "nodejs";

const Schema = z.object({
  secret: z.string().trim().min(1),
  anonId: z.string().trim().min(1).max(128),
});

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(raw);
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret || body.secret !== secret) return Response.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const db = createDbClient();
    const result = await deleteAccountEverywhere(db, body.anonId);
    return Response.json({ ok: true, anonId: body.anonId, ...result }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "delete failed" }, { status: 500 });
  }
}
