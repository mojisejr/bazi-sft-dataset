/**
 * Matching (จับคู่/สมพงษ์) admin API — ซินแสแก้/เพิ่ม/ลบ คำทำนายจับคู่ได้ live
 *   GET    → ทุกกลุ่ม (merge กับ catalog: โชว์ครบแม้ DB ยังว่าง) พร้อม items
 *   POST   → upsert 1 item { groupKey, itemKey, value, ordinal? }
 *   DELETE → ลบ 1 item ?groupKey=&itemKey=
 * เขียนตรงตาราง bazi_matching (live) — overlay ทับ reference.json/sising.json ตอน engine อ่าน
 */
import { MATCHING_GROUPS } from "@/lib/bazi/matching-groups";
import { createDbMatchingRepository } from "@/lib/bazi/matching-repository";
import { invalidateMatchingCache } from "@/lib/bazi/matching.server";
import type { MatchingValue } from "@/db/schema";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const expected = process.env.ADMIN_DOCTRINE_TOKEN?.trim();
  if (!expected) return true;
  return req.headers.get("x-admin-token")?.trim() === expected;
}

function actorOf(req: Request): string | undefined {
  return req.headers.get("x-actor")?.trim() || undefined;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: { message: "unauthorized" } }, { status: 401 });
  }

  let rows: Awaited<ReturnType<ReturnType<typeof createDbMatchingRepository>["listRaw"]>> = [];
  let unavailable = false;
  try {
    rows = await createDbMatchingRepository().listRaw();
  } catch {
    unavailable = true; // DB ยังไม่พร้อม — โชว์ catalog เปล่าได้
  }

  const byGroup = new Map<string, typeof rows>();
  for (const row of rows) {
    const bucket = byGroup.get(row.groupKey) ?? [];
    bucket.push(row);
    byGroup.set(row.groupKey, bucket);
  }

  const groups = MATCHING_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    description: g.description,
    keyKind: g.keyKind,
    sourceFile: g.sourceFile,
    items: (byGroup.get(g.key) ?? []).map((row) => ({
      itemKey: row.itemKey,
      ordinal: row.ordinal,
      value: row.value,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    })),
  }));

  return Response.json({ groups, unavailable });
}

type UpsertBody = {
  groupKey?: string;
  itemKey?: string;
  ordinal?: number;
  value?: MatchingValue;
};

export async function POST(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: { message: "unauthorized" } }, { status: 401 });
  }

  let body: UpsertBody;
  try {
    body = (await req.json()) as UpsertBody;
  } catch {
    return Response.json({ error: { message: "invalid json" } }, { status: 400 });
  }

  const groupKey = body.groupKey?.trim();
  const itemKey = body.itemKey?.trim();
  if (!groupKey || !itemKey || !body.value || typeof body.value.text !== "string") {
    return Response.json(
      { error: { message: "groupKey, itemKey, value.text จำเป็น" } },
      { status: 400 },
    );
  }
  if (!MATCHING_GROUPS.some((g) => g.key === groupKey)) {
    return Response.json({ error: { message: `ไม่รู้จักกลุ่ม ${groupKey}` } }, { status: 400 });
  }

  const value: MatchingValue = {
    text: body.value.text,
    ...(body.value.label !== undefined ? { label: body.value.label } : {}),
  };

  try {
    await createDbMatchingRepository().upsert(
      groupKey,
      itemKey,
      value,
      Number.isFinite(body.ordinal) ? Number(body.ordinal) : 0,
      actorOf(req),
    );
  } catch (error) {
    return Response.json(
      { error: { message: (error as Error).message ?? "save failed" } },
      { status: 500 },
    );
  }

  invalidateMatchingCache();
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: { message: "unauthorized" } }, { status: 401 });
  }

  const url = new URL(req.url);
  const groupKey = url.searchParams.get("groupKey")?.trim();
  const itemKey = url.searchParams.get("itemKey")?.trim();
  if (!groupKey || !itemKey) {
    return Response.json({ error: { message: "groupKey, itemKey จำเป็น" } }, { status: 400 });
  }

  try {
    await createDbMatchingRepository().remove(groupKey, itemKey);
  } catch (error) {
    return Response.json(
      { error: { message: (error as Error).message ?? "delete failed" } },
      { status: 500 },
    );
  }

  invalidateMatchingCache();
  return Response.json({ ok: true });
}
