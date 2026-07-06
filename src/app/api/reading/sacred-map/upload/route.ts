/**
 * Sacred Map — อัปโหลดรูปสถานที่ขึ้น Supabase Storage (แอดมิน)
 *   POST  multipart/form-data: file=<image>, id?=<location id>
 *      → { ok, imageUrl }  (เอา imageUrl ไปเก็บใน image_url ผ่าน POST/PUT ปกติ)
 * auth: x-admin-token = ADMIN_DOCTRINE_TOKEN (ถ้าไม่ตั้ง env → เปิดให้ทุกคน เหมือน route หลัก)
 */
import { ensureSacredBucket, uploadSacredMapImage } from "@/lib/supabase/storage";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

function authorized(req: Request): boolean {
  const expected = process.env.ADMIN_DOCTRINE_TOKEN?.trim();
  if (!expected) return true;
  return req.headers.get("x-admin-token")?.trim() === expected;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: { message: "unauthorized" } }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: { message: "ต้องส่งเป็น multipart/form-data" } }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: { message: "ไม่พบไฟล์รูป" } }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: { message: "ต้องเป็นไฟล์รูปภาพ" } }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: { message: "รูปใหญ่เกิน 8MB" } }, { status: 400 });
  }

  const id = (form.get("id") as string | null)?.trim() || "new";
  // ใส่ timestamp กัน CDN cache รูปเก่า (upload upsert 1 ปี) — แต่ละครั้ง = path ใหม่
  const objectKey = `${id.replace(/[^a-zA-Z0-9_-]/g, "")}-${Date.now()}`;

  try {
    await ensureSacredBucket();
    const buffer = Buffer.from(await file.arrayBuffer());
    const imageUrl = await uploadSacredMapImage(objectKey, buffer, file.type);
    return Response.json({ ok: true, imageUrl });
  } catch (error) {
    return Response.json(
      { error: { message: (error as Error).message ?? "อัปโหลดไม่สำเร็จ" } },
      { status: 500 },
    );
  }
}
