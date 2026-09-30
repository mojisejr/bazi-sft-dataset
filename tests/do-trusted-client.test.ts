/**
 * mumate-vercel-to-do-001 slice 2 — rate limit / โควตาของ bazi เป็นรายผู้ใช้ ไม่ใช่รายเครื่อง FE
 * FE ส่ง x-mumate-client-ip + x-mumate-client-secret; bazi เชื่อเฉพาะเมื่อ secret ตรงกับ BAZI_CLIENT_ID_SECRET
 */
import { describe, expect, test } from "vitest";

import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const SECRET = "s".repeat(43);
const req = (headers: Record<string, string>) => new Request("http://bazi:3000/api/what-if/generate", { headers });

describe("clientIp", () => {
  test("Vercel path unchanged: no secret configured → x-forwarded-for, forged headers ignored", () => {
    const r = req({ "x-forwarded-for": "76.76.21.1, 10.0.0.1", "x-mumate-client-ip": "1.2.3.4", "x-mumate-client-secret": SECRET });
    expect(clientIp(r, {})).toBe("76.76.21.1");
  });

  test("no header at all (FE → http://bazi:3000 inside compose) is still 'unknown' without the secret", () => {
    expect(clientIp(req({}), {})).toBe("unknown");
  });

  test("secret matches → the end user's IP from the FE", () => {
    const r = req({ "x-forwarded-for": "10.0.0.1", "x-mumate-client-ip": "203.0.113.9", "x-mumate-client-secret": SECRET });
    expect(clientIp(r, { BAZI_CLIENT_ID_SECRET: SECRET })).toBe("203.0.113.9");
    const v6 = req({ "x-mumate-client-ip": "2001:db8::1", "x-mumate-client-secret": SECRET });
    expect(clientIp(v6, { BAZI_CLIENT_ID_SECRET: SECRET })).toBe("2001:db8::1");
  });

  test("wrong or missing secret → header ignored, falls back", () => {
    const wrong = req({ "x-forwarded-for": "10.0.0.1", "x-mumate-client-ip": "203.0.113.9", "x-mumate-client-secret": "nope" });
    expect(clientIp(wrong, { BAZI_CLIENT_ID_SECRET: SECRET })).toBe("10.0.0.1");
    const none = req({ "x-mumate-client-ip": "203.0.113.9" });
    expect(clientIp(none, { BAZI_CLIENT_ID_SECRET: SECRET })).toBe("unknown");
  });

  test("a non-IP value is not used as a bucket key", () => {
    const r = req({ "x-mumate-client-ip": "evil; key", "x-mumate-client-secret": SECRET });
    expect(clientIp(r, { BAZI_CLIENT_ID_SECRET: SECRET })).toBe("unknown");
  });
});

describe("per-user buckets", () => {
  test("one user hitting the per-minute limit does not block another", () => {
    const env = { BAZI_CLIENT_ID_SECRET: SECRET };
    const a = clientIp(req({ "x-mumate-client-ip": "198.51.100.1", "x-mumate-client-secret": SECRET }), env);
    const b = clientIp(req({ "x-mumate-client-ip": "198.51.100.2", "x-mumate-client-secret": SECRET }), env);
    let blockedA = null;
    for (let i = 0; i < 100 && !blockedA; i++) blockedA = checkRateLimit("do-trusted-client-test", a, false);
    expect(blockedA?.status).toBe(429);
    expect(checkRateLimit("do-trusted-client-test", b, false)).toBeNull();
  });
});
