import { z, ZodError } from "zod";

import { runRectificationCombined } from "@/lib/bazi/hour-rectification/run-combined";
import { EVENT_TYPES, MAX_EVENTS } from "@/lib/bazi/hour-rectification/domain/events";
import { getNewdataMap } from "@/lib/bazi/newdata.server";
import type { NewdataMap } from "@/lib/bazi/newdata-repository";

export const runtime = "nodejs";

// unified lane — flow เดียวถามต่อเนื่อง (ช่วงของวัน → เหตุการณ์ → คำถามจากคำทำนาย) แล้วรวมคะแนน
// sub-route ใหม่ ไม่แตะ v1/v2/v3 เดิม. Stateless + deterministic + no LLM; DB ใช้แค่โหลดคลัง NewData
const EventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  year: z.number().int().min(1900).max(2100),
});

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
  // free string เพราะ "unknown" เป็นค่าที่ตั้งใจรับ — run-combined จัดการ gate เอง
  daypart: z.string().trim().min(1),
  events: z.array(EventSchema).max(MAX_EVENTS).default([]),
  answers: z.array(AnswerSchema).max(20).default([]),
});

/**
 * POST /api/bazi/rectify-hour/combined — สอบยามรวมทุกชั้นใน flow เดียว:
 * daypart จำกัด candidate → คะแนนกฎเหตุการณ์ (v2) + คะแนนคำถามจากคำทำนาย (v3) รวมต่อยาม
 */
export function createRectifyHourCombinedHandler(
  deps: { loadMap?: () => Promise<NewdataMap> } = {},
) {
  const loadMap = deps.loadMap ?? getNewdataMap;
  return async function POST(request: Request) {
    try {
      const payload = await request.json();
      const input = RequestSchema.parse(payload);

      const result = await runRectificationCombined(input, loadMap);
      // need_more_signal / question / result ล้วนเป็น outcome ปกติ → 200
      return Response.json(result, { status: 200 });
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Invalid rectify-hour combined payload.", details: error.issues },
          { status: 400 },
        );
      }
      const message = error instanceof Error ? error.message : "Unknown rectification error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createRectifyHourCombinedHandler();
