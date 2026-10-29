// GET /api/nine-gates/deck?deck=oracle|fengshui|divine — รายการไพ่ทั้งสำรับ + รูป สำหรับหน้าเก้าประตู (หลังบ้าน)
// สุ่มฝั่งหน้าจอ (เหมือนต้นแบบ) — route นี้แค่ส่งสำรับ · รูปเอาเฉพาะ URL (ไม่ส่ง base64 ทั้งสำรับ กันหนัก)
import { getAllCards as allDivine } from "@/lib/bazi/divine-cards/deck";
import { createDbDivineCardImageRepository } from "@/lib/bazi/divine-cards/image-repository";
import { getAllCards as allFengshui } from "@/lib/bazi/fengshui/deck";
import { getAllCards as allOracle } from "@/lib/bazi/oracle-cards/deck";
import { createDbOracleCardImageRepository } from "@/lib/bazi/oracle-cards/image-repository";

export const runtime = "nodejs";

export type NineGatesCard = { no: number; name: string; imageUrl: string | null };

async function urlsOf(repo: { getByNos: (nos: number[]) => Promise<{ cardNo: number; imageUrl: string | null }[]> }, nos: number[]) {
  try {
    const rows = await repo.getByNos(nos);
    return new Map(rows.filter((r) => r.imageUrl).map((r) => [r.cardNo, r.imageUrl as string]));
  } catch {
    return new Map<number, string>();
  }
}

export async function GET(request: Request) {
  const deck = new URL(request.url).searchParams.get("deck") ?? "oracle";
  let cards: NineGatesCard[];
  if (deck === "fengshui") {
    cards = allFengshui().map((c) => ({ no: c.no, name: c.name, imageUrl: c.imageUrl ?? null }));
  } else if (deck === "divine") {
    const all = allDivine();
    const urls = await urlsOf(createDbDivineCardImageRepository(), all.map((c) => c.no));
    cards = all.map((c) => ({ no: c.no, name: c.name, imageUrl: urls.get(c.no) ?? null }));
  } else if (deck === "oracle") {
    const all = allOracle();
    const urls = await urlsOf(createDbOracleCardImageRepository(), all.map((c) => c.no));
    cards = all.map((c) => ({ no: c.no, name: c.name, imageUrl: urls.get(c.no) ?? null }));
  } else {
    return Response.json({ error: { message: "deck ต้องเป็น oracle | fengshui | divine" } }, { status: 400 });
  }
  return Response.json({ deck, cards }, { headers: { "cache-control": "no-store" } });
}
