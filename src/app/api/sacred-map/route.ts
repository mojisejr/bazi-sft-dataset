/**
 * Sacred Map — public API
 *   GET  ?element=&need=  → รายการสถานที่ verified (กรองธาตุ/ความต้องการ)
 *   POST                  → ผู้ใช้เสนอสถานที่ใหม่ (เข้าคิว pending รอแอดมิน verify)
 */
import { SacredSubmissionSchema } from "@/lib/bazi/sacred-map/constants";
import { listVerified, submitLocation } from "@/lib/bazi/sacred-map/repository";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const element = url.searchParams.get("element")?.trim() || null;
  const need = url.searchParams.get("need")?.trim() || null;

  try {
    const locations = await listVerified({ element, need });
    return Response.json({ ok: true, locations });
  } catch (error) {
    console.error("[sacred-map] GET failed:", error);
    return Response.json({ ok: true, locations: [], unavailable: true });
  }
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: { message: "body ต้องเป็น JSON" } }, { status: 400 });
  }

  const parsed = SacredSubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: { message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" } },
      { status: 400 },
    );
  }

  const { submitterContact, ...input } = parsed.data;
  try {
    const location = await submitLocation(input, submitterContact ?? null);
    if (!location) return Response.json({ error: { message: "บันทึกไม่สำเร็จ" } }, { status: 500 });
    return Response.json({ ok: true, location });
  } catch (error) {
    console.error("[sacred-map] POST failed:", error);
    return Response.json({ error: { message: "บันทึกไม่สำเร็จ" } }, { status: 500 });
  }
}
