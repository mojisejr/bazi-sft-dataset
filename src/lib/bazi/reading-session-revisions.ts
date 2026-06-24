/**
 * ประวัติการบันทึก (reading session revision) — repository + API handlers + helper
 * สแน็ปช็อตแบบ insert-only ของ session ทุกครั้งที่กด "บันทึกการดูดวง" (ตาราง bazi_reading_session_revisions)
 * ต่างจาก reading-pdf-versions.ts ตรงที่ revision ถูกสร้าง "อัตโนมัติ" จากใน reading-sessions.saveSession
 * (ผู้ใช้ไม่ต้องกดบันทึกเวอร์ชัน PDF) → ย้อนเปิดดู/กู้คืนสภาพงานแต่ละครั้งที่บันทึกได้
 *
 * NOTE: โมดูลนี้ "ห้าม" import จาก reading-sessions.ts (กัน circular) — reading-sessions เรียก
 * recordSessionRevision/pruneSessionRevisions จากที่นี่ฝั่งเดียว
 */
import { desc, eq } from "drizzle-orm";

import { createDbClient, createDbSqlClient } from "@/db/client";
import { baziReadingSessionRevisions } from "@/db/schema";
import {
  type CalculatedStateValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import {
  type ReadingSessionDataValue,
  type ReadingSessionStatus,
} from "@/lib/bazi/reading-session-types";

/** จำนวน revision สูงสุดที่เก็บต่อ 1 ดวง — เกินกว่านี้ลบอันเก่าสุดทิ้งตอนบันทึกครั้งถัดไป */
export const MAX_REVISIONS_PER_SESSION = 30;

// ── Domain types ───────────────────────────────────────────────────────────────

/** สิ่งที่ใช้สร้าง revision หนึ่งแถว (มาจาก values ของ saveSession) */
export type RecordSessionRevisionInput = {
  sessionId: string;
  label: string | null;
  birthDate: string;
  birthTime: string;
  gender: string;
  dayMaster: string | null;
  provider: string;
  status: ReadingSessionStatus;
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue | null;
  sessionData: ReadingSessionDataValue;
  ownerId: string;
};

export type ReadingSessionRevisionListItem = {
  id: string;
  sessionId: string;
  label: string | null;
  birthDate: string;
  birthTime: string;
  gender: string;
  dayMaster: string | null;
  provider: string;
  status: ReadingSessionStatus;
  createdAt: string;
};

/** detail มิเรอร์รูป ReadingPdfVersionDetail (versionNote=null เสมอ) เพื่อให้หน้า reading ใช้ load path เดียวกับเวอร์ชัน PDF */
export type ReadingSessionRevisionDetail = ReadingSessionRevisionListItem & {
  versionNote: null;
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue | null;
  sessionData: ReadingSessionDataValue;
  ownerId: string | null;
};

type ReadingSessionRevisionListRow = {
  id: string;
  session_id: string;
  label: string | null;
  birth_date: string;
  birth_time: string;
  gender: string;
  day_master: string | null;
  provider: string;
  status: ReadingSessionStatus;
  created_at: string;
};

// ── Helper: บันทึก + prune (เรียกจาก reading-sessions.saveSession) ────────────────

/**
 * แทรก revision หนึ่งแถวสำหรับสภาพงานที่เพิ่งบันทึก แล้ว prune ให้เหลือ MAX ล่าสุดต่อดวง
 * best-effort: ถ้าล้มเหลวไม่ควรทำให้การบันทึก session หลักพัง (caller กลืน error เอง)
 */
export async function recordSessionRevision(
  input: RecordSessionRevisionInput,
  databaseUrl?: string,
): Promise<void> {
  const db = createDbClient(databaseUrl);
  await db.insert(baziReadingSessionRevisions).values({
    sessionId: input.sessionId,
    label: input.label,
    birthDate: input.birthDate,
    birthTime: input.birthTime,
    gender: input.gender,
    dayMaster: input.dayMaster,
    provider: input.provider,
    status: input.status,
    rawInput: input.rawInput,
    calculatedState: input.calculatedState,
    sessionData: input.sessionData,
    ownerId: input.ownerId,
  });

  await pruneSessionRevisions(input.sessionId, MAX_REVISIONS_PER_SESSION, databaseUrl);
}

/** ลบ revision เก่าสุดของดวงให้เหลือ keep อันล่าสุด */
export async function pruneSessionRevisions(
  sessionId: string,
  keep: number,
  databaseUrl?: string,
): Promise<void> {
  const sql = createDbSqlClient(databaseUrl);
  await sql`
    delete from bazi_reading_session_revisions
    where session_id = ${sessionId}
      and id not in (
        select id from bazi_reading_session_revisions
        where session_id = ${sessionId}
        order by created_at desc
        limit ${keep}
      )
  `;
}

// ── Auth (ใช้ร่วมกันทั้งระบบ — ไม่มี login, default เป็น "local") ─────────────────

export type ReadingSessionRevisionAuth = {
  userId: string | null;
  isAuthenticated?: boolean;
};

export type ReadingSessionRevisionAuthenticate = () => Promise<ReadingSessionRevisionAuth>;

const LOCAL_USER_ID = "local";
const localAuth: ReadingSessionRevisionAuthenticate = async () => ({
  userId: LOCAL_USER_ID,
  isAuthenticated: true,
});

// ── Repository (read side) ───────────────────────────────────────────────────────

export type ReadingSessionRevisionRepository = {
  listRevisions: () => Promise<ReadingSessionRevisionListItem[]>;
  getRevisionById: (revisionId: string) => Promise<ReadingSessionRevisionDetail | null>;
  deleteRevision: (revisionId: string) => Promise<void>;
};

export function createDbReadingSessionRevisionRepository(
  databaseUrl?: string,
): ReadingSessionRevisionRepository {
  return {
    async listRevisions() {
      const db = createDbSqlClient(databaseUrl);
      const records = (await db`
        select
          id,
          session_id,
          label,
          birth_date,
          birth_time,
          gender,
          day_master,
          provider,
          status,
          created_at
        from bazi_reading_session_revisions
        order by created_at desc
      `) as ReadingSessionRevisionListRow[];

      return records.map((record) => ({
        id: record.id,
        sessionId: record.session_id,
        label: record.label,
        birthDate: record.birth_date,
        birthTime: record.birth_time,
        gender: record.gender,
        dayMaster: record.day_master,
        provider: record.provider,
        status: record.status,
        createdAt: record.created_at,
      }));
    },
    async getRevisionById(revisionId) {
      const db = createDbClient(databaseUrl);
      const [record] = await db
        .select({
          id: baziReadingSessionRevisions.id,
          sessionId: baziReadingSessionRevisions.sessionId,
          label: baziReadingSessionRevisions.label,
          birthDate: baziReadingSessionRevisions.birthDate,
          birthTime: baziReadingSessionRevisions.birthTime,
          gender: baziReadingSessionRevisions.gender,
          dayMaster: baziReadingSessionRevisions.dayMaster,
          provider: baziReadingSessionRevisions.provider,
          status: baziReadingSessionRevisions.status,
          rawInput: baziReadingSessionRevisions.rawInput,
          calculatedState: baziReadingSessionRevisions.calculatedState,
          sessionData: baziReadingSessionRevisions.sessionData,
          ownerId: baziReadingSessionRevisions.ownerId,
          createdAt: baziReadingSessionRevisions.createdAt,
        })
        .from(baziReadingSessionRevisions)
        .where(eq(baziReadingSessionRevisions.id, revisionId))
        .orderBy(desc(baziReadingSessionRevisions.createdAt))
        .limit(1);

      if (!record) {
        return null;
      }

      return {
        id: record.id,
        sessionId: record.sessionId,
        label: record.label,
        versionNote: null,
        birthDate: record.birthDate,
        birthTime: record.birthTime,
        gender: record.gender,
        dayMaster: record.dayMaster,
        provider: record.provider,
        status: record.status,
        rawInput: record.rawInput,
        calculatedState: record.calculatedState,
        sessionData: record.sessionData,
        ownerId: record.ownerId,
        createdAt: record.createdAt.toISOString(),
      };
    },
    async deleteRevision(revisionId) {
      const db = createDbClient(databaseUrl);
      await db
        .delete(baziReadingSessionRevisions)
        .where(eq(baziReadingSessionRevisions.id, revisionId));
    },
  };
}

// ── Server helpers ───────────────────────────────────────────────────────────────

type ListReadingSessionRevisionsOptions = {
  repository?: Pick<ReadingSessionRevisionRepository, "listRevisions">;
};

export async function listReadingSessionRevisions(
  options: ListReadingSessionRevisionsOptions = {},
): Promise<ReadingSessionRevisionListItem[]> {
  const repository = options.repository ?? createDbReadingSessionRevisionRepository();
  return repository.listRevisions();
}

// ── Handler factories ────────────────────────────────────────────────────────────

type ListHandlerOptions = {
  repository?: Pick<ReadingSessionRevisionRepository, "listRevisions">;
  authenticate?: ReadingSessionRevisionAuthenticate;
};

type GetHandlerOptions = {
  repository?: Pick<ReadingSessionRevisionRepository, "getRevisionById">;
  authenticate?: ReadingSessionRevisionAuthenticate;
};

type DeleteHandlerOptions = {
  repository?: Pick<ReadingSessionRevisionRepository, "deleteRevision">;
  authenticate?: ReadingSessionRevisionAuthenticate;
};

type RouteContext = {
  params: Promise<{ revisionId: string }>;
};

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function createListReadingSessionRevisionsHandler(options: ListHandlerOptions) {
  return async function GET() {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);
      if (!isAuthenticated || !authResult.userId) {
        return unauthorizedResponse();
      }
      const repository = options.repository ?? createDbReadingSessionRevisionRepository();
      const records = await repository.listRevisions();
      return Response.json(records, { status: 200 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reading session revision listing error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export function createGetReadingSessionRevisionHandler(options: GetHandlerOptions) {
  return async function GET(_request: Request, context: RouteContext) {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);
      if (!isAuthenticated || !authResult.userId) {
        return unauthorizedResponse();
      }
      const { revisionId } = await context.params;
      const repository = options.repository ?? createDbReadingSessionRevisionRepository();
      const record = await repository.getRevisionById(revisionId);
      if (!record) {
        return Response.json(
          { error: `Reading session revision ${revisionId} was not found.` },
          { status: 404 },
        );
      }
      return Response.json(record, { status: 200 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reading session revision lookup error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export function createDeleteReadingSessionRevisionHandler(options: DeleteHandlerOptions) {
  return async function DELETE(_request: Request, context: RouteContext) {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);
      if (!isAuthenticated || !authResult.userId) {
        return unauthorizedResponse();
      }
      const { revisionId } = await context.params;
      const repository = options.repository ?? createDbReadingSessionRevisionRepository();
      await repository.deleteRevision(revisionId);
      return new Response(null, { status: 200 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reading session revision delete error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}
