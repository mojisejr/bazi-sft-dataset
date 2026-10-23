// /api/cron/ai-question-purge (CIEL mumate-pdpa-reconsent-001 plan 0.3) — ลบคำถามในคลังที่ครบ 2 ปี ทุกวัน, ต้องมี CRON_SECRET
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const executed: string[] = [];
vi.mock("@/db/client", () => ({
  createDbClient: () => ({
    execute: async (q: { queryChunks?: unknown[] }) => {
      executed.push(JSON.stringify(q?.queryChunks ?? q));
      return { rows: [{ id: "a" }, { id: "b" }] };
    },
  }),
}));

const { GET } = await import("@/app/api/cron/ai-question-purge/route");
const { AI_QUESTION_RETENTION_DAYS } = await import("@/lib/bazi/ai-question-log");

describe("ai-question-purge cron", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
    executed.length = 0;
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("ลบเฉพาะแถวที่เก่ากว่า 730 วัน แล้วบอกจำนวน", async () => {
    const res = await GET(new Request("http://localhost/api/cron/ai-question-purge", { headers: { authorization: "Bearer test-cron-secret" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deleted: 2 });
    expect(AI_QUESTION_RETENTION_DAYS).toBe(730);
    expect(executed).toHaveLength(1);
    expect(executed[0]).toContain("DELETE FROM ai_question_log WHERE created_at < now() - (");
    expect(executed[0]).toContain('"730"');
  });

  it("ไม่มี secret หรือผิด → 401 และไม่แตะ DB", async () => {
    expect((await GET(new Request("http://localhost/api/cron/ai-question-purge"))).status).toBe(401);
    expect((await GET(new Request("http://localhost/api/cron/ai-question-purge", { headers: { authorization: "Bearer nope" } }))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await GET(new Request("http://localhost/api/cron/ai-question-purge", { headers: { authorization: "Bearer undefined" } }))).status).toBe(401);
    expect(executed).toHaveLength(0);
  });
});
