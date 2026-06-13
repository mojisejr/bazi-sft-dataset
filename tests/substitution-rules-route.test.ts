import { describe, expect, test, vi } from "vitest";

import {
  BatchRuleInputSchema,
  RuleInputSchema,
  createDeleteRuleHandler,
  createListRulesHandler,
  createSaveRuleHandler,
} from "@/lib/bazi/substitution-rules-repository";
import { type SubstitutionRule } from "@/lib/bazi/substitution-rules";

function rule(over: Partial<SubstitutionRule> = {}): SubstitutionRule {
  return {
    id: over.id ?? "00000000-0000-0000-0000-000000000001",
    scope: over.scope ?? "topic",
    topicId: over.topicId ?? "wealth",
    match: over.match ?? "ได้เงินแบบรายเดือน",
    replacement: over.replacement ?? "passive income",
    note: over.note,
    source: over.source ?? { kind: "manual" },
    createdAt: over.createdAt ?? "2026-06-12T00:00:00.000Z",
    hitCount: over.hitCount ?? 0,
  };
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/reading/rules", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("RuleInputSchema", () => {
  test("scope=topic ต้องมี topicId (ไม่งั้น throw)", () => {
    expect(() => RuleInputSchema.parse({ scope: "topic", match: "x" })).toThrow();
  });

  test("scope=global ไม่ต้องมี topicId + replacement default ว่าง", () => {
    const parsed = RuleInputSchema.parse({ scope: "global", match: "x" });
    expect(parsed.replacement).toBe("");
    expect(parsed.source).toEqual({ kind: "manual" });
  });

  test("match ว่าง → throw", () => {
    expect(() => RuleInputSchema.parse({ scope: "global", match: "" })).toThrow();
  });

  test("BatchRuleInputSchema ต้องมีอย่างน้อย 1 กฎ", () => {
    expect(() => BatchRuleInputSchema.parse({ rules: [] })).toThrow();
    const ok = BatchRuleInputSchema.parse({ rules: [{ scope: "global", match: "x" }] });
    expect(ok.rules).toHaveLength(1);
  });
});

describe("createListRulesHandler", () => {
  test("คืนรายการกฎจาก repository", async () => {
    const rules = [rule()];
    const repository = { listRules: vi.fn().mockResolvedValue(rules) };
    const GET = createListRulesHandler({ repository });

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ rules });
    expect(repository.listRules).toHaveBeenCalledTimes(1);
  });
});

describe("createSaveRuleHandler (single)", () => {
  test("upsert กฎเดี่ยว แล้วคืน { rule, rules }", async () => {
    const saved = rule();
    const repository = {
      upsertRule: vi.fn().mockResolvedValue(saved),
      upsertRules: vi.fn(),
      listRules: vi.fn().mockResolvedValue([saved]),
    };
    const POST = createSaveRuleHandler({ repository });

    const res = await POST(
      postRequest({ scope: "topic", topicId: "wealth", match: "ได้เงินแบบรายเดือน", replacement: "passive income" }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ rule: saved, rules: [saved] });
    expect(repository.upsertRule).toHaveBeenCalledTimes(1);
    expect(repository.upsertRules).not.toHaveBeenCalled();
  });

  test("body ไม่ใช่ JSON → 400", async () => {
    const repository = { upsertRule: vi.fn(), upsertRules: vi.fn(), listRules: vi.fn() };
    const POST = createSaveRuleHandler({ repository });

    const res = await POST(postRequest("{ not json"));
    expect(res.status).toBe(400);
    expect(repository.upsertRule).not.toHaveBeenCalled();
  });

  test("scope=topic ไม่มี topicId → 400 และไม่แตะ repository", async () => {
    const repository = { upsertRule: vi.fn(), upsertRules: vi.fn(), listRules: vi.fn() };
    const POST = createSaveRuleHandler({ repository });

    const res = await POST(postRequest({ scope: "topic", match: "x" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { message?: string } };
    expect(body.error?.message).toContain("topicId");
    expect(repository.upsertRule).not.toHaveBeenCalled();
  });
});

describe("createSaveRuleHandler (batch — บันทึกเป็นกฎทั้งหมด)", () => {
  test("upsert หลายกฎในครั้งเดียว แล้วคืน { rules }", async () => {
    const all = [rule({ id: "a", match: "m1" }), rule({ id: "b", match: "m2" })];
    const repository = {
      upsertRule: vi.fn(),
      upsertRules: vi.fn().mockResolvedValue(all),
      listRules: vi.fn(),
    };
    const POST = createSaveRuleHandler({ repository });

    const res = await POST(
      postRequest({
        rules: [
          { scope: "topic", topicId: "wealth", match: "m1", replacement: "r1" },
          { scope: "topic", topicId: "wealth", match: "m2", replacement: "r2" },
        ],
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ rules: all });
    expect(repository.upsertRules).toHaveBeenCalledTimes(1);
    expect(repository.upsertRules.mock.calls[0][0]).toHaveLength(2);
    expect(repository.upsertRule).not.toHaveBeenCalled();
  });

  test("batch ที่มีกฎ invalid (topic ไม่มี topicId) → 400", async () => {
    const repository = { upsertRule: vi.fn(), upsertRules: vi.fn(), listRules: vi.fn() };
    const POST = createSaveRuleHandler({ repository });

    const res = await POST(postRequest({ rules: [{ scope: "topic", match: "m1" }] }));
    expect(res.status).toBe(400);
    expect(repository.upsertRules).not.toHaveBeenCalled();
  });
});

describe("createDeleteRuleHandler", () => {
  test("ลบตาม id แล้วคืนรายการที่เหลือ", async () => {
    const remaining = [rule({ id: "keep" })];
    const repository = { deleteRule: vi.fn().mockResolvedValue(remaining) };
    const DELETE = createDeleteRuleHandler({ repository });

    const res = await DELETE(new Request("http://localhost/api/reading/rules?id=gone", { method: "DELETE" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ rules: remaining });
    expect(repository.deleteRule).toHaveBeenCalledWith("gone");
  });

  test("ไม่ส่ง id → 400 และไม่แตะ repository", async () => {
    const repository = { deleteRule: vi.fn() };
    const DELETE = createDeleteRuleHandler({ repository });

    const res = await DELETE(new Request("http://localhost/api/reading/rules", { method: "DELETE" }));
    expect(res.status).toBe(400);
    expect(repository.deleteRule).not.toHaveBeenCalled();
  });
});
