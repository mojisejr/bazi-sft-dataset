import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * ทดสอบ engine ระบบกิจกรรม (แต้ม Qi) แบบแยกส่วน — mock ledger/entitlements/claim-db
 * ครอบคลุม: earn เพดาน (once/daily ครั้งที่ 2 = capped), spend ยอดไม่พอ (409),
 *           spend สำเร็จ (มอบสิทธิ์จริง), grant ล้ม → refund คืนแต้ม.
 */

// ── in-memory qi wallet (แทน applyLedger จริง) ───────────────────────────
const qiBalance = new Map<string, number>();
function applyLedgerFake(input: { anonId: string; qiDelta?: number }) {
  const cur = qiBalance.get(input.anonId) ?? 0;
  const next = cur + (input.qiDelta ?? 0);
  if (next < 0) return Promise.resolve(null); // กันติดลบ
  qiBalance.set(input.anonId, next);
  return Promise.resolve({ coins: 0, xp: 0, qi: next });
}

vi.mock("@/lib/bazi/manifest/ledger", () => ({
  applyLedger: vi.fn(applyLedgerFake),
  getWallet: vi.fn((anonId: string) =>
    Promise.resolve({ coins: 0, xp: 0, qi: qiBalance.get(anonId) ?? 0 }),
  ),
  levelOfXp: () => ({ level: 1, nextLevelXp: 1000, levelStartXp: 0 }),
}));

// ── grant สิทธิ์ (mock — ทำให้ throw ได้เพื่อทดสอบ refund) ─────────────────
const grantEntitlement = vi.fn(() => Promise.resolve());
vi.mock("@/lib/bazi/qi/entitlements", () => ({
  grantEntitlement: (...args: unknown[]) => grantEntitlement(...(args as [])),
}));

// ── claim table in-memory (แทน bazi_qi_claim) ────────────────────────────
const claims = new Set<string>();
vi.mock("@/db/client", () => ({
  createDbClient: () => ({
    insert: () => ({
      values: (v: { anonId: string; code: string; periodKey: string }) => ({
        onConflictDoNothing: () => ({
          returning: () => {
            const key = `${v.anonId}|${v.code}|${v.periodKey}`;
            if (claims.has(key)) return Promise.resolve([]); // ชน = capped
            claims.add(key);
            return Promise.resolve([{ code: v.code }]);
          },
        }),
      }),
    }),
  }),
}));

const { earnQi, spendQi, QiError } = await import("@/lib/bazi/qi/engine");

beforeEach(() => {
  qiBalance.clear();
  claims.clear();
  grantEntitlement.mockReset();
  grantEntitlement.mockResolvedValue(undefined);
});

describe("earnQi — เพดานต่อเส้น", () => {
  test("signup (once): ครั้งแรกได้ +50, ครั้งที่สอง capped", async () => {
    const first = await earnQi("u1", "signup");
    expect(first.awarded).toBe(true);
    expect(first.balance.qi).toBe(50);

    const second = await earnQi("u1", "signup");
    expect(second.awarded).toBe(false);
    expect(second.capped).toBe(true);
    expect(second.balance.qi).toBe(50); // ยอดไม่เพิ่ม
  });

  test("daily_login (daily): วันเดียวกันได้ครั้งเดียว", async () => {
    const first = await earnQi("u2", "daily_login");
    expect(first.awarded).toBe(true);
    expect(first.balance.qi).toBe(5);
    const second = await earnQi("u2", "daily_login");
    expect(second.capped).toBe(true);
  });

  test("referral_free (per_referral): ต่างผู้ถูกชวนได้แยกกัน, คนเดิมซ้ำ = capped", async () => {
    const a = await earnQi("host", "referral_free", "friendA");
    const b = await earnQi("host", "referral_free", "friendB");
    const aAgain = await earnQi("host", "referral_free", "friendA");
    expect(a.awarded).toBe(true);
    expect(b.awarded).toBe(true);
    expect(aAgain.capped).toBe(true);
    expect(b.balance.qi).toBe(100); // 50 + 50
  });

  test("code ที่ไม่รู้จัก → QiError 404", async () => {
    await expect(earnQi("u", "nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("spendQi — หัก + มอบสิทธิ์", () => {
  test("ยอดไม่พอ → QiError 409, ไม่ grant", async () => {
    await expect(spendQi("poor", "card_use")).rejects.toBeInstanceOf(QiError);
    await expect(spendQi("poor", "card_use")).rejects.toMatchObject({ status: 409 });
    expect(grantEntitlement).not.toHaveBeenCalled();
  });

  test("ยอดพอ → หัก 10 + grant card_use", async () => {
    qiBalance.set("rich", 100);
    const res = await spendQi("rich", "card_use");
    expect(res.qi).toBe(10);
    expect(res.balance.qi).toBe(90);
    expect(grantEntitlement).toHaveBeenCalledWith("rich", {
      type: "credit",
      kind: "card_use",
      credits: 1,
    });
  });

  test("grant ล้ม → refund คืนแต้ม + QiError 500", async () => {
    qiBalance.set("u", 500);
    grantEntitlement.mockRejectedValueOnce(new Error("db down"));
    await expect(spendQi("u", "course_destiny")).rejects.toMatchObject({ status: 500 });
    expect(qiBalance.get("u")).toBe(500); // หัก 500 แล้วคืน 500
  });
});
