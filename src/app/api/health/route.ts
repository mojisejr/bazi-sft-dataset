export async function GET() {
  return Response.json({
    project: "bazi",
    phase: "2",
    status: "symbolic-engine-ready",
    routes: ["/api/health", "/api/bazi/calculate"],
  });
}