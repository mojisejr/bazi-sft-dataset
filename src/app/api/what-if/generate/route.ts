/**
 * แคมเปญ "What If" — POST: วัน/เดือน/ปี+เวลา+เพศ + อาชีพปัจจุบัน
 *   → คำนวณดวง 4 เสาด้วย engine จริง → ตาราง B ของ NewData (ดิถี×กำลัง×ธาตุเดือน)
 *   → อาชีพที่ฟ้าลิขิต + รายชื่อธุรกิจถูกโฉลกจากตำรา (career_by_element)
 *   + นิทานโลกคู่ขนาน 3 บท (LLM) + ภาพ AI ตัวคุณในอีกมิติ (Imagen, best-effort)
 *
 * fallback: engine/DB ล่ม → คำนวณจากเสาปีอย่างเดียว (computeDestiny) — แคมเปญไม่ตาย
 * ป้องกันต้นทุน: guardServerLlm (กันยิงรัว/โควตารายวัน/เพดานงบ) แบบเดียวกับ divine-cards
 */
import { z } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import {
  computeDestiny,
  computeDestinyFromChart,
  toCeYear,
  type WhatIfDestiny,
} from "@/lib/bazi/what-if/destiny";
import { generateWhatIfStory } from "@/lib/bazi/what-if/story-llm";
import { generateWhatIfImage } from "@/lib/bazi/what-if/image-gen";
import { extractChartFacts, matchCareer, seasonalCareerBand } from "@/lib/bazi/newdata-lookup";
import { getNewdataMap } from "@/lib/bazi/newdata.server";
import { guardServerLlm } from "@/lib/bazi/llm-guard";
import { logLlmUsage } from "@/lib/llm-usage/logger";
import { reconcileDailyBudget } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ต้นทุนจริงโดยประมาณเมื่อสร้างภาพ Imagen 1 ใบ (~$0.04) — ใช้ปรับเพดานงบรายวันให้ตรงความจริง */
const IMAGE_COST_THB = 1.5;

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

const GenerateSchema = z.object({
  /** วันเกิด ค.ศ. รูปแบบ "YYYY-MM-DD" (client แปลงจาก พ.ศ. ให้แล้ว) */
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate ต้องเป็น YYYY-MM-DD"),
  /** เวลาเกิด "HH:mm" — ไม่ทราบ = ไม่ส่ง (ใช้เที่ยงวันตามธรรมเนียม) */
  birthTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  gender: z.enum(["male", "female"]),
  currentJob: z.string().trim().min(2).max(80),
  /** ปิดการสร้างภาพได้ (ประหยัด/ทดสอบ) */
  withImage: z.boolean().default(true),
  apiKey: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  provider: z.enum(["gemini", "opencode", "anthropic"]).default("gemini"),
});

/** แตกข้อความ career_by_element (บรรทัด `* ...`) เป็นรายการสั้น ๆ สำหรับ UI chips */
function parseBookCareers(text: string, limit = 8): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[\s*•\-–]+/, "").trim())
    .filter((line) => line.length >= 3 && !line.startsWith("ธาตุ"))
    .slice(0, limit);
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const parsed = GenerateSchema.safeParse(payload);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload.");
  }
  const { birthDate, birthTime, gender, currentJob, withImage, apiKey, model, provider } =
    parsed.data;

  const yearCe = toCeYear(Number(birthDate.slice(0, 4)));
  const nowYear = new Date().getFullYear();
  if (yearCe < 1930 || yearCe > nowYear - 15) {
    return badRequest("ปีเกิดอยู่นอกช่วงที่รองรับ — ตรวจสอบ พ.ศ./ค.ศ. อีกครั้ง");
  }
  const birthDateCe = `${yearCe}-${birthDate.slice(5)}`;
  if (Number.isNaN(Date.parse(birthDateCe))) {
    return badRequest("วันเกิดไม่ถูกต้อง — ตรวจสอบวัน/เดือนอีกครั้ง");
  }
  const age = nowYear - yearCe;

  const usedOwnKey = Boolean(apiKey);
  const blocked = guardServerLlm(req, "what_if", usedOwnKey);
  if (blocked) return blocked;

  // ── คำนวณดวง 4 เสาด้วย engine จริง → ตาราง B → อาชีพฟ้าลิขิต ──
  // ล่ม (DB/engine) → fallback เสาปีอย่างเดียว เพื่อให้แคมเปญตอบได้เสมอ
  let destiny: WhatIfDestiny;
  let engineMode: "full-chart" | "year-only" = "year-only";
  let bookCareers: string[] = [];
  let bookCareerExcerpt: string | null = null;
  let fourPillars: { position: string; stem: string; branch: string }[] | null = null;

  try {
    const state = await calculateBaziStateFromRawInput({
      birthDate: birthDateCe,
      birthTime: birthTime ?? "12:00",
      gender,
      province: "กรุงเทพมหานคร",
      calendarSystem: "solar" as const,
    });
    const facts = extractChartFacts(state, gender, yearCe);
    const band = seasonalCareerBand(facts);
    const dayStem = facts.pillars.find((p) => p.position === "day")?.stem ?? "";
    const monthStem = facts.pillars.find((p) => p.position === "month")?.stem ?? "";
    const chartDestiny = computeDestinyFromChart({
      dayStem,
      monthStem,
      band,
      birthYear: yearCe,
      currentJob,
    });
    if (!chartDestiny) throw new Error("unknown stems");
    destiny = chartDestiny;
    engineMode = "full-chart";
    fourPillars = facts.pillars.map((p) => ({
      position: p.position,
      stem: p.stem,
      branch: p.branch,
    }));

    // รายชื่อธุรกิจถูกโฉลกจากตำรา (NewData career_by_element ธาตุอันดับ 1) — best-effort
    try {
      const map = await getNewdataMap();
      const block = matchCareer(map, facts, "do", 1)[0];
      if (block?.text) {
        bookCareers = parseBookCareers(block.text);
        bookCareerExcerpt = block.text.slice(0, 700);
      }
    } catch {
      // ไม่มีตำราก็เล่าได้ — ข้าม
    }
  } catch (error) {
    console.error("[what-if] engine fallback to year-only:", error);
    destiny = computeDestiny(yearCe, currentJob);
  }

  // เรื่องราว (LLM) + ภาพ (Imagen) ยิงพร้อมกัน — เรื่องราวคือแกน (fail = 502),
  // ภาพเป็น best-effort (fail = imageUrl null, UI มี fallback avatar)
  const storyPromise = generateWhatIfStory({
    destiny,
    currentJob,
    age,
    gender,
    bookCareerExcerpt,
    apiKey,
    model,
    provider,
  });
  const imagePromise =
    withImage && provider === "gemini"
      ? generateWhatIfImage({ destinedCareer: destiny.destinedCareerEn, age, gender, apiKey })
      : null;

  let story: Awaited<typeof storyPromise>;
  try {
    story = await storyPromise;
  } catch (error) {
    // ไม่ปล่อย unhandled rejection ของฝั่งภาพ
    imagePromise?.catch(() => undefined);
    return badRequest(error instanceof Error ? error.message : "สร้างเรื่องราวไม่สำเร็จ", 502);
  }

  let imageUrl: string | null = null;
  let imageModel: string | null = null;
  if (imagePromise) {
    try {
      const image = await imagePromise;
      imageUrl = `data:${image.mime};base64,${image.imageBase64}`;
      imageModel = image.model;
      // ภาพแพงกว่าที่ pre-charge ไว้ — บวกต้นทุนจริงเข้าเพดานงบรายวัน (เฉพาะคีย์เซิร์ฟเวอร์)
      if (!usedOwnKey) reconcileDailyBudget(IMAGE_COST_THB);
      // ลงสถิติต้นทุนรูปใน /stats — Imagen คิดต่อรูป: convention outTokens = จำนวนรูป (ดู pricing.ts)
      logLlmUsage("what_if", {
        provider: "gemini",
        model: image.model,
        inTokens: 0,
        outTokens: 1,
        label: `รูป: ${destiny.destinedCareer}`.slice(0, 200),
        usedOwnKey,
      });
    } catch (error) {
      console.error("[what-if] image generation failed:", error);
    }
  }

  return Response.json({
    input: { birthDate: birthDateCe, birthTime: birthTime ?? null, gender, yearCe, age, currentJob },
    engineMode,
    fourPillars,
    destiny: {
      ganzhiLabel: destiny.ganzhiLabel,
      element: destiny.element,
      polarity: destiny.polarity,
      animal: destiny.animal,
      destinedCareer: destiny.destinedCareer,
      careerReason: destiny.careerReason,
    },
    bookCareers,
    story: story.story,
    model: story.model,
    imageUrl,
    imageModel,
  });
}
