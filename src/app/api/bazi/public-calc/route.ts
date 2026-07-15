import { ZodError } from "zod";

import {
  calculateBaziStateFromRawInput,
  type BaziStatePayload,
} from "@/features/bazi-math/bazi-engine-adapter";
import { createNoOpKnowledgeRepository } from "@/lib/bazi/no-op-knowledge-repository";
import { buildDaYunTableRows, resolveDaYunReaction } from "@/lib/bazi/topic-knowledge";
import {
  BRANCH_TO_ELEMENT,
  CLASH_PAIRS,
  ELEMENT_LABELS_TH,
  HARM_PAIRS,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";

export const runtime = "nodejs";

function elementLabelForSymbol(symbol: string): string {
  const stemEn = STEM_TO_ELEMENT[symbol as keyof typeof STEM_TO_ELEMENT];
  if (stemEn) return ELEMENT_LABELS_TH[stemEn];
  const branchEn = BRANCH_TO_ELEMENT[symbol as keyof typeof BRANCH_TO_ELEMENT];
  return branchEn ? ELEMENT_LABELS_TH[branchEn] : "";
}

function pairFlag(pairs: Set<string>, a: string, b: string): boolean {
  return pairs.has(`${a}|${b}`) || pairs.has(`${b}|${a}`);
}

function buildLiuNianRows(calculatedState: BaziStatePayload) {
  const dayBranch = calculatedState.fourPillars.day.branch;
  return calculatedState.liuNianSeries.map((y) => ({
    year: y.year,
    age: y.age,
    stem: y.stem,
    branch: y.branch,
    element: elementLabelForSymbol(y.stem),
    qi: y.twelveQiDisplay ?? "",
    reaction: resolveDaYunReaction(calculatedState, y.stem, "stem"),
    clash: pairFlag(CLASH_PAIRS, y.branch, dayBranch),
    harm: pairFlag(HARM_PAIRS, y.branch, dayBranch),
  }));
}

/**
 * POST /api/bazi/public-calc — วัยจร/ปีจร + ปฏิกิริยาธาตุ ล้วน ๆ (ไม่มีเกรด/ทำนาย)
 * คนละ route จาก mode=consumer เดิม — inject no-op repository เข้า calculateBaziStateFromRawInput
 * ตัวเดียวกับที่ /api/bazi/calculate ใช้จริง (ไม่แตะ src/lib/bazi/** core engine เลย) จึงไม่มี DB
 * round-trip เกิดขึ้นบน route นี้เลย ไม่ใช่แค่มี fallback — ดู #calculator-enrichment-FROZEN-v1
 */
export function createPublicCalcHandler() {
  return async function POST(request: Request) {
    try {
      const payload = await request.json();
      const repository = createNoOpKnowledgeRepository();
      const calculatedState = await calculateBaziStateFromRawInput(payload, { repository });

      const daYun = buildDaYunTableRows(calculatedState).map((row) => ({
        ...row,
        element: elementLabelForSymbol(row.symbol),
      }));

      return Response.json(
        {
          dayMaster: calculatedState.dayMaster,
          dayMasterElement: elementLabelForSymbol(calculatedState.dayMaster),
          strengthScore: calculatedState.strengthScore,
          daYun,
          liuNian: buildLiuNianRows(calculatedState),
        },
        { status: 200 },
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Invalid calculate payload.", details: error.issues },
          { status: 400 },
        );
      }

      const message = error instanceof Error ? error.message : "Unknown calculation error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createPublicCalcHandler();
