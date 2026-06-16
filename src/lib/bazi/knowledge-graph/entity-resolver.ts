/**
 * Entity resolver — NL (ไทย/จีน) → entity id แบบ deterministic (longest-alias-first, NFKC exact)
 *
 * alias มาจาก node ในกราฟ (derive จาก localization เดิม) + ชุดคำพ้องเฉพาะภาษา 2 ชุด:
 *   - STEM_PHONETICS_TH: เสียงอ่านแต้จิ๋วของ 10 ก้าน (เจี่ย/กุ่ย…) — ไม่มีใน codebase เดิม
 *   - BRANCH_COLLOQUIAL_TH: ชื่อสัตว์เรียกลำลอง (หนู/หมู…) คู่กับชื่อทางการ (ชวด/กุน)
 * ทั้งสองเป็น "alias ภาษา" (ไม่ใช่กฎโหราศาสตร์) ผู้ใช้เพิ่มได้
 *
 * entity ที่ไม่อยู่ใน registry จะถูกทิ้ง → สร้าง entity ปลอมไม่ได้ (แม่นยำ 100%)
 */
import { resolveCanonicalTwelveQiStage } from "@/lib/bazi/pillar-display";
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";

import { DISCIPLINES, entityIdFor } from "./entity-registry";
import { getArtifact, getNode } from "./graph-store";
import type { GraphEntityKind, ResolvedEntity } from "./graph-types";

/** เสียงอ่านแต้จิ๋วของก้าน (localization alias — ผู้ใช้ขยายได้) */
const STEM_PHONETICS_TH: Record<string, string[]> = {
  甲: ["เจี่ย"],
  乙: ["อิด", "อิก"],
  丙: ["เปี้ย"],
  丁: ["เต็ง"],
  戊: ["โบ่ว"],
  己: ["กี้"],
  庚: ["แก", "แกะ"],
  辛: ["ซิม", "ซิง"],
  壬: ["หยิ่ม", "ยิ่ม"],
  癸: ["กุ่ย"],
};

/** ชื่อสัตว์ลำลอง คู่กับชื่อทางการใน BRANCH_LABELS_TH */
const BRANCH_COLLOQUIAL_TH: Record<string, string[]> = {
  子: ["หนู"],
  丑: ["วัว", "ควาย"],
  寅: ["เสือ"],
  卯: ["กระต่าย"],
  辰: ["มังกร"],
  巳: ["งู"],
  午: ["ม้า"],
  未: ["แพะ"],
  申: ["ลิง"],
  酉: ["ไก่"],
  戌: ["หมา", "สุนัข"],
  亥: ["หมู"],
};

function nfkc(value: string): string {
  return (value ?? "").normalize("NFKC").trim().toLowerCase();
}

type AliasEntry = { alias: string; norm: string; id: string; kind: GraphEntityKind };

let aliasIndexCache: AliasEntry[] | null = null;

function buildAliasIndex(): AliasEntry[] {
  if (aliasIndexCache) return aliasIndexCache;
  const seen = new Set<string>();
  const entries: AliasEntry[] = [];
  const push = (alias: string | undefined, id: string, kind: GraphEntityKind) => {
    const norm = nfkc(alias ?? "");
    if (!norm) return;
    const key = `${norm}::${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ alias: alias as string, norm, id, kind });
  };

  for (const node of getArtifact().nodes) {
    if (node.kind === "discipline") continue; // discipline แยกไป resolveDiscipline
    // เลขโทรเป็นหลักเดี่ยว ("1") → จะ match ตัวเลขทุกตัวในข้อความ (ปี/อายุ) → noise
    // resolve เฉพาะใน flow เบอร์โทรโดยตรง ไม่ดึงเข้า NL resolver ทั่วไป
    if (node.kind === "phone-digit") continue;
    for (const alias of node.aliases) push(alias, node.id, node.kind);
    // stem.labelTh = ชื่อธาตุ (น้ำ) ซึ่งใช้ร่วมกัน 2 ก้าน (壬/癸) → กำกวม
    // ก้านระบุตัวด้วย CJK + เสียงอ่านเท่านั้น
    if (node.kind !== "stem") push(node.labelTh, node.id, node.kind);
    push(node.labelZh, node.id, node.kind);
  }
  for (const [stem, phonetics] of Object.entries(STEM_PHONETICS_TH)) {
    for (const phonetic of phonetics) push(phonetic, entityIdFor("stem", stem), "stem");
  }
  for (const [branch, names] of Object.entries(BRANCH_COLLOQUIAL_TH)) {
    for (const name of names) push(name, entityIdFor("branch", branch), "branch");
  }

  // longest-alias-first → กันคำสั้นบดบังคำยาว
  entries.sort((a, b) => b.norm.length - a.norm.length);
  aliasIndexCache = entries;
  return entries;
}

/** NL → entity (ทุก kind ยกเว้น discipline) */
export function resolveEntities(question: string): ResolvedEntity[] {
  const norm = nfkc(question);
  const byId = new Map<string, ResolvedEntity>();
  for (const entry of buildAliasIndex()) {
    if (byId.has(entry.id)) continue;
    if (norm.includes(entry.norm)) {
      byId.set(entry.id, {
        id: entry.id,
        kind: entry.kind,
        matchedPhrase: entry.alias,
        confidence: "exact",
      });
    }
  }
  return [...byId.values()];
}

/** NL → discipline id (longest keyword-first) */
export function resolveDisciplines(question: string): string[] {
  const norm = nfkc(question);
  const matches: { id: string; len: number }[] = [];
  for (const discipline of DISCIPLINES) {
    const keywords = [discipline.labelTh, ...discipline.keywords];
    for (const keyword of keywords) {
      const normKeyword = nfkc(keyword);
      if (normKeyword && norm.includes(normKeyword)) {
        matches.push({ id: entityIdFor("discipline", discipline.id), len: normKeyword.length });
        break;
      }
    }
  }
  return matches.sort((a, b) => b.len - a.len).map((match) => match.id);
}

/** seed entity จากดวงที่คำนวณแล้ว (day-master, สี่เสา, ปีจร) */
export function seedEntitiesFromState(state: CalculatedStateValue): ResolvedEntity[] {
  const out: ResolvedEntity[] = [];
  const add = (kind: GraphEntityKind, key: string | undefined, phrase: string) => {
    if (!key) return;
    const id = entityIdFor(kind, key);
    if (getNode(id)) out.push({ id, kind, matchedPhrase: phrase, confidence: "exact" });
  };

  add("stem", state.dayMaster, "ดิถี (day master)");
  const pillars = state.fourPillars;
  for (const [name, pillar] of Object.entries(pillars)) {
    add("stem", pillar.stem, `เสา${name}`);
    add("branch", pillar.branch, `เสา${name}`);
    add("sixty-jiazi", `${pillar.stem}${pillar.branch}`, `เสา${name}`);
  }
  if (state.liuNian) add("branch", state.liuNian.branch, "ปีจร");
  return out;
}

/** หา qi-stage ที่ derive จาก day-master × กิ่ง (สำหรับ "วัยจรตก…") */
export function deriveQiStageEntity(
  dayMasterStem: string | undefined,
  branch: string,
): ResolvedEntity | null {
  if (!dayMasterStem) return null;
  const stage = resolveCanonicalTwelveQiStage(dayMasterStem, branch);
  if (!stage) return null;
  const id = entityIdFor("qi-stage", stage);
  if (!getNode(id)) return null;
  return { id, kind: "qi-stage", matchedPhrase: `${dayMasterStem}${branch}→qi`, confidence: "exact" };
}

/** เคลียร์ cache (สำหรับเทส) */
export function _resetAliasIndexForTest(): void {
  aliasIndexCache = null;
}
