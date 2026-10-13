// The bdash door (mumate-business-metrics-001): the business dashboard host's own key and cookie, /bdash only.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BACKSTAGE_COOKIE, BACKSTAGE_HEADER, BACKSTAGE_LOGIN_PATH, BDASH_COOKIE, bdashAllows, cookieValueFor } from "@/lib/backstage/gate";
import { proxy } from "@/proxy";

const BDASH = "test-bdash-key-0123456789";
const BACKSTAGE = "test-backstage-key-0123456789";
const HOST = "https://bdash.staging.mumate.co";

type Init = { method?: string; stamp?: string | null; cookie?: string; accept?: string; body?: BodyInit };

function req(path: string, init: Init = {}) {
  const headers = new Headers();
  const stamp = init.stamp === undefined ? "bdash" : init.stamp;
  if (stamp) headers.set(BACKSTAGE_HEADER, stamp);
  if (init.cookie) headers.set("cookie", init.cookie);
  headers.set("accept", init.accept ?? "text/html,application/xhtml+xml");
  headers.set("host", "bdash.staging.mumate.co");
  if (init.body instanceof URLSearchParams) headers.set("content-type", "application/x-www-form-urlencoded");
  return new NextRequest(`${HOST}${path}`, { method: init.method ?? "GET", headers, body: init.body });
}

const passes = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("bdash door (src/proxy.ts)", () => {
  const saved = { bdash: process.env.BDASH_KEY, backstage: process.env.BACKSTAGE_KEY };
  beforeEach(() => {
    process.env.BDASH_KEY = BDASH;
    process.env.BACKSTAGE_KEY = BACKSTAGE;
  });
  afterEach(() => {
    for (const [k, v] of [["BDASH_KEY", saved.bdash], ["BACKSTAGE_KEY", saved.backstage]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("fails closed when BDASH_KEY is missing, even though BACKSTAGE_KEY is set", async () => {
    delete process.env.BDASH_KEY;
    expect((await proxy(req("/bdash"))).status).toBe(503);
  });

  it("answers 404 for anything but the dashboard on that host, cookie or not", async () => {
    const cookie = `${BDASH_COOKIE}=${await cookieValueFor(BDASH, "bdash")}`;
    for (const path of ["/", "/ops", "/api/ops/user-delete", "/api/ops/analytics", "/reading/doctrine-config", "/bdashx"]) {
      expect((await proxy(req(path))).status).toBe(404);
      expect((await proxy(req(path, { cookie, method: "POST", accept: "application/json" }))).status).toBe(404);
    }
  });

  it("allows only the dashboard, its login and Next's static files", () => {
    expect(bdashAllows("/bdash")).toBe(true);
    expect(bdashAllows("/bdash/anything")).toBe(true);
    expect(bdashAllows(BACKSTAGE_LOGIN_PATH)).toBe(true);
    expect(bdashAllows("/_next/static/x.js")).toBe(true);
    expect(bdashAllows("/api/cron/bdash-snapshot")).toBe(false);
  });

  it("shows its own login form for /bdash without a cookie", async () => {
    const res = await proxy(req("/bdash"));
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).toContain("MuMate ภาพรวมธุรกิจ");
    expect(body).toContain('value="/bdash"');
    expect(body).not.toContain(BDASH);
  });

  it("logs in with BDASH_KEY into its own cookie and lands on /bdash", async () => {
    const res = await proxy(req(BACKSTAGE_LOGIN_PATH, { method: "POST", body: new URLSearchParams({ key: BDASH, next: "/" }) }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://bdash.staging.mumate.co/bdash");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${BDASH_COOKIE}=${await cookieValueFor(BDASH, "bdash")}`);
    expect(setCookie).not.toContain(BACKSTAGE_COOKIE);
    expect(setCookie).not.toContain(BDASH);
  });

  it("does not take the backstage key, and the backstage cookie does not open it", async () => {
    const res = await proxy(req(BACKSTAGE_LOGIN_PATH, { method: "POST", body: new URLSearchParams({ key: BACKSTAGE, next: "/bdash" }) }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
    const backstageCookie = `${BACKSTAGE_COOKIE}=${await cookieValueFor(BACKSTAGE)}`;
    expect((await proxy(req("/bdash", { cookie: backstageCookie }))).status).toBe(401);
  });

  it("lets /bdash through with its cookie", async () => {
    const cookie = `${BDASH_COOKIE}=${await cookieValueFor(BDASH, "bdash")}`;
    expect(passes(await proxy(req("/bdash", { cookie })))).toBe(true);
  });

  it("the bdash cookie does not open the backstage host, even when both keys are the same value", async () => {
    process.env.BDASH_KEY = BACKSTAGE;
    const cookie = `${BACKSTAGE_COOKIE}=${await cookieValueFor(BACKSTAGE, "bdash")}`;
    expect((await proxy(req("/reading/doctrine-config", { stamp: "1", cookie }))).status).toBe(401);
  });

  it("an unknown stamp value is treated as unstamped (Caddy only ever sends 1 or bdash)", async () => {
    expect(passes(await proxy(req("/bdash", { stamp: "other" })))).toBe(true);
  });
});
