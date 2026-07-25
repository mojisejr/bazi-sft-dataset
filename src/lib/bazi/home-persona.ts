import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
import { elementLabelForSymbol } from "@/lib/bazi/element-label";

export type HomePersona = {
  elementTh: string; // day-master element, Thai label ("ไม้"/"ไฟ"/"ดิน"/"ทอง"/"น้ำ")
  strengthLabel: string; // day-master strength band — REAL engine vocab ("ดิถีแข็ง"/"ดิถีอ่อน"/…)
};

// Home "ธาตุของคุณ" line: day-master element + strength band, both derived from the SAME
// calculatedState the day's fortune uses (no drift between the reading and the persona line).
// Reuses the shared element-label helper + the existing strength classifier — no engine change.
// The strength label is the engine's ground-truth vocabulary (ดิถีอ่อนเกินไป/ดิถีอ่อน/ดิถีสมดุล/
// ดิถีแข็ง/ดิถีแข็งเกินไป), intentionally NOT mapped to a friendlier synonym.
// PURE. Throws only when the score is NaN / out of every band's domain — callers guard that to a
// null persona so a bad score never breaks the rest of the home payload.
export function buildHomePersona(input: { dayMaster: string; strengthScore: number }): HomePersona {
  return {
    elementTh: elementLabelForSymbol(input.dayMaster),
    strengthLabel: classifyOperatorStrengthScore(input.strengthScore).displayLabel,
  };
}
