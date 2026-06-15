import { z } from "zod";

import { getAllCards, getCardByNo } from "@/lib/bazi/divine-cards/deck";
import { generateCardImage } from "@/lib/bazi/divine-cards/image-gen";
import { createDbDivineCardImageRepository } from "@/lib/bazi/divine-cards/image-repository";
import { uploadDivineCardImage } from "@/lib/supabase/storage";

export const runtime = "nodejs";
/** gen รูปหลายใบใช้เวลานาน — ขยายเพดาน (Vercel/Node) */
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const expected = process.env.ADMIN_DOCTRINE_TOKEN?.trim();
  if (!expected) return true; // local dev
  return req.headers.get("x-admin-token")?.trim() === expected;
}

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

/** GET — สถานะ: ใบไหนมีรูปแล้ว / ทั้งหมดกี่ใบ */
export async function GET(req: Request) {
  if (!authorized(req)) return badRequest("unauthorized", 401);
  try {
    const done = await createDbDivineCardImageRepository().listNos();
    return Response.json({ total: getAllCards().length, done });
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "อ่านสถานะรูปไม่สำเร็จ (ตรวจ migration)",
      500,
    );
  }
}

const PostSchema = z.object({
  apiKey: z.string().trim().min(1),
  model: z.string().trim().min(1).optional(),
  /** เลือก gen เฉพาะบางใบ; ไม่ส่ง = gen เฉพาะใบที่ยังไม่มีรูป */
  nos: z.array(z.number().int()).optional(),
  /** force: gen ใหม่ทับของเดิมด้วย */
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  if (!authorized(req)) return badRequest("unauthorized", 401);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = PostSchema.safeParse(payload);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload.");
  }
  const { apiKey, model, nos, force } = parsed.data;

  const repo = createDbDivineCardImageRepository();
  let existing: Set<number>;
  try {
    existing = new Set(await repo.listNos());
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "อ่านสถานะรูปไม่สำเร็จ (ตรวจ migration)",
      500,
    );
  }

  // กำหนดรายการที่จะ gen
  const targetNos = (nos ?? getAllCards().map((c) => c.no)).filter(
    (no) => force || !existing.has(no),
  );

  const succeeded: number[] = [];
  const failed: Array<{ no: number; error: string }> = [];

  for (const no of targetNos) {
    const card = getCardByNo(no);
    if (!card) {
      failed.push({ no, error: "ไม่อยู่ในสำรับ" });
      continue;
    }
    try {
      const img = await generateCardImage(card, { apiKey, model });
      const url = await uploadDivineCardImage(no, Buffer.from(img.imageBase64, "base64"), img.mime);
      await repo.upsert(no, {
        prompt: img.prompt,
        imageUrl: url,
        imageBase64: null,
        mime: img.mime,
        model: img.model,
      });
      succeeded.push(no);
    } catch (error) {
      failed.push({ no, error: error instanceof Error ? error.message : "gen ล้มเหลว" });
    }
  }

  return Response.json({
    ok: failed.length === 0,
    requested: targetNos.length,
    succeeded,
    failed,
  });
}
