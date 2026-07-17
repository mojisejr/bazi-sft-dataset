/**
 * POST /api/reading/newdata-reading/annual — คำนวณบท 12 "จุดเปลี่ยน/วัยจร" ใหม่ตามปีจรที่เลือก
 *
 * ใช้ตอนซินแสกดเลือกปีในตารางปีจร (หน้า /reading/newdata-reading และ .../newdata-reading2)
 * คืนเฉพาะกล่องบท turning_points ที่ยึด `anchorYear` เป็น "ปีปัจจุบัน" — ไม่ต้อง recompute 15 บท
 */
import { ZodError } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";
import { getNewdataMap } from "@/lib/bazi/newdata.server";
import { extractChartFacts } from "@/lib/bazi/newdata-lookup";
import { resolveChapterBoxes } from "@/lib/bazi/chapter-newdata-map";
import { getChapterOutline } from "@/lib/bazi/chapter-outline";

export const runtime = "nodejs";

const TOPIC_ID = "turning_points";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsedYear = Number.parseInt(String(payload?.anchorYear ?? ""), 10);
    const anchorYear = Number.isFinite(parsedYear) ? parsedYear : undefined;

    const repository = createDbKnowledgeRepository();
    const calculatedState = await calculateBaziStateFromRawInput(payload, { repository });
    const birthYear = Number.parseInt(String(payload?.birthDate ?? "").slice(0, 4), 10) || undefined;
    const facts = extractChartFacts(calculatedState, payload?.gender, birthYear);
    const map = await getNewdataMap();

    const resolved = resolveChapterBoxes(TOPIC_ID, facts, map, anchorYear);
    const outline = getChapterOutline(TOPIC_ID);
    const boxes = [
      ...(outline?.intro ? [{ title: "ภาพรวม", body: outline.intro }] : []),
      ...resolved.boxes,
    ];

    return Response.json(
      { topicId: TOPIC_ID, anchorYear: anchorYear ?? null, hasContent: resolved.hasContent, boxes },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "ข้อมูลวันเกิดไม่ถูกต้อง", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "คำนวณปีจรไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}
