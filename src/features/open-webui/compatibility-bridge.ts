// Compatibility (ดูดวงคู่/สมพงศ์) grounding for chat: when the user asks "เข้ากันไหม" and gives the
// OTHER person's birth, we compute BOTH charts via the existing pair engine (/api/bazi/pair) and
// render a real สมพงศ์ reading — instead of the chat fabricating the second person's chart.
import { type RawInputValue } from "@/lib/bazi/schema-types";

export type RelationshipKind = "love" | "colleague";

// งาน/หุ้นส่วน/ลูกน้อง/เพื่อนร่วมงาน → colleague; อื่น ๆ (แฟน/คู่ครอง/เนื้อคู่) → love (ค่าเริ่มต้น)
const WORK_REL_RE = /หุ้นส่วน|ร่วมงาน|ลูกน้อง|เจ้านาย|หัวหน้า|ทีมงาน|ร่วมทุน|ทำงานด้วย|โคเวิร์ค|โคเวิร์กเกอร์/;
export function detectRelationship(message?: string | null): RelationshipKind {
  return typeof message === "string" && WORK_REL_RE.test(message) ? "colleague" : "love";
}

type PairFacet = {
  label?: unknown;
  pairingLabel?: unknown;
  percent?: unknown;
  grade?: unknown;
  ratingText?: unknown;
  isMain?: unknown;
  lines?: unknown;
};

type PairResponse = {
  facets?: unknown;
  mainFacet?: unknown;
  comparison?: {
    match?: { love?: { overallPercent?: unknown; overallGrade?: unknown }; work?: { overallPercent?: unknown; overallGrade?: unknown } };
    personA?: { elementTh?: unknown; nisai?: unknown };
    personB?: { elementTh?: unknown; nisai?: unknown };
  };
};

function num(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}
function str(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

function renderFacet(f: PairFacet): string {
  const label = str(f.label) || str(f.pairingLabel);
  const pct = num(f.percent);
  const grade = str(f.grade);
  const rating = str(f.ratingText);
  const firstLine = Array.isArray(f.lines) && f.lines.length
    ? str((f.lines[0] as { text?: unknown })?.text)
    : "";
  const head = `- ${label || "มิติหนึ่ง"}: ${pct != null ? `${pct}%` : "-"}${grade ? ` เกรด ${grade}` : ""}${rating ? ` (${rating})` : ""}`;
  return firstLine ? `${head}\n  ${firstLine}` : head;
}

// ยิง engine pair แล้วเรียบเรียงผลเป็นก้อนความจริงสำหรับ chat. คืน null เมื่อยิงไม่ได้ (caller ใช้ guard เดิม).
export async function fetchCompatibilityReading(
  origin: string,
  args: { personA: RawInputValue; personB: RawInputValue; relationship: RelationshipKind; partnerTimeAssumed?: boolean },
): Promise<string | null> {
  try {
    const res = await fetch(`${origin}/api/bazi/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personA: args.personA, personB: args.personB, relationship: args.relationship }),
    });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as PairResponse;
    const facets = Array.isArray(json.facets) ? (json.facets as PairFacet[]) : [];
    if (!facets.length) {
      return null;
    }

    const rel = args.relationship === "colleague" ? "work" : "love";
    const overall = json.comparison?.match?.[rel];
    const overallPct = num(overall?.overallPercent);
    const overallGrade = str(overall?.overallGrade);

    const main = json.mainFacet && typeof json.mainFacet === "object" ? (json.mainFacet as PairFacet) : null;
    // มิติเด่น 3 อันดับ (ตัด main ไม่ให้ซ้ำ)
    const ranked = facets
      .filter((f) => f !== main)
      .sort((a, b) => (num(b.percent) ?? -1) - (num(a.percent) ?? -1))
      .slice(0, 3);

    const relLabel = args.relationship === "colleague" ? "ด้านการงาน/ร่วมงาน" : "ด้านความรัก/คู่ครอง";
    const lines: string[] = [
      `ผลวิเคราะห์ดวงคู่ (สมพงศ์ ${relLabel}) จาก engine โดยคำนวณดวงจริงทั้งสองฝ่าย — ใช้ตอบได้เลย:`,
    ];
    if (overallPct != null) {
      lines.push(`ความเข้ากันโดยรวม: ${overallPct}%${overallGrade ? ` (เกรด ${overallGrade})` : ""}`);
    }
    if (main) {
      lines.push(`มิติหลัก:\n${renderFacet(main)}`);
    }
    if (ranked.length) {
      lines.push(`มิติอื่น:\n${ranked.map(renderFacet).join("\n")}`);
    }
    if (args.partnerTimeAssumed) {
      lines.push("หมายเหตุ: ไม่ทราบเวลาเกิดของอีกฝ่าย ใช้เที่ยงวันโดยประมาณ — มิติที่อิงยามอาจคลาดเคลื่อนได้ ให้บอกผู้ใช้ด้วย.");
    }
    lines.push("เรียบเรียงเป็นคำฟันธงแบบซินแส (เข้ากันแค่ไหน จุดหนุน-จุดปะทะ วิธีปรับเข้าหากัน) จากตัวเลข/คำทำนายด้านบน ห้ามแต่งเสา/ดวงเพิ่มเอง.");
    return lines.join("\n\n");
  } catch {
    return null;
  }
}
