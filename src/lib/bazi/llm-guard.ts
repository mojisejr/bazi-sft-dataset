/**
 * Guard กลางสำหรับ endpoint AI ที่ใช้ "คีย์เซิร์ฟเวอร์" (แบบเดียวกับ /louise-hay):
 * กันยิงรัว (ต่อ IP) + โควตารายวัน + เพดานค่าใช้จ่ายรวมต่อวัน — กันต้นทุนบานปลาย.
 *
 * ผู้ใช้กรอกคีย์ Gemini ของตัวเอง (usedOwnKey=true) → ต้นทุนไม่ตกที่ระบบ จึงไม่บังคับโควตา/เพดาน.
 * คืน Response (พร้อม Retry-After) ถ้าโดนบล็อก, หรือ null ถ้าผ่านให้ทำงานต่อ.
 *
 * server-only.
 */
import { checkRateLimit, clientIp, tryChargeDailyBudget } from "@/lib/rate-limit";

export function guardServerLlm(req: Request, feature: string, usedOwnKey: boolean): Response | null {
  const limited = checkRateLimit(feature, clientIp(req), !usedOwnKey);
  if (limited) {
    return Response.json(
      { error: { message: limited.message } },
      { status: limited.status, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }
  if (!usedOwnKey) {
    const budget = tryChargeDailyBudget();
    if (!budget.ok) {
      return Response.json(
        {
          error: {
            message:
              "ระบบพักรับคำขอ AI ชั่วคราวสำหรับวันนี้ 🌙 พรุ่งนี้ลองใหม่ หรือใส่ Gemini API key ของคุณเองเพื่อใช้ต่อได้",
          },
        },
        { status: 503, headers: { "Retry-After": String(budget.retryAfterSec) } },
      );
    }
  }
  return null;
}
