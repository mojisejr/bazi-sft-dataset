import { ZodError } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { applyMatchingOverrides } from "@/lib/bazi/matching-overlay";
import { getMatchingMap } from "@/lib/bazi/matching.server";
import { buildManVsDay, buildManVsDayMonth, buildManVsDayYear, type ManPillars } from "@/lib/bazi/manvsday";
import { gradeForPercent } from "@/lib/bazi/pair-matching";
import type { DayPillar } from "@/lib/bazi/pair-types";
import { type BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";

export const runtime = "nodejs";

type HandlerOptions = {
  repository?: BaziKnowledgeRepository;
};

type BaziState = Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>;

function dayPillarOf(state: BaziState): DayPillar {
  return { stem: state.fourPillars.day.stem, branch: state.fourPillars.day.branch };
}

function facetPillarsOf(state: BaziState): ManPillars {
  const p = state.fourPillars;
  const lite = (x: { stem: string; branch: string }): DayPillar => ({ stem: x.stem, branch: x.branch });
  return { hour: lite(p.hour), day: lite(p.day), month: lite(p.month), year: lite(p.year) };
}

/** แปลง "YYYY-MM-DD" → {y,m,d}; ถ้าไม่ส่งมาใช้วันนี้ (เขต server). */
function parseDate(input: unknown): { y: number; m: number; d: number } | null {
  if (typeof input === "string") {
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input.trim());
    if (!match) return null;
    return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  }
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

/** แปลง "YYYY-MM" → {y,m}. */
function parseMonth(input: unknown): { y: number; m: number } | null {
  if (typeof input !== "string") return null;
  const match = /^(\d{4})-(\d{1,2})$/.exec(input.trim());
  if (!match) return null;
  const m = Number(match[2]);
  if (m < 1 || m > 12) return null;
  return { y: Number(match[1]), m };
}

/**
 * POST /api/bazi/man-vs-day
 * Body:
 *   - รายวัน: { person: RawInput, date?: "YYYY-MM-DD" }  (ไม่ส่ง date = วันนี้)
 *   - รายเดือน (ปฏิทินส่วนตัว): { person: RawInput, month: "YYYY-MM" }
 * ใช้ทั้งบนหน้าเว็บ (การ์ดรายวัน + ปฏิทินคลิกได้) และผ่าน chat ("พรุ่งนี้ลงทุนดีไหม").
 */
// เปิด "เกรดของวัน" ออกทางท่อ — ค่าที่เครื่องคำนวณคิดเสร็จแล้ว (overallPercent) map ผ่านตำราเกรด
// (gradeForPercent = pair-matching, ตาราง rating-scale 13 ระดับ) โดยไม่แตะเครื่องคำนวณ/สูตร/ตำรา.
// null → null (ไม่ใช่ sentinel "-" ของ gradeForPercent — คีย์ใหม่ นิยามเองให้ fe อ่านง่าย). ไม่ปัดเศษ
// ก่อนเทียบ: รอยต่อทศนิยม (49.16) ตกช่องบน (C+) ตามตำราเดิม — ห้ามขยับ.
export const gradeOf = (percent: number | null | undefined): string | null =>
  percent == null ? null : gradeForPercent(percent);

export function createManVsDayHandler(options: HandlerOptions = {}) {
  return async function POST(request: Request) {
    try {
      const body = await request.json();
      const { person, date, month, year } = body ?? {};

      if (!person) {
        return Response.json({ error: "person is required." }, { status: 400 });
      }

      const repository = options.repository ?? createDbKnowledgeRepository();
      const state = await calculateBaziStateFromRawInput(person, { repository });
      // overlay คำทำนายที่ซินแสแก้จาก DB (ช่องว่าง = ใช้ค่า JSON เดิม) เหมือน pair route
      const text = applyMatchingOverrides(await getMatchingMap());
      const pillars = facetPillarsOf(state);
      const dayMaster = dayPillarOf(state);

      // โหมดรายปี — ปฏิทินส่วนตัวสำหรับ PDF ขาย
      if (year !== undefined) {
        const y = Number(year);
        if (!Number.isInteger(y) || y < 1900 || y > 2200) {
          return Response.json({ error: "Invalid year (ค.ศ. 1900–2200)." }, { status: 400 });
        }
        const result = buildManVsDayYear(pillars, dayMaster, y, text);
        // เติม grade ต่อวัน ในทุกเดือน (months[].days[]) — spread คงคีย์เดิมครบ เติม grade ล้วน
        return Response.json(
          {
            person: state,
            ...result,
            months: result.months.map((m) => ({
              ...m,
              days: m.days.map((d) => ({ ...d, grade: gradeOf(d.overallPercent) })),
            })),
          },
          { status: 200 },
        );
      }

      // โหมดรายเดือน — ปฏิทินส่วนตัว
      if (month !== undefined) {
        const ym = parseMonth(month);
        if (!ym) {
          return Response.json({ error: "Invalid month; expected YYYY-MM." }, { status: 400 });
        }
        const result = buildManVsDayMonth(pillars, dayMaster, ym.y, ym.m, text);
        // เติม grade ต่อวัน (days[]) — spread คงคีย์เดิมครบ เติม grade ล้วน
        return Response.json(
          {
            person: state,
            ...result,
            days: result.days.map((d) => ({ ...d, grade: gradeOf(d.overallPercent) })),
          },
          { status: 200 },
        );
      }

      // โหมดรายวัน
      const ymd = parseDate(date);
      if (!ymd) {
        return Response.json({ error: "Invalid date; expected YYYY-MM-DD." }, { status: 400 });
      }
      const result = buildManVsDay(pillars, dayMaster, ymd.y, ymd.m, ymd.d, text);
      // เติม grade ระดับบนสุด — spread คงคีย์เดิมครบ เติม grade ล้วน
      return Response.json(
        { person: state, ...result, grade: gradeOf(result.overallPercent) },
        { status: 200 },
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Invalid man-vs-day payload.", details: error.issues },
          { status: 400 },
        );
      }
      const message = error instanceof Error ? error.message : "Unknown error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createManVsDayHandler();
