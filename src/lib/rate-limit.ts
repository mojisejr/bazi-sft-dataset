/**
 * Rate limiter แบบ in-memory (fixed window) — กันยิง endpoint รัว ๆ + บังคับโควตารายวัน.
 * เหมาะ single server / dev. บน serverless หลาย instance ควรสลับไป Redis (Upstash) เพราะ
 * แต่ละ instance นับแยกกัน. เก็บ counter ตาม key (เช่น "chat:min:<ip>") พร้อม auto-sweep กันบวม.
 *
 * ปรับลิมิตผ่าน env:
 *   LH_RATE_PER_MIN  (ดีฟอลต์ 15) — ยิงได้กี่ครั้ง/นาที ต่อ IP (กัน burst)
 *   LH_DAILY_LIMIT   (ดีฟอลต์ 30) — โควตาต่อวัน ต่อ IP (เฉพาะที่ใช้คีย์เซิร์ฟเวอร์ = free tier)
 * server-only.
 */

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();
let ops = 0;

function sweep(now: number): void {
  if (++ops % 1000 !== 0) return;
  for (const [k, b] of store) {
    if (b.resetAt <= now) store.delete(k);
  }
}

export type RateResult = { ok: boolean; remaining: number; retryAfterSec: number; limit: number };

/** เพิ่มตัวนับของ key แล้วบอกว่ายังอยู่ในลิมิตไหม (fixed window ยาว windowMs) */
export function hit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);
  let b = store.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    store.set(key, b);
  }
  b.count += 1;
  const ok = b.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - b.count),
    retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    limit,
  };
}

export const PER_MIN_LIMIT = Number(process.env.LH_RATE_PER_MIN) || 15;
export const DAILY_LIMIT = Number(process.env.LH_DAILY_LIMIT) || 30;

// ── เพดานค่าใช้จ่ายรวมต่อวัน (กันกรณีเลวร้ายสุด) — เฉพาะที่ใช้คีย์เซิร์ฟเวอร์ ──
export const DAILY_BUDGET_THB = Number(process.env.LH_DAILY_BUDGET_THB) || 100;
const CHARGE_ESTIMATE_THB = 0.03; // pre-charge ตอนเริ่ม request (คืนส่วนต่างตอนรู้ต้นทุนจริง) กัน burst race
let spend = { date: "", thb: 0 };

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}
function secToNextUtcMidnight(now: number): number {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now) / 1000));
}

/**
 * จอง budget 1 request (pre-charge ประมาณการ) — ถ้าวันนี้ใช้ครบเพดานแล้วคืน ok=false.
 * เรียกเฉพาะ request ที่ใช้คีย์เซิร์ฟเวอร์.
 */
export function tryChargeDailyBudget(): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const day = utcDay(now);
  if (spend.date !== day) spend = { date: day, thb: 0 };
  if (spend.thb >= DAILY_BUDGET_THB) {
    return { ok: false, retryAfterSec: secToNextUtcMidnight(now) };
  }
  spend.thb += CHARGE_ESTIMATE_THB;
  return { ok: true, retryAfterSec: 0 };
}

/** แทนที่ค่าประมาณด้วยต้นทุนจริงหลัง request จบ (บวกส่วนต่าง) */
export function reconcileDailyBudget(actualThb: number): void {
  if (spend.date === utcDay(Date.now())) {
    spend.thb += actualThb - CHARGE_ESTIMATE_THB;
  }
}

/** ดึง IP ผู้เรียกจาก proxy headers (Vercel/Cloudflare ตั้ง x-forwarded-for) */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * ตรวจทั้ง burst (ต่อนาที) + โควตารายวัน สำหรับฟีเจอร์หนึ่ง.
 * daily ใช้เฉพาะเมื่อ enforceDaily=true (คีย์เซิร์ฟเวอร์ = free tier; คีย์ผู้ใช้เองไม่จำกัด).
 * คืน null ถ้าผ่าน, หรือ { status, message, retryAfterSec } ถ้าโดนบล็อก.
 */
export function checkRateLimit(
  feature: string,
  ip: string,
  enforceDaily: boolean,
): { status: number; message: string; retryAfterSec: number } | null {
  const perMin = hit(`${feature}:min:${ip}`, PER_MIN_LIMIT, 60_000);
  if (!perMin.ok) {
    return {
      status: 429,
      message: "ช้าลงหน่อยนะคะ 🌸 คุณส่งข้อความถี่ไปนิด ลองอีกครั้งในอีกสักครู่",
      retryAfterSec: perMin.retryAfterSec,
    };
  }
  if (enforceDaily) {
    const perDay = hit(`${feature}:day:${ip}`, DAILY_LIMIT, 86_400_000);
    if (!perDay.ok) {
      return {
        status: 429,
        message: `วันนี้ใช้ครบโควตาฟรีแล้ว (${DAILY_LIMIT} ครั้ง/วัน) 🌷 พรุ่งนี้กลับมาคุยกันใหม่ หรือใส่ Gemini API key ของคุณเองเพื่อคุยต่อได้ไม่จำกัด`,
        retryAfterSec: perDay.retryAfterSec,
      };
    }
  }
  return null;
}
