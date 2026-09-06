/**
 * GET /api/fortune-sage/image/<no> — เสิร์ฟ bytes รูปใบเซียมซี (โปสเตอร์คำทำนายเต็มใบ) จาก knownlage/
 * เป็น single source of truth ให้ FE ดึงรูปจาก engine โดยตรง (ไม่พึ่ง Supabase CDN)
 */
import { getCardImageBytes } from "@/lib/bazi/card-images/file-source";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const n = parseInt(no, 10);
  if (!Number.isFinite(n) || n < 1) {
    return Response.json({ error: "เลขใบเซียมซีไม่ถูกต้อง" }, { status: 400 });
  }
  const img = await getCardImageBytes("sage", n);
  if (!img) {
    return Response.json({ error: `ไม่พบรูปใบเซียมซี #${n}` }, { status: 404 });
  }
  return new Response(new Uint8Array(img.buf), {
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
