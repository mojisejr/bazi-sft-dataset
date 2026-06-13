/**
 * ที่เก็บกฎแทนคำ (phrase substitution rules) บน Postgres — repository + API handlers + Zod schema
 * เก็บลงตาราง bazi_substitution_rules ให้ persist จริง (เดิมเคยเป็นไฟล์ JSON ใน source tree ซึ่ง
 * บน Vercel เขียนไม่ได้ → กฎหายทุก refresh/redeploy)
 *
 * มิเรอร์รูปแบบจาก reading-sessions.ts (repository factory + handler factory แบบ DI ทดสอบง่าย)
 * ส่วน logic แทนคำ (applySubstitutionRules ฯลฯ) ยังอยู่ใน substitution-rules.ts (pure)
 */
import { desc, eq } from "drizzle-orm";
import { ZodError, z } from "zod";

import { createDbClient } from "@/db/client";
import { baziSubstitutionRules, type SelectBaziSubstitutionRule } from "@/db/schema";
import { type SubstitutionRule, type SubstitutionRuleScope } from "@/lib/bazi/substitution-rules";

// ── Zod schema ────────────────────────────────────────────────────────────────

export const RuleInputSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    scope: z.enum(["topic", "global"]).default("topic"),
    topicId: z.string().trim().min(1).optional(),
    match: z.string().trim().min(1),
    replacement: z.string().default(""),
    note: z.string().trim().optional(),
    source: z
      .object({
        kind: z.enum(["manual", "diff"]).default("manual"),
        chartSignature: z.string().trim().optional(),
      })
      .default({ kind: "manual" }),
  })
  .refine((value) => value.scope === "global" || Boolean(value.topicId), {
    message: "scope = topic ต้องระบุ topicId",
  });

export type RuleInput = z.infer<typeof RuleInputSchema>;

/** POST รับได้ทั้งกฎเดี่ยว และชุดกฎ { rules: [...] } (ปุ่ม "บันทึกเป็นกฎทั้งหมด") */
export const BatchRuleInputSchema = z.object({
  rules: z.array(RuleInputSchema).min(1),
});

// ── Domain mapping ──────────────────────────────────────────────────────────────

const LOCAL_OWNER_ID = "local";

function toDomain(row: SelectBaziSubstitutionRule): SubstitutionRule {
  return {
    id: row.id,
    scope: row.scope as SubstitutionRuleScope,
    topicId: row.topicId ?? undefined,
    match: row.match,
    replacement: row.replacement,
    note: row.note ?? undefined,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    hitCount: row.hitCount,
  };
}

function editableFields(input: RuleInput) {
  return {
    scope: input.scope,
    topicId: input.scope === "topic" ? input.topicId ?? null : null,
    match: input.match,
    replacement: input.replacement,
    note: input.note ?? null,
    source: input.source,
  };
}

// ── Repository ──────────────────────────────────────────────────────────────────

export type SubstitutionRuleRepository = {
  listRules: () => Promise<SubstitutionRule[]>;
  upsertRule: (input: RuleInput) => Promise<SubstitutionRule>;
  upsertRules: (inputs: RuleInput[]) => Promise<SubstitutionRule[]>;
  deleteRule: (id: string) => Promise<SubstitutionRule[]>;
};

export function createDbSubstitutionRuleRepository(
  databaseUrl?: string,
): SubstitutionRuleRepository {
  async function listRules(): Promise<SubstitutionRule[]> {
    const db = createDbClient(databaseUrl);
    const rows = await db
      .select()
      .from(baziSubstitutionRules)
      .orderBy(desc(baziSubstitutionRules.createdAt));
    return rows.map(toDomain);
  }

  async function upsertRule(input: RuleInput): Promise<SubstitutionRule> {
    const db = createDbClient(databaseUrl);
    const fields = editableFields(input);

    if (input.id) {
      const [updated] = await db
        .update(baziSubstitutionRules)
        .set(fields)
        .where(eq(baziSubstitutionRules.id, input.id))
        .returning();
      if (updated) return toDomain(updated);
      // id ที่ส่งมาไม่มีในตาราง → insert ใหม่โดยคงค่า id เดิมไว้
      const [inserted] = await db
        .insert(baziSubstitutionRules)
        .values({ id: input.id, ...fields, ownerId: LOCAL_OWNER_ID })
        .returning();
      return toDomain(inserted);
    }

    const [inserted] = await db
      .insert(baziSubstitutionRules)
      .values({ ...fields, ownerId: LOCAL_OWNER_ID })
      .returning();
    return toDomain(inserted);
  }

  async function upsertRules(inputs: RuleInput[]): Promise<SubstitutionRule[]> {
    for (const input of inputs) {
      await upsertRule(input);
    }
    return listRules();
  }

  async function deleteRule(id: string): Promise<SubstitutionRule[]> {
    const db = createDbClient(databaseUrl);
    await db.delete(baziSubstitutionRules).where(eq(baziSubstitutionRules.id, id));
    return listRules();
  }

  return { listRules, upsertRule, upsertRules, deleteRule };
}

// ── Handler factories ────────────────────────────────────────────────────────────

function errorResponse(message: string, status: number) {
  return Response.json({ error: { message } }, { status });
}

type ListRulesHandlerOptions = {
  repository?: Pick<SubstitutionRuleRepository, "listRules">;
};

type SaveRuleHandlerOptions = {
  repository?: Pick<SubstitutionRuleRepository, "upsertRule" | "upsertRules" | "listRules">;
};

type DeleteRuleHandlerOptions = {
  repository?: Pick<SubstitutionRuleRepository, "deleteRule">;
};

export function createListRulesHandler(options: ListRulesHandlerOptions = {}) {
  return async function GET() {
    try {
      const repository = options.repository ?? createDbSubstitutionRuleRepository();
      const rules = await repository.listRules();
      return Response.json({ rules });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "อ่านกฎแทนคำไม่สำเร็จ";
      return errorResponse(message, 500);
    }
  };
}

export function createSaveRuleHandler(options: SaveRuleHandlerOptions = {}) {
  return async function POST(req: Request) {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return errorResponse("Request body must be valid JSON.", 400);
    }

    const repository = options.repository ?? createDbSubstitutionRuleRepository();

    try {
      // ชุดกฎ (batch) — ปุ่ม "บันทึกเป็นกฎทั้งหมด"
      if (payload && typeof payload === "object" && Array.isArray((payload as { rules?: unknown }).rules)) {
        const batch = BatchRuleInputSchema.parse(payload);
        const rules = await repository.upsertRules(batch.rules);
        return Response.json({ rules });
      }

      // กฎเดี่ยว
      const input = RuleInputSchema.parse(payload);
      const rule = await repository.upsertRule(input);
      const rules = await repository.listRules();
      return Response.json({ rule, rules });
    } catch (error) {
      if (error instanceof ZodError) {
        return errorResponse(error.issues[0]?.message ?? "Invalid rule.", 400);
      }
      const message = error instanceof Error ? error.message : "บันทึกกฎไม่สำเร็จ";
      return errorResponse(message, 500);
    }
  };
}

export function createDeleteRuleHandler(options: DeleteRuleHandlerOptions = {}) {
  return async function DELETE(req: Request) {
    const id = new URL(req.url).searchParams.get("id")?.trim();
    if (!id) {
      return errorResponse("ต้องระบุ id ของกฎที่จะลบ", 400);
    }
    try {
      const repository = options.repository ?? createDbSubstitutionRuleRepository();
      const rules = await repository.deleteRule(id);
      return Response.json({ rules });
    } catch (error) {
      const message = error instanceof Error ? error.message : "ลบกฎไม่สำเร็จ";
      return errorResponse(message, 500);
    }
  };
}
