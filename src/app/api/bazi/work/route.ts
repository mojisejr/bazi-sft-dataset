import { ZodError } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { buildPersonProfile, buildWorkComparison, buildWorkRoleComparison, isWorkRelationship, WORK_RELATIONSHIPS } from "@/lib/bazi/pair-matching";
import type { PillarPos } from "@/lib/bazi/pair-types";
import { applyMatchingOverrides } from "@/lib/bazi/matching-overlay";
import { buildChartTable } from "@/lib/bazi/chart-table";
import { getMatchingMap } from "@/lib/bazi/matching.server";
import type { DayPillar } from "@/lib/bazi/pair-types";
import { type BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";

type HandlerOptions = {
  repository?: BaziKnowledgeRepository;
};

const MAX_CANDIDATES = 3;

type BaziState = Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>;

function dayPillarOf(state: BaziState): DayPillar {
  return { stem: state.fourPillars.day.stem, branch: state.fourPillars.day.branch };
}

/** สี่เสาแบบย่อ (ก้าน/กิ่ง) — มิติของบทบาทใช้ครบทั้ง 4 ตำแหน่ง เหมือน /api/bazi/pair-match */
function fourPillarsOf(state: BaziState): Record<PillarPos, DayPillar> {
  const lite = (x: { stem: string; branch: string }): DayPillar => ({ stem: x.stem, branch: x.branch });
  const p = state.fourPillars;
  return { hour: lite(p.hour), day: lite(p.day), month: lite(p.month), year: lite(p.year) };
}

/**
 * POST /api/bazi/work
 * Body: { self: RawInput, candidates: RawInput[], relationship?: "boss" | "partner" | "subordinate" }  (1..3 candidates)
 * Returns: { self (calculated chart), candidates (calculated charts), comparison }
 *   - ไม่ส่ง relationship → พฤติกรรมเดิม (จัดอันดับด้วย forward score รวมของ domain งาน + คำอ่าน 3 มุมมอง)
 *   - ส่ง relationship → คำนวณ **แยกตามบทบาท** (ฟีม 2026-09-07): มิติของบทบาทนั้นจากสี่เสา จัดอันดับด้วยมิติหลัก
 *     comparison มี `relationship`/`relationshipLabel` และต่อคนมี `facets` + `roleFacet` เพิ่ม (roles ยังครบ 3)
 *   - relationship ที่ไม่รู้จัก → 400 (ไม่เงียบไปใช้ค่าเริ่มต้น — เส้นนี้จะเปิดให้ partner ใช้)
 */
export function createWorkBaziHandler(options: HandlerOptions = {}) {
  return async function POST(request: Request) {
    try {
      const body = await request.json();
      const { self, candidates, relationship } = body ?? {};
      if (relationship !== undefined && !isWorkRelationship(relationship)) {
        return Response.json(
          { error: `relationship ต้องเป็นหนึ่งใน ${WORK_RELATIONSHIPS.join(" | ")}` },
          { status: 400 },
        );
      }

      if (!self || !Array.isArray(candidates) || candidates.length === 0) {
        return Response.json(
          { error: "ต้องมี self และ candidates อย่างน้อย 1 คน" },
          { status: 400 },
        );
      }
      if (candidates.length > MAX_CANDIDATES) {
        return Response.json(
          { error: `เปรียบเทียบได้สูงสุด ${MAX_CANDIDATES} คน` },
          { status: 400 },
        );
      }

      const repository = options.repository ?? createDbKnowledgeRepository();
      const [selfState, ...candidateStates] = await Promise.all([
        calculateBaziStateFromRawInput(self, { repository }),
        ...candidates.map((c: unknown) => calculateBaziStateFromRawInput(c, { repository })),
      ]);

      // overlay คำทำนายที่ซินแสแก้จาก DB (เหมือน pair-match) — เฉพาะเส้นแยกบทบาท; เส้นเดิมคงพฤติกรรมเดิม
      const text = applyMatchingOverrides(await getMatchingMap());
      const comparison = isWorkRelationship(relationship)
        ? buildWorkRoleComparison(
            relationship,
            fourPillarsOf(selfState),
            candidateStates.map(fourPillarsOf),
            text,
          )
        : buildWorkComparison(dayPillarOf(selfState), candidateStates.map(dayPillarOf));

      // นิสัยของ "คุณ" (Figma 720:29221 hero: บรรทัดอธิบายใต้หัว) — รูปเดียวกับ persons.a.nisai ของ pair-match
      const selfDay = dayPillarOf(selfState);
      const sp = buildPersonProfile(selfDay, text);
      const selfProfile = { dayGanzhi: `${selfDay.stem}${selfDay.branch}`, elementTh: sp.elementTh, stageTh: sp.stageTh, nisai: sp.nisai };

      // ตารางดวงจีนของทุกคน (Figma 720:32490) — ใส่ไว้ใน comparison เพราะ FE เก็บเฉพาะก้อนนี้ลง DB
      const rawOf = (p: unknown) => {
        const o = (p ?? {}) as { birthDate?: string; birthTime?: string | null };
        return { birthDate: String(o.birthDate ?? ""), birthTime: o.birthTime ?? null };
      };
      const charts = {
        self: buildChartTable(selfState, rawOf(self)),
        candidates: candidateStates.map((st, i) => buildChartTable(st, rawOf(candidates[i]))),
      };

      return Response.json(
        { self: selfState, candidates: candidateStates, comparison: { ...comparison, charts, selfProfile } },
        { status: 200 },
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Invalid work payload.", details: error.issues },
          { status: 400 },
        );
      }

      const message = error instanceof Error ? error.message : "Unknown work calculation error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createWorkBaziHandler();
