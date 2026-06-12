/**
 * Focused fallback cleaner for the one pair (36) that the structured-JSON path
 * keeps returning empty for. Cleans each field as PLAIN TEXT (no responseJsonSchema),
 * which avoids the empty-body behavior. One-off — run after the main cleaner.
 *
 *   npx tsx scripts/clean-pair36.ts            # default key 36
 *   npx tsx scripts/clean-pair36.ts 27         # any key
 */
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

import { config as loadEnv } from "dotenv";
import { GoogleGenAI, type SafetySetting } from "@google/genai";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const DATA_PATH = path.resolve(process.cwd(), "src/lib/bazi/data/phone/phone-pair-meanings.json");
const MODEL = process.env.PHONE_CLEAN_MODEL?.trim() || "gemini-3-flash-preview";
const FIELDS = ["feeling", "work", "money", "love", "analysis"] as const;
const KEY = (process.argv[2] || "36").trim();

const INSTRUCTION =
  "จัดเรียงสระและวรรณยุกต์ของข้อความภาษาไทยต่อไปนี้ให้สะกดถูกต้องอ่านเป็นภาษาไทยปกติ " +
  "ข้อความถูกสกัดจาก PDF จึงมีสระ/วรรณยุกต์เรียงสลับหรือเว้นวรรคกลางคำ " +
  "ห้ามเปลี่ยน/เพิ่ม/ตัดความหมาย ห้ามซ้ำคำ คงลำดับประโยคเดิม " +
  "ตอบกลับเป็นข้อความที่แก้แล้วล้วนๆ ไม่ต้องมีคำอธิบายหรือเครื่องหมายคำพูดใดๆ";

const safetySettings = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
  "HARM_CATEGORY_CIVIC_INTEGRITY",
].map((category) => ({ category, threshold: "BLOCK_NONE" })) as unknown as SafetySetting[];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cleanField(ai: GoogleGenAI, text: string): Promise<string> {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: `${INSTRUCTION}\n\nข้อความ:\n${text}`,
        config: { temperature: 0, safetySettings },
      });
      const out = res.text?.trim();
      if (out) return out;
      throw new Error("empty");
    } catch (error) {
      if (attempt === 5) {
        console.warn("  field failed, keeping original:", error instanceof Error ? error.message : error);
        return text;
      }
      await sleep(1500 * attempt);
    }
  }
  return text;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
  const data = JSON.parse(readFileSync(DATA_PATH, "utf8")) as Record<string, Record<string, string>>;
  if (!data[KEY]) throw new Error(`key ${KEY} not found`);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  for (const f of FIELDS) {
    const before = data[KEY][f] ?? "";
    if (!before.trim()) continue;
    const after = await cleanField(ai, before);
    data[KEY][f] = after;
    console.log(`[${f}] ${after.slice(0, 60)}`);
  }
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("wrote", DATA_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
