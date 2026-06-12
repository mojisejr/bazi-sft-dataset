import { KnowledgeWorkspace } from "@/components/bazi/reading/KnowledgeWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";
import {
  listTopicKnowledgeViews,
  type TopicKnowledgeView,
} from "@/lib/bazi/knowledge/topic-knowledge-view";

// ดึงสด (merge doctrine override จาก DB) + ให้กฎแทนคำที่เพิ่ม/ลบเห็นผลทันที
export const dynamic = "force-dynamic";

const knowledgeStatusCopy = {
  tone: "ready",
  label: "องค์ความรู้ + คำแก้",
  detail: "ดูองค์ความรู้/หลักการที่ engine ใช้แต่ละบท และจัดการกฎแทนคำ (เปลี่ยนคำเดิม → คำใหม่)",
} as const;

export default async function ReadingKnowledgePage() {
  let topics: TopicKnowledgeView[] = [];
  let unavailable = false;

  try {
    topics = await listTopicKnowledgeViews();
  } catch {
    // best-effort: ถ้า doctrine override โหลดไม่ได้ accessor จะ fallback อยู่แล้ว — กันไว้อีกชั้น
    unavailable = true;
  }

  return (
    <main className="trainer-page">
      <SystemHeader statusCopy={knowledgeStatusCopy} />
      <KnowledgeWorkspace topics={topics} unavailable={unavailable} />
    </main>
  );
}
