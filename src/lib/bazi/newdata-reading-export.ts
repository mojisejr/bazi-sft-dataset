/**
 * Export dataset ของดวง NewData (อ่าน 15 บท) ที่ mark "เสร็จสิ้น"
 *
 * ประกอบคำอ่านสุดท้ายรายบท = recompute engine baseline แล้ว overlay edits ของซินแส
 * (edits.boxes[topicId] = กล่องที่ซินแสแก้ทั้งชุด แทนของ engine; edits.titles[topicId] = ชื่อบทที่ปรับ)
 * มิเรอร์ pipeline จาก POST /api/reading/newdata-reading + build-shinse-fewshot.
 */
import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";
import { getNewdataMap } from "@/lib/bazi/newdata.server";
import { extractChartFacts } from "@/lib/bazi/newdata-lookup";
import { resolveChapterBoxes } from "@/lib/bazi/chapter-newdata-map";
import { getChapterOutline } from "@/lib/bazi/chapter-outline";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import {
  createDbNewdataReadingRepository,
  type NewdataReadingRepository,
} from "@/lib/bazi/newdata-reading-repository";
import type { NewdataReadingBox } from "@/db/schema";

const PREDICT_TOPICS = TOPIC_PATH.filter((t) => t.kind === "predict");

export type NewdataReadingExportChapter = {
  id: string;
  chapter: number;
  title: string;
  boxes: NewdataReadingBox[];
  /** true = ซินแสแก้กล่องบทนี้เอง (ไม่ใช่ข้อความ engine ตั้งต้น) */
  edited: boolean;
};

export type NewdataReadingExportItem = {
  readingId: string;
  clientName: string | null;
  birthDate: string;
  birthTime: string;
  gender: string;
  province: string | null;
  chapters: NewdataReadingExportChapter[];
  updatedAt: string;
};

/** กล่องตั้งต้นจาก engine (ภาพรวมจาก outline.intro + กล่องที่ resolve ได้) — เหมือนใน route/POST */
function engineBoxesFor(
  topicId: string,
  facts: ReturnType<typeof extractChartFacts>,
  map: Awaited<ReturnType<typeof getNewdataMap>>,
): NewdataReadingBox[] {
  const resolved = resolveChapterBoxes(topicId, facts, map);
  const outline = getChapterOutline(topicId);
  return [
    ...(outline?.intro ? [{ title: "ภาพรวม", body: outline.intro }] : []),
    ...resolved.boxes,
  ];
}

/** ดึงดวง NewData ที่เสร็จสิ้นทั้งหมดในรูป dataset (recompute + overlay edits) */
export async function collectDoneNewdataReadingsForExport(
  repository: NewdataReadingRepository = createDbNewdataReadingRepository(),
): Promise<NewdataReadingExportItem[]> {
  const listed = await repository.list();
  const doneIds = listed.filter((row) => row.status === "done").map((row) => row.id);
  if (doneIds.length === 0) return [];

  const map = await getNewdataMap();
  const knowledgeRepo = createDbKnowledgeRepository();
  const items: NewdataReadingExportItem[] = [];

  for (const id of doneIds) {
    const row = await repository.get(id);
    if (!row) continue;

    const state = await calculateBaziStateFromRawInput(
      {
        birthDate: row.birthDate,
        birthTime: row.birthTime,
        gender: row.gender,
        province: row.province ?? undefined,
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      },
      { repository: knowledgeRepo },
    );
    const birthYear = Number.parseInt(row.birthDate.slice(0, 4), 10) || undefined;
    const facts = extractChartFacts(state, row.gender, birthYear);

    const chapters = PREDICT_TOPICS.map((topic) => {
      const editedBoxes = row.edits?.boxes?.[topic.id];
      const edited = Array.isArray(editedBoxes) && editedBoxes.length > 0;
      return {
        id: topic.id,
        chapter: topic.chapter,
        title: row.edits?.titles?.[topic.id]?.trim() || topic.title,
        boxes: edited ? editedBoxes : engineBoxesFor(topic.id, facts, map),
        edited,
      };
    });

    items.push({
      readingId: row.id,
      clientName: row.clientName,
      birthDate: row.birthDate,
      birthTime: row.birthTime,
      gender: row.gender,
      province: row.province,
      chapters,
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  return items;
}
