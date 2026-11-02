// แปลงตำราไพ่ออราเคิลพระอาจารย์จี้กง (Google Doc export txt) → เติมเนื้อหาใน jigong.json (คงรูปเดิม)
// ใช้: node scripts/extract-jigong-deck.cjs <jigong.txt> <jigong.json>
// ไม่ใช้หัวข้อ 5 ไพ่กลับหัว (ซินแส: ไพ่เทพไม่ทำกลับหัว)
const fs = require("fs");
const [srcF, jsonF] = process.argv.slice(2);
const DIMS = { "ภาพรวม / การดำเนินชีวิต": "overall", "การงาน": "work", "การเงิน": "money", "สุขภาพ": "health", "จิตใจ / อารมณ์": "mind", "ครอบครัว": "family", "ความรัก – มีคู่": "loveCouple", "ความรัก – โสด": "loveSingle" };
const SEC = { 1: "history", 2: "philosophy", 3: "meaning", 6: "byQuestion", 7: "relation", 8: "teaching" };
const lines = fs.readFileSync(srcF, "utf8").replace(/^﻿/, "").split("\n").map((l) => l.replace(/\r$/, "").trim());
const starts = lines.map((l, i) => (/^ไพ่ใบที่ \d+ ·/.test(l) ? i : -1)).filter((i) => i >= 0);
const old = JSON.parse(fs.readFileSync(jsonF, "utf8"));
const cards = starts.map((s, n) => {
  const seg = lines.slice(s, starts[n + 1] ?? lines.length);
  const h = seg[0].match(/^ไพ่ใบที่ (\d+) · (.+) \((ดี|กลาง|ร้าย)\)$/);
  const no = +h[1];
  const c = { no, name: h[2], category: h[3] === "ร้าย" ? "เตือน" : h[3], deity: "พระอาจารย์จี้กง" };
  const kw = seg.find((l) => l.startsWith("คำสำคัญ:"));
  if (kw) c.keywords = kw.replace(/^คำสำคัญ:\s*/, "");
  const p = seg.find((l) => l.startsWith("คะแนนรวม:"))?.match(/บวก\s*(\d+)%?\s*:\s*ลบ\s*(\d+)/);
  c.positive = p ? +p[1] : null; c.negative = p ? +p[2] : null;
  const heads = seg.map((l, i) => { const m = l.match(/^([1-8])\.\s/); return m ? [+m[1], i] : null; }).filter(Boolean);
  const body = (num) => {
    const at = heads.findIndex((x) => x[0] === num);
    return at < 0 ? [] : seg.slice(heads[at][1] + 1, heads[at + 1]?.[1] ?? seg.length).filter(Boolean);
  };
  const table = body(4);
  for (let i = 0; i < table.length; i++) {
    const key = DIMS[table[i]];
    if (key) c[key] = `${table[i + 1]} · ระวัง: ${table[i + 2]} (บวก:ลบ ${table[i + 3]})`;
  }
  const t8 = body(8);
  c.advice = t8.filter((l) => l.startsWith("*")).map((l) => l.replace(/^\*\s*/, "")).join(" ");
  const quote = t8.find((l) => /^["“]/.test(l));
  if (quote) c.advice += ` ${quote}`;
  c.deep = Object.fromEntries(Object.entries(SEC).map(([num, key]) => [key, body(+num).join("\n")]));
  c.imageUrl = old.find((o) => o.no === no)?.imageUrl;
  return c;
});
fs.writeFileSync(jsonF, JSON.stringify(cards));
const bad = cards.filter((c) => !c.overall || !c.loveSingle || !c.mind || !c.advice || !c.deep.history || !c.imageUrl);
console.log("cards", cards.length, "bad", bad.map((c) => c.no), "cats", cards.map((c) => c.category[0]).join(""), "pos", cards.map((c) => c.positive).join(","));
console.log(JSON.stringify(cards[0]).slice(0, 900));
