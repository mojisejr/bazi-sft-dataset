/**
 * POST /api/reading/newdata-reading — อ่านดวง 15 บท "ฉบับ NewData"
 * รวม flow: engine คำนวณเดิม → extractChartFacts → resolve 15 บทจาก NewData → compose markdown
 * คืนทั้งดวง (calculatedState) + 15 บทพร้อมข้อความตั้งต้น (ซินแสแก้ต่อในหน้าได้)
 */
import { ZodError } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";
import { getNewdataMap } from "@/lib/bazi/newdata.server";
import { extractChartFacts } from "@/lib/bazi/newdata-lookup";
import { resolveChapterBoxes } from "@/lib/bazi/chapter-newdata-map";
import { getChapterOutline } from "@/lib/bazi/chapter-outline";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";

export const runtime = "nodejs";

const PREDICT_TOPICS = TOPIC_PATH.filter((t) => t.kind === "predict");

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const repository = createDbKnowledgeRepository();
    const calculatedState = await calculateBaziStateFromRawInput(payload, { repository });

    // birthYear จาก birthDate (ค.ศ.) — ใช้บท 12 โชว์อายุรายปีจร
    const birthYear = Number.parseInt(String(payload?.birthDate ?? "").slice(0, 4), 10) || undefined;
    const facts = extractChartFacts(calculatedState, payload?.gender, birthYear);
    const map = await getNewdataMap();

    const chapters = PREDICT_TOPICS.map((topic) => {
      const resolved = resolveChapterBoxes(topic.id, facts, map);
      const outline = getChapterOutline(topic.id);
      // box ครบทุกหัวข้อย่อย (bullet) + กล่อง "ภาพรวม" นำหน้า (จาก outline.intro)
      const boxes = [
        ...(outline?.intro ? [{ title: "ภาพรวม", body: outline.intro }] : []),
        ...resolved.boxes,
      ];
      return {
        id: topic.id,
        chapter: topic.chapter,
        title: topic.title,
        intro: outline?.intro ?? null,
        defined: resolved.defined,
        hasContent: resolved.hasContent,
        boxes,
      };
    });

    return Response.json({ rawInput: payload, calculatedState, chapters }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "ข้อมูลวันเกิดไม่ถูกต้อง", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "คำนวณไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}
