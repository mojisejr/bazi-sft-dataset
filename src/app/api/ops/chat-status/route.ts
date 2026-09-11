import { getEntitlementSummary } from "@/lib/bazi/qi/entitlements";
import { getUnlimitedFeatures } from "@/lib/bazi/qi/entitlements";
import { usageToday, freeLimitOf, isUnlimited } from "@/lib/bazi/qi/quota";

export const runtime = "nodejs";

/**
 * /api/ops/chat-status — สรุปสิทธิ์ "แชท" (และไพ่/ดูดวงคู่) ของผู้ใช้ สำหรับหน้า admin.
 * secret-gated (x-ops-secret === OPS_ADMIN_SECRET). อ่านอย่างเดียว.
 * ตรรกะการใช้แชท (จาก lib/bazi/qi/quota.ts): ฟรีรายวันตาม tier → เครดิต chat_question → หัก QI
 *   free=1/วัน · plus=5/วัน · pro=100/วัน ; plus/pro = ไม่จำกัด (unlimited)
 *   GET ?anonId= → { tier, chat:{unlimited,freeLimit,usedToday,freeRemaining,credits},
 *                    card:{freeLimit,usedToday,freeRemaining,credits}, matchingCredits }
 */
export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret || request.headers.get("x-ops-secret") !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const anonId = new URL(request.url).searchParams.get("anonId")?.trim();
  if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });

  try {
    const [summary, used, unlimitedList] = await Promise.all([
      getEntitlementSummary(anonId),
      usageToday(anonId),
      getUnlimitedFeatures(anonId),
    ]);
    const tier = summary.tier;
    // map โค้ดฟีเจอร์ → ถูกตั้งไม่จำกัดหรือไม่ (แอดมิน override) — ครอบทั้งการ์ด/แชท/ดูเบอร์/แก้วันเกิด/ดูดวงคู่
    const unlimited: Record<string, boolean> = {};
    for (const code of unlimitedList) unlimited[code] = true;
    const chatUnlimited = isUnlimited("chat", tier) || !!unlimited.chat_question;
    const cardUnlimited = !!unlimited.card_use;
    const chatFree = freeLimitOf("chat", tier);
    const cardFree = freeLimitOf("card", tier);
    return Response.json(
      {
        anonId,
        tier,
        unlimited, // { card_use?, chat_question?, phone_reading?, birth_edit?, honeycomb_reading?, matching_slot? }
        chat: {
          unlimited: chatUnlimited,
          freeLimit: chatFree,
          usedToday: used.chat,
          freeRemaining: chatUnlimited ? -1 : Math.max(0, chatFree - used.chat),
          credits: summary.credits.chat_question,
        },
        card: {
          unlimited: cardUnlimited,
          freeLimit: cardFree,
          usedToday: used.card,
          freeRemaining: cardUnlimited ? -1 : Math.max(0, cardFree - used.card),
          credits: summary.credits.card_use,
        },
        matchingCredits: summary.credits.matching_slot,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown chat-status error.";
    // local dev (ตารางไม่ครบ) → คืน available:false ไม่ให้จอพัง
    return Response.json({ anonId, available: false, note: message }, { status: 200 });
  }
}
