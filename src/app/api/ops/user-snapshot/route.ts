import { and, desc, eq, ne } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziWallet, baziLedgerTxn, baziUserProfile } from "@/db/schema";

export const runtime = "nodejs";

/**
 * /api/ops/user-snapshot — ข้อมูลฝั่ง engine ของ user คนหนึ่ง สำหรับหน้า /ops ฝั่ง FE.
 * secret-gated ด้วย header x-ops-secret === OPS_ADMIN_SECRET (fail-closed). อ่านอย่างเดียว.
 *   GET ?anonId=<uuid>  →  { qi, ledger:[{qiDelta,reason,ref,createdAt}], profile:{...} }
 */
export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret || request.headers.get("x-ops-secret") !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const anonId = new URL(request.url).searchParams.get("anonId")?.trim();
  if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });

  try {
    const db = createDbClient();
    const [wallet] = await db.select().from(baziWallet).where(eq(baziWallet.anonId, anonId)).limit(1);
    const ledger = await db
      .select({ qiDelta: baziLedgerTxn.qiDelta, reason: baziLedgerTxn.reason, ref: baziLedgerTxn.ref, createdAt: baziLedgerTxn.createdAt })
      .from(baziLedgerTxn)
      .where(and(eq(baziLedgerTxn.anonId, anonId), ne(baziLedgerTxn.qiDelta, 0)))
      .orderBy(desc(baziLedgerTxn.createdAt))
      .limit(50);
    const [profile] = await db
      .select({
        displayName: baziUserProfile.displayName,
        firstName: baziUserProfile.firstName,
        lastName: baziUserProfile.lastName,
        gender: baziUserProfile.gender,
        email: baziUserProfile.email,
        birthDate: baziUserProfile.birthDate,
        birthTime: baziUserProfile.birthTime,
        birthProvince: baziUserProfile.birthProvince,
        timeUnknown: baziUserProfile.timeUnknown,
      })
      .from(baziUserProfile)
      .where(eq(baziUserProfile.anonId, anonId))
      .limit(1);

    return Response.json({ anonId, qi: wallet?.qi ?? 0, ledger, profile: profile ?? null }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown user-snapshot error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
