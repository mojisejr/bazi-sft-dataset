/**
 * ตั้ง/ดู/ยกเลิก "การเตือนวันโชค/วันควรระวัง" — เรียกจาก LIFF (ในแอป LINE).
 * ยืนยันตัวตนด้วย LIFF id_token ผ่าน `Authorization: Bearer <idToken>` แล้ว verify กับ LINE เพื่อได้ userId จริง.
 *
 *   POST   /api/alerts   { targetDate, kind, message, birthKey? }  → สร้างการเตือน
 *   GET    /api/alerts                                             → รายการที่ยัง pending ของผู้ใช้
 *   DELETE /api/alerts?id=<id>                                     → ยกเลิกการเตือน
 */
import { z } from "zod";

import { cancelAlert, createAlert, listUserAlerts, todayBangkok } from "@/lib/bazi/alerts/repository";
import { verifyLiffIdToken } from "@/lib/bazi/alerts/verify-line";

export const runtime = "nodejs";

const BodySchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "targetDate ต้องเป็น YYYY-MM-DD"),
  kind: z.enum(["luck", "caution", "custom"]),
  message: z.string().trim().min(1).max(1000),
  birthKey: z.string().trim().max(200).optional(),
});

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** verify Bearer id_token → LINE userId (หรือ Response 401 ถ้าไม่ผ่าน) */
async function requireUser(req: Request): Promise<string | Response> {
  const token = bearer(req);
  if (!token) return Response.json({ error: { message: "ต้องแนบ Authorization: Bearer <LIFF id_token>" } }, { status: 401 });
  const userId = await verifyLiffIdToken(token);
  if (!userId) return Response.json({ error: { message: "id_token ไม่ถูกต้องหรือหมดอายุ" } }, { status: 401 });
  return userId;
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (user instanceof Response) return user;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: { message: "body ต้องเป็น JSON" } }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: { message: parsed.error.issues[0]?.message ?? "payload ไม่ถูกต้อง" } }, { status: 400 });
  }
  // กันตั้งเตือนวันที่ผ่านมาแล้ว
  if (parsed.data.targetDate < todayBangkok()) {
    return Response.json({ error: { message: "ตั้งเตือนวันที่ผ่านมาแล้วไม่ได้นะคะ" } }, { status: 400 });
  }

  const alert = await createAlert({
    lineUserId: user,
    targetDate: parsed.data.targetDate,
    kind: parsed.data.kind,
    message: parsed.data.message,
    birthKey: parsed.data.birthKey ?? null,
  });
  if (!alert) return Response.json({ error: { message: "บันทึกการเตือนไม่สำเร็จ" } }, { status: 500 });
  return Response.json({ ok: true, alert });
}

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof Response) return user;
  const alerts = await listUserAlerts(user);
  return Response.json({ ok: true, alerts });
}

export async function DELETE(req: Request) {
  const user = await requireUser(req);
  if (user instanceof Response) return user;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: { message: "ต้องระบุ id" } }, { status: 400 });
  const ok = await cancelAlert(id, user);
  if (!ok) return Response.json({ error: { message: "ไม่พบการเตือนนี้ของคุณ" } }, { status: 404 });
  return Response.json({ ok: true });
}
