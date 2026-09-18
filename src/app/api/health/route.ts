import { createDbSqlClient } from "@/db/client";
import { checkRuntimeFiles } from "@/lib/runtime-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — liveness AND readiness for the engine (mumate-infra-move-001 slice 1).
//
// Until this change the route returned four constants, which proved only that Node was up. A container
// orchestrator routing on that would happily send traffic to an engine whose database is unreachable or
// whose runtime knowledge files were never copied into the image. Now the route runs a real `select 1`
// through the same client every API route uses and answers 503 when it fails. The original fields are
// kept so nothing that read them breaks. Nothing about the connection is echoed; the SHA is the build
// argument, so every running container names the revision it was built from.
//
// The runtime-file manifest is checked ONLY inside the container (Dockerfile sets APP_RUNTIME=container and
// APP_RUNTIME_ROOT=/app, the standalone root it populated). On Vercel each function carries its own traced
// files and this route's function does not carry the knowledge tree, so the check would report "missing" for
// files the real routes do have; there it says "not-checked" and never affects the status. The root comes
// from env, never process.cwd(): see checkRuntimeFiles for why the tracer must not be able to evaluate it.
export async function GET() {
  const startedAt = Date.now();
  let db: "ok" | "error" = "ok";
  try {
    await createDbSqlClient()`select 1`;
  } catch {
    db = "error";
  }
  const runtimeRoot = process.env.APP_RUNTIME_ROOT;
  const inContainer = process.env.APP_RUNTIME === "container" && !!runtimeRoot;
  const files = inContainer ? checkRuntimeFiles(runtimeRoot) : null;
  const healthy = db === "ok" && (files ? files.ok : true);

  return Response.json(
    {
      project: "bazi",
      phase: "2",
      status: healthy ? "symbolic-engine-ready" : "degraded",
      routes: ["/api/health", "/api/bazi/calculate"],
      db,
      dbLatencyMs: Date.now() - startedAt,
      runtimeFiles: files ? (files.ok ? "ok" : "missing") : "not-checked",
      runtimeFilesMissing: files ? files.missing : [],
      sha: process.env.APP_GIT_SHA ?? null,
      uptimeSec: Math.round(process.uptime()),
    },
    { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
