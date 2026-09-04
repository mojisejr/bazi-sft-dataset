import { and, desc, eq, sql } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziCorrectionRequest, baziQiClaim, baziUserProfile } from "@/db/schema";
import { spendQi, QiError } from "@/lib/bazi/qi/engine";

export const runtime = "nodejs";

/**
 * /api/profile — โปรไฟล์ของผู้ใช้ (edit-personal-info / edit-birth-data ก้อน 3).
 *   GET ?anonId= → { profile: {...} | null, quota: { freeUsed, priceQi, pendingRequest } }
 *   PATCH { anonId, firstName?, lastName?, gender?, birth?, timeUnknown?, birthTime? }
 *     — แก้ชื่อ/เพศ ได้เสมอ (ไม่มีโควตา); แก้ "วันเกิด" ผูกโควตา:
 *       · ยังไม่เคยใช้สิทธิ์ฟรี → ใช้สิทธิ์ฟรี (bazi_qi_claim birth_edit_free ครั้งเดียวตลอดชีพ)
 *       · ใช้แล้ว → หัก 100 ชี่ อัตโนมัติใน PATCH เดียว (spendQi birth_edit — แต้มไม่พอ → 409)
 *     · ไม่ส่ง birth = ไม่แตะโควตา (แก้ชื่ออย่างเดียวก็ได้)
 *
 * 🔴 ทั้งโควตาและการหักชี่เกิด "ที่นี่ที่เดียว" — ไม่ให้ FE ยิง /api/qi/spend เองแล้ว PATCH ตาม
 * เพราะสองคำขอแยกกันไม่เป็น atomic (ยิงสำเร็จแต่ PATCH ล้ม = เสียแต้มเปล่า ต้องพึ่ง refund)
 */

const PostSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  firstName: z.string().trim().max(64).optional(),
  lastName: z.string().trim().max(64).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullish(),
  email: z.string().trim().max(200).nullish(),
  birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "birth ต้องเป็น YYYY-MM-DD").optional(),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/, "birthTime ต้องเป็น HH:mm").nullish(),
  birthProvince: z.string().trim().max(100).nullish(),
  timeUnknown: z.boolean().optional(),
});

const BIRTH_EDIT_SPEND_CODE = "birth_edit";
const BIRTH_EDIT_FREE_CLAIM = "birth_edit_free";

async function freeBirthEditUsed(anonId: string): Promise<boolean> {
  const db = createDbClient();
  const claimed = await db
    .select({ code: baziQiClaim.code })
    .from(baziQiClaim)
    .where(and(eq(baziQiClaim.anonId, anonId), eq(baziQiClaim.code, BIRTH_EDIT_FREE_CLAIM)))
    .limit(1);
  return claimed.length > 0;
}

export async function GET(request: Request) {
  try {
    const anonId = new URL(request.url).searchParams.get("anonId")?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });

    const db = createDbClient();
    const [profile] = await db.select().from(baziUserProfile).where(eq(baziUserProfile.anonId, anonId)).limit(1);
    const [pending] = await db
      .select({ id: baziCorrectionRequest.id, reason: baziCorrectionRequest.reason, createdAt: baziCorrectionRequest.createdAt })
      .from(baziCorrectionRequest)
      .where(and(eq(baziCorrectionRequest.anonId, anonId), eq(baziCorrectionRequest.status, "pending")))
      .orderBy(desc(baziCorrectionRequest.createdAt))
      .limit(1);

    return Response.json(
      {
        anonId,
        profile: profile
          ? {
              displayName: profile.displayName,
              firstName: profile.firstName,
              lastName: profile.lastName,
              gender: profile.gender,
              email: profile.email,
              birthDate: profile.birthDate,
              birthTime: profile.birthTime,
              birthProvince: profile.birthProvince,
              timeUnknown: profile.timeUnknown,
            }
          : null,
        quota: {
          birthEditFreeUsed: await freeBirthEditUsed(anonId),
          birthEditPriceQi: 100,
          pendingCorrection: pending ?? null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown profile error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());
    const db = createDbClient();

    // แถวโปรไฟล์ต้องมีอยู่ก่อน (@name สร้างขึ้นตอนสมัคร); ไม่มี = ยังไม่เคยตั้ง @name → สร้างเงื่อนไข
    // ไม่ได้เพราะ displayName NOT NULL — ตอบ 409 ให้ FE พาไปตั้ง @name ก่อน (หน้าสมัคร)
    const [existing] = await db
      .select({ anonId: baziUserProfile.anonId, birthDate: baziUserProfile.birthDate })
      .from(baziUserProfile)
      .where(eq(baziUserProfile.anonId, body.anonId))
      .limit(1);
    if (!existing) {
      return Response.json({ error: "ยังไม่มีโปรไฟล์ — ตั้ง @name ก่อน (หน้าสมัคร)" }, { status: 409 });
    }

    const birthChanged =
      body.birth !== undefined && (body.birth !== existing.birthDate || body.timeUnknown === true);

    // ── โควตาแก้วันเกิด (เกิดที่เดียว ใน flow เดียว) ────────────────────────────────────────────
    let birthEditMode: "free" | "qi" | null = null;
    if (birthChanged) {
      const freeUsed = await freeBirthEditUsed(body.anonId);
      if (!freeUsed) {
        const claimed = await db
          .insert(baziQiClaim)
          .values({ anonId: body.anonId, code: BIRTH_EDIT_FREE_CLAIM, periodKey: "all" })
          .onConflictDoNothing()
          .returning({ code: baziQiClaim.code });
        if (!claimed.length) {
          // แพ้ race กับคำขออื่นที่ใช้สิทธิ์ฟรีไปแล้ว — ต้องจ่ายชี่
          await spendQi(body.anonId, BIRTH_EDIT_SPEND_CODE);
          birthEditMode = "qi";
        } else {
          birthEditMode = "free";
        }
      } else {
        // หักชี่ใน PATCH เดียว (spendQi: แต้มไม่พอ → QiError 409; grant ไม่มีผลข้างเคลื่อนที่นี่
        // เพราะ birth_edit เป็นสิทธิ์เชิงตรรกะ ไม่ใช่ credit ใน bazi_entitlement)
        await spendQi(body.anonId, BIRTH_EDIT_SPEND_CODE);
        birthEditMode = "qi";
      }
    }

    // ── เขียนโปรไฟล์ ──────────────────────────────────────────────────────────────────────────
    const patch: Record<string, unknown> = { updatedAt: sql`now()` };
    if (body.firstName !== undefined) patch.firstName = body.firstName || null;
    if (body.lastName !== undefined) patch.lastName = body.lastName || null;
    if (body.gender !== undefined) patch.gender = body.gender ?? null;
    if (body.email !== undefined) patch.email = body.email || null;
    // จังหวัดที่เกิด: แก้ได้อิสระ ไม่ผูกโควตาแก้วันเกิด (คนละฟิลด์กับ birth_date)
    if (body.birthProvince !== undefined) patch.birthProvince = body.birthProvince || null;
    if (body.birth !== undefined) {
      patch.birthDate = body.birth;
      patch.timeUnknown = body.timeUnknown ?? false;
      patch.birthTime = body.timeUnknown ? null : (body.birthTime ?? null);
    }
    const [saved] = await db
      .update(baziUserProfile)
      .set(patch)
      .where(eq(baziUserProfile.anonId, body.anonId))
      .returning();

    return Response.json(
      {
        anonId: body.anonId,
        birthEditMode,
        profile: {
          displayName: saved.displayName,
          firstName: saved.firstName,
          lastName: saved.lastName,
          gender: saved.gender,
          birthDate: saved.birthDate,
          birthTime: saved.birthTime,
          timeUnknown: saved.timeUnknown,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid profile payload.", details: error.issues }, { status: 400 });
    }
    if (error instanceof QiError) {
      // แต้มไม่พอ (409) — FE เปิดชีต "ชี่ไม่พอ" ต่อได้เลย
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown profile error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

/** คำขอพิจารณาแก้วันเกิด (เฟรม correction request sheet) — เก็บเหตุผลถึงทีม, idempotent ต่อ pending */
export async function POST(request: Request) {
  try {
    const body = z
      .object({ anonId: z.string().trim().min(1).max(128), reason: z.string().trim().min(1).max(500) })
      .parse(await request.json());
    const db = createDbClient();
    const [pending] = await db
      .select({ id: baziCorrectionRequest.id })
      .from(baziCorrectionRequest)
      .where(and(eq(baziCorrectionRequest.anonId, body.anonId), eq(baziCorrectionRequest.status, "pending")))
      .limit(1);
    if (pending) {
      return Response.json({ error: "มีคำขอรอพิจารณาอยู่แล้ว" }, { status: 409 });
    }
    const [row] = await db
      .insert(baziCorrectionRequest)
      .values({ anonId: body.anonId, reason: body.reason })
      .returning({ id: baziCorrectionRequest.id, createdAt: baziCorrectionRequest.createdAt });
    return Response.json({ ok: true, requestId: row.id, createdAt: row.createdAt }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid correction payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown correction error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
