/**
 * ประวัติการดูดวง (reading session) — repository + API handlers + Zod schema
 * เก็บงานของหน้า /reading ลงฐานข้อมูล (ตาราง bazi_reading_sessions) แยกจาก SFT dataset
 * เพื่อให้กลับมาแก้ต่อ / ปริ้นซ้ำ / ฝากคนอื่นแก้ได้
 *
 * มิเรอร์รูปแบบจาก dataset-records.ts (repository factory + handler factory + localAuth)
 */
import { desc, eq } from "drizzle-orm";
import { ZodError, z } from "zod";

import { createDbClient, createDbSqlClient } from "@/db/client";
import { baziReadingSessions } from "@/db/schema";
import { recordSessionRevision } from "@/lib/bazi/reading-session-revisions";
import {
  CalculatedStateSchema,
  RawInputSchema,
  type CalculatedStateValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import {
  READING_SESSION_DATA_VERSION,
  type ReadingSessionDataValue,
  type ReadingSessionMetadataValue,
  type ReadingSessionStatus,
} from "@/lib/bazi/reading-session-types";

// ── Zod schema ────────────────────────────────────────────────────────────────

const RelationshipLineSchema = z.object({
  ageRange: z.string(),
  symbol: z.string(),
  relationLine: z.string(),
  deepNote: z.string(),
  // ขึ้นหน้าใหม่ก่อนแถวนี้ (บทเสริม) — ต้องประกาศไว้ ไม่งั้น zod ตัดทิ้งตอนบันทึก
  pageBreakBefore: z.boolean().optional(),
});

// result เก็บแบบ permissive (z.any) เพื่อให้รูป engine reading วิวัฒน์ได้โดยไม่ทำให้โหลดเซสชันเดิมพัง
const TopicStateSchema = z.object({
  status: z.enum(["idle", "loading", "done", "error"]),
  result: z.any().nullable(),
  error: z.string().nullable(),
});

const SinsaeCorrectionSchema = z.object({
  topicId: z.string(),
  fingerprint: z.string(),
  chartSignature: z.string(),
  original: z.string(),
  corrected: z.string(),
  editedAt: z.string(),
});

export const SessionDataSchema = z.object({
  version: z.number().int().default(READING_SESSION_DATA_VERSION),
  provider: z.enum(["gemini", "opencode", "anthropic"]),
  topicStates: z.record(z.string(), TopicStateSchema),
  corrections: z.record(z.string(), z.array(SinsaeCorrectionSchema)),
  readings: z.record(z.string(), z.string()),
  // ชื่อบทที่ซินแสแก้เอง (topicId → หัวข้อใหญ่) — เก่าที่ไม่มีฟิลด์นี้ default เป็น {}
  titleOverrides: z.record(z.string(), z.string()).default({}),
  relationshipLines: z.array(RelationshipLineSchema).nullable(),
});

export const SaveReadingSessionRequestSchema = z.object({
  /** ถ้ามี = อัปเดตเซสชันเดิม, ถ้าไม่มี = สร้างใหม่ */
  sessionId: z.string().uuid().optional(),
  label: z.string().trim().max(200).nullable().optional(),
  status: z.enum(["in_progress", "done"]).default("in_progress"),
  rawInput: RawInputSchema,
  /** snapshot ดวง — บังคับตอนบันทึก (หน้า reading มีค่านี้เสมอเมื่อกดบันทึกได้) */
  calculatedState: CalculatedStateSchema,
  sessionData: SessionDataSchema,
  /**
   * สร้าง "จุดประวัติการบันทึก" (revision) ไหม — default true (กดปุ่ม "บันทึกการดูดวง" เอง)
   * auto-save หลังแก้กล่องส่ง false → บันทึกลง DB ทุกครั้งแต่ไม่รก revision (จุดประวัติ = การกดบันทึกเองเท่านั้น)
   */
  createRevision: z.boolean().default(true),
});

export type SaveReadingSessionRequest = z.infer<typeof SaveReadingSessionRequestSchema>;

/** อัปเดตสถานะดวง (เสร็จสิ้น/กลับไปแก้) — PATCH /api/reading/sessions/[sessionId] */
export const SetReadingSessionStatusSchema = z.object({
  status: z.enum(["in_progress", "done"]),
});

// ── Domain types ───────────────────────────────────────────────────────────────

export type SavedReadingSession = {
  sessionId: string;
  status: ReadingSessionStatus;
  updatedAt: string;
};

export type ReadingSessionListItem = {
  id: string;
  label: string | null;
  birthDate: string;
  birthTime: string;
  gender: string;
  dayMaster: string | null;
  provider: string;
  status: ReadingSessionStatus;
  createdAt: string;
  updatedAt: string;
};

export type ReadingSessionDetail = ReadingSessionListItem & {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue | null;
  sessionData: ReadingSessionDataValue;
  metadata: ReadingSessionMetadataValue;
  ownerId: string | null;
};

type ReadingSessionListRow = {
  id: string;
  label: string | null;
  birth_date: string;
  birth_time: string;
  gender: string;
  day_master: string | null;
  provider: string;
  status: ReadingSessionStatus;
  created_at: string;
  updated_at: string;
};

export type ReadingSessionRepository = {
  saveSession: (
    input: SaveReadingSessionRequest,
    ownerId: string,
  ) => Promise<SavedReadingSession>;
  /** อัปเดตสถานะอย่างเดียว (เสร็จสิ้น/กลับไปแก้ต่อ) โดยไม่แตะเนื้อหา */
  setSessionStatus: (
    sessionId: string,
    status: ReadingSessionStatus,
  ) => Promise<SavedReadingSession>;
  listSessions: () => Promise<ReadingSessionListItem[]>;
  /** ดวงที่ mark "เสร็จสิ้น" แล้ว พร้อมเนื้อหาเต็ม — ไว้ export ไปเทรน */
  listDoneSessions: () => Promise<ReadingSessionDetail[]>;
  getSessionById: (sessionId: string) => Promise<ReadingSessionDetail | null>;
  deleteSession: (sessionId: string, ownerId: string) => Promise<void>;
};

// ── Auth (ใช้ร่วมกันทั้งระบบ — ไม่มี login, default เป็น "local") ─────────────────

export type ReadingSessionAuth = {
  userId: string | null;
  isAuthenticated?: boolean;
};

export type ReadingSessionAuthenticate = () => Promise<ReadingSessionAuth>;

const LOCAL_USER_ID = "local";
const localAuth: ReadingSessionAuthenticate = async () => ({
  userId: LOCAL_USER_ID,
  isAuthenticated: true,
});

// ── Repository ──────────────────────────────────────────────────────────────────

export function createDbReadingSessionRepository(
  databaseUrl?: string,
): ReadingSessionRepository {
  return {
    async saveSession(input, ownerId) {
      const db = createDbClient(databaseUrl);

      const values = {
        label: input.label ?? null,
        birthDate: input.rawInput.birthDate,
        birthTime: input.rawInput.birthTime,
        gender: input.rawInput.gender,
        dayMaster: input.calculatedState?.dayMaster ?? null,
        provider: input.sessionData.provider,
        status: input.status,
        rawInput: input.rawInput,
        calculatedState: input.calculatedState ?? null,
        sessionData: input.sessionData,
        ownerId,
      };

      let resolvedSessionId: string;
      let updatedAt: Date;

      if (input.sessionId) {
        const [updatedRecord] = await db
          .update(baziReadingSessions)
          .set(values)
          .where(eq(baziReadingSessions.id, input.sessionId))
          .returning({
            sessionId: baziReadingSessions.id,
            updatedAt: baziReadingSessions.updatedAt,
          });

        if (!updatedRecord) {
          throw new Error(`Reading session ${input.sessionId} was not found.`);
        }

        resolvedSessionId = updatedRecord.sessionId;
        updatedAt = updatedRecord.updatedAt;
      } else {
        const [createdRecord] = await db
          .insert(baziReadingSessions)
          .values(values)
          .returning({
            sessionId: baziReadingSessions.id,
            updatedAt: baziReadingSessions.updatedAt,
          });

        resolvedSessionId = createdRecord.sessionId;
        updatedAt = createdRecord.updatedAt;
      }

      // เก็บ "ประวัติการบันทึก" หนึ่งสแน็ปช็อตเฉพาะตอนกดบันทึกเอง (createRevision !== false) — auto-save ข้าม
      // best-effort: ถ้า revision ล้มเหลวไม่ทำให้การบันทึก session หลักพัง
      if (input.createRevision !== false) {
        try {
          await recordSessionRevision(
            { ...values, sessionId: resolvedSessionId },
            databaseUrl,
          );
        } catch {
          /* บันทึกประวัติไม่สำเร็จ — ข้ามได้ (session หลักบันทึกแล้ว) */
        }
      }

      return {
        sessionId: resolvedSessionId,
        status: input.status,
        updatedAt: updatedAt.toISOString(),
      };
    },
    async setSessionStatus(sessionId, status) {
      const db = createDbClient(databaseUrl);
      const [record] = await db
        .update(baziReadingSessions)
        .set({ status })
        .where(eq(baziReadingSessions.id, sessionId))
        .returning({
          sessionId: baziReadingSessions.id,
          status: baziReadingSessions.status,
          updatedAt: baziReadingSessions.updatedAt,
        });

      if (!record) {
        throw new Error(`Reading session ${sessionId} was not found.`);
      }

      return {
        sessionId: record.sessionId,
        status: record.status,
        updatedAt: record.updatedAt.toISOString(),
      };
    },
    async listSessions() {
      const db = createDbSqlClient(databaseUrl);
      const records = (await db`
        select
          id,
          label,
          birth_date,
          birth_time,
          gender,
          day_master,
          provider,
          status,
          created_at,
          updated_at
        from bazi_reading_sessions
        order by updated_at desc
      `) as ReadingSessionListRow[];

      return records.map((record) => ({
        id: record.id,
        label: record.label,
        birthDate: record.birth_date,
        birthTime: record.birth_time,
        gender: record.gender,
        dayMaster: record.day_master,
        provider: record.provider,
        status: record.status,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      }));
    },
    async listDoneSessions() {
      const db = createDbClient(databaseUrl);
      const records = await db
        .select({
          id: baziReadingSessions.id,
          label: baziReadingSessions.label,
          birthDate: baziReadingSessions.birthDate,
          birthTime: baziReadingSessions.birthTime,
          gender: baziReadingSessions.gender,
          dayMaster: baziReadingSessions.dayMaster,
          provider: baziReadingSessions.provider,
          status: baziReadingSessions.status,
          rawInput: baziReadingSessions.rawInput,
          calculatedState: baziReadingSessions.calculatedState,
          sessionData: baziReadingSessions.sessionData,
          metadata: baziReadingSessions.metadata,
          ownerId: baziReadingSessions.ownerId,
          createdAt: baziReadingSessions.createdAt,
          updatedAt: baziReadingSessions.updatedAt,
        })
        .from(baziReadingSessions)
        .where(eq(baziReadingSessions.status, "done"))
        .orderBy(desc(baziReadingSessions.updatedAt));

      return records.map((record) => ({
        id: record.id,
        label: record.label,
        birthDate: record.birthDate,
        birthTime: record.birthTime,
        gender: record.gender,
        dayMaster: record.dayMaster,
        provider: record.provider,
        status: record.status,
        rawInput: record.rawInput,
        calculatedState: record.calculatedState,
        sessionData: record.sessionData,
        metadata: record.metadata,
        ownerId: record.ownerId,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      }));
    },
    async getSessionById(sessionId) {
      const db = createDbClient(databaseUrl);
      const [record] = await db
        .select({
          id: baziReadingSessions.id,
          label: baziReadingSessions.label,
          birthDate: baziReadingSessions.birthDate,
          birthTime: baziReadingSessions.birthTime,
          gender: baziReadingSessions.gender,
          dayMaster: baziReadingSessions.dayMaster,
          provider: baziReadingSessions.provider,
          status: baziReadingSessions.status,
          rawInput: baziReadingSessions.rawInput,
          calculatedState: baziReadingSessions.calculatedState,
          sessionData: baziReadingSessions.sessionData,
          metadata: baziReadingSessions.metadata,
          ownerId: baziReadingSessions.ownerId,
          createdAt: baziReadingSessions.createdAt,
          updatedAt: baziReadingSessions.updatedAt,
        })
        .from(baziReadingSessions)
        .where(eq(baziReadingSessions.id, sessionId))
        .limit(1);

      if (!record) {
        return null;
      }

      return {
        id: record.id,
        label: record.label,
        birthDate: record.birthDate,
        birthTime: record.birthTime,
        gender: record.gender,
        dayMaster: record.dayMaster,
        provider: record.provider,
        status: record.status,
        rawInput: record.rawInput,
        calculatedState: record.calculatedState,
        sessionData: record.sessionData,
        metadata: record.metadata,
        ownerId: record.ownerId,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      };
    },
    async deleteSession(sessionId) {
      const db = createDbClient(databaseUrl);

      await db
        .delete(baziReadingSessions)
        .where(eq(baziReadingSessions.id, sessionId));
    },
  };
}

// ── Server helpers ───────────────────────────────────────────────────────────────

type ListReadingSessionsOptions = {
  repository?: Pick<ReadingSessionRepository, "listSessions">;
};

export async function listReadingSessions(
  options: ListReadingSessionsOptions = {},
): Promise<ReadingSessionListItem[]> {
  const repository = options.repository ?? createDbReadingSessionRepository();

  return repository.listSessions();
}

// ── Handler factories ────────────────────────────────────────────────────────────

type SaveReadingSessionHandlerOptions = {
  repository?: Pick<ReadingSessionRepository, "saveSession">;
  /** Optional. When omitted, requests are treated as the local user (no login). */
  authenticate?: ReadingSessionAuthenticate;
};

type ListReadingSessionsHandlerOptions = {
  repository?: Pick<ReadingSessionRepository, "listSessions">;
  authenticate?: ReadingSessionAuthenticate;
};

type GetReadingSessionHandlerOptions = {
  repository?: Pick<ReadingSessionRepository, "getSessionById">;
  authenticate?: ReadingSessionAuthenticate;
};

type DeleteReadingSessionHandlerOptions = {
  repository?: Pick<ReadingSessionRepository, "deleteSession">;
  authenticate?: ReadingSessionAuthenticate;
};

type SetReadingSessionStatusHandlerOptions = {
  repository?: Pick<ReadingSessionRepository, "setSessionStatus">;
  authenticate?: ReadingSessionAuthenticate;
};

type ExportDoneReadingsHandlerOptions = {
  repository?: Pick<ReadingSessionRepository, "listDoneSessions">;
  authenticate?: ReadingSessionAuthenticate;
};

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function createSaveReadingSessionHandler(
  options: SaveReadingSessionHandlerOptions,
) {
  return async function POST(request: Request) {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);

      if (!isAuthenticated || !authResult.userId) {
        return unauthorizedResponse();
      }

      const payload = SaveReadingSessionRequestSchema.parse(await request.json());
      const repository = options.repository ?? createDbReadingSessionRepository();
      const record = await repository.saveSession(payload, authResult.userId);

      return Response.json(record, { status: 200 });
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          {
            error: "Invalid reading session payload.",
            details: error.issues,
          },
          { status: 400 },
        );
      }

      if (error instanceof Error && error.message.includes("was not found")) {
        return Response.json({ error: error.message }, { status: 404 });
      }

      const message =
        error instanceof Error ? error.message : "Unknown reading session save error.";

      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export function createListReadingSessionsHandler(
  options: ListReadingSessionsHandlerOptions,
) {
  return async function GET() {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);

      if (!isAuthenticated || !authResult.userId) {
        return unauthorizedResponse();
      }

      const repository = options.repository ?? createDbReadingSessionRepository();
      const records = await repository.listSessions();

      return Response.json(records, { status: 200 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reading session listing error.";

      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export function createGetReadingSessionHandler(
  options: GetReadingSessionHandlerOptions,
) {
  return async function GET(_request: Request, context: RouteContext) {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);

      if (!isAuthenticated || !authResult.userId) {
        return unauthorizedResponse();
      }

      const { sessionId } = await context.params;
      const repository = options.repository ?? createDbReadingSessionRepository();
      const record = await repository.getSessionById(sessionId);

      if (!record) {
        return Response.json(
          { error: `Reading session ${sessionId} was not found.` },
          { status: 404 },
        );
      }

      return Response.json(record, { status: 200 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reading session lookup error.";

      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export function createDeleteReadingSessionHandler(
  options: DeleteReadingSessionHandlerOptions,
) {
  return async function DELETE(_request: Request, context: RouteContext) {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);

      if (!isAuthenticated || !authResult.userId) {
        return unauthorizedResponse();
      }

      const { sessionId } = await context.params;
      const repository = options.repository ?? createDbReadingSessionRepository();
      await repository.deleteSession(sessionId, authResult.userId);

      return new Response(null, { status: 200 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reading session delete error.";

      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export function createSetReadingSessionStatusHandler(
  options: SetReadingSessionStatusHandlerOptions,
) {
  return async function PATCH(request: Request, context: RouteContext) {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);

      if (!isAuthenticated || !authResult.userId) {
        return unauthorizedResponse();
      }

      const { sessionId } = await context.params;
      const { status } = SetReadingSessionStatusSchema.parse(await request.json());
      const repository = options.repository ?? createDbReadingSessionRepository();
      const record = await repository.setSessionStatus(sessionId, status);

      return Response.json(record, { status: 200 });
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Invalid status payload.", details: error.issues },
          { status: 400 },
        );
      }

      if (error instanceof Error && error.message.includes("was not found")) {
        return Response.json({ error: error.message }, { status: 404 });
      }

      const message =
        error instanceof Error ? error.message : "Unknown reading session status error.";

      return Response.json({ error: message }, { status: 500 });
    }
  };
}

// ── Export dataset (ดวงที่ "เสร็จสิ้น") ────────────────────────────────────────────

/** 1 รายการ dataset ต่อดวง: ข้อมูลนำเข้า + คำอ่านสุดท้ายรายบท (เนื้อ PDF สุดท้าย) */
export type ReadingExportItem = {
  sessionId: string;
  label: string | null;
  birthDate: string;
  birthTime: string;
  gender: string;
  dayMaster: string | null;
  provider: string;
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue | null;
  /** topicId → คำอ่านสุดท้าย (ที่ซินแสแก้แล้ว) */
  readings: Record<string, string>;
  /** topicId → ชื่อบทที่ปรับเอง */
  titleOverrides: Record<string, string>;
  relationshipLines: ReadingSessionDataValue["relationshipLines"];
  updatedAt: string;
};

/** แปลงดวงเต็มเป็นรายการ dataset — ตัด state ที่ไม่ใช้เทรน (topicStates/corrections ฯลฯ) ออก */
export function toReadingExportItem(detail: ReadingSessionDetail): ReadingExportItem {
  return {
    sessionId: detail.id,
    label: detail.label,
    birthDate: detail.birthDate,
    birthTime: detail.birthTime,
    gender: detail.gender,
    dayMaster: detail.dayMaster,
    provider: detail.provider,
    rawInput: detail.rawInput,
    calculatedState: detail.calculatedState,
    readings: detail.sessionData.readings ?? {},
    titleOverrides: detail.sessionData.titleOverrides ?? {},
    relationshipLines: detail.sessionData.relationshipLines ?? null,
    updatedAt: detail.updatedAt,
  };
}

/** ดึงดวงที่เสร็จสิ้นทั้งหมดในรูป dataset (ใช้ทั้ง API export และสคริปต์) */
export async function collectDoneReadingsForExport(
  repository: Pick<ReadingSessionRepository, "listDoneSessions"> = createDbReadingSessionRepository(),
): Promise<ReadingExportItem[]> {
  const sessions = await repository.listDoneSessions();
  return sessions.map(toReadingExportItem);
}

export function createExportDoneReadingsHandler(
  options: ExportDoneReadingsHandlerOptions,
) {
  return async function GET() {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);

      if (!isAuthenticated || !authResult.userId) {
        return unauthorizedResponse();
      }

      const repository = options.repository ?? createDbReadingSessionRepository();
      const items = await collectDoneReadingsForExport(repository);

      return new Response(
        JSON.stringify({ count: items.length, items }, null, 2),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": 'attachment; filename="done-readings.json"',
          },
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reading export error.";

      return Response.json({ error: message }, { status: 500 });
    }
  };
}
