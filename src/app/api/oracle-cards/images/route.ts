import { getAllCards } from "@/lib/bazi/oracle-cards/deck";
import { createDbOracleCardImageRepository } from "@/lib/bazi/oracle-cards/image-repository";

export const runtime = "nodejs";

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

/**
 * GET — สถานะรูป: ใบไหนมีรูปแล้ว / ทั้งหมดกี่ใบ
 * (รูปไพ่ออราเคิลนำเข้าจากไฟล์จริงด้วยสคริปต์ oracle:import-images — ไม่มี gen ผ่าน API)
 */
export async function GET() {
  try {
    const done = await createDbOracleCardImageRepository().listNos();
    return Response.json({ total: getAllCards().length, done });
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "อ่านสถานะรูปไม่สำเร็จ (ตรวจ migration)",
      500,
    );
  }
}
