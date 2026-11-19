import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const ledger = vi.hoisted(() => ({ applyLedger: vi.fn() }));
vi.mock("@/lib/bazi/manifest/ledger", () => ({ applyLedger: ledger.applyLedger }));
const dbm = vi.hoisted(() => ({ createDbClient: vi.fn() }));
vi.mock("@/db/client", () => ({ createDbClient: dbm.createDbClient }));

import { POST as packetPOST } from "@/app/api/taisui/packet/route";
import {
  PACKET_MAX_PER_RECEIVER_PER_DAY,
  PACKET_MAX_PER_SENDER_PER_DAY,
  drawPacketQi,
  openPacket,
  releaseLantern,
} from "@/features/taisui/rewards";

// A scripted stand-in for the drizzle chains rewards.ts uses. Each terminal call takes the next
// scripted result in order: select → [rows], insert → [returned rows], delete → [].
function fakeDb(results: unknown[][]) {
  const queue = [...results];
  const calls: string[] = [];
  const next = () => Promise.resolve(queue.shift() ?? []);
  const chain = (kind: string): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    for (const m of ["from", "where", "values", "onConflictDoNothing"]) c[m] = () => c;
    c.limit = () => next();
    c.returning = () => next();
    c.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => next().then(ok, bad);
    calls.push(kind);
    return c;
  };
  return {
    db: { select: () => chain("select"), insert: () => chain("insert"), delete: () => chain("delete") } as never,
    calls,
  };
}

const SENDER = [{ anonId: "sender-marker" }];

describe("drawPacketQi", () => {
  test("draws from 5 to 10 inclusive (owner, revision 0.8)", () => {
    expect(drawPacketQi((min) => min)).toBe(5);
    expect(drawPacketQi((_min, maxExclusive) => maxExclusive - 1)).toBe(10);
    for (let i = 0; i < 200; i++) {
      const q = drawPacketQi();
      expect(q).toBeGreaterThanOrEqual(5);
      expect(q).toBeLessThanOrEqual(10);
    }
  });
});

describe("openPacket", () => {
  beforeEach(() => ledger.applyLedger.mockReset());

  test("an unknown code pays nothing", async () => {
    const { db } = fakeDb([[]]);
    expect(await openPacket("receiver-marker", "MUMATE12345", db)).toEqual({ paid: false, reason: "unknown_code" });
  });

  test("your own packet pays nothing", async () => {
    const { db } = fakeDb([[{ anonId: "receiver-marker" }]]);
    expect(await openPacket("receiver-marker", "MUMATE12345", db)).toEqual({ paid: false, reason: "own_packet" });
  });

  test("the receiver's daily cap stops the fourth packet", async () => {
    const { db } = fakeDb([SENDER, [{ n: PACKET_MAX_PER_RECEIVER_PER_DAY }]]);
    expect(await openPacket("receiver-marker", "MUMATE12345", db)).toEqual({ paid: false, reason: "receiver_daily_cap" });
    expect(ledger.applyLedger).not.toHaveBeenCalled();
  });

  test("the sender's daily cap stops a farm of receivers", async () => {
    const { db } = fakeDb([SENDER, [{ n: 0 }], [{ n: PACKET_MAX_PER_SENDER_PER_DAY }]]);
    expect(await openPacket("receiver-marker", "MUMATE12345", db)).toEqual({ paid: false, reason: "sender_daily_cap" });
  });

  test("a second open of the same sender's packet pays nothing", async () => {
    const { db } = fakeDb([SENDER, [{ n: 0 }], [{ n: 0 }], []]);
    expect(await openPacket("receiver-marker", "MUMATE12345", db)).toEqual({ paid: false, reason: "already_opened" });
    expect(ledger.applyLedger).not.toHaveBeenCalled();
  });

  test("a first open pays 5 to 10 QI to the receiver, with the sender as the reference", async () => {
    ledger.applyLedger.mockResolvedValue({ coins: 0, xp: 0, qi: 99 });
    const { db } = fakeDb([SENDER, [{ n: 0 }], [{ n: 0 }], [{ code: "taisui_packet" }]]);
    const r = await openPacket("receiver-marker", "MUMATE12345", db);
    expect(r.paid).toBe(true);
    const call = ledger.applyLedger.mock.calls[0][0];
    expect(call).toMatchObject({ anonId: "receiver-marker", reason: "qi:earn:taisui_packet", ref: "sender-marker" });
    expect(call.qiDelta).toBeGreaterThanOrEqual(5);
    expect(call.qiDelta).toBeLessThanOrEqual(10);
    if (r.paid) expect(r.qi).toBe(call.qiDelta);
  });

  test("a failed ledger write gives the claim back and fails loudly", async () => {
    ledger.applyLedger.mockResolvedValue(null);
    const { db, calls } = fakeDb([SENDER, [{ n: 0 }], [{ n: 0 }], [{ code: "taisui_packet" }], []]);
    await expect(openPacket("receiver-marker", "MUMATE12345", db)).rejects.toThrow("ledger_write_failed");
    expect(calls.at(-1)).toBe("delete");
  });
});

describe("releaseLantern", () => {
  test("one lantern per member; the count comes back either way", async () => {
    const first = fakeDb([[{ code: "taisui_lantern" }], [{ n: 7 }]]);
    expect(await releaseLantern("member-marker", first.db)).toEqual({ released: true, count: 7 });
    const again = fakeDb([[], [{ n: 7 }]]);
    expect(await releaseLantern("member-marker", again.db)).toEqual({ released: false, count: 7 });
  });
});

describe("POST /api/taisui/packet", () => {
  const secret = "taisui-test-client-only";
  beforeEach(() => {
    vi.stubEnv("BAZI_CLIENT_ID_SECRET", secret);
    vi.spyOn(console, "error").mockImplementation(() => {});
    dbm.createDbClient.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  const req = (body: unknown, withSecret = true) =>
    new Request("http://localhost/api/taisui/packet", {
      method: "POST",
      headers: { "content-type": "application/json", ...(withSecret ? { "x-mumate-client-secret": secret } : {}) },
      body: JSON.stringify(body),
    });

  test("refuses an untrusted caller and malformed codes before touching the database", async () => {
    expect((await packetPOST(req({ anonId: "a", code: "MUMATE12345" }, false))).status).toBe(403);
    expect((await packetPOST(req({ anonId: "a", code: "MUMATE12" }))).status).toBe(400);
    expect((await packetPOST(req({ code: "MUMATE12345" }))).status).toBe(400);
    expect(dbm.createDbClient).not.toHaveBeenCalled();
  });
});
