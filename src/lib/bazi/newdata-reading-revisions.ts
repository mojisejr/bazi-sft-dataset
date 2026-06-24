/**
 * "ประวัติการบันทึก" ของ tab อ่าน 15 บท (NewData) — repository + API handlers + helper
 * สแน็ปช็อต edits (boxes+titles) แบบ insert-only ทุกครั้งที่กด "บันทึกดวงนี้" (ตาราง bazi_newdata_reading_revisions)
 * มิเรอร์ reading-session-revisions.ts ของอ่านดวงหลัก — ต่างกันตรงเก็บ edits ของ NewData
 *
 * NOTE: ห้าม import จาก newdata-reading-repository.ts (กัน circular) — repository เรียก
 * recordNewdataReadingRevision จากที่นี่ฝั่งเดียว
 */
import { desc, eq } from "drizzle-orm";

import { createDbClient, createDbSqlClient } from "@/db/client";
import { baziNewdataReadingRevisions, type NewdataReadingEdits } from "@/db/schema";

/** จำนวน revision สูงสุดที่เก็บต่อ 1 ดวง */
export const MAX_NEWDATA_REVISIONS_PER_READING = 30;

// ── Domain types ───────────────────────────────────────────────────────────────

export type RecordNewdataRevisionInput = {
  readingId: string;
  clientName: string | null;
  birthDate: string;
  birthTime: string;
  gender: string;
  province: string | null;
  edits: NewdataReadingEdits;
};

export type NewdataReadingRevisionListItem = {
  id: string;
  readingId: string;
  clientName: string | null;
  birthDate: string;
  birthTime: string;
  gender: string;
  province: string | null;
  createdAt: string;
};

export type NewdataReadingRevisionDetail = NewdataReadingRevisionListItem & {
  edits: NewdataReadingEdits;
};

// ── Helper: บันทึก + prune (เรียกจาก newdata-reading-repository.save) ─────────────

export async function recordNewdataReadingRevision(
  input: RecordNewdataRevisionInput,
  databaseUrl?: string,
): Promise<void> {
  const db = createDbClient(databaseUrl);
  await db.insert(baziNewdataReadingRevisions).values({
    readingId: input.readingId,
    clientName: input.clientName,
    birthDate: input.birthDate,
    birthTime: input.birthTime,
    gender: input.gender,
    province: input.province,
    edits: input.edits,
  });
  await pruneNewdataReadingRevisions(input.readingId, MAX_NEWDATA_REVISIONS_PER_READING, databaseUrl);
}

export async function pruneNewdataReadingRevisions(
  readingId: string,
  keep: number,
  databaseUrl?: string,
): Promise<void> {
  const sql = createDbSqlClient(databaseUrl);
  await sql`
    delete from bazi_newdata_reading_revisions
    where reading_id = ${readingId}
      and id not in (
        select id from bazi_newdata_reading_revisions
        where reading_id = ${readingId}
        order by created_at desc
        limit ${keep}
      )
  `;
}

// ── Auth (local, ไม่มี login) ────────────────────────────────────────────────────

export type NewdataRevisionAuth = { userId: string | null; isAuthenticated?: boolean };
export type NewdataRevisionAuthenticate = () => Promise<NewdataRevisionAuth>;
const localAuth: NewdataRevisionAuthenticate = async () => ({ userId: "local", isAuthenticated: true });

// ── Repository (read side) ───────────────────────────────────────────────────────

export type NewdataReadingRevisionRepository = {
  listRevisions: () => Promise<NewdataReadingRevisionListItem[]>;
  getRevisionById: (revisionId: string) => Promise<NewdataReadingRevisionDetail | null>;
  deleteRevision: (revisionId: string) => Promise<void>;
};

export function createDbNewdataReadingRevisionRepository(
  databaseUrl?: string,
): NewdataReadingRevisionRepository {
  return {
    async listRevisions() {
      const sql = createDbSqlClient(databaseUrl);
      const records = (await sql`
        select id, reading_id, client_name, birth_date, birth_time, gender, province, created_at
        from bazi_newdata_reading_revisions
        order by created_at desc
      `) as Array<{
        id: string;
        reading_id: string;
        client_name: string | null;
        birth_date: string;
        birth_time: string;
        gender: string;
        province: string | null;
        created_at: string;
      }>;
      return records.map((r) => ({
        id: r.id,
        readingId: r.reading_id,
        clientName: r.client_name,
        birthDate: r.birth_date,
        birthTime: r.birth_time,
        gender: r.gender,
        province: r.province,
        createdAt: r.created_at,
      }));
    },
    async getRevisionById(revisionId) {
      const db = createDbClient(databaseUrl);
      const [record] = await db
        .select()
        .from(baziNewdataReadingRevisions)
        .where(eq(baziNewdataReadingRevisions.id, revisionId))
        .orderBy(desc(baziNewdataReadingRevisions.createdAt))
        .limit(1);
      if (!record) return null;
      return {
        id: record.id,
        readingId: record.readingId,
        clientName: record.clientName,
        birthDate: record.birthDate,
        birthTime: record.birthTime,
        gender: record.gender,
        province: record.province,
        edits: record.edits,
        createdAt: record.createdAt.toISOString(),
      };
    },
    async deleteRevision(revisionId) {
      const db = createDbClient(databaseUrl);
      await db.delete(baziNewdataReadingRevisions).where(eq(baziNewdataReadingRevisions.id, revisionId));
    },
  };
}

// ── Server helper ────────────────────────────────────────────────────────────────

export async function listNewdataReadingRevisions(): Promise<NewdataReadingRevisionListItem[]> {
  return createDbNewdataReadingRevisionRepository().listRevisions();
}

// ── Handler factories ────────────────────────────────────────────────────────────

type RouteContext = { params: Promise<{ revisionId: string }> };
function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function createListNewdataReadingRevisionsHandler(
  options: { repository?: Pick<NewdataReadingRevisionRepository, "listRevisions">; authenticate?: NewdataRevisionAuthenticate } = {},
) {
  return async function GET() {
    try {
      const auth = await (options.authenticate ?? localAuth)();
      if (!(auth.isAuthenticated ?? Boolean(auth.userId)) || !auth.userId) return unauthorized();
      const repo = options.repository ?? createDbNewdataReadingRevisionRepository();
      return Response.json(await repo.listRevisions(), { status: 200 });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "list error" }, { status: 500 });
    }
  };
}

export function createGetNewdataReadingRevisionHandler(
  options: { repository?: Pick<NewdataReadingRevisionRepository, "getRevisionById">; authenticate?: NewdataRevisionAuthenticate } = {},
) {
  return async function GET(_request: Request, context: RouteContext) {
    try {
      const auth = await (options.authenticate ?? localAuth)();
      if (!(auth.isAuthenticated ?? Boolean(auth.userId)) || !auth.userId) return unauthorized();
      const { revisionId } = await context.params;
      const repo = options.repository ?? createDbNewdataReadingRevisionRepository();
      const record = await repo.getRevisionById(revisionId);
      if (!record) return Response.json({ error: `revision ${revisionId} not found` }, { status: 404 });
      return Response.json(record, { status: 200 });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "lookup error" }, { status: 500 });
    }
  };
}

export function createDeleteNewdataReadingRevisionHandler(
  options: { repository?: Pick<NewdataReadingRevisionRepository, "deleteRevision">; authenticate?: NewdataRevisionAuthenticate } = {},
) {
  return async function DELETE(_request: Request, context: RouteContext) {
    try {
      const auth = await (options.authenticate ?? localAuth)();
      if (!(auth.isAuthenticated ?? Boolean(auth.userId)) || !auth.userId) return unauthorized();
      const { revisionId } = await context.params;
      const repo = options.repository ?? createDbNewdataReadingRevisionRepository();
      await repo.deleteRevision(revisionId);
      return new Response(null, { status: 200 });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "delete error" }, { status: 500 });
    }
  };
}
