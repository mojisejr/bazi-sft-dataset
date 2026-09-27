/**
 * mumate-vercel-to-do-001 slice 2, step 7 — vercel.json is the one source of bazi's cron schedules.
 * The image carries it, so the DigitalOcean host's timers (slice 3) read the schedules from the image they call.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const cfg = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons?: { path: string; schedule: string }[] };
const crons = cfg.crons ?? [];

describe("vercel.json crons", () => {
  it("exist", () => {
    expect(crons.length).toBeGreaterThan(0);
  });

  it.each(crons)("$path is a real route", ({ path }) => {
    expect(existsSync(join("src", "app", path, "route.ts"))).toBe(true);
  });

  it.each(crons)("$schedule is a plain five-field cron a systemd timer can mirror (minute and hour fixed or *)", ({ schedule }) => {
    expect(schedule).toMatch(/^(\*|\*\/\d+|\d+) (\*|\d+) \* \* \*$/);
  });

  it("the runtime image carries vercel.json, and .dockerignore does not drop it", () => {
    const dockerfile = readFileSync("Dockerfile", "utf8");
    const runner = dockerfile.slice(dockerfile.lastIndexOf("AS runner"));
    expect(runner).toMatch(/^COPY --from=builder [^\n]*\/app\/vercel\.json \.\/vercel\.json$/m);
    const ignore = existsSync(".dockerignore") ? readFileSync(".dockerignore", "utf8") : "";
    expect(ignore.split("\n").map((l) => l.trim())).not.toContain("vercel.json");
  });
});
