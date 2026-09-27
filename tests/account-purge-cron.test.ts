// tests/account-purge-cron.test.ts — 2026-09-27: /api/cron/account-purge ต้องล้างเฉพาะคำขอที่ยัง "pending".
// เดิม select แค่ purgeAt <= now → คนที่กด "ยกเลิกการลบ" (status canceled, purgeAt เดิมยังอยู่) โดนล้างข้อมูลตามวันเดิม
// และแถวที่ purged แล้วถูกวนลบซ้ำทุกคืน. เทสนี้ดักเงื่อนไข where ที่ส่งเข้า DB จริง ๆ แล้วแปลงเป็น SQL ตรวจ.
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captured: { where: SQL | undefined } = { where: undefined };
const rows: { anonId: string }[] = [];

vi.mock("@/db/client", () => ({
  createDbClient: () => ({
    select: () => ({
      from: () => ({
        where: async (cond: SQL) => {
          captured.where = cond;
          return rows;
        },
      }),
    }),
    delete: () => ({ where: async () => undefined }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  }),
}));

const { GET } = await import("@/app/api/cron/account-purge/route");

function authed() {
  return new Request("http://localhost/api/cron/account-purge", {
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

describe("account-purge cron — ล้างเฉพาะคำขอ pending", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
    captured.where = undefined;
    rows.length = 0;
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("where ต้องกรอง status = 'pending' คู่กับ purge_at <= now (คนที่ยกเลิกแล้วต้องไม่โดนล้าง)", async () => {
    const res = await GET(authed());
    expect(res.status).toBe(200);
    expect(captured.where).toBeDefined();
    const q = new PgDialect().sqlToQuery(captured.where!);
    expect(q.sql).toContain('"status" = $');
    expect(q.params).toContain("pending");
    expect(q.sql).toContain('"purge_at" <= $');
  });

  it("ไม่มี CRON_SECRET ที่ถูกต้อง → 401 และไม่แตะ DB", async () => {
    const res = await GET(new Request("http://localhost/api/cron/account-purge"));
    expect(res.status).toBe(401);
    expect(captured.where).toBeUndefined();
  });
});
