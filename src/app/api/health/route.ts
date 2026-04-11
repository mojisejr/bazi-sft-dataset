export async function GET() {
  return Response.json({
    project: "bazi",
    phase: "0.5",
    status: "scaffold-ready",
  });
}