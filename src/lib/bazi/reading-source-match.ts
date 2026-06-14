/**
 * จับคู่ "ย่อหน้าคำทำนาย" → ช่องตาราง catalog (chip อ้างอิง / แก้ในคลัง) ฝั่ง client.
 * รองรับทั้งค่าคงที่ (indexOf) และ "โครงประโยค" ที่มี {placeholder} (regex full-match)
 * — เพราะหลังห่อ template ค่าในคลังมี {…} แต่ output แทนค่าจริงแล้ว substring ตรงๆ จะไม่เจอ.
 */

/** catalog องค์ความรู้แบบย่อ (จาก /api/reading/knowledge-override) */
export type KnowledgeTableLite = {
  tableId: string;
  label: string;
  entries: Array<{
    key: string;
    keyLabel?: string;
    default: string;
    published: string | null;
    draft: string | null;
  }>;
};

/**
 * แหล่งที่มาของย่อหน้า
 *  - exact = ย่อหน้าเท่ากับ "ค่าคงที่" ของช่องเป๊ะ → แก้ catalog inline ได้ปลอดภัย (publish ค่าที่เห็นได้)
 *  - full  = ทั้งย่อหน้ามาจากช่องนี้ (exact-คงที่ หรือ template เต็มทั้งย่อหน้า) → ไม่ใช่ "บางส่วน"
 *    template เป็น full แต่ exact=false เพราะค่าจริงแทน {…} แล้ว publish กลับไม่ได้ (จะทับ placeholder)
 */
export type ParagraphSource = {
  label: string;
  tableId: string;
  key: string;
  keyLabel: string;
  value: string;
  exact: boolean;
  full: boolean;
};

/** entry ที่ precompile ไว้ (constant = indexOf, template = regex full-match) */
export type CompiledEntry = {
  tableId: string;
  label: string;
  key: string;
  keyLabel: string;
  value: string;
  isTemplate: boolean;
  regex: RegExp | null;
};

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * งบ prefix ที่ยอมให้นำหน้า template match — รองรับ "คำเชื่อม" ที่ weaveNarrative เติมหน้าย่อหน้า
 * (เช่น "นอกจากนี้ ", "ในอีกด้านหนึ่ง ") โดยไม่ import NARRATIVE_CONNECTORS (server-only) เข้า client
 */
export const TEMPLATE_PREFIX_BUDGET = 16;

/**
 * regex ของ template: escape ชิ้น literal, whitespace→\s+, placeholder {…}→[\s\S]*?, anchor ท้าย (\s*$).
 * ไม่ anchor หัว (^) เพื่อยอมให้มีคำเชื่อมนำ — ตอน match จะเช็คว่า index ที่เจอ ≤ TEMPLATE_PREFIX_BUDGET.
 * คืน null ถ้า literal (ตัด placeholder แล้ว) สั้นเกิน (<8) — กัน template ที่แทบไม่มีตัวคงที่ match มั่ว
 */
export function buildTemplateRegex(value: string): RegExp | null {
  const parts = value.split(/\{[^{}]+\}/g);
  if (parts.join("").trim().length < 8) return null;
  const core = parts.map((seg) => escapeRegExp(seg).replace(/\s+/g, "\\s+")).join("[\\s\\S]*?");
  try {
    return new RegExp(`${core}\\s*$`);
  } catch {
    return null;
  }
}

/** precompile catalog ทั้งหมดครั้งเดียว — value = draft??published??default */
export function compileKnowledgeTables(tables: KnowledgeTableLite[]): CompiledEntry[] {
  const out: CompiledEntry[] = [];
  for (const table of tables) {
    for (const entry of table.entries) {
      const value = (entry.draft ?? entry.published ?? entry.default ?? "").trim();
      if (value.length === 0) continue;
      const isTemplate = /\{[^{}]+\}/.test(value);
      out.push({
        tableId: table.tableId,
        label: table.label,
        key: entry.key,
        keyLabel: entry.keyLabel ?? entry.key,
        value,
        isTemplate,
        regex: isTemplate ? buildTemplateRegex(value) : null,
      });
    }
  }
  return out;
}

/**
 * map ย่อหน้า → ช่อง catalog ที่ "ปรากฏ" ในย่อหน้า. 1 ย่อหน้าอาจมาจากหลายตาราง → คืนทุกแหล่งที่ match.
 *  - constant: indexOf; exact = ย่อหน้าตรงค่าเป๊ะ
 *  - template: regex full-match ทั้งย่อหน้า → full=true, exact=false (ไม่ทำ substring-template กัน chip รก)
 *
 * dedup ด้วย "สิ่งที่ผู้ใช้เห็น" (ป้ายที่โชว์ + full) ไม่ใช่ tableId|key — เพราะ:
 *  (ก) ตารางข้อมูล composite-key หลาย key มี "ค่าเดียวกัน" (LOVE_DAY_SPOUSE_TH: 62 key/14 ค่า)
 *  (ข) ย่อหน้าเดียวอาจ match หลายค่าในตารางเดียว แต่ partial chip โชว์ "label ตาราง" เหมือนกันหมด
 * ทั้งสองกรณีผู้ใช้เห็น chip หน้าตาซ้ำ → ยุบเป็นอันเดียวต่อ (ป้ายที่โชว์ + full).
 * แต่ละกลุ่มเลือก key ที่ "ตรงดวง" — ทุกส่วนของ composite key ปรากฏใน hay (เช่น "辛|卯" — hay มี 辛,卯)
 * เพื่อให้ลิงก์ "แก้ในคลัง" ไปถูกแถวของดวงนี้.
 * ป้ายที่โชว์: template-full = keyLabel (รายช่อง), constant = label (ของตาราง) — ตรงกับ TopicCard.
 */
export function resolveParagraphSources(text: string, compiled: CompiledEntry[]): ParagraphSource[] {
  const hay = text.trim();
  if (hay.length === 0) return [];
  const groups = new Map<string, ParagraphSource & { at: number; score: number }>();
  for (const entry of compiled) {
    let at = -1;
    let exact = false;
    let full = false;
    if (entry.isTemplate) {
      if (!entry.regex) continue;
      const m = entry.regex.exec(hay);
      // match ทั้งย่อหน้า (เผื่อคำเชื่อมนำ ≤ budget) → full; ลึกกว่านั้นถือว่าไม่ใช่ที่มาของย่อหน้า
      if (!m || m.index > TEMPLATE_PREFIX_BUDGET) continue;
      at = m.index;
      full = true;
    } else {
      if (entry.value.length < 8) continue;
      at = hay.indexOf(entry.value);
      if (at < 0) continue;
      exact = hay === entry.value;
      full = exact;
    }
    // ป้ายที่ผู้ใช้เห็นจริง (ตรงกับ TopicCard: template-full → keyLabel, constant → label)
    const shownLabel = full && !exact ? entry.keyLabel : entry.label;
    const groupKey = `${shownLabel}|${full ? 1 : 0}`;
    // score: composite key (split "|") ที่ "ทุกส่วน" ปรากฏใน hay = key ที่ตรงดวงนี้ (ไม่ใช่ค่าบังเอิญเหมือน)
    const parts = entry.key.split("|").filter((p) => p.length > 0);
    const score = parts.length > 0 && parts.every((p) => hay.includes(p)) ? 1 : 0;
    const prev = groups.get(groupKey);
    if (!prev || score > prev.score) {
      groups.set(groupKey, {
        label: entry.label,
        tableId: entry.tableId,
        key: entry.key,
        keyLabel: entry.keyLabel,
        value: entry.value,
        exact,
        full,
        at,
        score,
      });
    }
  }
  const found = [...groups.values()];
  // full-match ก่อน แล้วเรียงตามตำแหน่ง; ตำแหน่งเท่ากัน → ยาวกว่ามาก่อน
  found.sort((a, b) => Number(b.full) - Number(a.full) || a.at - b.at || b.value.length - a.value.length);
  return found.map(({ at: _at, score: _score, ...rest }) => rest);
}
