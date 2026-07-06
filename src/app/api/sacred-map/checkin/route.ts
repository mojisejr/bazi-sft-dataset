/**
 * Sacred Map — เช็คอินนิรนาม
 *   POST { id } → เพิ่มยอดเช็คอินรวมของสถานที่ 1 (สถานะส่วนตัว "เช็คอินแล้ว" เก็บ localStorage ฝั่ง client)
 */
import { incrementCheckin } from "@/lib/bazi/sacred-map/repository";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let payload: { id?: unknown };
  try {
    payload = (await req.json()) as { id?: unknown };
  } catch {
    return Response.json({ error: { message: "body ต้องเป็น JSON" } }, { status: 400 });
  }

  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!id) return Response.json({ error: { message: "ต้องระบุ id" } }, { status: 400 });

  try {
    const count = await incrementCheckin(id);
    if (count === null) return Response.json({ error: { message: "ไม่พบสถานที่นี้" } }, { status: 404 });
    return Response.json({ ok: true, checkinCount: count });
  } catch (error) {
    console.error("[sacred-map] checkin failed:", error);
    return Response.json({ error: { message: "เช็คอินไม่สำเร็จ" } }, { status: 500 });
  }
}
