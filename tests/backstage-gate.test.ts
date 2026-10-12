import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BACKSTAGE_COOKIE, BACKSTAGE_HEADER, BACKSTAGE_LOGIN_PATH, cookieValueFor, safeNext } from "@/lib/backstage/gate";
import { proxy } from "@/proxy";

const KEY = "test-backstage-key-0123456789";
const HOST = "https://bazi-sft.staging.mumate.co";

function req(path: string, init: { method?: string; stamped?: boolean; cookie?: string; accept?: string; body?: BodyInit } = {}) {
  const headers = new Headers();
  if (init.stamped !== false) headers.set(BACKSTAGE_HEADER, "1");
  if (init.cookie) headers.set("cookie", `${BACKSTAGE_COOKIE}=${init.cookie}`);
  headers.set("accept", init.accept ?? "text/html,application/xhtml+xml");
  if (init.body instanceof URLSearchParams) headers.set("content-type", "application/x-www-form-urlencoded");
  return new NextRequest(`${HOST}${path}`, { method: init.method ?? "GET", headers, body: init.body });
}

const passes = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("backstage passkey gate (src/proxy.ts)", () => {
  const saved = process.env.BACKSTAGE_KEY;
  beforeEach(() => {
    process.env.BACKSTAGE_KEY = KEY;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.BACKSTAGE_KEY;
    else process.env.BACKSTAGE_KEY = saved;
  });

  it("lets unstamped requests through untouched (FE internal calls, staging)", async () => {
    expect(passes(await proxy(req("/api/fengshui/predict", { method: "POST", stamped: false, accept: "application/json" })))).toBe(true);
    delete process.env.BACKSTAGE_KEY;
    expect(passes(await proxy(req("/reading/doctrine-config", { stamped: false })))).toBe(true);
  });

  it("fails closed when a stamped request arrives and the key is missing or too short", async () => {
    delete process.env.BACKSTAGE_KEY;
    expect((await proxy(req("/reading/doctrine-config"))).status).toBe(503);
    process.env.BACKSTAGE_KEY = "short";
    expect((await proxy(req("/reading/doctrine-config"))).status).toBe(503);
  });

  it("shows the passkey form for a page without a cookie, remembering where to go", async () => {
    const res = await proxy(req("/reading/doctrine-config?tab=a"));
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).toContain(`action="${BACKSTAGE_LOGIN_PATH}"`);
    expect(body).toContain('value="/reading/doctrine-config?tab=a"');
    expect(body).not.toContain(KEY);
  });

  it("refuses API calls without a cookie as JSON", async () => {
    const res = await proxy(req("/api/reading/doctrine", { method: "PUT", accept: "application/json" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "backstage passkey required" });
  });

  it("rejects a wrong passkey with the form again and no cookie", async () => {
    const res = await proxy(req(BACKSTAGE_LOGIN_PATH, { method: "POST", body: new URLSearchParams({ key: "wrong-key-wrong-key", next: "/almanac" }) }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.text()).toContain("passkey ไม่ถูกต้อง");
  });

  it("accepts the right passkey: a hashed cookie, never the key, and a relative redirect back", async () => {
    const res = await proxy(req(BACKSTAGE_LOGIN_PATH, { method: "POST", body: new URLSearchParams({ key: KEY, next: "/almanac" }) }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/almanac");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${BACKSTAGE_COOKIE}=${await cookieValueFor(KEY)}`);
    expect(setCookie).not.toContain(KEY);
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("secure");
  });

  it("lets a request with the right cookie through, and not one with a stale cookie", async () => {
    expect(passes(await proxy(req("/reading/doctrine-config", { cookie: await cookieValueFor(KEY) })))).toBe(true);
    expect((await proxy(req("/reading/doctrine-config", { cookie: await cookieValueFor("an-older-key-0123456") }))).status).toBe(401);
  });

  it("never redirects off-site after login", async () => {
    for (const next of ["//evil.example/x", "https://evil.example", "/\\evil.example", "", "almanac"]) {
      expect(safeNext(next)).toBe("/");
    }
    const res = await proxy(req(BACKSTAGE_LOGIN_PATH, { method: "POST", body: new URLSearchParams({ key: KEY, next: "//evil.example" }) }));
    expect(res.headers.get("location")).toBe("/");
  });
});
