/**
 * แปลง "ตำราไพ่ทาโรต์ของซินแสนุ้ย" (Google Doc → txt, knownlage/tarot/sinsae-tarot.txt) เป็นข้อมูลรายใบ
 * → src/lib/bazi/data/tarot-sinsae.json (ผูกกับไพ่ใน tarot-tao.json ด้วยเลข no)
 *
 * โครงต่อใบในตำรา (9 หัวข้อ): 1 ความหมาย(+บวก/ลบ/%) · 2 ออราเคิลหน้าไพ่ (สัญลักษณ์ละ บวก/ลบ/%) · 3 ทั่วไป ·
 * 4 การเงิน · 5 การงาน · 6 สุขภาพ · 7 ครอบครัว · 8 ความรัก · 9 กลับหัว(+บวก/ลบ/%)
 *
 * ที่มา: docs.google.com/document/d/18vhmrs3qFm5zbAdBZuc0504zN-WvKX24cIJJYYy1wps (ซินแสนุ้ย 2026-10-03 "ตรวจเอง เจนเอง")
 * Usage: npx tsx scripts/import-tarot-sinsae.ts   (อัปเดตตำรา: export txt ใหม่ทับ knownlage/tarot/sinsae-tarot.txt แล้วรันซ้ำ)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "knownlage", "tarot", "sinsae-tarot.txt");
const OUT = path.join(ROOT, "src", "lib", "bazi", "data", "tarot-sinsae.json");
const DECK = path.join(ROOT, "src", "lib", "bazi", "data", "tarot-tao.json");

type Energy = { positive: number; negative: number; note: string } | null;
type Side = { positive: string; negative: string; energy: Energy };
type OracleSymbol = { symbol: string; description: string } & Side;
export type SinsaeTarotCard = {
  no: number;
  name: string;
  meaning: string;
  core: Side;
  oracle: OracleSymbol[];
  general: string;
  finance: string;
  career: string;
  health: string;
  family: string;
  love: string;
  reversed: string;
  reversedCore: Side;
};

/** คีย์เทียบชื่อไพ่: ตัด "The ", วงเล็บ, ช่องว่างซ้ำ, ตัวพิมพ์ */
const key = (s: string) =>
  s.split("—")[0].replace(/[()]/g, "").trim().toLowerCase().replace(/^the\s+/, "").replace(/\s+/g, " ");

function parseEnergy(text: string): Energy {
  // รองรับ "เด่นเชิงบวก 80% / เชิงลบ 20%" และคำพิมพ์เพี้ยนในตำรา (เช่น "เชิง lบ")
  const m = /เชิงบวก\s*(\d+)\s*%\s*\/\s*เชิง\s*\S*?\s*(\d+)\s*%\s*(.*)/.exec(text);
  return m ? { positive: Number(m[1]), negative: Number(m[2]), note: m[3].trim() } : null;
}

/** ดึง บวก/ลบ/% จากบรรทัด bullet ในก้อนข้อความ */
function parseSide(lines: string[]): Side {
  let positive = "", negative = "", energy: Energy = null;
  for (const raw of lines) {
    const l = raw.replace(/^[\s*•⚖️]+/u, "").trim();
    if (/^(มุมมอง|มิติ)?เชิงบวก[^:]*:/.test(l) && !positive) positive = l.replace(/^(มุมมอง|มิติ)?เชิงบวก[^:]*:\s*/, "");
    else if (/^(มุมมอง|มิติ)?เชิงลบ[^:]*:/.test(l) && !negative) negative = l.replace(/^(มุมมอง|มิติ)?เชิงลบ[^:]*:\s*/, "");
    else if (/^น้ำหนัก(พลังงาน|ไพ่)/.test(l) && !energy) energy = parseEnergy(l);
  }
  return { positive, negative, energy };
}

const clean = (lines: string[]) =>
  lines.map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim() && !/^_{5,}$/.test(l.trim())).join("\n").trim();

function main() {
  const deck = JSON.parse(readFileSync(DECK, "utf8")) as { no: number; name: string }[];
  const byKey = new Map(deck.map((c) => [key(c.name), c]));
  const lines = readFileSync(SRC, "utf8").replace(/^﻿/, "").split(/\r?\n/);

  // หัวไพ่ = บรรทัดที่ (ตัดเลข/จุดนำหน้า) ตรงชื่อไพ่ในสำรับ
  const starts: { idx: number; card: { no: number; name: string } }[] = [];
  lines.forEach((l, idx) => {
    const k = key(l.replace(/^\s*\d{0,2}\.?\s*/, ""));
    const card = byKey.get(k);
    if (card && !/^\s*\d\.\s+ความหมาย/.test(l)) starts.push({ idx, card });
  });

  const out: SinsaeTarotCard[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const { idx, card } = starts[i];
    const body = lines.slice(idx + 1, i + 1 < starts.length ? starts[i + 1].idx : lines.length);
    // แบ่ง 9 หัวข้อด้วยบรรทัดขึ้นต้น "N. " (N = 1..9) ที่ไม่ย่อหน้า
    const sec: Record<number, string[]> = {};
    let cur = 0;
    for (const l of body) {
      const m = /^(\d)\.\s/.exec(l);
      if (m && Number(m[1]) === cur + 1) { cur = Number(m[1]); sec[cur] = []; continue; }
      if (cur) sec[cur].push(l);
    }
    const s = (n: number) => sec[n] ?? [];

    // ออราเคิล: bullet ระดับบน "* สัญลักษณ์: คำอธิบาย" ตามด้วย bullet ย่อย บวก/ลบ/%
    const oracle: OracleSymbol[] = [];
    // บางใบย่อหน้า bullet สัญลักษณ์เท่ากับบรรทัดบวก/ลบ → นับว่า bullet ที่ "ไม่ใช่ บวก/ลบ/น้ำหนัก" = สัญลักษณ์ใหม่
    const isSideLine = (t: string) => /^(⚖️\s*)?(มุมมอง|มิติ)?(เชิงบวก|เชิงลบ|น้ำหนักพลังงาน|น้ำหนักไพ่)/u.test(t);
    for (const l of s(2)) {
      const bullet = /^\s*\*\s+(.+)$/.exec(l);
      if (!bullet) continue;
      const t = bullet[1].trim();
      if (!isSideLine(t)) {
        const [sym, ...rest] = t.split(":");
        oracle.push({ symbol: sym.trim(), description: rest.join(":").trim(), positive: "", negative: "", energy: null });
      } else if (oracle.length) {
        const o = oracle[oracle.length - 1];
        const side = parseSide([l]);
        o.positive ||= side.positive;
        o.negative ||= side.negative;
        o.energy ||= side.energy;
      }
    }

    out.push({
      no: card.no,
      name: card.name,
      meaning: clean(s(1).filter((l) => !/^\s*\*/.test(l))),
      core: (() => { const c = parseSide(s(1)); const g = parseSide(s(3)); return { positive: c.positive || g.positive, negative: c.negative || g.negative, energy: c.energy ?? g.energy }; })(),
      oracle,
      general: clean(s(3)),
      finance: clean(s(4)),
      career: clean(s(5)),
      health: clean(s(6)),
      family: clean(s(7)),
      love: clean(s(8)),
      reversed: clean(s(9)),
      reversedCore: parseSide(s(9)),
    });
  }

  out.sort((a, b) => a.no - b.no);
  const missing = deck.filter((c) => !out.some((o) => o.no === c.no)).map((c) => c.name);
  const weak = out
    .map((c) => ({ n: c.name, miss: [!c.core.energy && "core%", c.oracle.length === 0 && "oracle", c.oracle.some((o) => !o.energy) && "oracle%", !c.finance && "finance", !c.love && "love", !c.reversed && "reversed", !c.reversedCore.energy && "rev%"].filter(Boolean) }))
    .filter((x) => x.miss.length)
    .map((x) => `${x.n}(${x.miss.join("/")})`);
  writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n", "utf8");
  console.log(`ใบที่แปลงได้ ${out.length}/${deck.length} → ${path.relative(ROOT, OUT)}`);
  if (missing.length) console.log("⚠️ ไม่พบในตำรา:", missing.join(", "));
  if (weak.length) console.log("⚠️ หัวข้อไม่ครบ:", weak.join(", "));
}

main();
