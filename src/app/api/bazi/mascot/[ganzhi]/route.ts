/**
 * GET /api/bazi/mascot/<ganzhi> — ลิงก์ + ชื่อ mascot ตามเสาวัน (60 กะจื่อ)
 * คืน metadata + URL (รูปจริงอยู่บน Supabase Storage)
 */
import { createDbMascotImageRepository } from "@/lib/bazi/mascot/mascot-repository";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ ganzhi: string }> }) {
  const { ganzhi } = await params;
  try {
    const row = await createDbMascotImageRepository().getByGanzhi(ganzhi);
    if (!row || !row.imageUrl) {
      return Response.json({ error: "ไม่พบ mascot ของดิถีนี้" }, { status: 404 });
    }
    return Response.json({
      ganzhi: row.ganzhi,
      nameTh: row.nameTh,
      nameEn: row.nameEn,
      imageUrl: row.imageUrl,
      // ชุด UI v2 (nullable) — ผู้อ่านเดิมมองข้ามฟิลด์นี้; fe proxy v2 อ่านเฉพาะช่องนี้
      imageUrlV2: row.imageUrlV2 ?? null,
    });
  } catch (error) {
    return Response.json(
      { error: (error as Error).message ?? "โหลด mascot ไม่สำเร็จ (ตรวจ migration)" },
      { status: 500 },
    );
  }
}
