/**
 * GET    /api/bazi/saved-charts        → { charts: SavedChartSummary[], unavailable? }
 * GET    /api/bazi/saved-charts?id=... → { chart: SavedChartRow }
 * POST   /api/bazi/saved-charts        → { chart }  body: { id?, label, rawInput, dayMaster? }
 * DELETE /api/bazi/saved-charts?id=... → { ok: true }
 */
import { createDbSavedChartRepository } from "@/lib/bazi/saved-chart-repository";
import type { RawInputValue } from "@/lib/bazi/schema-types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id")?.trim();
  try {
    const repo = createDbSavedChartRepository();
    if (id) {
      const chart = await repo.get(id);
      if (!chart) return Response.json({ error: "not found" }, { status: 404 });
      return Response.json({ chart });
    }
    return Response.json({ charts: await repo.list() });
  } catch {
    // DB ล่ม — คืนรายการว่างเพื่อให้หน้ายังใช้งานได้ (ป้อนสดได้)
    return Response.json({ charts: [], unavailable: true });
  }
}

type SaveBody = { id?: string; label?: string; rawInput?: RawInputValue; dayMaster?: string | null };

export async function POST(req: Request) {
  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const label = body.label?.trim();
  const rawInput = body.rawInput;
  if (!label || !rawInput?.birthDate || !rawInput?.birthTime) {
    return Response.json({ error: "label + rawInput (birthDate/birthTime) required" }, { status: 400 });
  }

  try {
    const chart = await createDbSavedChartRepository().save({
      id: body.id,
      label,
      rawInput,
      dayMaster: body.dayMaster ?? null,
    });
    return Response.json({ chart });
  } catch (error) {
    return Response.json({ error: (error as Error).message ?? "save failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  try {
    await createDbSavedChartRepository().remove(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message ?? "delete failed" }, { status: 500 });
  }
}
