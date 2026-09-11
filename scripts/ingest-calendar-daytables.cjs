// Ingest ตาราง 60 วัน จากเอกสารซินแส (FIXเงื่อนไขปฏิทิน) → JSON 3 ไฟล์ (key = day-ganzhi, NFC)
//   worship-deity-60.json : { ganzhi: [ชื่อองค์เทพ...] }        (ไหว้องค์เทพประจำวัน)
//   shirt-color-60.json   : { ganzhi: { navin, colors:[...] } } (สีเสื้อประจำวัน 納音)
//   day-direction-60.json : { ganzhi: { fortune, patrons:[{degree,zodiac}], bad } } (ทิศดี/ผู้อุปถัมภ์/ร้าย)
// source = knownlage/NewData/FIXเงื่อนไขปฏิทิน.extracted.txt (สกัดจาก .docx). รัน: node scripts/ingest-calendar-daytables.cjs
const fs = require("node:fs");
const path = require("node:path");
const SRC = path.join("knownlage", "NewData", "FIXเงื่อนไขปฏิทิน.extracted.txt");
const DIR = path.join("src", "lib", "bazi", "data", "almanac");
const STEMS = "甲乙丙丁戊己庚辛壬癸", BR = "子丑寅卯辰巳午未申酉戌亥";
const lines = fs.readFileSync(SRC, "utf8").normalize("NFC").split(/\r?\n/).map((l) => l.trim());

const idxOf = (needle) => lines.findIndex((l) => l.startsWith(needle));
const dStart = idxOf("ไหว้องค์เทพ"), cStart = idxOf("สีเสื้อประจำวัน"), tStart = idxOf("ทิศดี/");
const gzRe = new RegExp(`^วัน\\s*([${STEMS}][${BR}])`);

// แยกเป็นบล็อกต่อ "วัน GZ" ในช่วง [from,to)
function blocks(from, to) {
  const out = []; let cur = null;
  for (let i = from; i < to; i++) {
    const m = gzRe.exec(lines[i]);
    if (m) { cur = { gz: m[1], body: [] }; out.push(cur); }
    else if (cur && lines[i]) cur.body.push(lines[i]);
  }
  return out;
}

const deity = {}, color = {}, dir = {};
for (const b of blocks(dStart, cStart)) {
  // บรรทัดแรก = กิ่ง (1 ตัว CJK) ข้าม, ที่เหลือ = ชื่อเทพ
  const body = b.body[0] && b.body[0].length === 1 && BR.includes(b.body[0]) ? b.body.slice(1) : b.body;
  deity[b.gz] = body;
}
for (const b of blocks(cStart, tStart)) {
  const navin = b.body.find((l) => l.startsWith("นับอิม")) ?? "";
  color[b.gz] = { navin, colors: b.body.filter((l) => !l.startsWith("นับอิม")) };
}
for (const b of blocks(tStart, lines.length)) {
  const fortune = (b.body.find((l) => l.startsWith("ทิศโชคลาภ")) ?? "").replace("ทิศโชคลาภ", "").trim();
  const bad = (b.body.find((l) => l.startsWith("ทิศร้าย")) ?? "").replace("ทิศร้าย", "").trim();
  const patrons = b.body.filter((l) => l.startsWith("ทิศผู้อุปถัม")).map((l) => {
    const rest = l.replace(/^ทิศผู้อุปถัม[ภถ]์?\s*/, "");
    const [deg, zod] = rest.split("/").map((s) => s.trim());
    return { degree: (deg || "").replace(/องศา$/, "").trim(), zodiac: (zod || "").replace(/^คนเกิดปี/, "").trim() };
  });
  dir[b.gz] = { fortune, patrons, bad };
}

fs.writeFileSync(path.join(DIR, "worship-deity-60.json"), JSON.stringify(deity, null, 0) + "\n");
fs.writeFileSync(path.join(DIR, "shirt-color-60.json"), JSON.stringify(color, null, 0) + "\n");
fs.writeFileSync(path.join(DIR, "day-direction-60.json"), JSON.stringify(dir, null, 0) + "\n");
console.log(`deity:${Object.keys(deity).length} color:${Object.keys(color).length} dir:${Object.keys(dir).length}`);
console.log("sample deity 甲子:", JSON.stringify(deity["甲子"]));
console.log("sample color 丙寅:", JSON.stringify(color["丙寅"]));
console.log("sample dir 甲子:", JSON.stringify(dir["甲子"]));
