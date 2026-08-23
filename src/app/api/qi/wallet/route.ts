import { and, desc, eq, ne } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziLedgerTxn } from "@/db/schema";
import { getWallet, levelOfXp } from "@/lib/bazi/manifest/ledger";

export const runtime = "nodejs";

/**
 * /api/qi/wallet — ยอดแต้ม Qi + ประวัติธุรกรรม Qi (เฉพาะรายการที่ qi_delta != 0).
 *   GET ?anonId=...&history=20 → { anonId, qi, coins, xp, level, history[] }
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const anonId = url.searchParams.get("anonId")?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });
    const historyLimit = Math.min(100, Math.max(0, Number(url.searchParams.get("history") ?? 20)));

    const wallet = await getWallet(anonId);
    const db = createDbClient();
    const history = historyLimit
      ? await db
          .select({
            id: baziLedgerTxn.id,
            qiDelta: baziLedgerTxn.qiDelta,
            reason: baziLedgerTxn.reason,
            ref: baziLedgerTxn.ref,
            createdAt: baziLedgerTxn.createdAt,
          })
          .from(baziLedgerTxn)
          .where(and(eq(baziLedgerTxn.anonId, anonId), ne(baziLedgerTxn.qiDelta, 0)))
          .orderBy(desc(baziLedgerTxn.createdAt))
          .limit(historyLimit)
      : [];

    return Response.json({ anonId, ...wallet, ...levelOfXp(wallet.xp), history }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown qi wallet error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
