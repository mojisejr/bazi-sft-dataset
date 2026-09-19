/**
 * POST /api/prayer — สร้าง "คำอธิษฐาน" (บทขอพร) ตามเรื่องที่ขอ + ธาตุเสริมดวง (用神) ของผู้ใช้.
 *
 * รับ { topic, birth?, placeName?, deity?, dateTimeLabel? } → ถ้ามี birth คำนวณดวงเพื่อหา用神
 * แล้วเรียก buildPrayer (คลัง 8 ประตู + 10 เทพ) คืน { title, text, used, favorableElements }.
 * deterministic — ไม่เรียก LLM. โหลดดวงพังก็ยังสร้างพร "ตามเรื่อง" ได้ (ไม่มีชั้น用神).
 */
import { z } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { extractChartFacts, favorableElements } from "@/lib/bazi/newdata-lookup";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";
import { buildPrayer, type PrayerTopic } from "@/lib/bazi/prayer/build-prayer";

export const runtime = "nodejs";

const TOPICS: readonly PrayerTopic[] = ["love", "wealth", "career", "health", "study", "fixluck", "general"];

const BirthSchema = z.object({
  birthDate: z.string().trim().min(1),
  birthTime: z.string().trim().min(1),
  gender: z.enum(["male", "female"]),
  province: z.string().trim().min(1),
});

const BodySchema = z.object({
  topic: z.enum(["love", "wealth", "career", "health", "study", "fixluck", "general"]).optional(),
  birth: BirthSchema.optional(),
  placeName: z.string().trim().max(120).optional(),
  deity: z.string().trim().max(120).optional(),
  dateTimeLabel: z.string().trim().max(120).optional(),
  /** โหมดเจาะจงประตู/เทพ (ปุ่มในป๊อปอัพประตู) — อักษรจีนของประตู/เทพ */
  gates: z.array(z.string().trim().min(1).max(4)).max(4).optional(),
  gods: z.array(z.string().trim().min(1).max(4)).max(4).optional(),
  title: z.string().trim().max(120).optional(),
});

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: { message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid payload." } },
      { status: 400 },
    );
  }
  const { topic, birth, placeName, deity, dateTimeLabel, gates, gods, title } = parsed.data;

  // มี birth → หาธาตุเสริมดวง (用神) เพื่อเสริมประตู/เทพให้ตรงดวงเจ้าตัว (พังก็ข้าม ใช้พรตามเรื่องล้วน)
  let fav: ReturnType<typeof favorableElements> = [];
  if (birth) {
    try {
      const repository = createDbKnowledgeRepository();
      const state = await calculateBaziStateFromRawInput(
        { ...birth, calendarSystem: "solar", timezone: "Asia/Bangkok" },
        { repository },
      );
      fav = favorableElements(extractChartFacts(state, birth.gender));
    } catch {
      fav = [];
    }
  }

  const prayer = buildPrayer({
    topic: topic ?? "general",
    favorableElements: fav,
    placeName,
    deity,
    dateTimeLabel,
    gates,
    gods,
    title,
  });
  return Response.json(prayer, {
    headers: { "Cache-Control": "no-store" },
  });
}
