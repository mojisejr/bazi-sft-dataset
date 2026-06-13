import { z } from "zod";

import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { ReadingDoctrineOverrideSchema } from "@/lib/bazi/reading-doctrine-override";
import {
  DOCTRINE_CONFIG_SCOPES,
  ROLE_KEYS,
  STAR_KEYS,
  STEP_KEYS,
  parseDoctrineConfigValue,
} from "@/lib/bazi/doctrine-config";
import {
  createDbDoctrineDraftRepository,
  decodeKnowledgeEntityKey,
} from "@/lib/bazi/doctrine-draft-repository";
import { publishAllDrafts, publishDraft } from "@/lib/bazi/doctrine-publish.service";
import { getCatalogEntry } from "@/lib/bazi/knowledge/knowledge-catalog";
import { BAZI_TOPIC_REGISTRY_BY_ID } from "@/lib/bazi/knowledge/topic-registry";

export const runtime = "nodejs";

const TOPIC_IDS = TOPIC_PATH.map((t) => t.id);
const KEY_BY_SCOPE: Record<string, readonly string[]> = {
  step: STEP_KEYS,
  role: ROLE_KEYS,
  star: STAR_KEYS,
};

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}
function authorized(req: Request): boolean {
  const expected = process.env.ADMIN_DOCTRINE_TOKEN?.trim();
  if (!expected) return true;
  return req.headers.get("x-admin-token")?.trim() === expected;
}

/** ตรวจ value ของร่างตาม surface/entityKey — คืน validated value หรือ null */
function validateDraftValue(surface: string, entityKey: string, value: unknown): Record<string, unknown> | null {
  if (surface === "topic") {
    if (!TOPIC_IDS.includes(entityKey)) return null;
    const parsed = ReadingDoctrineOverrideSchema.safeParse(value);
    return parsed.success ? (parsed.data as Record<string, unknown>) : null;
  }
  if (surface === "config") {
    const [scope, key] = entityKey.split(":");
    if (!key || !(DOCTRINE_CONFIG_SCOPES as readonly string[]).includes(scope)) return null;
    if (!KEY_BY_SCOPE[scope].includes(key)) return null;
    const parsed = parseDoctrineConfigValue(scope as "step" | "role" | "star", value);
    return parsed ? (parsed as Record<string, unknown>) : null;
  }
  if (surface === "knowledge") {
    const decoded = decodeKnowledgeEntityKey(entityKey);
    if (!decoded) return null;
    const text = (value as { text?: unknown }).text;
    if (typeof text !== "string") return null;
    if (decoded.kind === "table") {
      const entry = getCatalogEntry(decoded.group);
      if (!entry || !(decoded.item in entry.defaults)) return null;
      return { text };
    }
    if (decoded.kind === "append") {
      if (!TOPIC_IDS.includes(decoded.group) || !/^\d+$/.test(decoded.item)) return null;
      return { text };
    }
    if (decoded.kind === "logic" || decoded.kind === "sourcefocus") {
      // group = registry topicId (BAZI_TOPIC_IDS); item = ordinal 1..(จำนวน default + 1)
      const def = BAZI_TOPIC_REGISTRY_BY_ID[decoded.group as keyof typeof BAZI_TOPIC_REGISTRY_BY_ID];
      if (!def || !/^\d+$/.test(decoded.item)) return null;
      const ordinal = Number(decoded.item);
      const max =
        (decoded.kind === "logic"
          ? def.sinsaeLogicRules.length
          : def.sourceRefs.length) + 1;
      if (ordinal < 1 || ordinal > max) return null;
      return { text };
    }
    return null;
  }
  return null;
}

/** GET — รายการร่างทั้งหมด (ให้ admin แสดง indicator) */
export async function GET(req: Request) {
  if (!authorized(req)) return badRequest("unauthorized", 401);
  try {
    const drafts = await createDbDoctrineDraftRepository().listRaw();
    return Response.json({ drafts });
  } catch {
    return Response.json({ drafts: [] });
  }
}

const PutSchema = z.object({
  surface: z.enum(["topic", "config", "knowledge"]),
  entityKey: z.string().trim().min(1),
  value: z.record(z.string(), z.unknown()),
  updatedBy: z.string().trim().min(1).max(120).optional(),
});

/** PUT — บันทึกฉบับร่าง (ยังไม่เผยแพร่) */
export async function PUT(req: Request) {
  if (!authorized(req)) return badRequest("unauthorized", 401);
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = PutSchema.safeParse(payload);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload.");
  const { surface, entityKey, value, updatedBy } = parsed.data;
  const valid = validateDraftValue(surface, entityKey, value);
  if (!valid) return badRequest(`ค่าร่างไม่ถูกต้องสำหรับ ${surface}:${entityKey}`);
  try {
    await createDbDoctrineDraftRepository().upsert(surface, entityKey, valid, updatedBy);
    return Response.json({ ok: true });
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "บันทึกร่างไม่สำเร็จ (ตรวจว่าได้รัน migration แล้ว)",
      500,
    );
  }
}

/** DELETE — ทิ้งร่าง ?surface=&key= */
export async function DELETE(req: Request) {
  if (!authorized(req)) return badRequest("unauthorized", 401);
  const url = new URL(req.url);
  const surface = url.searchParams.get("surface")?.trim();
  const key = url.searchParams.get("key")?.trim();
  if ((surface !== "topic" && surface !== "config" && surface !== "knowledge") || !key) {
    return badRequest("ต้องระบุ surface + key");
  }
  try {
    await createDbDoctrineDraftRepository().remove(surface, key);
    return Response.json({ ok: true });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "ทิ้งร่างไม่สำเร็จ", 500);
  }
}

const PublishSchema = z.object({
  all: z.boolean().optional(),
  surface: z.enum(["topic", "config", "knowledge"]).optional(),
  entityKey: z.string().trim().min(1).optional(),
  actor: z.string().trim().min(1).max(120).optional(),
});

/** POST — เผยแพร่ร่าง (ทั้งหมด หรือ รายคีย์) */
export async function POST(req: Request) {
  if (!authorized(req)) return badRequest("unauthorized", 401);
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = PublishSchema.safeParse(payload);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload.");
  const actor = parsed.data.actor ?? "ซินแส (online)";
  try {
    if (parsed.data.all || !parsed.data.surface || !parsed.data.entityKey) {
      const result = await publishAllDrafts(actor);
      if (!result.ok) return badRequest(result.message);
      return Response.json({ ok: true, published: result.published });
    }
    const result = await publishDraft(parsed.data.surface, parsed.data.entityKey, actor);
    if (!result.ok) return badRequest(result.message);
    return Response.json({ ok: true, published: 1 });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "เผยแพร่ไม่สำเร็จ", 500);
  }
}
