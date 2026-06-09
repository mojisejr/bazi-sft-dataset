import { z } from "zod";

import {
  DOCTRINE_CONFIG_SCOPES,
  ROLE_KEYS,
  ROLE_TEXT_DEFAULTS,
  STAR_KEYS,
  STAR_TEXT_DEFAULTS,
  STEP_KEYS,
  STEP_TEXT_DEFAULTS,
  parseDoctrineConfigValue,
} from "@/lib/bazi/doctrine-config";
import { createDbDoctrineConfigRepository } from "@/lib/bazi/doctrine-config-repository";
import {
  getDoctrineConfigV2,
  invalidateDoctrineConfigCache,
} from "@/lib/bazi/doctrine-config.server";
import { appendDoctrineAuditSafe } from "@/lib/bazi/doctrine-audit-repository";

export const runtime = "nodejs";

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

function authorized(req: Request): boolean {
  const expected = process.env.ADMIN_DOCTRINE_TOKEN?.trim();
  if (!expected) {
    return true;
  }
  return req.headers.get("x-admin-token")?.trim() === expected;
}

const ScopeSchema = z.enum(DOCTRINE_CONFIG_SCOPES);
const KEY_BY_SCOPE: Record<string, readonly string[]> = {
  step: STEP_KEYS,
  role: ROLE_KEYS,
  star: STAR_KEYS,
};

const UpsertSchema = z.object({
  scope: ScopeSchema,
  key: z.string().trim().min(1),
  value: z.record(z.string(), z.unknown()),
  updatedBy: z.string().trim().min(1).max(120).optional(),
});

/** GET — คืน defaults + overrides ของทั้ง 3 scope ให้ UI แสดง default/override */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return badRequest("unauthorized", 401);
  }
  const defaults = {
    step: STEP_TEXT_DEFAULTS,
    role: ROLE_TEXT_DEFAULTS,
    star: STAR_TEXT_DEFAULTS,
  };
  try {
    const overrides = await getDoctrineConfigV2({
      repository: createDbDoctrineConfigRepository(),
    });
    return Response.json({ defaults, overrides });
  } catch {
    return Response.json({ defaults, overrides: { steps: {}, roles: {}, stars: {} } });
  }
}

/** PUT — upsert config ของ (scope,key) */
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
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload.");
  }
  const { scope, key, value, updatedBy } = parsed.data;
  if (!KEY_BY_SCOPE[scope].includes(key)) {
    return badRequest(`key ไม่ถูกต้องสำหรับ scope=${scope}`);
  }
  const validValue = parseDoctrineConfigValue(scope, value);
  if (!validValue) {
    return badRequest(`value ไม่ถูกต้องสำหรับ scope=${scope}`);
  }
  try {
    await createDbDoctrineConfigRepository().upsert(scope, key, validValue, updatedBy);
    invalidateDoctrineConfigCache();
    await appendDoctrineAuditSafe({
      surface: "config",
      entityKey: `${scope}:${key}`,
      action: "upsert",
      value: validValue as Record<string, unknown>,
      actor: updatedBy,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "บันทึกไม่สำเร็จ (ตรวจว่าได้รัน migration แล้ว)",
      500,
    );
  }
}

/** DELETE — ลบ config (กลับไปใช้ default) ?scope=&key= */
export async function DELETE(req: Request) {
  if (!authorized(req)) {
    return badRequest("unauthorized", 401);
  }
  const url = new URL(req.url);
  const scopeRaw = url.searchParams.get("scope")?.trim() ?? "";
  const key = url.searchParams.get("key")?.trim() ?? "";
  const scope = ScopeSchema.safeParse(scopeRaw);
  if (!scope.success || !key || !KEY_BY_SCOPE[scope.data].includes(key)) {
    return badRequest("ต้องระบุ scope + key ที่ถูกต้อง");
  }
  try {
    await createDbDoctrineConfigRepository().remove(scope.data, key);
    invalidateDoctrineConfigCache();
    await appendDoctrineAuditSafe({
      surface: "config",
      entityKey: `${scope.data}:${key}`,
      action: "delete",
      value: null,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "ลบไม่สำเร็จ", 500);
  }
}
