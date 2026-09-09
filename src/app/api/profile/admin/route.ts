import { eq, sql } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziUserProfile } from "@/db/schema";

export const runtime = "nodejs";

/**
 * /api/profile/admin — แอดมิน (/ops) แก้ข้อมูลวันเกิด/โปรไฟล์ของผู้ใช้ "โดยไม่หัก QI" (ต่างจาก
 * /api/profile PATCH ปกติที่คิดค่าแก้วันเกิด). secret-gated ด้วย OPS_ADMIN_SECRET (fail-closed).
 *   PATCH { secret, anonId, birth?(YYYY-MM-DD), birthTime?(HH:mm|null), timeUnknown?, gender?, birthProvince?, firstName?, lastName? }
 * UPDATE-only: ถ้ายังไม่มีแถว bazi_user_profile (ยังไม่เคยตั้ง @name) จะไม่สร้าง — ฝั่ง FE จะ sync legacy
 * `user` ให้ destiny/chat อ่านถูกอยู่แล้ว (mergeEngineBirth). คืน updated:true/false
 */
const PatchSchema = z.object({
  secret: z.string().trim().min(1),
  anonId: z.string().trim().min(1).max(128),
  birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "birth ต้องเป็น YYYY-MM-DD").optional(),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/, "birthTime ต้องเป็น HH:mm").nullish(),
  timeUnknown: z.boolean().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullish(),
  birthProvince: z.string().trim().max(100).nullish(),
  firstName: z.string().trim().max(64).optional(),
  lastName: z.string().trim().max(64).optional(),
});

export async function PATCH(request: Request) {
  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid admin profile payload.", details: error.issues }, { status: 400 });
    }
    return Response.json({ error: "Invalid admin profile payload." }, { status: 400 });
  }

  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret || body.secret !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const patch: Record<string, unknown> = { updatedAt: sql`now()` };
    if (body.firstName !== undefined) patch.firstName = body.firstName || null;
    if (body.lastName !== undefined) patch.lastName = body.lastName || null;
    if (body.gender !== undefined) patch.gender = body.gender ?? null;
    if (body.birthProvince !== undefined) patch.birthProvince = body.birthProvince || null;
    if (body.birth !== undefined) {
      patch.birthDate = body.birth;
      patch.timeUnknown = body.timeUnknown ?? false;
      patch.birthTime = body.timeUnknown ? null : (body.birthTime ?? null);
    }

    const db = createDbClient();
    const saved = await db
      .update(baziUserProfile)
      .set(patch)
      .where(eq(baziUserProfile.anonId, body.anonId))
      .returning({ anonId: baziUserProfile.anonId, birthDate: baziUserProfile.birthDate, birthTime: baziUserProfile.birthTime, timeUnknown: baziUserProfile.timeUnknown });

    return Response.json({ anonId: body.anonId, updated: saved.length > 0, profile: saved[0] ?? null }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown admin profile error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
