import { z, ZodError } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { buildLifePath } from "@/lib/bazi/life-path";
import { type BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";

export const runtime = "nodejs";

/**
 * POST /api/bazi/life-path — ข้อมูลจอ "เส้นทางชีวิต" (Life-Path curve, UI ใหม่).
 * Body: { person: RawInput }
 *   person = { birthDate, birthTime, gender, province, calendarSystem?, timezone? }
 * คืนเส้นคะแนนชีวิต 4 ความละเอียด (all / 5y / 1y / 1m) — score เป็นค่า derive (provisional).
 */

const PersonSchema = z.object({
  birthDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate ต้องเป็น YYYY-MM-DD"),
  birthTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "birthTime ต้องเป็น HH:mm").default("12:00"),
  gender: z.enum(["female", "male", "unspecified"]).default("unspecified"),
  province: z.string().trim().min(1).default("กรุงเทพมหานคร"),
  calendarSystem: z.enum(["solar", "lunar"]).optional(),
  timezone: z.string().trim().min(1).optional(),
});

const RequestSchema = z.object({
  person: PersonSchema,
});

type HandlerOptions = { repository?: BaziKnowledgeRepository };

export function createLifePathHandler(options: HandlerOptions = {}) {
  return async function POST(request: Request) {
    try {
      const { person } = RequestSchema.parse(await request.json());
      const repository = options.repository ?? createDbKnowledgeRepository();
      const state = await calculateBaziStateFromRawInput(person, { repository });

      const birthYear = Number(person.birthDate.slice(0, 4));
      const lifePath = buildLifePath(state, {
        gender: person.gender === "unspecified" ? undefined : person.gender,
        birthYear: Number.isFinite(birthYear) ? birthYear : undefined,
      });

      return Response.json(lifePath, { status: 200 });
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Invalid life-path payload.", details: error.issues },
          { status: 400 },
        );
      }
      const message = error instanceof Error ? error.message : "Unknown life-path error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createLifePathHandler();
