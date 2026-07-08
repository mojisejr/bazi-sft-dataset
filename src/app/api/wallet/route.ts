import { desc, eq } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziLedgerTxn } from "@/db/schema";
import { applyLedger, getWallet, levelOfXp } from "@/lib/bazi/manifest/ledger";

export const runtime = "nodejs";

/**
 * /api/wallet — ยอดเหรียญ/XP/Level + ประวัติธุรกรรม (จอ Karma Dashboard / Achievement).
 *   GET  ?anonId=...&history=20 → { coins, xp, level, nextLevelXp, history[] }
 *   POST { anonId, coinDelta?, xpDelta?, reason, ref? } → earn/spend (ยอดไม่พอ → 409)
 */

const PostSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  coinDelta: z.number().int().min(-100000).max(100000).default(0),
  xpDelta: z.number().int().min(-100000).max(100000).default(0),
  reason: z.string().trim().min(1).max(200),
  ref: z.string().trim().max(200).optional(),
});

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
          .select()
          .from(baziLedgerTxn)
          .where(eq(baziLedgerTxn.anonId, anonId))
          .orderBy(desc(baziLedgerTxn.createdAt))
          .limit(historyLimit)
      : [];

    return Response.json({ anonId, ...wallet, ...levelOfXp(wallet.xp), history }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown wallet error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());
    if (body.coinDelta === 0 && body.xpDelta === 0) {
      return Response.json({ error: "coinDelta หรือ xpDelta ต้องไม่เป็น 0 ทั้งคู่" }, { status: 400 });
    }

    const balance = await applyLedger(body);
    if (!balance) {
      return Response.json({ error: "ยอดไม่พอ (insufficient balance)" }, { status: 409 });
    }

    return Response.json({ anonId: body.anonId, ...balance, ...levelOfXp(balance.xp) }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid wallet payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown wallet error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
