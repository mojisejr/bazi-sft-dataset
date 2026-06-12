/**
 * ตารางคำแก้ของซินแส (phrase substitution rules) — กลไกหลักของ "การเรียนรู้ข้ามดวง"
 *
 * เจตนา: ถ้าซินแสแก้ผลทาย "ได้เงินแบบรายเดือน" → "passive income" แล้ว ดวงอื่นคนละคน
 * ที่ระบบทายได้วลีเดียวกัน ต้องออกเป็น "passive income" เสมอ (deterministic ไม่ใช่ LLM few-shot)
 * replacement = "" หมายถึง "ลบวลีนั้นทิ้ง"
 *
 * โมดูลนี้ "pure" (ไม่มี fs/db) → import ได้ทั้ง client/server.
 * ส่วนเก็บถาวร (อ่าน/เขียนกฎลง Postgres) อยู่ใน substitution-rules-repository.ts (server only)
 */
export type SubstitutionRuleScope = "topic" | "global";

export type SubstitutionRule = {
  id: string;
  scope: SubstitutionRuleScope;
  /** บทที่กฎนี้ใช้ (เมื่อ scope = "topic") */
  topicId?: string;
  /** วลีเดิมจากระบบที่จะถูกแทน */
  match: string;
  /** วลีใหม่ของซินแส (สตริงว่าง = ลบวลีเดิมทิ้ง) */
  replacement: string;
  note?: string;
  source: { kind: "manual" | "diff"; chartSignature?: string };
  createdAt: string;
  hitCount?: number;
};

export type SubstitutionRuleSet = { rules: SubstitutionRule[] };

/**
 * แทนคำตามกฎที่เกี่ยวข้องกับบทนี้ (scope global หรือ topicId ตรง) — pure, idempotent
 * แทนแบบ literal (split/join) จึงไม่ต้อง escape regex; เรียง match ยาว→สั้นกัน overlap
 */
export function applySubstitutionRules(
  topicId: string,
  text: string | null | undefined,
  rules: SubstitutionRule[],
): string {
  if (!text) return text ?? "";
  const applicable = rules
    .filter((rule) => rule.scope === "global" || rule.topicId === topicId)
    .filter((rule) => rule.match.length > 0)
    .sort((a, b) => b.match.length - a.match.length);

  let result = text;
  let removedSomething = false;
  for (const rule of applicable) {
    if (!result.includes(rule.match)) continue;
    result = result.split(rule.match).join(rule.replacement);
    if (rule.replacement.length === 0) removedSomething = true;
  }

  if (removedSomething) {
    // เก็บกวาดหลังลบวลี: ช่องว่างซ้ำ, ช่องว่างหน้าวรรคตอน, บรรทัดว่างเกิน
    result = result
      .split("\n")
      .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").replace(/[ \t]+$/g, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
  }
  return result;
}

/**
 * เสนอคู่แทนคำจากการ diff ผลระบบเดิม vs คำที่ซินแสแก้ (ระดับวรรค/บรรทัด)
 * Thai ไม่มี word boundary → ทำระดับวลี/ประโยคให้ซินแสตัดแต่งก่อนยืนยันเป็นกฎ
 */
export function suggestSubstitutions(
  original: string,
  corrected: string,
): Array<{ match: string; replacement: string }> {
  const split = (text: string) =>
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

  const originalLines = split(original);
  const correctedSet = new Set(split(corrected));
  const originalSet = new Set(originalLines);
  const correctedLines = split(corrected);

  const removed = originalLines.filter((line) => !correctedSet.has(line));
  const added = correctedLines.filter((line) => !originalSet.has(line));

  const pairs: Array<{ match: string; replacement: string }> = [];
  const count = Math.max(removed.length, added.length);
  for (let i = 0; i < count; i += 1) {
    const match = removed[i];
    if (!match) break; // เหลือแต่ของที่เพิ่มล้วน → ไม่ใช่การแทน
    pairs.push({ match, replacement: added[i] ?? "" });
  }
  return pairs;
}

/** ตาราง markdown สำหรับรีวิว (ใช้โดยสคริปต์ออกรายงานกฎ ถ้าต้องการ) */
export function renderRulesMarkdown(set: SubstitutionRuleSet): string {
  const esc = (value: string) => value.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const rows = set.rules.map((rule) => {
    const where = rule.scope === "global" ? "ทุกบท" : (rule.topicId ?? "-");
    const to = rule.replacement.length === 0 ? "_(ลบทิ้ง)_" : esc(rule.replacement);
    return `| ${where} | ${esc(rule.match)} | ${to} | ${esc(rule.note ?? "")} | ${rule.source.kind} |`;
  });
  return [
    "# ตารางคำแก้ของซินแส (phrase substitution rules)",
    "",
    "> สร้างอัตโนมัติจาก `src/lib/bazi/data/rules/phrase-substitutions.json` — อย่าแก้ไฟล์นี้ตรง ๆ",
    "",
    `รวม ${set.rules.length} กฎ`,
    "",
    "| บท | คำเดิม (match) | แก้เป็น (replacement) | หมายเหตุ | ที่มา |",
    "|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}
