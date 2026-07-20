import { z, ZodError } from "zod";

import { runRectificationByReading } from "@/lib/bazi/hour-rectification/run-reading";
import { getNewdataMap } from "@/lib/bazi/newdata.server";
import type { NewdataMap } from "@/lib/bazi/newdata-repository";

export const runtime = "nodejs";

// v3 reading-diff lane (สอบจากคำทำนาย) — sub-route ใหม่แยกจาก v1 quiz (/api/bazi/rectify-hour) และ
// v2 events (/events) ทั้งคู่ไม่ถูกแตะ. Stateless + deterministic + no LLM; ใช้ DB แค่โหลดคลัง
// NewData (แหล่งคำทำนายเดียวกับหน้าอ่าน 15 บท)
const AnswerSchema = z.object({
  questionId: z.string().trim().min(1),
  optionId: z.string().trim().min(1),
});

const RequestSchema = z.object({
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate must be YYYY-MM-DD")
    .refine((value) => !Number.isNaN(Date.parse(value)), "birthDate is not a real date"),
  gender: z.enum(["male", "female"]),
  province: z.string().trim().min(1),
  // free string เพราะ "unknown" (ไม่ทราบเลย) เป็นค่าที่ตั้งใจรับ — run-reading แยก gate เอง
  daypart: z.string().trim().min(1).optional(),
  answers: z.array(AnswerSchema).max(20).default([]),
});

/**
 * POST /api/bazi/rectify-hour/reading — สอบยาม v3 (สอบจากคำทำนาย). คำนวณดวง 12 ยามของ user จริง
 * → ดึงคำทำนายที่ผูกกับเสายามจากคลัง NewData (บริวาร/ภพลูก/จิตใต้สำนึก — ตัดเนื้อหา 18+ และ
 * soften ถ้อยคำแรง) → จับกลุ่มยามที่คำทำนายเหมือนกันเป็นคำถาม → ตอบครบได้ shortlist 3-4 ยาม
 */
export function createRectifyHourReadingHandler(
  deps: { loadMap?: () => Promise<NewdataMap> } = {},
) {
  const loadMap = deps.loadMap ?? getNewdataMap;
  return async function POST(request: Request) {
    try {
      const payload = await request.json();
      const input = RequestSchema.parse(payload);

      const result = await runRectificationByReading(input, loadMap);
      // need_daypart / unknown_daypart / question / result ล้วนเป็น outcome ปกติ → 200
      return Response.json(result, { status: 200 });
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Invalid rectify-hour reading payload.", details: error.issues },
          { status: 400 },
        );
      }
      const message = error instanceof Error ? error.message : "Unknown rectification error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createRectifyHourReadingHandler();
