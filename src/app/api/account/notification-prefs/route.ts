import { eq } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziNotificationPrefs } from "@/db/schema";

export const runtime = "nodejs";

/**
 * /api/account/notification-prefs — ตั้งค่าการแจ้งเตือน (เฟรม settings-notifications).
 *   GET ?anonId= → { dailyFortune, reminders, updates } (ยังไม่เคยตั้ง = ค่าเริ่มต้น)
 *   PUT  { anonId, dailyFortune?, reminders?, updates? } → upsert
 * (การสมัครรับ push ของเบราว์เซอร์/PWA ยังอยู่ฝั่ง FE — ตารางนี้เก็บ "ต้องการรับหมวดไหน")
 */

const PutSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  dailyFortune: z.boolean().optional(),
  reminders: z.boolean().optional(),
  updates: z.boolean().optional(),
});

async function getPrefs(anonId: string) {
  const db = createDbClient();
  const [row] = await db
    .select({ dailyFortune: baziNotificationPrefs.dailyFortune, reminders: baziNotificationPrefs.reminders, updates: baziNotificationPrefs.updates })
    .from(baziNotificationPrefs)
    .where(eq(baziNotificationPrefs.anonId, anonId))
    .limit(1);
  return row ?? { dailyFortune: true, reminders: true, updates: false };
}

export async function GET(request: Request) {
  try {
    const anonId = new URL(request.url).searchParams.get("anonId")?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });
    return Response.json({ anonId, ...(await getPrefs(anonId)) }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown prefs error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = PutSchema.parse(await request.json());
    const db = createDbClient();
    const [row] = await db
      .insert(baziNotificationPrefs)
      .values({ anonId: body.anonId, dailyFortune: body.dailyFortune ?? true, reminders: body.reminders ?? true, updates: body.updates ?? false })
      .onConflictDoUpdate({
        target: baziNotificationPrefs.anonId,
        set: {
          ...(body.dailyFortune !== undefined ? { dailyFortune: body.dailyFortune } : {}),
          ...(body.reminders !== undefined ? { reminders: body.reminders } : {}),
          ...(body.updates !== undefined ? { updates: body.updates } : {}),
          updatedAt: new Date(),
        },
      })
      .returning({ dailyFortune: baziNotificationPrefs.dailyFortune, reminders: baziNotificationPrefs.reminders, updates: baziNotificationPrefs.updates });
    return Response.json({ anonId: body.anonId, ...row }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid prefs payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown prefs error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
