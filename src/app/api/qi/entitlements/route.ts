import { getWallet } from "@/lib/bazi/manifest/ledger";
import { getEntitlementSummary } from "@/lib/bazi/qi/entitlements";
import { freeLimitOf } from "@/lib/bazi/qi/quota";

export const runtime = "nodejs";

/**
 * /api/qi/entitlements — สรุปสิทธิ์ปัจจุบันของ user (credit คงเหลือ / สินค้าที่เป็นเจ้าของ / tier).
 *   GET ?anonId=... → { anonId, qi, tier, credits, owned[], freeLimit }
 */
export async function GET(request: Request) {
  try {
    const anonId = new URL(request.url).searchParams.get("anonId")?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });

    const [summary, wallet] = await Promise.all([getEntitlementSummary(anonId), getWallet(anonId)]);

    return Response.json(
      {
        anonId,
        qi: wallet.qi,
        tier: summary.tier,
        credits: summary.credits,
        owned: summary.owned,
        // โควตาฟรีต่อวันตาม tier (ให้ frontend โชว์ว่าเหลือเท่าไร)
        freeLimit: { card: freeLimitOf("card", summary.tier), chat: freeLimitOf("chat", summary.tier) },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown qi entitlements error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
