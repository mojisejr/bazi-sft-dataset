/**
 * Seed "ข้อมูลหลักแบบใหม่" (NewData) → ตาราง bazi_newdata
 * แปลงไฟล์ใน knownlage/NewData/*.txt เป็น rows (group_key / item_key / value)
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/seed-reading-newdata.ts --dry-run   # ดูผล ไม่เขียน DB
 *   node --env-file=.env --import tsx scripts/seed-reading-newdata.ts             # เขียน (ON CONFLICT DO NOTHING — ไม่ทับของที่ซินแสแก้)
 *   node --env-file=.env --import tsx scripts/seed-reading-newdata.ts --force     # เขียนทับทุกแถว (ใช้ตอนแก้ parser)
 *
 * ออกแบบให้ "เว้นว่าง" บทที่ซินแสยังไม่ส่ง — ไฟล์ไหนไม่มี ก็ไม่มี row, ซินแสมาเติมในแอดมินทีหลังได้
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { sql } from "drizzle-orm";

import { createDbClient } from "../src/db/client";
import { baziNewdata, type NewdataValue } from "../src/db/schema";
import { getStandaloneCoreDescriptions } from "../src/lib/bazi/topic-knowledge";
import {
  BRANCH_ORDER,
  SIXTY_JIAZI,
  STEM_ORDER,
  STRENGTH_BANDS,
} from "../src/lib/bazi/knowledge/standalone-tables";
import { BRANCH_LABELS_TH } from "../src/lib/bazi/symbolic-engine.constants";

const NEWDATA_DIR = path.resolve(process.cwd(), "knownlage/NewData");

type SeedRow = {
  groupKey: string;
  itemKey: string;
  ordinal: number;
  value: NewdataValue;
  sourceFile: string;
};

// ── พจนานุกรมอ้างอิง ──────────────────────────────────────────────────────
const BRANCHES: Record<string, string> = {
  子: "ชวด", 丑: "ฉลู", 寅: "ขาล", 卯: "เถาะ", 辰: "มะโรง", 巳: "มะเส็ง",
  午: "มะเมีย", 未: "มะแม", 申: "วอก", 酉: "ระกา", 戌: "จอ", 亥: "กุน",
};
const STEMS = new Set("甲乙丙丁戊己庚辛壬癸".split(""));

/** ลำดับวัฏจักร 12 เชี่ยงแซ + ชื่อ canonical (alias → canonical) */
const STATE_ORDER: Record<string, number> = {
  ทอ: 1, เอี้ยง: 2, เชี่ยงแซ: 3, หมกยก: 4, กวงตั่ว: 5, ลิ่มกัว: 6,
  ตี้อ๋วง: 7, ซวย: 8, แป่: 9, ซี่: 10, หมอ: 11, เจ๊าะ: 12,
};
const STATE_ALIAS: Record<string, string> = { เอี๊ยง: "เอี้ยง", เจ๊าะ: "เจ๊าะ" };
function canonicalState(word: string): string | null {
  const w = STATE_ALIAS[word] ?? word;
  return w in STATE_ORDER ? w : null;
}

function splitLines(raw: string): string[] {
  return raw.replace(/^﻿/, "").split(/\r?\n/);
}
function read(file: string): string {
  // NFC normalize: ต้นฉบับบางตัวใช้ CJK Compatibility Ideograph (เช่น 辰 = U+F971)
  // normalize ให้กลายเป็น codepoint ปกติ (U+8FB0) เพื่อให้ match กับ BRANCHES ได้
  return readFileSync(path.join(NEWDATA_DIR, file), "utf8").normalize("NFC");
}
function branchesIn(line: string): string[] {
  const found = [...line].filter((c) => c in BRANCHES);
  return [...new Set(found)];
}

// ── parser: "state-keyed" (12 เชี่ยงแซ / การศึกษา / การเรียน) ─────────────────
function parseStateKeyed(file: string, group: string, stopAt?: string): SeedRow[] {
  let lines = splitLines(read(file));
  if (stopAt) {
    const idx = lines.findIndex((l) => l.includes(stopAt));
    if (idx >= 0) lines = lines.slice(0, idx);
  }
  const collected: Array<{ key: string; bullets: string[] }> = [];
  let current: { key: string; bullets: string[] } | null = null;
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("*")) continue;
    const content = t.replace(/^\*+\s*/, "").trim();
    if (!content) continue;
    const canon = canonicalState(content);
    if (canon) {
      current = { key: canon, bullets: [] };
      collected.push(current);
    } else if (current) {
      current.bullets.push(content);
    }
  }
  return collected.map((c) => ({
    groupKey: group,
    itemKey: c.key,
    ordinal: STATE_ORDER[c.key] ?? 0,
    value: { text: c.bullets.join("\n"), label: c.key },
    sourceFile: file,
  }));
}

// ── parser: "pair-keyed" (ชง / เฮ้ง / ไห่ / จื่อเฮ้ง) ─────────────────────────
function parsePairs(file: string, group: string): SeedRow[] {
  const lines = splitLines(read(file));
  const rows: SeedRow[] = [];
  let pending: { key: string; label: string } | null = null;
  let order = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("*")) {
      if (pending) {
        const text = t.replace(/^\*+\s*/, "").trim();
        rows.push({
          groupKey: group,
          itemKey: pending.key,
          ordinal: ++order,
          value: { text, label: pending.label },
          sourceFile: file,
        });
        pending = null;
      }
      continue;
    }
    const b = branchesIn(t);
    if (b.length >= 1) {
      pending = { key: b.join("-"), label: b.map((x) => BRANCHES[x]).join("×") };
    }
  }
  return rows;
}

// ── parser: ผั่ว (numbered ganzhi entries + category) ───────────────────────
function parsePhua(file: string): SeedRow[] {
  const CATEGORIES = ["ถ่ายเทจนหมดตัว", "ส่งเสริมแต่แฝงพิษ", "พิฆาตกันเองภายใน", "คู่ธาตุและขุมคลังรั่วไหล"];
  const lines = splitLines(read(file));
  const rows: SeedRow[] = [];
  let category = "";
  let current: SeedRow | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (current) {
      current.value.text = buf.join(" ").trim();
      rows.push(current);
    }
    current = null;
    buf = [];
  };
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (CATEGORIES.includes(t)) {
      flush();
      category = t;
      continue;
    }
    const m = t.match(/^(\d+)\.(.+)$/);
    if (m) {
      flush();
      const rest = m[2].trim();
      const stem = [...rest].find((c) => STEMS.has(c)) ?? "";
      const branch = [...rest].find((c) => c in BRANCHES) ?? "";
      const firstCjkIdx = [...rest].findIndex((c) => STEMS.has(c) || c in BRANCHES);
      const label = (firstCjkIdx > 0 ? rest.slice(0, firstCjkIdx) : "").trim();
      current = {
        groupKey: "phua",
        itemKey: `${stem}${branch}`,
        ordinal: Number(m[1]),
        value: { text: "", label, category },
        sourceFile: file,
      };
      continue;
    }
    if (current) buf.push(t);
  }
  flush();
  return rows;
}

// ── parser: ภาคีคู่ บน-ล่าง (combine stem / branch) ─────────────────────────
function parseCombine(file: string): SeedRow[] {
  const lines = splitLines(read(file));
  const rows: SeedRow[] = [];
  let order = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const m = t.match(/^(.)\s*\+\s*(.)\s*=\s*(.)/u);
    if (!m) continue;
    const [, a, b] = m;
    const isStem = STEMS.has(a) && STEMS.has(b);
    const isBranch = a in BRANCHES && b in BRANCHES;
    if (!isStem && !isBranch) continue;
    // หาบรรทัดชื่อภาคี (“…”) ถัดไป ไม่เกิน 2 บรรทัดถัดมา
    let label = "";
    for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
      const q = lines[j].trim();
      if (q.startsWith("“") || q.startsWith('"')) {
        label = q.replace(/[“”"]/g, "").trim();
        break;
      }
    }
    rows.push({
      groupKey: isStem ? "combine_stem" : "combine_branch",
      itemKey: `${a}${b}`,
      ordinal: ++order,
      value: { text: t, label },
      sourceFile: file,
    });
  }
  return rows;
}

// ── parser: ไตรภาคี (full + half) ───────────────────────────────────────────
function parseTrinity(file: string): SeedRow[] {
  const lines = splitLines(read(file));
  const rows: SeedRow[] = [];
  let order = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const full = t.match(/^ไตรภาคี(น้ำ|ไฟ|ทอง|ไม้)\s*$/);
    if (full) {
      const desc = (lines[i + 1] ?? "").trim();
      let branches: string[] = [];
      for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
        const b = branchesIn(lines[j]);
        if (b.length >= 2) { branches = b; break; }
      }
      rows.push({
        groupKey: "trinity",
        itemKey: full[1],
        ordinal: ++order,
        value: { text: desc, label: `ไตรภาคี${full[1]}`, branches },
        sourceFile: file,
      });
      continue;
    }
    const half = t.match(/^(.)\s*\+\s*(.)\s*=.*ครึ่งไตรภาคี/u);
    if (half) {
      const [, a, b] = half;
      if (!(a in BRANCHES && b in BRANCHES)) continue;
      rows.push({
        groupKey: "trinity_half",
        itemKey: `${a}${b}`,
        ordinal: ++order,
        value: { text: t, label: `${BRANCHES[a]}+${BRANCHES[b]}` },
        sourceFile: file,
      });
    }
  }
  return rows;
}

// ── parser: 4 แถว 8 อักษร (pillars meaning) ─────────────────────────────────
function parsePillars(file: string): SeedRow[] {
  let lines = splitLines(read(file));
  const stop = lines.findIndex((l) => l.includes("ตารางความหมาย"));
  if (stop >= 0) lines = lines.slice(0, stop);
  const rows: SeedRow[] = [];
  const PILLARS: Record<string, number> = { ปี: 1, เดือน: 2, วัน: 3, ยาม: 4 };
  const introBuf: string[] = [];
  let current: { key: string; head: string; bullets: string[] } | null = null;
  const flush = () => {
    if (current) {
      rows.push({
        groupKey: "pillars_meaning",
        itemKey: current.key,
        ordinal: PILLARS[current.key],
        value: { text: [current.head, ...current.bullets].filter(Boolean).join("\n"), label: `แถว${current.key}` },
        sourceFile: file,
      });
    }
  };
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("*")) {
      const content = t.replace(/^\*+\s*/, "").trim();
      const pillar = Object.keys(PILLARS).find((p) => content.startsWith(`แถว${p}`));
      if (pillar) {
        flush();
        current = { key: pillar, head: content.replace(`แถว${pillar}`, "").trim(), bullets: [] };
      } else if (current) {
        current.bullets.push(content);
      }
    } else if (!current) {
      introBuf.push(t);
    }
  }
  flush();
  if (introBuf.length) {
    rows.unshift({
      groupKey: "pillars_meaning",
      itemKey: "บทนำ",
      ordinal: 0,
      value: { text: introBuf.join("\n"), label: "บทนำ" },
      sourceFile: file,
    });
  }
  return rows;
}

// ── parser: ซำเฮ้ง (3 กลุ่ม + ชุดตัวแทน 3 ตัว) ──────────────────────────────
function parseSamHeng(file: string): SeedRow[] {
  const lines = splitLines(read(file));
  const rows: SeedRow[] = [];
  const GROUPS = ["กลุ่มพาหะ", "กลุ่มแม่ธาตุ", "กลุ่มขุนคลัง", "กลุ่มขุมคลัง"];
  let order = 0;
  let current: { key: string; text: string; combos: string[][] } | null = null;
  const flush = () => { if (current) rows.push({ groupKey: "sam_heng", itemKey: current.key, ordinal: ++order, value: { text: current.text, combos: current.combos }, sourceFile: file }); };
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const g = GROUPS.find((x) => t === x);
    if (g) { flush(); current = { key: g.replace(/^กลุ่ม/, ""), text: "", combos: [] }; continue; }
    if (!current) continue;
    if (t.startsWith("*")) { current.text = t.replace(/^\*+\s*/, "").trim(); continue; }
    const b = branchesIn(t);
    if (b.length >= 2) current.combos.push(b);
  }
  flush();
  return rows;
}

// ── parser: อาชีพ 5 ธาตุ (element → รายชื่ออาชีพ) ────────────────────────────
function parseCareerByElement(file: string): SeedRow[] {
  const lines = splitLines(read(file));
  const ELEMENTS = ["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"];
  const ORDER: Record<string, number> = { ไม้: 1, ไฟ: 2, ดิน: 3, ทอง: 4, น้ำ: 5 };
  const rows: SeedRow[] = [];
  let current: { key: string; bullets: string[] } | null = null;
  const flush = () => {
    if (current) {
      rows.push({
        groupKey: "career_by_element",
        itemKey: current.key,
        ordinal: ORDER[current.key] ?? 0,
        value: { text: current.bullets.join("\n"), label: `อาชีพ/ธุรกิจ ธาตุ${current.key}` },
        sourceFile: file,
      });
    }
  };
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const content = t.replace(/^[•*]+\s*/, "").trim();
    const head = ELEMENTS.find((el) => content === `ธาตุ${el}`);
    if (head) {
      flush();
      current = { key: head, bullets: [] };
      continue;
    }
    if (current && /^[•*]/.test(t)) current.bullets.push(content);
  }
  flush();
  return rows;
}

// ── parser: บท 7 ลักษณะชีวิตคู่ (ปฏิกิริยาธาตุหลักวัน → 5 แบบ) ────────────────────
function parseLoveBase(file: string): SeedRow[] {
  const lines = splitLines(read(file));
  // เรียง keyword กันชนกัน (ธาตุลาภ ก่อน พิฆาตธาตุ; ก่อเกิด/คู่ธาตุ เฉพาะตัว)
  const REL: Array<[string, string]> = [
    ["ก่อเกิด", "resource"], ["คู่ธาตุ", "same"], ["ธาตุลาภ", "wealth"],
    ["พิฆาตธาตุ", "power"], ["ถ่ายเท", "output"],
  ];
  const rows: SeedRow[] = [];
  const seen = new Set<string>();
  let order = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("*") || !t.includes("ราศีล่างหลักวัน") || !t.includes("หมายถึง")) continue;
    const content = t.replace(/^\*+\s*/, "").trim();
    const rel = REL.find(([w]) => content.includes(w));
    if (!rel || seen.has(rel[1])) continue;
    seen.add(rel[1]);
    rows.push({
      groupKey: "love_base",
      itemKey: rel[1],
      ordinal: ++order,
      value: { text: content.split("หมายถึง").slice(1).join("หมายถึง").trim(), label: rel[0] },
      sourceFile: file,
    });
  }
  return rows;
}

// ── parser: บท 7 ลักษณะชีวิตคู่ 60 กะจื่อ (สกัดจาก xlsx → JSON {ganzhi: {text}}) ──────
function parseLoveBase60(file: string): SeedRow[] {
  const raw = readFileSync(path.join(NEWDATA_DIR, file), "utf8").normalize("NFC");
  const map = JSON.parse(raw) as Record<string, { text: string }>;
  // เรียงตามลำดับ 60 กะจื่อ canonical (เพื่อ ordinal คงที่)
  const order = new Map(SIXTY_JIAZI.map(({ ganzhi, ordinal }) => [ganzhi.normalize("NFC"), ordinal]));
  return Object.entries(map)
    .map(([ganzhi, v]) => {
      const key = ganzhi.normalize("NFC");
      return {
        groupKey: "love_base_60",
        itemKey: key,
        ordinal: order.get(key) ?? 999,
        value: { text: (v.text ?? "").trim(), label: key } as NewdataValue,
        sourceFile: file,
      };
    })
    .sort((a, b) => a.ordinal - b.ordinal);
}

// ── parser: บท 7 โอกาสมีคู่ (เพศ × กำลังดิถี → 10 ช่อง) ───────────────────────────
function parseLoveChance(file: string): SeedRow[] {
  const lines = splitLines(read(file));
  // band keyword เรียง "เกินไป/มาก" ก่อนตัวสั้น (substring กันชน)
  const BANDS: Array<[string, string]> = [
    ["อ่อนมาก", "very-weak"], ["แข็งแรงเกินไป", "very-strong"], ["สมดุล", "balanced"],
    ["แข็งแรง", "strong"], ["อ่อน", "weak"],
  ];
  const rows: SeedRow[] = [];
  const seen = new Set<string>();
  let gender: string | null = null;
  let order = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.includes("ดิถีเป็นเพศชาย")) { gender = "male"; continue; }
    if (t.includes("ดิถีเป็นเพศหญิง")) { gender = "female"; continue; }
    if (!gender || !t.startsWith("*")) continue;
    const content = t.replace(/^\*+\s*/, "").trim();
    const band = BANDS.find(([w]) => content.includes(w));
    if (!band) continue;
    const key = `${gender}|${band[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      groupKey: "love_chance",
      itemKey: key,
      ordinal: ++order,
      value: { text: content, label: `${gender === "female" ? "หญิง" : "ชาย"} ${band[0]}` },
      sourceFile: file,
    });
  }
  return rows;
}

// ── parser: ทำบุญ 5 ธาตุ (element → คำทำบุญ) — เก็บ occurrence แรกต่อธาตุ ──────────
function parseMeritByElement(file: string): SeedRow[] {
  const lines = splitLines(read(file));
  const ELEMENTS = ["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"];
  const ORDER: Record<string, number> = { ไม้: 1, ไฟ: 2, ดิน: 3, ทอง: 4, น้ำ: 5 };
  const collected: Record<string, string> = {};
  let cur: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (cur && collected[cur] === undefined && buf.length) collected[cur] = buf.join(" ").trim();
    buf = [];
  };
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("ดิถ")) {
      flush();
      cur = null;
      continue;
    } // หัวข้อ "ดิถีธาตุ..กำลัง" (มี typo ดิถึ ด้วย)
    const el = ELEMENTS.find((e) => t === `ธาตุ${e}`);
    if (el) {
      flush();
      cur = collected[el] !== undefined ? null : el; // มีแล้วข้าม (occurrence แรกชนะ)
      continue;
    }
    if (cur) buf.push(t);
  }
  flush();
  return ELEMENTS.filter((e) => collected[e]).map((e) => ({
    groupKey: "merit_by_element",
    itemKey: e,
    ordinal: ORDER[e],
    value: { text: collected[e], label: `ทำบุญ ธาตุ${e}` },
    sourceFile: file,
  }));
}

// ── parser: ดิถีถ่ายเททุกแบบ (ก้านดิถี ถ่ายเท → ปลายทาง) — คีย์ "{ดิถี}|{ปลายทาง}" ─────
function parseDithiTransfer(file: string): SeedRow[] {
  const lines = splitLines(read(file));
  const rows: SeedRow[] = [];
  const seen = new Set<string>();
  let order = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("*")) continue;
    const body = t.replace(/^\*+\s*/, "");
    // ดึงอักษรจีน 2 ตัวแรก = ก้านดิถี + ปลายทาง (กันเคส "ถ่ายเท ถ่ายเท" ซ้ำ)
    const cjk = [...body].filter((c) => STEMS.has(c) || c in BRANCHES);
    if (cjk.length < 2) continue;
    const day = cjk[0];
    const target = cjk[1];
    if (!STEMS.has(day)) continue;
    const tIdx = body.indexOf(target, body.indexOf(day) + 1);
    const text = body.slice(tIdx + target.length).trim();
    if (!text) continue;
    const key = `${day}|${target}`;
    if (seen.has(key)) continue; // คีย์แรกชนะ (กันซ้ำข้ามหมวดภาคี/ไตรภาคี)
    seen.add(key);
    rows.push({
      groupKey: "dithi_transfer",
      itemKey: key,
      ordinal: ++order,
      value: { text, label: `${day} ถ่ายเท ${target}` },
      sourceFile: file,
    });
  }
  return rows;
}

// ── seeder: บท 1 core (ย้ายตารางอิสระ 50/12/60 → NewData box) ────────────────
function collectChartFoundationCore(): SeedRow[] {
  const rows: SeedRow[] = [];

  // (1) ดิถี/กำลัง 50 ช่อง — ว่างทั้งหมด (ซินแสกรอกในแอดมิน) คีย์ "{ก้าน}|{band}"
  let ord = 0;
  for (const stem of STEM_ORDER) {
    for (const band of STRENGTH_BANDS) {
      rows.push({
        groupKey: "daymaster_strength",
        itemKey: `${stem}|${band.key}`,
        ordinal: ++ord,
        value: { text: "", label: `${stem} × ${band.label}` },
        sourceFile: "(กรอกในแอดมิน)",
      });
    }
  }

  // เนื้อ 12 นักษัตร + 60 กะจื่อ จาก knownlage (reuse ตัว parse เดิม)
  const { nakshatra, jiazi } = getStandaloneCoreDescriptions();

  // (2) 12 นักษัตร — คีย์ราศีล่าง
  BRANCH_ORDER.forEach((branch, i) => {
    rows.push({
      groupKey: "zodiac_nisai",
      itemKey: branch,
      ordinal: i + 1,
      value: { text: nakshatra[branch] ?? "", label: `${branch} ${BRANCH_LABELS_TH[branch]}` },
      sourceFile: "นิสัย 12 นักษัตร.txt",
    });
  });

  // (3) 60 กะจื่อ — คีย์กะจื่อ
  for (const { ordinal, ganzhi } of SIXTY_JIAZI) {
    rows.push({
      groupKey: "ganzhi_nisai",
      itemKey: ganzhi,
      ordinal,
      value: { text: jiazi[ganzhi] ?? "", label: `#${ordinal} ${ganzhi}` },
      sourceFile: "ลักษณะนิสัย 60 แบบ.txt",
    });
  }

  return rows;
}

// ── รวมทุก parser ──────────────────────────────────────────────────────────
function collectAll(): SeedRow[] {
  const all: SeedRow[] = [];
  const push = (label: string, fn: () => SeedRow[]) => {
    try {
      const rows = fn();
      all.push(...rows);
      console.log(`  ✓ ${label.padEnd(24)} → ${rows.length} rows`);
    } catch (e) {
      console.log(`  ✗ ${label.padEnd(24)} → ERROR ${(e as Error).message}`);
    }
  };
  push("shengxiang", () => parseStateKeyed("12 เชี่ยงแซ.txt", "shengxiang", "ตาราง 12"));
  push("edu_level", () => parseStateKeyed("การศึกษา 12 เชี่ยงแซ.txt", "edu_level"));
  push("study_style", () => parseStateKeyed("การเรียน12 เชี่ยงแซ.txt", "study_style"));
  push("clash", () => parsePairs("ชง.txt", "clash"));
  push("harm_heng", () => parsePairs("เฮ้ง.txt", "harm_heng"));
  push("harm_hai", () => parsePairs("ไห่.txt", "harm_hai"));
  push("self_punish", () => parsePairs("จื่อเฮ้ง.txt", "self_punish"));
  push("sam_heng", () => parseSamHeng("ซำเฮ้ง.txt"));
  push("phua", () => parsePhua("ผั่ว.txt"));
  push("combine", () => parseCombine("ภาคีคู่ บน-ล่าง.txt"));
  push("trinity", () => parseTrinity("ไตรภาคี.txt"));
  push("pillars_meaning", () => parsePillars("4 แถว 8 อักษร.txt"));
  push("career_by_element", () => parseCareerByElement("อาชีพ 5 ธาตุ.txt"));
  push("dithi_transfer", () => parseDithiTransfer("ดิถีถ่ายเททุกแบบ.txt"));
  push("merit_by_element", () => parseMeritByElement("ทำบุญ 5 ธาตุ.txt"));
  push("love_base", () => parseLoveBase("ความรักและความสัมพันธ์.txt"));
  push("love_base_60", () => parseLoveBase60("love-base-60.json"));
  push("love_chance", () => parseLoveChance("ความรักและความสัมพันธ์.txt"));
  push("chart_foundation_core", collectChartFoundationCore);
  return all;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");

  if (!existsSync(NEWDATA_DIR)) {
    console.error(`NewData dir not found: ${NEWDATA_DIR}`);
    process.exit(1);
  }

  console.log(`Parsing NewData from ${NEWDATA_DIR}\n`);
  const materialized = collectAll();

  const byGroup = materialized.reduce<Record<string, number>>((acc, r) => {
    acc[r.groupKey] = (acc[r.groupKey] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\nสรุปตาม group:`);
  for (const [g, n] of Object.entries(byGroup)) console.log(`  ${g.padEnd(18)} ${n}`);
  console.log(`รวมทั้งหมด: ${materialized.length} rows\n`);

  const dumpFlag = process.argv.find((a) => a.startsWith("--dump="));
  if (dumpFlag) {
    const out = dumpFlag.slice("--dump=".length);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(out, JSON.stringify(materialized, null, 2), "utf8");
    console.log(`dumped ${materialized.length} rows → ${out}`);
  }

  if (dryRun) {
    console.log("── คีย์ทั้งหมดต่อ group ──");
    for (const g of Object.keys(byGroup)) {
      const items = materialized.filter((r) => r.groupKey === g);
      const keys = items.map((r) => `${r.itemKey}${(r.value.text ?? "").trim() ? "" : "⚠"}`).join(", ");
      console.log(`  [${g}] (${items.length}) ${keys}`);
    }
    console.log("\n[dry-run] ไม่เขียน DB");
    return;
  }

  const db = createDbClient();
  let written = 0;
  for (const r of materialized) {
    const insert = db
      .insert(baziNewdata)
      .values({ groupKey: r.groupKey, itemKey: r.itemKey, ordinal: r.ordinal, value: r.value, sourceFile: r.sourceFile });
    if (force) {
      await insert.onConflictDoUpdate({
        target: [baziNewdata.groupKey, baziNewdata.itemKey],
        set: { value: r.value, ordinal: r.ordinal, sourceFile: r.sourceFile, updatedAt: sql`now()` },
      });
    } else {
      await insert.onConflictDoNothing();
    }
    written++;
  }
  console.log(`เขียนสำเร็จ ${written} rows (${force ? "force update" : "insert/skip existing"})`);
}

main().catch((e) => {
  console.error("SEED FAILED:", e);
  process.exit(1);
});
