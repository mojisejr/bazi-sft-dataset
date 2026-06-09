import { z } from "zod";

import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { ReadingDoctrineOverrideSchema } from "@/lib/bazi/reading-doctrine-override";
import { createDbReadingDoctrineRepository } from "@/lib/bazi/reading-doctrine-repository";
import {
  getMergedReadingDoctrine,
  invalidateReadingDoctrineCache,
} from "@/lib/bazi/reading-doctrine.server";
import { appendDoctrineAuditSafe } from "@/lib/bazi/doctrine-audit-repository";

export const runtime = "nodejs";

const TOPIC_IDS = TOPIC_PATH.map((topic) => topic.id) as [string, ...string[]];

const UpsertSchema = z.object({
  topicId: z.enum(TOPIC_IDS),
  override: ReadingDoctrineOverrideSchema,
  updatedBy: z.string().trim().min(1).max(120).optional(),
});

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

/**
 * Guard แบบ token: ถ้าตั้ง env ADMIN_DOCTRINE_TOKEN จะบังคับให้ส่ง header x-admin-token ตรงกัน
 * ถ้าไม่ได้ตั้ง env (เช่น local dev) จะปล่อยผ่าน (สอดคล้องกับ /api/reading/rules เดิม)
 */
function authorized(req: Request): boolean {
  const expected = process.env.ADMIN_DOCTRINE_TOKEN?.trim();
  if (!expected) {
    return true;
  }
  return req.headers.get("x-admin-token")?.trim() === expected;
}

/** GET — คืนนิยามบท merged (default + override) + รายการ override ดิบ เพื่อให้ UI แสดง default/override */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return badRequest("unauthorized", 401);
  }
  try {
    const repository = createDbReadingDoctrineRepository();
    const [merged, overrides] = await Promise.all([
      getMergedReadingDoctrine({ repository }),
      repository.listOverrides(),
    ]);
    return Response.json({ merged, defaults: TOPIC_PATH, overrides });
  } catch {
    // DB มีปัญหา → ยังคืน default ให้ UI ทำงานได้
    return Response.json({ merged: TOPIC_PATH, defaults: TOPIC_PATH, overrides: {} });
  }
}

/** PUT — upsert override ของบทหนึ่ง แล้วล้าง cache เพื่อให้เห็นผลทันที */
export async function PUT(req: Request) {
  if (!authorized(req)) {
    return badRequest("unauthorized", 401);
  }
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = UpsertSchema.safeParse(payload);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid override.");
  }
  try {
    const repository = createDbReadingDoctrineRepository();
    await repository.upsertOverride(parsed.data.topicId, parsed.data.override, parsed.data.updatedBy);
    invalidateReadingDoctrineCache();
    await appendDoctrineAuditSafe({
      surface: "topic",
      entityKey: parsed.data.topicId,
      action: "upsert",
      value: parsed.data.override,
      actor: parsed.data.updatedBy,
    });
    const merged = await getMergedReadingDoctrine({ repository });
    return Response.json({ ok: true, merged });
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "บันทึก override ไม่สำเร็จ (ตรวจว่าได้รัน migration แล้ว)",
      500,
    );
  }
}

/** DELETE — ลบ override (กลับไปใช้ค่า default ในโค้ดของบทนั้น) */
export async function DELETE(req: Request) {
  if (!authorized(req)) {
    return badRequest("unauthorized", 401);
  }
  const topicId = new URL(req.url).searchParams.get("topicId")?.trim();
  if (!topicId || !TOPIC_IDS.includes(topicId)) {
    return badRequest("ต้องระบุ topicId ที่ถูกต้อง");
  }
  try {
    const repository = createDbReadingDoctrineRepository();
    await repository.deleteOverride(topicId);
    invalidateReadingDoctrineCache();
    await appendDoctrineAuditSafe({ surface: "topic", entityKey: topicId, action: "delete", value: null });
    const merged = await getMergedReadingDoctrine({ repository });
    return Response.json({ ok: true, merged });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "ลบ override ไม่สำเร็จ", 500);
  }
}
