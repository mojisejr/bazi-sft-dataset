import { timingSafeEqual } from "node:crypto";

/**
 * Admin guard ของ route หลังบ้าน (header x-admin-token = ADMIN_DOCTRINE_TOKEN) — ที่เดียวทั้งรีโป
 *
 * fail closed: ไม่ตั้ง ADMIN_DOCTRINE_TOKEN = ไม่อนุญาต (เดิม "ไม่ตั้ง = เปิดให้ทุกคน" ทำให้ production
 * เปิด admin route ~12 ตัวสู่อินเทอร์เน็ตจนตั้ง token 2026-09-27 · และ staging บน DO เจอแบบเดียวกัน)
 * ยกเว้นเดียว: `next dev` บนเครื่อง dev (NODE_ENV=development) ที่ไม่ได้ตั้ง token = อนุญาตเหมือนเดิม
 * — ทั้ง Vercel และ container รันด้วย NODE_ENV=production จึงไม่เข้าข้อยกเว้นนี้
 * (mumate-vercel-to-do-001 slice 2)
 */
export function isAdminAuthorized(
  req: Request,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): boolean {
  const expected = env.ADMIN_DOCTRINE_TOKEN?.trim();
  if (!expected) return env.NODE_ENV === "development";
  const given = req.headers.get("x-admin-token")?.trim() ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
