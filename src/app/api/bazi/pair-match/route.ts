import { z, ZodError } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { elementLabelForSymbol } from "@/lib/bazi/element-label";
import { buildFacets, buildPairComparison, mainFacetOf, RELATIONSHIP_SPECS } from "@/lib/bazi/pair-matching";
import { applyMatchingOverrides } from "@/lib/bazi/matching-overlay";
import { getMatchingMap } from "@/lib/bazi/matching.server";
import type { DayPillar, MatchFacet, PillarPos } from "@/lib/bazi/pair-types";
import {
  gradeLabelOf,
  heartsOf,
  PAIR_MATCH_DEFAULT_BIRTH_TIME,
  PAIR_MATCH_DEFAULT_PROVINCE,
  relationshipLabelOverride,
  relationshipNoteOf,
  toEngineRelationship,
} from "@/lib/bazi/pair-consumer";
import { type BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";

export const runtime = "nodejs";

/**
 * POST /api/bazi/pair-match — consumer endpoint สำหรับ wizard "ดวงสมพงษ์" (UI ใหม่).
 * ต่างจาก /api/bazi/pair ตรงที่:
 *  - validate เข้มด้วย zod (เวลาเกิด optional → เที่ยงวัน, จังหวัด optional → กรุงเทพฯ)
 *  - response ผอม ตรงกับจอผลลัพธ์ (overall เกรด+% / คะแนนรายมิติ / โปรไฟล์ย่อ)
 *    ไม่ส่ง BaziState เต็มกลับไป
 *  - รองรับ relationship "family" (จอ wizard) เป็น alias ของตารางความรัก
 *    ⚠️ ยังไม่มีสเปกครอบครัวจากซินแส — ติด note ไว้ใน response จนกว่าจะเคาะ
 */

/** ความสัมพันธ์ที่ wizard ส่งได้ = ของ engine + "family" (alias love). */
const RelationshipInputSchema = z.enum(["love", "partner", "boss", "subordinate", "family"]);

const PersonInputSchema = z.object({
  /** วันเกิด ค.ศ. รูปแบบ YYYY-MM-DD */
  birthDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate ต้องเป็น YYYY-MM-DD"),
  /** เวลาเกิด HH:mm — ไม่ทราบให้เว้น (ใช้เที่ยงวัน และ timeKnown=false ใน response) */
  birthTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "birthTime ต้องเป็น HH:mm")
    .optional(),
  gender: z.enum(["female", "male", "unspecified"]).default("unspecified"),
  province: z.string().trim().min(1).optional(),
  /** ชื่อเรียกในผลลัพธ์ (เช่น "สิริวรรณ") — optional, echo กลับเฉย ๆ */
  displayName: z.string().trim().max(100).optional(),
});

const PairMatchRequestSchema = z.object({
  relationship: RelationshipInputSchema.default("love"),
  personA: PersonInputSchema,
  personB: PersonInputSchema,
});

type CalculatedState = Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>;

function dayPillarOf(state: CalculatedState): DayPillar {
  return { stem: state.fourPillars.day.stem, branch: state.fourPillars.day.branch };
}

function facetPillarsOf(state: CalculatedState): Record<PillarPos, DayPillar> {
  const p = state.fourPillars;
  const lite = (x: { stem: string; branch: string }): DayPillar => ({ stem: x.stem, branch: x.branch });
  return { hour: lite(p.hour), day: lite(p.day), month: lite(p.month), year: lite(p.year) };
}

/**
 * มุมมองสี่เสาสำหรับจอผลลัพธ์ (year/month/day/hour) — เสาละ stem·branch·element.
 * element = ธาตุของก้านเสา แปลงผ่าน elementLabelForSymbol (คำศัพท์ธาตุชุดเดียวกับ /home + public-calc)
 * ไม่ใช่ hardcode ใหม่. hour คืนค่าเสมอ (เที่ยงวันเมื่อไม่ทราบเวลา) — จอตัดสินซ่อนเองจาก timeKnown.
 */
function pillarView(x: { stem: string; branch: string }) {
  return { stem: x.stem, branch: x.branch, element: elementLabelForSymbol(x.stem) };
}

function fourPillarsView(state: CalculatedState) {
  const p = state.fourPillars;
  return {
    year: pillarView(p.year),
    month: pillarView(p.month),
    day: pillarView(p.day),
    hour: pillarView(p.hour),
  };
}

/** ย่อ MatchFacet เหลือเฉพาะที่จอ wizard ใช้ (ตัด lines/sising เต็มออก). */
function slimFacet(f: MatchFacet) {
  return {
    key: f.key,
    label: f.label,
    pairingLabel: f.pairingLabel,
    percent: f.percent,
    grade: f.grade,
    gradeLabel: gradeLabelOf(f.percent),
    emoji: f.emoji,
    ratingText: f.ratingText,
    isMain: f.isMain,
    sising: f.sising ? { code: f.sising.code, nameTh: f.sising.nameTh, summary: f.sising.summary } : null,
  };
}

type HandlerOptions = {
  repository?: BaziKnowledgeRepository;
};

export function createPairMatchHandler(options: HandlerOptions = {}) {
  return async function POST(request: Request) {
    try {
      const body = PairMatchRequestSchema.parse(await request.json());
      const relationship = toEngineRelationship(body.relationship);
      const spec = RELATIONSHIP_SPECS[relationship];

      const repository = options.repository ?? createDbKnowledgeRepository();
      const toRawInput = (p: z.infer<typeof PersonInputSchema>) => ({
        birthDate: p.birthDate,
        birthTime: p.birthTime ?? PAIR_MATCH_DEFAULT_BIRTH_TIME,
        gender: p.gender,
        province: p.province ?? PAIR_MATCH_DEFAULT_PROVINCE,
      });
      const [stateA, stateB] = await Promise.all([
        calculateBaziStateFromRawInput(toRawInput(body.personA), { repository }),
        calculateBaziStateFromRawInput(toRawInput(body.personB), { repository }),
      ]);

      // overlay คำทำนายที่ซินแสแก้จาก DB (เหมือน /api/bazi/pair)
      const text = applyMatchingOverrides(await getMatchingMap());
      const comparison = buildPairComparison(dayPillarOf(stateA), dayPillarOf(stateB), text);
      const facets = buildFacets(relationship, facetPillarsOf(stateA), facetPillarsOf(stateB), text);
      const mainFacet = mainFacetOf(facets);

      // คะแนนรวม = มิติคำทำนายหลักตามซินแส; ถ้าหลักหาไม่เจอ fallback ค่าเฉลี่ยสองทิศของ domain
      const fallback = comparison.match[spec.domain];
      const overallPercent = mainFacet?.percent ?? fallback.overallPercent;
      const overallGrade = mainFacet?.percent != null ? mainFacet.grade : fallback.overallGrade;

      const profileOf = (p: (typeof comparison)["personA"], displayName?: string) => ({
        displayName: displayName ?? null,
        dayGanzhi: `${p.dayPillar.stem}${p.dayPillar.branch}`,
        elementTh: p.elementTh,
        stageTh: p.stageTh,
        nisai: p.nisai,
      });

      return Response.json(
        {
          relationship: body.relationship,
          relationshipLabel: relationshipLabelOverride(body.relationship) ?? spec.label,
          ourLabel: spec.ourLabel,
          partnerLabel: spec.partnerLabel,
          domain: spec.domain,
          note: relationshipNoteOf(body.relationship),
          persons: {
            a: {
              ...profileOf(comparison.personA, body.personA.displayName),
              timeKnown: body.personA.birthTime != null,
              fourPillars: fourPillarsView(stateA),
            },
            b: {
              ...profileOf(comparison.personB, body.personB.displayName),
              timeKnown: body.personB.birthTime != null,
              fourPillars: fourPillarsView(stateB),
            },
          },
          overall: {
            percent: overallPercent,
            grade: overallGrade,
            gradeLabel: gradeLabelOf(overallPercent),
            hearts: heartsOf(overallPercent),
            emoji: mainFacet?.emoji ?? null,
            ratingText: mainFacet?.ratingText ?? "",
          },
          dimensions: facets.map(slimFacet),
          elementInteraction: {
            aElementTh: comparison.elementInteraction.aElementTh,
            bElementTh: comparison.elementInteraction.bElementTh,
            summaryTh: comparison.elementInteraction.summaryTh,
            // ทิศทางปฏิกิริยาธาตุสองทาง { relation, labelTh, meaningTh } — มีครบใน comparison แล้ว
            // route เดิมส่งแต่ summaryTh; จอผลลัพธ์ต้องการแยกทิศ เรา→เขา / เขา→เรา
            aToB: comparison.elementInteraction.aToB,
            bToA: comparison.elementInteraction.bToA,
          },
        },
        { status: 200 },
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Invalid pair-match payload.", details: error.issues },
          { status: 400 },
        );
      }
      const message = error instanceof Error ? error.message : "Unknown pair-match error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createPairMatchHandler();
