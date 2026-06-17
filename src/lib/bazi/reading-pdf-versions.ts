/**
 * เวอร์ชัน PDF ที่บันทึก (reading PDF version) — repository + API handlers + Zod schema
 * snapshot แบบ insert-only ของงานในหน้า /reading ณ ตอนกด "บันทึกเวอร์ชัน PDF"
 * เก็บได้หลายเวอร์ชันต่อ 1 ดวง (ตาราง bazi_reading_pdf_versions) → ย้อนกลับมาแก้/ปริ้นเวอร์ชันเดิมได้
 *
 * มิเรอร์รูปแบบจาก reading-sessions.ts (repository factory + handler factory + localAuth)
 * ต่างกันตรง saveVersion เป็น insert เท่านั้น (ไม่มี update) และ detail มี sessionId/versionNote เพิ่ม
 */
import { eq } from "drizzle-orm";
import { ZodError, z } from "zod";

import { createDbClient, createDbSqlClient } from "@/db/client";
import { baziReadingPdfVersions } from "@/db/schema";
import {
  CalculatedStateSchema,
  RawInputSchema,
  type CalculatedStateValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import { SessionDataSchema } from "@/lib/bazi/reading-sessions";
import {
  type ReadingSessionDataValue,
  type ReadingSessionStatus,
} from "@/lib/bazi/reading-session-types";

// ── Zod schema ────────────────────────────────────────────────────────────────

export const SaveReadingPdfVersionRequestSchema = z.object({
  /** ดวงต้นทาง (live session) ที่ snapshot นี้แตกออกมา — nullable เผื่อบันทึกก่อนมี session */
  sessionId: z.string().uuid().nullable().optional(),
  /** โน้ตประจำเวอร์ชัน (ไม่บังคับ) เช่น "ก่อนแก้บทคู่ครอง" */
  versionNote: z.string().trim().max(500).nullable().optional(),
  label: z.string().trim().max(200).nullable().optional(),
  status: z.enum(["in_progress", "done"]).default("in_progress"),
  rawInput: RawInputSchema,
  calculatedState: CalculatedStateSchema,
  sessionData: SessionDataSchema,
});

export type SaveReadingPdfVersionRequest = z.infer<typeof SaveReadingPdfVersionRequestSchema>;

// ── Domain types ───────────────────────────────────────────────────────────────

export type SavedReadingPdfVersion = {
  versionId: string;
  createdAt: string;
};

export type ReadingPdfVersionListItem = {
  id: string;
  sessionId: string | null;
  label: string | null;
  versionNote: string | null;
  birthDate: string;
  birthTime: string;
  gender: string;
  dayMaster: string | null;
  provider: string;
  status: ReadingSessionStatus;
  createdAt: string;
};

export type ReadingPdfVersionDetail = ReadingPdfVersionListItem & {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue | null;
  sessionData: ReadingSessionDataValue;
  ownerId: string | null;
};

type ReadingPdfVersionListRow = {
  id: string;
  session_id: string | null;
  label: string | null;
  version_note: string | null;
  birth_date: string;
  birth_time: string;
  gender: string;
  day_master: string | null;
  provider: string;
  status: ReadingSessionStatus;
  created_at: string;
};

export type ReadingPdfVersionRepository = {
  saveVersion: (
    input: SaveReadingPdfVersionRequest,
    ownerId: string,
  ) => Promise<SavedReadingPdfVersion>;
  listVersions: () => Promise<ReadingPdfVersionListItem[]>;
  getVersionById: (versionId: string) => Promise<ReadingPdfVersionDetail | null>;
  deleteVersion: (versionId: string, ownerId: string) => Promise<void>;
};

// ── Auth (ใช้ร่วมกันทั้งระบบ — ไม่มี login, default เป็น "local") ─────────────────

export type ReadingPdfVersionAuth = {
  userId: string | null;
  isAuthenticated?: boolean;
};

export type ReadingPdfVersionAuthenticate = () => Promise<ReadingPdfVersionAuth>;

const LOCAL_USER_ID = "local";
const localAuth: ReadingPdfVersionAuthenticate = async () => ({
  userId: LOCAL_USER_ID,
  isAuthenticated: true,
});

// ── Repository ──────────────────────────────────────────────────────────────────

export function createDbReadingPdfVersionRepository(
  databaseUrl?: string,
): ReadingPdfVersionRepository {
  return {
    async saveVersion(input, ownerId) {
      const db = createDbClient(databaseUrl);

      // snapshot แบบ insert เสมอ — ไม่เคย update แถวเดิม (นี่คือแก่นของการเก็บเวอร์ชัน)
      const [createdRecord] = await db
        .insert(baziReadingPdfVersions)
        .values({
          sessionId: input.sessionId ?? null,
          label: input.label ?? null,
          versionNote: input.versionNote ?? null,
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
        })
        .returning({
          versionId: baziReadingPdfVersions.id,
          createdAt: baziReadingPdfVersions.createdAt,
        });

      return {
        versionId: createdRecord.versionId,
        createdAt: createdRecord.createdAt.toISOString(),
      };
    },
    async listVersions() {
      const db = createDbSqlClient(databaseUrl);
      const records = (await db`
        select
          id,
          session_id,
          label,
          version_note,
          birth_date,
          birth_time,
          gender,
          day_master,
          provider,
          status,
          created_at
        from bazi_reading_pdf_versions
        order by created_at desc
      `) as ReadingPdfVersionListRow[];

      return records.map((record) => ({
        id: record.id,
        sessionId: record.session_id,
        label: record.label,
        versionNote: record.version_note,
        birthDate: record.birth_date,
        birthTime: record.birth_time,
        gender: record.gender,
        dayMaster: record.day_master,
        provider: record.provider,
        status: record.status,
        createdAt: record.created_at,
      }));
    },
    async getVersionById(versionId) {
      const db = createDbClient(databaseUrl);
      const [record] = await db
        .select({
          id: baziReadingPdfVersions.id,
          sessionId: baziReadingPdfVersions.sessionId,
          label: baziReadingPdfVersions.label,
          versionNote: baziReadingPdfVersions.versionNote,
          birthDate: baziReadingPdfVersions.birthDate,
          birthTime: baziReadingPdfVersions.birthTime,
          gender: baziReadingPdfVersions.gender,
          dayMaster: baziReadingPdfVersions.dayMaster,
          provider: baziReadingPdfVersions.provider,
          status: baziReadingPdfVersions.status,
          rawInput: baziReadingPdfVersions.rawInput,
          calculatedState: baziReadingPdfVersions.calculatedState,
          sessionData: baziReadingPdfVersions.sessionData,
          ownerId: baziReadingPdfVersions.ownerId,
          createdAt: baziReadingPdfVersions.createdAt,
        })
        .from(baziReadingPdfVersions)
        .where(eq(baziReadingPdfVersions.id, versionId))
        .limit(1);

      if (!record) {
        return null;
      }

      return {
        id: record.id,
        sessionId: record.sessionId,
        label: record.label,
        versionNote: record.versionNote,
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
    async deleteVersion(versionId) {
      const db = createDbClient(databaseUrl);

      await db
        .delete(baziReadingPdfVersions)
        .where(eq(baziReadingPdfVersions.id, versionId));
    },
  };
}

// ── Server helpers ───────────────────────────────────────────────────────────────

type ListReadingPdfVersionsOptions = {
  repository?: Pick<ReadingPdfVersionRepository, "listVersions">;
};

export async function listReadingPdfVersions(
  options: ListReadingPdfVersionsOptions = {},
): Promise<ReadingPdfVersionListItem[]> {
  const repository = options.repository ?? createDbReadingPdfVersionRepository();

  return repository.listVersions();
}

// ── Handler factories ────────────────────────────────────────────────────────────

type SaveReadingPdfVersionHandlerOptions = {
  repository?: Pick<ReadingPdfVersionRepository, "saveVersion">;
  authenticate?: ReadingPdfVersionAuthenticate;
};

type ListReadingPdfVersionsHandlerOptions = {
  repository?: Pick<ReadingPdfVersionRepository, "listVersions">;
  authenticate?: ReadingPdfVersionAuthenticate;
};

type GetReadingPdfVersionHandlerOptions = {
  repository?: Pick<ReadingPdfVersionRepository, "getVersionById">;
  authenticate?: ReadingPdfVersionAuthenticate;
};

type DeleteReadingPdfVersionHandlerOptions = {
  repository?: Pick<ReadingPdfVersionRepository, "deleteVersion">;
  authenticate?: ReadingPdfVersionAuthenticate;
};

type RouteContext = {
  params: Promise<{ versionId: string }>;
};

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function createSaveReadingPdfVersionHandler(
  options: SaveReadingPdfVersionHandlerOptions,
) {
  return async function POST(request: Request) {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);

      if (!isAuthenticated || !authResult.userId) {
        return unauthorizedResponse();
      }

      const payload = SaveReadingPdfVersionRequestSchema.parse(await request.json());
      const repository = options.repository ?? createDbReadingPdfVersionRepository();
      const record = await repository.saveVersion(payload, authResult.userId);

      return Response.json(record, { status: 200 });
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          {
            error: "Invalid reading PDF version payload.",
            details: error.issues,
          },
          { status: 400 },
        );
      }

      const message =
        error instanceof Error ? error.message : "Unknown reading PDF version save error.";

      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export function createListReadingPdfVersionsHandler(
  options: ListReadingPdfVersionsHandlerOptions,
) {
  return async function GET() {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);

      if (!isAuthenticated || !authResult.userId) {
        return unauthorizedResponse();
      }

      const repository = options.repository ?? createDbReadingPdfVersionRepository();
      const records = await repository.listVersions();

      return Response.json(records, { status: 200 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reading PDF version listing error.";

      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export function createGetReadingPdfVersionHandler(
  options: GetReadingPdfVersionHandlerOptions,
) {
  return async function GET(_request: Request, context: RouteContext) {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);

      if (!isAuthenticated || !authResult.userId) {
        return unauthorizedResponse();
      }

      const { versionId } = await context.params;
      const repository = options.repository ?? createDbReadingPdfVersionRepository();
      const record = await repository.getVersionById(versionId);

      if (!record) {
        return Response.json(
          { error: `Reading PDF version ${versionId} was not found.` },
          { status: 404 },
        );
      }

      return Response.json(record, { status: 200 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reading PDF version lookup error.";

      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export function createDeleteReadingPdfVersionHandler(
  options: DeleteReadingPdfVersionHandlerOptions,
) {
  return async function DELETE(_request: Request, context: RouteContext) {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);

      if (!isAuthenticated || !authResult.userId) {
        return unauthorizedResponse();
      }

      const { versionId } = await context.params;
      const repository = options.repository ?? createDbReadingPdfVersionRepository();
      await repository.deleteVersion(versionId, authResult.userId);

      return new Response(null, { status: 200 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reading PDF version delete error.";

      return Response.json({ error: message }, { status: 500 });
    }
  };
}
