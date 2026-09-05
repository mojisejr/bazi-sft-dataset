/**
 * GET /api/divine-cards/image/<no> — เสิร์ฟไฟล์รูปหน้าไพ่จิตวิญญาณแดนสวรรค์ (bytes) จาก knownlage/
 * เป็น single source of truth ให้ FE ดึงรูปจาก engine โดยตรง (ไม่พึ่ง Supabase CDN)
 */
import { getCardImageBytes } from "@/lib/bazi/card-images/file-source";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const n = parseInt(no, 10);
  if (!Number.isFinite(n) || n < 1) {
    return Response.json({ error: "เลขไพ่ไม่ถูกต้อง" }, { status: 400 });
  }
  const img = await getCardImageBytes("divine", n);
  if (!img) {
    return Response.json({ error: `ไม่พบรูปไพ่ #${n}` }, { status: 404 });
  }
  return new Response(new Uint8Array(img.buf), {
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
