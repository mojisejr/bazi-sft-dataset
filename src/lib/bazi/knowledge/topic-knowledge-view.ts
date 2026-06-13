/**
 * View model รวม "องค์ความรู้รายบท" สำหรับหน้า /reading/knowledge (read-only)
 *
 * รวม 2 แหล่ง client-safe เข้าด้วยกัน — ไม่แตะ compiled-knowledge.json (42MB):
 *  - TOPIC_PATH (เมตาดาทารายบท: lens/ขั้น/บทบาทธาตุ) ฉบับ merged override จาก DB
 *  - BAZI_TOPIC_REGISTRY (engineDependencies / sinsaeLogicRules / sourceRefs)
 * เชื่อมผ่าน evidenceDimension ↔ annotationDimension (topic-dimension-bridge)
 *
 * server-only เพราะดึง doctrine override ผ่าน reading-doctrine.server (แตะ Neon, best-effort)
 * ฝั่ง client ให้ import เฉพาะ `type TopicKnowledgeView`
 */
import { type TopicDefinition } from "@/lib/bazi/topic-path";
import { getMergedReadingDoctrine } from "@/lib/bazi/reading-doctrine.server";
import { getKnowledgeOverlay } from "@/lib/bazi/knowledge-override.server";
import {
  EMPTY_OVERLAY,
  resolveLogicRules,
  resolveSourceFocus,
  type KnowledgeOverlay,
} from "@/lib/bazi/knowledge/knowledge-overlay";
import { BAZI_TOPIC_REGISTRY } from "@/lib/bazi/knowledge/topic-registry";
import { getTopicIdsForAnnotationDimension } from "@/lib/bazi/knowledge/topic-dimension-bridge";
import { type BaziTopicDefinition } from "@/lib/bazi/knowledge/topic-types";

export type TopicKnowledgeView = {
  /** นิยามบท (merged override แล้ว) */
  definition: TopicDefinition;
  /** ก้อนความรู้จาก registry ที่ map กับ dimension ของบทนี้ (0..n ก้อน) */
  knowledge: BaziTopicDefinition[];
};

const REGISTRY_BY_ID = new Map(BAZI_TOPIC_REGISTRY.map((topic) => [topic.id, topic]));

/** ทับ logicRules/sourceFocus ของก้อนความรู้ด้วย overlay (ไม่แตะ field คำนวณ) */
function applyOverlayToBundle(
  bundle: BaziTopicDefinition,
  overlay: KnowledgeOverlay,
): BaziTopicDefinition {
  const logic = resolveLogicRules(overlay, bundle.id, bundle.sinsaeLogicRules);
  const focuses = resolveSourceFocus(
    overlay,
    bundle.id,
    bundle.sourceRefs.map((ref) => ref.reasoningFocus),
  );
  return {
    ...bundle,
    sinsaeLogicRules: logic.length > 0 ? logic : bundle.sinsaeLogicRules,
    sourceRefs: bundle.sourceRefs.map((ref, index) => ({
      ...ref,
      reasoningFocus: focuses[index] ?? ref.reasoningFocus,
    })),
  };
}

/** ก้อนความรู้ของบทหนึ่ง — หาจาก dimension ของบทนั้น (บทที่ dimension ว่าง/ไม่ map → ว่าง) */
export function knowledgeForDefinition(
  definition: TopicDefinition,
  overlay: KnowledgeOverlay = EMPTY_OVERLAY,
): BaziTopicDefinition[] {
  if (!definition.evidenceDimension) return [];
  const ids = getTopicIdsForAnnotationDimension(definition.evidenceDimension) ?? [];
  return ids
    .map((id) => REGISTRY_BY_ID.get(id))
    .filter((entry): entry is BaziTopicDefinition => Boolean(entry))
    .map((entry) => applyOverlayToBundle(entry, overlay));
}

/** รายการ view รายบท (เฉพาะบททำนาย — บท basis ไม่มีองค์ความรู้ให้แสดง) */
export async function listTopicKnowledgeViews(
  deps: Parameters<typeof getMergedReadingDoctrine>[0] = {},
): Promise<TopicKnowledgeView[]> {
  const merged = await getMergedReadingDoctrine(deps);
  // overlay = published only (หน้า read-only แสดงค่าที่ "เผยแพร่แล้ว"); best-effort
  const overlay = await getKnowledgeOverlay().catch(() => EMPTY_OVERLAY);
  return merged
    .filter((definition) => definition.kind === "predict")
    .map((definition) => ({
      definition,
      knowledge: knowledgeForDefinition(definition, overlay),
    }));
}
