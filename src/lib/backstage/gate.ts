// Backstage passkey gate (mumate-bazi-backstage-001, owner 2026-10-12).
// bazi's own pages (doctrine, knowledge, almanac, sacred-map, ops …) are reachable from the internet again at
// bazi-sft.staging.mumate.co (a production host despite the name) for เอ็ม and ซินแส, behind one passkey — the same
// value as the FE /ops key. Caddy's site for that host stamps every request with `x-mumate-backstage: 1`; only stamped
// requests are gated, so the FE's internal calls (http://bazi:3000, never through Caddy) and staging are untouched.
// Fail closed: a stamped request while BACKSTAGE_KEY is missing answers 503, never the page.
// This is a door, not a login system: one shared key, an httpOnly cookie holding a hash of it, 30 days.
//
// A second door, bdash (mumate-business-metrics-001, owner 2026-10-13): the business dashboard's own host stamps
// `x-mumate-backstage: bdash`. That door has its own key (BDASH_KEY) and cookie, so the business team's passkey
// does not open the backstage host, and it serves /bdash only — every other path is 404 there, even with a valid
// cookie (Caddy's allowlist for that host is the first wall, this is the second).

export const BACKSTAGE_HEADER = "x-mumate-backstage";
export const BACKSTAGE_COOKIE = "mumate_backstage";
export const BACKSTAGE_LOGIN_PATH = "/__backstage/login";
export const BACKSTAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export const BACKSTAGE_MIN_KEY_LENGTH = 16;
export const BDASH_COOKIE = "mumate_bdash";
export const BDASH_HOME = "/bdash";

export type Door = "backstage" | "bdash";

type DoorConfig = { envKey: "BACKSTAGE_KEY" | "BDASH_KEY"; cookie: string; salt: string; title: string; home: string };

export const DOORS: Record<Door, DoorConfig> = {
  backstage: { envKey: "BACKSTAGE_KEY", cookie: BACKSTAGE_COOKIE, salt: "mumate-backstage:v1:", title: "bazi หลังบ้าน", home: "/" },
  bdash: { envKey: "BDASH_KEY", cookie: BDASH_COOKIE, salt: "mumate-bdash:v1:", title: "MuMate ภาพรวมธุรกิจ", home: BDASH_HOME },
};

export type GateDecision =
  | { kind: "pass" }
  | { kind: "misconfigured" }
  | { kind: "login-form"; next: string; status: 401 }
  | { kind: "login-check"; }
  | { kind: "api-denied" }
  | { kind: "not-found" };

/** Which door Caddy's site stamped this request with; null = not through a gated host (FE internal calls, staging). */
export function doorOf(headers: Headers): Door | null {
  const v = headers.get(BACKSTAGE_HEADER);
  return v === "1" ? "backstage" : v === "bdash" ? "bdash" : null;
}

export function isStamped(headers: Headers): boolean {
  return doorOf(headers) !== null;
}

/** The bdash door serves the dashboard, its login and Next's static files — nothing else. */
export function bdashAllows(pathname: string): boolean {
  return (
    pathname === BDASH_HOME ||
    pathname.startsWith(`${BDASH_HOME}/`) ||
    pathname === BACKSTAGE_LOGIN_PATH ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

export function usableKey(key: string | undefined): string | null {
  const trimmed = key?.trim() ?? "";
  return trimmed.length >= BACKSTAGE_MIN_KEY_LENGTH ? trimmed : null;
}

export async function cookieValueFor(key: string, door: Door = "backstage"): Promise<string> {
  const bytes = new TextEncoder().encode(`${DOORS[door].salt}${key}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Only a same-site path may follow the login: "/x" yes, "//evil.example" or "https://…" no.
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function loginFormHtml(next: string, wrong: boolean, door: Door = "backstage"): string {
  const title = DOORS[door].title;
  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,"Noto Sans Thai",sans-serif;background:#f7f5f0;color:#2b2b2b}
form{width:min(22rem,90vw);display:flex;flex-direction:column;gap:.75rem}h1{font-size:1.2rem;margin:0}
input{font-size:1rem;padding:.6rem .7rem;border:1px solid #bbb;border-radius:.4rem}button{font-size:1rem;padding:.6rem;border:0;border-radius:.4rem;background:#2b2b2b;color:#fff}
p{margin:0;color:#b00020}</style></head>
<body><form method="post" action="${BACKSTAGE_LOGIN_PATH}">
<h1>${title}</h1>
${wrong ? "<p>passkey ไม่ถูกต้อง</p>" : ""}
<input type="password" name="key" placeholder="passkey" autocomplete="current-password" required autofocus>
<input type="hidden" name="next" value="${escapeHtml(next)}">
<button type="submit">เข้าใช้งาน</button>
</form></body></html>`;
}

// What to do with a request, before any I/O on the body. `cookie` is the door's cookie value, if any.
export async function decide(input: {
  stamped: boolean;
  door?: Door;
  key: string | undefined;
  method: string;
  pathname: string;
  search: string;
  cookie: string | undefined;
  wantsHtml: boolean;
}): Promise<GateDecision> {
  if (!input.stamped) return { kind: "pass" };
  const door = input.door ?? "backstage";
  const key = usableKey(input.key);
  if (!key) return { kind: "misconfigured" };
  if (door === "bdash" && !bdashAllows(input.pathname)) return { kind: "not-found" };
  if (input.pathname === BACKSTAGE_LOGIN_PATH && input.method === "POST") return { kind: "login-check" };
  if (input.cookie && sameSecret(input.cookie, await cookieValueFor(key, door))) return { kind: "pass" };
  if (input.wantsHtml && (input.method === "GET" || input.method === "HEAD")) {
    const next = input.pathname === BACKSTAGE_LOGIN_PATH ? DOORS[door].home : safeNext(input.pathname + input.search);
    return { kind: "login-form", next, status: 401 };
  }
  return { kind: "api-denied" };
}
