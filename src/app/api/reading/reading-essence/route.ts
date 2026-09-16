/**
 * POST /api/reading/reading-essence — "ใจความสำคัญ" ของอ่านดวง 15 บท (เฉพาะที่หน้าดวงใช้)
 * ต่างจาก /newdata-reading ที่คืน 15 บทเต็ม (~1MB, ช้า): endpoint นี้ resolve บทเหมือนกัน
 * แต่ "คืนเฉพาะใจความ" (บุคลิก/นิสัย/ความรัก/ข้อควรระวัง/เทพประจำวัน) → payload เล็ก โหลดเร็ว
 * (อาชีพ/การเงินแยกไปที่ /api/reading/career-finance แหล่งเดียว — ไม่ซ้ำที่นี่)
 */
import { ZodError } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";
import { getNewdataMap } from "@/lib/bazi/newdata.server";
import { extractChartFacts } from "@/lib/bazi/newdata-lookup";
import { resolveChapterBoxes } from "@/lib/bazi/chapter-newdata-map";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { primaryGuardianDeity } from "@/lib/bazi/topic-knowledge";

export const runtime = "nodejs";

const PREDICT_TOPICS = TOPIC_PATH.filter((t) => t.kind === "predict");

type Box = { title?: string; body?: string };
const hasBody = (b?: Box) => typeof b?.body === "string" && b.body.trim().length > 0;

/** ข้อความเนื้อหาจริงกล่องแรก (ข้าม "ภาพรวม" ที่ generic); match = เลือกกล่องที่ title มีคำนี้ */
function bodyText(boxes: Box[], match?: string): string | null {
  const pick = match
    ? boxes.find((b) => b?.title?.includes(match) && hasBody(b))
    : (boxes.find((b) => hasBody(b) && b?.title !== "ภาพรวม") ?? boxes.find((b) => hasBody(b)));
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

    // resolve เฉพาะ boxes ต่อบท (ไม่ compose markdown เต็มแบบ newdata-reading) แล้วเก็บ id → boxes
    const byId = new Map<string, Box[]>();
    for (const topic of PREDICT_TOPICS) {
      byId.set(topic.id, resolveChapterBoxes(topic.id, facts, map).boxes as Box[]);
    }
    const chap = (id: string): Box[] => byId.get(id) ?? [];

    const foundation = chap("chart_foundation");
    const prediction = {
      personality: bodyText(foundation),
      // #3 (ซินแสนุ้ย 2026-09-14): "นิสัย" ใช้เสาเต็ม 60 กะจื่อ (甲午 = ganzhi_nisai) จากกล่อง "ทายนิสัยจากราศีบน/ราศีล่างหลักวัน".
      // 🔴 2026-09-16 (ผู้ใช้แจ้ง "ราศีล่างหาย"): คอมมิตข้างบนเลือกกล่อง "ราศีบน" กล่องเดียว → กล่อง "ทายนิสัยจากราศีล่างหลักวัน"
      // (คำทำนายจากก้านล่าง/12 นักษัตร ที่เคยโชว์ก่อนหน้านั้น) หายไป. รวมทั้งสองกล่อง: ราศีบน(เสาเต็ม) + ราศีล่าง(ก้านล่าง).
      // match "จากราศีล่าง" จับเฉพาะกล่องราศีล่าง (กล่องราศีบนคือ "จากราศีบน/ราศีล่าง" — "จาก"+"ราศีล่าง" ไม่ติดกัน จึงไม่ชน).
      habit:
        [bodyText(foundation, "ราศีบน"), bodyText(foundation, "จากราศีล่าง")].filter(Boolean).join("\n\n") ||
        bodyText(foundation, "นิสัย"),
      love: bodyText(chap("love_partner")),
      // work ไม่อยู่ที่นี่ — มาจาก /api/reading/career-finance แหล่งเดียว (รวมอาชีพ)
    };

    // ข้อควรระวัง: กล่องที่ title มี "ระวัง" จากทุกบท
    const cautions: string[] = [];
    for (const boxes of byId.values()) {
      for (const b of boxes) {
        if (b?.body && b?.title?.includes("ระวัง")) cautions.push(b.body.trim());
      }
    }
    // เทพประจำตัว = ชื่อองค์คุ้มครองหลักของดวง (ไม่ใช่ชื่อกล่อง "องค์เทพคุ้มครองดวงชะตา")
    const deity = primaryGuardianDeity(state);

    return Response.json({ prediction, cautions: cautions.slice(0, 4), deity }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "ข้อมูลวันเกิดไม่ถูกต้อง", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "คำนวณไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}
