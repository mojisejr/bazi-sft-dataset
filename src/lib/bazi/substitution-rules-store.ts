/**
 * ที่เก็บกฎแทนคำ (server only) — อ่าน/เขียนไฟล์ JSON ใน repo + gen docs markdown
 * เรียกได้เฉพาะใน route ที่ runtime = "nodejs" เท่านั้น (มี node:fs)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  renderRulesMarkdown,
  type SubstitutionRuleSet,
} from "@/lib/bazi/substitution-rules";

const RULES_PATH = join(process.cwd(), "src", "lib", "bazi", "data", "rules", "phrase-substitutions.json");
const DOCS_PATH = join(process.cwd(), "docs", "substitution-rules.md");

export function readRules(): SubstitutionRuleSet {
  try {
    if (!existsSync(RULES_PATH)) return { rules: [] };
    const parsed = JSON.parse(readFileSync(RULES_PATH, "utf8")) as SubstitutionRuleSet;
    return parsed && Array.isArray(parsed.rules) ? parsed : { rules: [] };
  } catch {
    return { rules: [] };
  }
}

export function writeRules(set: SubstitutionRuleSet): void {
  mkdirSync(dirname(RULES_PATH), { recursive: true });
  writeFileSync(RULES_PATH, `${JSON.stringify(set, null, 2)}\n`, "utf8");
  try {
    mkdirSync(dirname(DOCS_PATH), { recursive: true });
    writeFileSync(DOCS_PATH, renderRulesMarkdown(set), "utf8");
  } catch {
    /* docs เป็นของแถม — ถ้าเขียนไม่ได้ ข้ามได้ */
  }
}
