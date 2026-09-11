// อัปเดต/เพิ่ม "วันพิเศษ" ใน day-stars.json ตามเอกสารซินแส FIXเงื่อนไขปฏิทิน.docx
//   - วันหมอเทพ (mor-thep): แก้ triggers ให้ตรง doc (month-branch → day-branch = month+8)
//   - วันฟ้าอภัย (thian-soe): แก้ triggers ให้ตรง doc (month-branch → day-GANZHI, เฉพาะบางเดือน)
//   - วันความรัก (love) / วันลาภสวรรค์ (heaven-fortune): เพิ่มใหม่ (month-branch → day-branch)
// idempotent: upsert by id. รัน: node scripts/patch-special-day-stars.cjs
const fs = require("node:fs");
const P = "src/lib/bazi/data/almanac/day-stars.json";
const rows = JSON.parse(fs.readFileSync(P, "utf8"));

// map { monthBranch: dayValue } → triggers { monthBranch: [dayValue] }
const trig = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [v]]));

const LOVE = { 子: "酉", 丑: "午", 寅: "卯", 卯: "子", 辰: "酉", 巳: "午", 午: "卯", 未: "子", 申: "酉", 酉: "午", 戌: "卯", 亥: "子" };
const FORTUNE = { 子: "子", 丑: "寅", 寅: "辰", 卯: "午", 辰: "申", 巳: "戌", 午: "子", 未: "寅", 申: "辰", 酉: "午", 戌: "申", 亥: "戌" };
const DOCTOR = { 子: "申", 丑: "酉", 寅: "戌", 卯: "亥", 辰: "子", 巳: "丑", 午: "寅", 未: "卯", 申: "辰", 酉: "巳", 戌: "午", 亥: "未" };
const PARDON = { 寅: "戊寅", 辰: "戊寅", 巳: "甲午", 未: "甲午", 酉: "戊申", 子: "甲子" }; // day-ganzhi, บางเดือน

const upsert = (id, patch) => {
  const i = rows.findIndex((r) => r.id === id);
  if (i >= 0) rows[i] = { ...rows[i], ...patch };
  else rows.push({ id, ...patch });
};

upsert("mor-thep", { triggers: trig(DOCTOR) });
upsert("thian-soe", { triggers: trig(PARDON) });
upsert("love", {
  name: "วันความรัก", polarity: "good",
  activity: "เสริมเสน่ห์ ความรัก ความโรแมนติก แรงดึงดูด",
  triggers: trig(LOVE), note: "วันความรัก — month-branch → day-branch",
});
upsert("heaven-fortune", {
  name: "วันลาภสวรรค์", polarity: "good",
  activity: "ไหว้ขอลาภจากฟ้า ขอโชคลาภความมั่งคั่ง",
  triggers: trig(FORTUNE), note: "วันลาภสวรรค์ — month-branch → day-branch",
});

fs.writeFileSync(P, JSON.stringify(rows, null, 2) + "\n");
console.log("day-stars now:", rows.map((r) => `${r.id}(${Object.keys(r.triggers).length})`).join(", "));
