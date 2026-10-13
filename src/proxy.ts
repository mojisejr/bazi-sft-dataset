import { NextResponse, type NextRequest } from "next/server";

import {
  BACKSTAGE_COOKIE_MAX_AGE,
  cookieValueFor,
  decide,
  DOORS,
  doorOf,
  loginFormHtml,
  safeNext,
  sameSecret,
  usableKey,
} from "@/lib/backstage/gate";

// Next 16 "proxy" (formerly middleware). Its only job today is the passkey gate (backstage and bdash doors); see
// src/lib/backstage/gate.ts. Unstamped requests (the FE's internal calls, staging, tests) return NextResponse.next() at once.
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const door = doorOf(request.headers) ?? "backstage";
  const cfg = DOORS[door];
  const decision = await decide({
    stamped: doorOf(request.headers) !== null,
    door,
    key: process.env[cfg.envKey],
    method: request.method,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    cookie: request.cookies.get(cfg.cookie)?.value,
    wantsHtml: (request.headers.get("accept") ?? "").includes("text/html"),
  });

  switch (decision.kind) {
    case "pass":
      return NextResponse.next();
    case "misconfigured":
      return new NextResponse("backstage is not configured", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    case "not-found":
      return new NextResponse("not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    case "login-form":
      return html(loginFormHtml(decision.next, false, door), decision.status);
    case "api-denied":
      return NextResponse.json({ error: "backstage passkey required" }, { status: 401, headers: { "cache-control": "no-store" } });
    case "login-check": {
      const key = usableKey(process.env[cfg.envKey])!;
      const form = await request.formData().catch(() => null);
      const given = String(form?.get("key") ?? "").trim();
      const asked = safeNext(String(form?.get("next") ?? cfg.home));
      const next = asked === "/" ? cfg.home : asked;
      const expected = await cookieValueFor(key, door);
      if (!given || !sameSecret(await cookieValueFor(given, door), expected)) {
        return html(loginFormHtml(next, true, door), 401);
      }
      // Absolute Location built from the public host: the Next runtime rejects a relative one ("Invalid URL", a 500 seen
      // on staging 2026-10-12), and request.url carries the container's own http/internal address behind Caddy.
      // Host is safe here: Caddy only routes a request to this app when Host is the backstage site's name.
      const res = new NextResponse(null, { status: 303, headers: { location: absoluteBack(request, next) } });
      res.cookies.set(cfg.cookie, expected, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: BACKSTAGE_COOKIE_MAX_AGE,
      });
      res.headers.set("cache-control", "no-store");
      return res;
    }
  }
}

function absoluteBack(request: NextRequest, next: string): string {
  const host = request.headers.get("host");
  return host ? `https://${host}${next}` : new URL(next, request.nextUrl.origin).toString();
}

function html(body: string, status: number): NextResponse {
  return new NextResponse(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
