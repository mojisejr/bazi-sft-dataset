/**
 * สร้างรูปอวตารโค้ชฮีลใจ (หญิง/ชาย) ด้วย Gemini image gen (Nano Banana) แล้วบีบเป็น WebP ลง public/.
 * ใช้ GEMINI_API_KEY เดิม (ฟรี tier ก็รันได้).
 *
 *   node scripts/gen-louise-avatar.mjs            # ทั้งหญิงและชาย
 *   node scripts/gen-louise-avatar.mjs male       # เฉพาะเพศที่ระบุ (female | male)
 *
 * ออก: public/louise-hay/avatar/{female,male}/{idle,speaking,concern}.webp
 * speaking/concern แก้จากภาพฐาน idle เพื่อให้ตัวละคร "เดิม" (character consistency).
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const key =
  process.env.GEMINI_API_KEY ||
  (fs.readFileSync(path.join(process.cwd(), ".env"), "utf8").match(/GEMINI_API_KEY=(.+)/) || [])[1]?.trim();
if (!key) throw new Error("GEMINI_API_KEY required");

const MODEL = "gemini-2.5-flash-image";
const ROOT = path.join(process.cwd(), "public/louise-hay/avatar");
const STYLE =
  "flat vector illustration, thick clean rounded outlines, soft pastel colors, simple solid pale-pink (#ffe4ef) background, centered head-and-shoulders, cute kawaii comforting style, high quality";

const CHARACTERS = {
  female:
    "a warm friendly Thai healing-coach girl mascot, soft round face, kind caring eyes, gentle rosy cheeks, shoulder-length soft dark hair with a small white flower, wearing a soft pink pastel top",
  male:
    "a warm friendly Thai healing-coach young man mascot, soft round face, kind caring eyes, gentle rosy cheeks, short neat dark hair, wearing a soft light-blue pastel shirt",
};

const JOBS = [
  { name: "idle", edit: false, prompt: (c) => `${c}, front-facing, gentle closed-mouth warm smile, calm and welcoming. ${STYLE}` },
  { name: "speaking", edit: true, prompt: () => "Keep the exact same character, same face, colors, background and framing. Change only the mouth to be open as if warmly speaking, a soft open smile." },
  { name: "concern", edit: true, prompt: () => "Keep the exact same character, same face, colors, background and framing. Change only the expression to gently caring and concerned: eyebrows slightly raised with empathy, a soft small worried mouth." },
];

async function gen(prompt, baseB64) {
  const parts = [{ text: prompt }];
  if (baseB64) parts.push({ inlineData: { mimeType: "image/png", data: baseB64 } });
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }] }) },
  );
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const p = (j.candidates?.[0]?.content?.parts || []).find((x) => x.inlineData);
  if (!p) throw new Error("no image returned");
  return p.inlineData.data;
}

const only = process.argv[2];
const genders = only ? [only] : ["female", "male"];
for (const gender of genders) {
  const outDir = path.join(ROOT, gender);
  fs.mkdirSync(outDir, { recursive: true });
  let baseB64 = null;
  for (const job of JOBS) {
    const b64 = await gen(job.prompt(CHARACTERS[gender]), job.edit ? baseB64 : null);
    if (!job.edit) baseB64 = b64;
    const file = path.join(outDir, `${job.name}.webp`);
    await sharp(Buffer.from(b64, "base64")).resize(384, 384).webp({ quality: 82 }).toFile(file);
    console.log("saved", path.relative(process.cwd(), file), Math.round(fs.statSync(file).size / 1024) + "KB");
  }
}
