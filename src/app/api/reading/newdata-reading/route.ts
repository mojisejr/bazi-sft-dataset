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
import { resolveChapterNewdata, type ResolvedChapter } from "@/lib/bazi/chapter-newdata-map";
import { getChapterOutline } from "@/lib/bazi/chapter-outline";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";

export const runtime = "nodejs";

const PREDICT_TOPICS = TOPIC_PATH.filter((t) => t.kind === "predict");

const PLACEHOLDER_NO_DATA = "ซินแสยังไม่ได้ใส่ข้อมูลสำหรับบทนี้ (รอเพิ่มภายหลัง)";
const PLACEHOLDER_NO_MATCH = "ดวงนี้ไม่เข้าเงื่อนไขของบทนี้";

export type ReadingBox = { title: string; body: string };

/** แปลง resolved chapter → กล่องตั้งต้น (เพิ่ม/ลบ/แก้ได้ในหน้า) — body รองรับ **ตัวหนา** _เอียง_ */
function composeBoxes(intro: string | undefined, r: ResolvedChapter): ReadingBox[] {
  const boxes: ReadingBox[] = [];
  if (intro) boxes.push({ title: "ภาพรวม", body: intro });

  if (!r.defined) {
    boxes.push({ title: "", body: PLACEHOLDER_NO_DATA });
    return boxes;
  }
  if (!r.hasContent) {
    boxes.push({ title: "", body: PLACEHOLDER_NO_MATCH });
    return boxes;
  }

  for (const section of r.sections) {
    const body = section.blocks
      .map((block) => {
        const head = block.label ? `**${block.label}** ` : "";
        const ctx = block.context ? ` _(${block.context})_` : "";
        return `${head}${block.text}${ctx}`;
      })
      .join("\n\n");
    boxes.push({ title: section.title, body });
  }
  return boxes;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const repository = createDbKnowledgeRepository();
    const calculatedState = await calculateBaziStateFromRawInput(payload, { repository });

    const facts = extractChartFacts(calculatedState);
    const map = await getNewdataMap();

    const chapters = PREDICT_TOPICS.map((topic) => {
      const resolved = resolveChapterNewdata(topic.id, facts, map);
      const outline = getChapterOutline(topic.id);
      return {
        id: topic.id,
        chapter: topic.chapter,
        title: topic.title,
        intro: outline?.intro ?? null,
        defined: resolved.defined,
        hasContent: resolved.hasContent,
        sections: resolved.sections,
        boxes: composeBoxes(outline?.intro ?? undefined, resolved),
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
