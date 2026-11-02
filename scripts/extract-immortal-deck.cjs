// แปลงเอกสารซินแสนุ้ย → ข้อมูลไพ่เทพเซียน 1 ชุด (21 ใบ)
// ใช้: node scripts/extract-immortal-deck.cjs <siamsi.txt> <textbook.txt|-> <images.json [[ชื่อไฟล์,driveId]]> <out.json>
const fs = require("fs");
const [siamsiF, bookF, imagesF, outF] = process.argv.slice(2);
const KEYS = { "ภาพรวม": "overall", "การงาน": "work", "การเงิน": "money", "สุขภาพ": "health", "จิตใจ": "mind", "ครอบครัว": "family", "ความรักมีคู่": "loveCouple", "ความรักคนโสด": "loveSingle", "คำแนะนำ": "advice", "คำสำคัญ": "keywords" };
const images = JSON.parse(fs.readFileSync(imagesF, "utf8"));
const lines = fs.readFileSync(siamsiF, "utf8").replace(/^\uFEFF/, "").split("\n").map((l) => l.trim());
const idx = lines.map((l, i) => (/^หมวด(ดี|กลาง|เตือน)\s*:/.test(l) ? i : -1)).filter((i) => i >= 0);
const cards = idx.map((start, n) => {
  const end = idx[n + 1] ?? lines.length;
  const m = lines[start].match(/^หมวด(ดี|กลาง|เตือน)\s*:\s*(.*)$/);
  const c = { no: n + 1, name: n === 0 ? "แปดเซียนข้ามทะเล" : lines[start - 1], category: m[1], deity: m[2].replace(/·\s*บวก.*$/, "").trim() };
  for (const l of lines.slice(start + 1, end)) {
    const k = l.match(/^([^:]{2,14}):\s*(.*)$/);
    if (k && KEYS[k[1].trim()]) c[KEYS[k[1].trim()]] = k[2];
  }
  const p = lines.slice(start, end).join(" ").match(/บวก\s*(\d+)\s*:\s*ลบ\s*(\d+)/);
  c.positive = p ? +p[1] : null; c.negative = p ? +p[2] : null;
  return c;
});
if (bookF !== "-") {
  const book = fs.readFileSync(bookF, "utf8").split("\n");
  const starts = book.map((l, i) => (/^\s*\*?\s*1\.\s*ประวัติ/.test(l) ? i : -1)).filter((i) => i >= 0);
  const SEC = [[1, "history"], [2, "philosophy"], [4, "meaning"], [6, "byQuestion"], [7, "relation"], [8, "teaching"]];
  starts.forEach((s, n) => {
    const seg = book.slice(s, starts[n + 1] ?? book.length);
    const heads = seg.map((l, i) => { const m = l.match(/^\s*\*?\s*([1-8])\.\s/); return m ? [+m[1], i] : null; }).filter(Boolean);
    const deep = {};
    for (const [num, key] of SEC) {
      const at = heads.findIndex((h) => h[0] === num);
      if (at < 0) continue;
      deep[key] = seg.slice(heads[at][1] + 1, heads[at + 1]?.[1] ?? seg.length).map((l) => l.trim()).filter((l) => l && !/^_+$/.test(l)).join("\n");
    }
    if (cards[n]) cards[n].deep = deep;
  });
}
const out = cards.length ? cards : images.map(([f]) => ({ no: parseInt(f), name: f.replace(/^\d+\.+/, "").replace(/\.png$/, "") }));
fs.writeFileSync(outF, JSON.stringify(out));
const bad = out.filter((c) => bookF !== "-" && (!c.overall || !c.advice || !c.deep?.history));
console.log("cards", out.length, "bad", bad.map((c) => c.no), "cats", out.map((c) => c.category?.[0]).join(""), "pos", out.map((c) => c.positive).join(","));
console.log(out.slice(0, 3).map((c, i) => c.name + " | img " + images[i][0]).join("\n"), "\ndeep", JSON.stringify(Object.fromEntries(Object.entries(out[0].deep ?? {}).map(([k, v]) => [k, v.length]))));
