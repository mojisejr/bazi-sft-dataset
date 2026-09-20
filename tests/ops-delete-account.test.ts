// tests/ops-delete-account.test.ts — 2026-09-20: /ops ปุ่มลบบัญชี (ลบออกจาก data → สมัคร LINE ใหม่ได้).
// deleteAccountEverywhere ต้องลบครบทุก target (7 ตาราง), นับแถวจริง, และ best-effort (target พังไม่ล้มทั้งชุด).
import { describe, expect, it, vi } from "vitest";

import { deleteAccountEverywhere } from "@/lib/bazi/ops/delete-account";

function makeDb(opts: { throwOnCall?: number; count?: number } = {}) {
  let n = 0;
  const execute = vi.fn(async () => {
    n += 1;
    if (opts.throwOnCall === n) throw new Error("boom");
    return { count: opts.count ?? 1 };
  });
  return { db: { execute } as never, execute };
}

describe("deleteAccountEverywhere — ลบบัญชีออกจาก data (scoped, best-effort)", () => {
  it("ลบครบทุก target แล้วคืน count ต่อ table", async () => {
    const { db, execute } = makeDb({ count: 2 });
    const r = await deleteAccountEverywhere(db, "anon-1");
    expect(execute).toHaveBeenCalledTimes(7); // user_provider..user
    expect(r.errors).toEqual([]);
    expect(r.deleted.user_provider).toBe(2); // ★ ตัวชี้ขาด (LINE mapping)
    expect(r.deleted.user).toBe(2); // identity ท้ายสุด
  });

  it("target หนึ่งพัง → ตัวอื่นยังลบต่อ + บันทึก error (best-effort)", async () => {
    const { db, execute } = makeDb({ throwOnCall: 3 });
    const r = await deleteAccountEverywhere(db, "anon-2");
    expect(execute).toHaveBeenCalledTimes(7); // ไม่หยุดกลางคัน
    expect(r.errors.length).toBe(1);
  });
});
