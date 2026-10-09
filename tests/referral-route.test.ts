import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({ createDbClient: vi.fn() }));
vi.mock("@/db/client", () => ({ createDbClient: fixture.createDbClient }));

import { GET, POST } from "@/app/api/referral/route";

const clientSecret = "referral-test-client-only";
function request(query = "anonId=private-member-marker", requestId?: string) {
  return new Request(`http://localhost/api/referral?${query}`, {
    headers: { "x-mumate-client-secret": clientSecret, ...(requestId ? { "x-request-id": requestId } : {}) },
  });
}

describe("referral GET failure and input contract", () => {
  beforeEach(() => {
    vi.stubEnv("BAZI_CLIENT_ID_SECRET", clientSecret);
    fixture.createDbClient.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  test("refuses an untrusted caller before touching the database", async () => {
    const response = await GET(new Request("http://localhost/api/referral?anonId=member"));
    expect(response.status).toBe(403);
    expect(fixture.createDbClient).not.toHaveBeenCalled();
  });

  test("missing member and malformed invite code stay 400 without database calls", async () => {
    expect((await GET(request(""))).status).toBe(400);
    expect((await GET(request("code=invalid"))).status).toBe(400);
    expect(fixture.createDbClient).not.toHaveBeenCalled();
  });

  test("logs only safe nested database metadata and a valid request ID", async () => {
    const requestId = "1b2b21a9-b2ea-4bce-8742-cde78d34e9f0";
    fixture.createDbClient.mockImplementation(() => {
      throw new Error("Failed query: secret-query-marker params: private-member-marker", {
        cause: Object.assign(new Error("secret-cause-marker"), { code: "08006", constraint_name: "bazi_referral_code_code_uq" }),
      });
    });
    const response = await GET(request(undefined, requestId));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
    expect(JSON.parse(vi.mocked(console.error).mock.calls[0][0])).toEqual({
      event: "referral_get_failed", attempts: 0, sqlstate: "08006", constraint: "bazi_referral_code_code_uq", request_id: requestId,
    });
    expect(JSON.stringify([body, vi.mocked(console.error).mock.calls])).not.toMatch(/secret-|private-member-marker|params:/);
  });

  test("does not log arbitrary error fields or an untrusted request-ID header", async () => {
    fixture.createDbClient.mockImplementation(() => { throw { code: "secret-code-marker", constraint_name: "secret-constraint-marker", cause: null }; });
    expect((await GET(request(undefined, "secret-header-marker"))).status).toBe(500);
    expect(JSON.parse(vi.mocked(console.error).mock.calls[0][0])).toEqual({ event: "referral_get_failed", attempts: 0 });
  });

  test("POST validation still refuses malformed codes without a database write", async () => {
    const response = await POST(new Request("http://localhost/api/referral", {
      method: "POST", headers: { "x-mumate-client-secret": clientSecret, "content-type": "application/json" },
      body: JSON.stringify({ anonId: "member", code: "bad" }),
    }));
    expect(response.status).toBe(400);
    expect(fixture.createDbClient).not.toHaveBeenCalled();
  });
});
