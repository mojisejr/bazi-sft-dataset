import { z, ZodError } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { buildNisai } from "@/lib/bazi/pair-matching";
import { applyMatchingOverrides } from "@/lib/bazi/matching-overlay";
import { getMatchingMap } from "@/lib/bazi/matching.server";
import { elementThOfStem, type ElementTh } from "@/lib/bazi/constants/career-finance-table";
import { ELEMENT_ADVICE_TABLES } from "@/lib/bazi/constants/element-advice";
import { type BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";

export const runtime = "nodejs";

/**
 * POST /api/bazi/element-summary — จอ onboarding "05-aha-moment" (ธาตุของคุณคือ …).
 * Body: { person: RawInput }
 * คืน: ธาตุดิถี + คำโปรย + ลักษณะเด่น (นิสัยหลักวัน) + คำแนะนำเบื้องต้นรายธาตุ.
 * เนื้อหาทั้งหมดมาจากตำรา (reference.json + element-advice) — overlay ซินแสสะท้อนอัตโนมัติ.
 */

/** คำโปรยใต้หัวข้อ "ธาตุของคุณคือ …" ต่อธาตุ (UI copy สั้น ๆ). */
const ELEMENT_TAGLINE: Record<ElementTh, string> = {
  ไม้: "สัญลักษณ์แห่งการเติบโตและการเริ่มต้นใหม่ คุณคือผู้สร้างและพัฒนาไม่หยุดนิ่ง",
  ไฟ: "สัญลักษณ์แห่งพลัง ความอบอุ่น และการส่องสว่าง คุณคือผู้จุดประกายและนำทางผู้อื่น",
  ดิน: "สัญลักษณ์แห่งความมั่นคงและความน่าเชื่อถือ คุณคือรากฐานที่ผู้คนพึ่งพิงได้",
  ทอง: "สัญลักษณ์แห่งความเด็ดเดี่ยวและระเบียบ คุณคือผู้มีหลักการและลงมือทำจริง",
  น้ำ: "สัญลักษณ์แห่งปัญญาและการปรับตัว คุณคือผู้ยืดหยุ่น มองเห็นโอกาสก่อนใคร",
};

const PersonSchema = z.object({
  birthDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate ต้องเป็น YYYY-MM-DD"),
  birthTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "birthTime ต้องเป็น HH:mm").default("12:00"),
  gender: z.enum(["female", "male", "unspecified"]).default("unspecified"),
  province: z.string().trim().min(1).default("กรุงเทพมหานคร"),
  calendarSystem: z.enum(["solar", "lunar"]).optional(),
  timezone: z.string().trim().min(1).optional(),
});

const RequestSchema = z.object({ person: PersonSchema });

type HandlerOptions = { repository?: BaziKnowledgeRepository };

export function createElementSummaryHandler(options: HandlerOptions = {}) {
  return async function POST(request: Request) {
    try {
      const { person } = RequestSchema.parse(await request.json());
      const repository = options.repository ?? createDbKnowledgeRepository();
      const state = await calculateBaziStateFromRawInput(person, { repository });

      const elementTh = elementThOfStem(state.dayMaster);
      const day = state.fourPillars.day;

      const text = applyMatchingOverrides(await getMatchingMap());
      // ลักษณะเด่น = นิสัยหลักวัน (ก้าน/ราศี/เชี่ยงแซ) จากตำรา
      const traits = buildNisai({ stem: day.stem, branch: day.branch }, text);

      const advice = elementTh
        ? [
            { key: "talent", label: "การใช้จุดแข็ง", text: ELEMENT_ADVICE_TABLES.talent[elementTh] },
            { key: "health", label: "การดูแลตัวเอง", text: ELEMENT_ADVICE_TABLES.health[elementTh] },
          ]
        : [];

      return Response.json(
        {
          dayMaster: state.dayMaster,
          dayGanzhi: `${day.stem}${day.branch}`,
          elementTh: elementTh ?? null,
          tagline: elementTh ? ELEMENT_TAGLINE[elementTh] : null,
          traits,
          advice,
        },
        { status: 200 },
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Invalid element-summary payload.", details: error.issues },
          { status: 400 },
        );
      }
      const message = error instanceof Error ? error.message : "Unknown element-summary error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createElementSummaryHandler();
