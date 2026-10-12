import { NextResponse, type NextRequest } from "next/server";

import {
  BACKSTAGE_COOKIE,
  BACKSTAGE_COOKIE_MAX_AGE,
  cookieValueFor,
  decide,
  isStamped,
  loginFormHtml,
  safeNext,
  sameSecret,
  usableKey,
} from "@/lib/backstage/gate";

// Next 16 "proxy" (formerly middleware). Its only job today is the backstage passkey gate; see src/lib/backstage/gate.ts.
// Unstamped requests (the FE's internal calls, staging, tests) return NextResponse.next() at once.
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const decision = await decide({
    stamped: isStamped(request.headers),
    key: process.env.BACKSTAGE_KEY,
    method: request.method,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    cookie: request.cookies.get(BACKSTAGE_COOKIE)?.value,
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
    case "login-form":
      return html(loginFormHtml(decision.next, false), decision.status);
    case "api-denied":
      return NextResponse.json({ error: "backstage passkey required" }, { status: 401, headers: { "cache-control": "no-store" } });
    case "login-check": {
      const key = usableKey(process.env.BACKSTAGE_KEY)!;
      const form = await request.formData().catch(() => null);
      const given = String(form?.get("key") ?? "").trim();
      const next = safeNext(String(form?.get("next") ?? "/"));
      const expected = await cookieValueFor(key);
      if (!given || !sameSecret(await cookieValueFor(given), expected)) {
        return html(loginFormHtml(next, true), 401);
      }
      // Absolute Location built from the public host: the Next runtime rejects a relative one ("Invalid URL", a 500 seen
      // on staging 2026-10-12), and request.url carries the container's own http/internal address behind Caddy.
      // Host is safe here: Caddy only routes a request to this app when Host is the backstage site's name.
      const res = new NextResponse(null, { status: 303, headers: { location: absoluteBack(request, next) } });
      res.cookies.set(BACKSTAGE_COOKIE, expected, {
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
