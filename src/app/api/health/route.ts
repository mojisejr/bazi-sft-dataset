import { createDbSqlClient } from "@/db/client";
import { checkRuntimeFiles } from "@/lib/runtime-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — liveness AND readiness for the engine (mumate-infra-move-001 slice 1).
//
// Until this change the route returned four constants, which proved only that Node was up. A container
// orchestrator routing on that would happily send traffic to an engine whose database is unreachable or
// whose runtime knowledge files were never copied into the image. Now the route runs a real `select 1`
// through the same client every API route uses, checks the runtime-file manifest against process.cwd(),
// and answers 503 when either fails. The original fields are kept so nothing that read them breaks.
// Nothing about the connection is echoed; the SHA is the build argument, so every running container
// names the revision it was built from.
export async function GET() {
  const startedAt = Date.now();
  let db: "ok" | "error" = "ok";
  try {
    await createDbSqlClient()`select 1`;
  } catch {
    db = "error";
  }
  const files = checkRuntimeFiles();
  const healthy = db === "ok" && files.ok;

  return Response.json(
    {
      project: "bazi",
      phase: "2",
      status: healthy ? "symbolic-engine-ready" : "degraded",
      routes: ["/api/health", "/api/bazi/calculate"],
      db,
      dbLatencyMs: Date.now() - startedAt,
      runtimeFiles: files.ok ? "ok" : "missing",
      runtimeFilesMissing: files.missing,
      sha: process.env.APP_GIT_SHA ?? null,
      uptimeSec: Math.round(process.uptime()),
    },
    { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
