// Hour Rectification — reading-diff-detailed (#hour-rectification-engine, unified lane ชั้นละเอียด).
//
// ยกระดับจาก 3 มิติ curated: จำลอง "อ่านดวงเต็ม 15 บท" (pipeline เดียวกับ /reading/newdata-reading
// คือ resolveChapterBoxes) ให้ดวงทั้ง 12 ยามของผู้ตอบ แล้ว diff กล่องคำทำนายทุกกล่องข้ามยาม —
// กล่องไหนที่เนื้อต่างกันระหว่าง candidate = คำถามเพิ่มได้
//
// การกรองเพื่อความแม่นยำ (ตามซินแส "กรองดีๆ"):
//   - กล่องที่เนื้อเหมือนกันทุกยาม = ทิ้ง (ไม่แยกยาม → noise)
//   - กล่องที่ partition ของยามซ้ำกับคำถามที่เลือกไปแล้ว = ทิ้ง (ไม่เพิ่มข้อมูลใหม่ ถามซ้ำเปล่าๆ)
//   - เนื้อ 18+ = ตัดทั้งกล่อง · ถ้อยคำแรง = soften · ตาราง markdown = ทิ้ง (สรุปเป็นตัวเลือกไม่ได้)
//   - จัดอันดับกล่องตามพลังแยก (จำนวนกลุ่มมาก + กลุ่มใหญ่สุดเล็ก = แยกละเอียดสุด) แล้ว cap จำนวนข้อ
//
// Pure ทั้งไฟล์ — ไม่มี LLM/engine/DB (วินัยเดียวกับ domain/ ทุกไฟล์)

import { HOUR_BRANCHES, type HourBranch } from "./types";
import {
  disambiguateLabels,
  isBlockedText,
  softenText,
  SKIP_OPTION_ID,
  type ReadingOption,
  type ScorableQuestion,
} from "./reading-diff";

export const DETAILED_QUESTION_WEIGHT = 2;

// กล่องคำทำนายของดวง 1 ยาม: key = "{chapterId}:{boxIndex}" (stable ข้าม request → คำถาม deterministic)
export type HourBoxFacts = {
  hourBranch: HourBranch;
  boxes: Record<string, { title: string; body: string }>;
};

export type DetailedQuestion = ScorableQuestion & {
  boxKey: string;
  boxTitle: string;
};

const branchOrder = new Map<HourBranch, number>(HOUR_BRANCHES.map((b, i) => [b, i]));

/** ลายเซ็น partition ของกลุ่มยาม — ใช้ตัดคำถามที่แบ่งกลุ่มซ้ำกับข้อที่เลือกไปแล้ว */
export function partitionSignature(groups: readonly (readonly HourBranch[])[]): string {
  return groups
    .map((hours) =>
      [...hours].sort((a, b) => (branchOrder.get(a) ?? 0) - (branchOrder.get(b) ?? 0)).join(""),
    )
    .sort()
    .join("|");
}

/** ลายเซ็น partition ของคำถามที่มีอยู่แล้ว (เอา option ข้ามออก) */
export function questionPartitionSignature(question: ScorableQuestion): string {
  return partitionSignature(
    question.options.filter((o) => o.id !== SKIP_OPTION_ID).map((o) => o.hours),
  );
}

function hasMarkdownTable(text: string): boolean {
  return /(^|\n)\s*\|/.test(text);
}

/**
 * สร้างคำถามชั้นละเอียดจากกล่องคำทำนายเต็ม 15 บทของ candidate hours
 * - seenSignatures: partition ของคำถาม curated ที่ถามอยู่แล้ว (กันถามซ้ำเชิงข้อมูล)
 * - maxQuestions: เพดานจำนวนข้อเพิ่ม (กัน quiz ยาวเกิน)
 */
export function buildDetailedQuestions(
  factSets: readonly HourBoxFacts[],
  candidateHours: readonly HourBranch[],
  opts: { maxQuestions: number; seenSignatures?: ReadonlySet<string> },
): DetailedQuestion[] {
  const candidates = new Set(candidateHours);
  const seen = new Set(opts.seenSignatures ?? []);

  // รวม key กล่องทั้งหมดที่โผล่ในยามใดยามหนึ่ง (เรียง deterministic)
  const allKeys = [...new Set(factSets.flatMap((fs) => Object.keys(fs.boxes)))].sort();

  type Candidate = { question: DetailedQuestion; groupCount: number; largestGroup: number };
  const out: Candidate[] = [];

  for (const key of allKeys) {
    // group: เนื้อ (หลัง soften) → ยามที่ได้เนื้อนั้น
    const groups = new Map<string, HourBranch[]>();
    let title = "";
    let blocked = false;
    for (const fs of factSets) {
      if (!candidates.has(fs.hourBranch)) continue;
      const box = fs.boxes[key];
      if (!box || !box.body.trim()) continue;
      if (isBlockedText(box.body)) {
        blocked = true; // 18+ = ตัดทั้งกล่อง (ไม่ใช่แค่ยามเดียว)
        break;
      }
      if (hasMarkdownTable(box.body)) {
        blocked = true; // ตาราง → สรุปเป็นตัวเลือกอ่านรู้เรื่องไม่ได้
        break;
      }
      title = box.title || title;
      const text = softenText(box.body.trim());
      const bucket = groups.get(text);
      if (bucket) bucket.push(fs.hourBranch);
      else groups.set(text, [fs.hourBranch]);
    }
    if (blocked || groups.size < 2) continue;

    const coveredHours = [...groups.values()].reduce((n, hs) => n + hs.length, 0);
    const largest = Math.max(...[...groups.values()].map((hs) => hs.length));
    if (largest >= coveredHours) continue; // กลุ่มเดียวครอบทุกยามที่มีเนื้อ = แยกไม่ได้

    const sortedGroups = [...groups.entries()].sort(
      (a, b) => (branchOrder.get(a[1][0]) ?? 0) - (branchOrder.get(b[1][0]) ?? 0),
    );
    const signature = partitionSignature(sortedGroups.map(([, hours]) => hours));
    if (seen.has(signature)) continue; // แบ่งกลุ่มซ้ำกับข้อที่มีแล้ว = ไม่เพิ่มข้อมูล
    seen.add(signature);

    const labels = disambiguateLabels(sortedGroups.map(([text]) => text));
    const options: ReadingOption[] = sortedGroups.map(([, hours], index) => ({
      id: `${key}-${index + 1}`,
      label: labels[index],
      hours: [...hours].sort((a, b) => (branchOrder.get(a) ?? 0) - (branchOrder.get(b) ?? 0)),
    }));
    options.push({ id: SKIP_OPTION_ID, label: "ไม่แน่ใจ / ไม่ตรงสักข้อ", hours: [] });

    out.push({
      question: {
        id: key,
        boxKey: key,
        boxTitle: title,
        question: `เรื่อง「${title}」ข้อไหนใกล้เคียงตัวคุณที่สุด?`,
        weight: DETAILED_QUESTION_WEIGHT,
        options,
      },
      groupCount: sortedGroups.length,
      largestGroup: largest,
    });
  }

  // จัดอันดับพลังแยก: กลุ่มมากก่อน → กลุ่มใหญ่สุดเล็กก่อน → ตามลำดับ key (deterministic)
  out.sort((a, b) => {
    if (b.groupCount !== a.groupCount) return b.groupCount - a.groupCount;
    if (a.largestGroup !== b.largestGroup) return a.largestGroup - b.largestGroup;
    return a.question.boxKey.localeCompare(b.question.boxKey);
  });

  return out.slice(0, Math.max(0, opts.maxQuestions)).map((c) => c.question);
}
