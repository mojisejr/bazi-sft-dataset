/**
 * POST /api/reading/career-finance — "ใจความสำคัญ" เฉพาะบทอาชีพ + การเงิน จากอ่านดวง 15 บท (NewData)
 * ต่างจาก /newdata-reading ที่คืน 15 บทเต็ม (~1MB): endpoint นี้คืนเฉพาะ
 *   · career.doElement / avoidElement = ธาตุที่ "ควรทำ/ควรเลี่ยง" อาชีพ (ตาราง B + ปรับ 得令)
 *     — ธาตุที่ควรเสริม (用神) ไม่ใช่ธาตุประจำตัว (เคสดิถีอ่อน+น้ำเยอะ → ควรทำ "ไฟ" ไม่ใช่ "ดิน")
 *   · career.essence / finance.essence = เนื้อหาซินแส (NewData) แบบย่อ ใจความสำคัญ
 * ใช้ให้หน้าดวงผูกอาชีพ/คำแนะนำจากผลนี้ แทนการเดาจากธาตุประจำตัว
 */
import { ZodError } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";
import { getNewdataMap } from "@/lib/bazi/newdata.server";
import { extractChartFacts, matchCareer } from "@/lib/bazi/newdata-lookup";
import { resolveChapterBoxes } from "@/lib/bazi/chapter-newdata-map";

export const runtime = "nodejs";

/** ใจความสำคัญของบท = กล่องเนื้อหาจริงกล่องแรก (ข้าม "ภาพรวม" ที่เป็นคำอธิบาย generic) */
function chapterEssence(topicId: string, facts: ReturnType<typeof extractChartFacts>, map: Awaited<ReturnType<typeof getNewdataMap>>): string | null {
  const { boxes } = resolveChapterBoxes(topicId, facts, map);
  const pick = boxes.find((b) => b.title !== "ภาพรวม" && typeof b.body === "string" && b.body.trim())
    ?? boxes.find((b) => typeof b.body === "string" && b.body.trim());
  const t = pick?.body;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const repository = createDbKnowledgeRepository();
    const state = await calculateBaziStateFromRawInput(payload, { repository });
    const birthYear = Number.parseInt(String(payload?.birthDate ?? "").slice(0, 4), 10) || undefined;
    const facts = extractChartFacts(state, payload?.gender, birthYear);
    const map = await getNewdataMap();

    // ธาตุที่ควรทำ/เลี่ยง (order 1 = อันดับแรก) — บล็อกมี itemKey=ธาตุ, text=อาชีพซินแส, context=ที่มา
    const doBlock = matchCareer(map, facts, "do", 1)[0] ?? null;
    const avoidBlock = matchCareer(map, facts, "avoid", 1)[0] ?? null;

    return Response.json(
      {
        career: {
          doElement: doBlock?.itemKey ?? null,      // ธาตุที่ควรทำอาชีพ (เช่น "ไฟ")
          avoidElement: avoidBlock?.itemKey ?? null, // ธาตุที่ควรเลี่ยง (เช่น "ไม้")
          occupations: doBlock?.text ?? null,        // อาชีพ/ธุรกิจของธาตุนั้น (ซินแส NewData)
          context: doBlock?.context ?? null,         // ที่มา: "ดิถีธาตุดิน (อ่อน) · เดือนธาตุน้ำ → ธาตุไฟ"
          essence: chapterEssence("career_potential", facts, map),
        },
        finance: {
          essence: chapterEssence("wealth_and_investment", facts, map),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "ข้อมูลวันเกิดไม่ถูกต้อง", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "คำนวณไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}
