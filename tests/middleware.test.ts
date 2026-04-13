import { beforeEach, describe, expect, test, vi } from "vitest";

const protect = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  createRouteMatcher: (patterns: string[]) => {
    const publicPrefixes = patterns
      .map((pattern) => pattern.replace("(.*)", ""))
      .filter(Boolean);

    return (request: { nextUrl: { pathname: string } }) =>
      publicPrefixes.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
  },
  clerkMiddleware: (
    handler: (auth: { protect: typeof protect }, request: { nextUrl: { pathname: string } }) =>
      Promise<void>,
  ) => handler,
}));

describe("proxy", () => {
  beforeEach(() => {
    protect.mockReset();
    protect.mockResolvedValue(undefined);
  });

  test("protects application routes by default", async () => {
    const proxyModule = await import("@/proxy");

    await proxyModule.proxy(
      { protect },
      { nextUrl: { pathname: "/" } },
    );

    expect(protect).toHaveBeenCalledTimes(1);
  });

  test("leaves the sign-in route public", async () => {
    const proxyModule = await import("@/proxy");

    await proxyModule.proxy(
      { protect },
      { nextUrl: { pathname: "/sign-in" } },
    );

    expect(protect).not.toHaveBeenCalled();
  });

  test("keeps the nextjs matcher configured for app and api routes", async () => {
    const proxyModule = await import("@/proxy");

    expect(proxyModule.config.matcher).toEqual([
      "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
      "/(api|trpc)(.*)",
    ]);
  });
});