// /api/ops/course-video — แอดมิน (/ops) วางลิงก์ YouTube ของคอร์สปฏิทิน Mumate ทีละ EP (ตาราง course_video ของ FE, 0039).
// secret-gated ด้วย OPS_ADMIN_SECRET (fail-closed) เหมือน /api/ops/promo-share.
//   GET  ?secret=                          → { videos: { [ep]: url }, missing?: true }
//   POST { secret, ep, url }               → บันทึก (url ว่าง = ลบลิงก์ตอนนั้น)
import { sql } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";

export const runtime = "nodejs";
const COURSE = "calendar";

function unauthorized() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}
function rowsOf(r: unknown): Record<string, unknown>[] {
  return (Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? [])) as Record<string, unknown>[];
}

export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  const url = new URL(request.url);
  if (!secret || url.searchParams.get("secret") !== secret) return unauthorized();
  try {
    const r = await createDbClient().execute(sql`SELECT ep, video_url FROM course_video WHERE course = ${COURSE} ORDER BY ep`);
    const videos: Record<number, string> = {};
    for (const x of rowsOf(r)) videos[Number(x.ep)] = String(x.video_url ?? "");
    return Response.json({ videos });
  } catch {
    // ตารางยังไม่มี = ยังไม่รัน migration 0039 ของ FE
    return Response.json({ videos: {}, missing: true });
  }
}

const PostSchema = z.object({
  secret: z.string().trim().min(1),
  ep: z.number().int().min(1).max(13),
  url: z.string().trim().max(500),
});

export async function POST(request: Request) {
  let body: z.infer<typeof PostSchema>;
  try {
    body = PostSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }
  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret || body.secret !== secret) return unauthorized();
  if (body.url && !/(youtube\.com|youtu\.be)\//i.test(body.url)) {
    return Response.json({ error: "ต้องเป็นลิงก์ YouTube (youtube.com หรือ youtu.be)" }, { status: 400 });
  }
  try {
    const db = createDbClient();
    if (!body.url) {
      await db.execute(sql`DELETE FROM course_video WHERE course = ${COURSE} AND ep = ${body.ep}`);
    } else {
      await db.execute(sql`INSERT INTO course_video (course, ep, video_url, updated_at) VALUES (${COURSE}, ${body.ep}, ${body.url}, now())
        ON CONFLICT (course, ep) DO UPDATE SET video_url = EXCLUDED.video_url, updated_at = now()`);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "course-video save error" }, { status: 500 });
  }
}
