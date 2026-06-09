import { TOPIC_PATH, getTopicDefinition, type TopicDefinition } from "@/lib/bazi/topic-path";
import { mergeTopicDefinition } from "@/lib/bazi/reading-doctrine-override";
import {
  createDbReadingDoctrineRepository,
  type ReadingDoctrineRepository,
} from "@/lib/bazi/reading-doctrine-repository";

/**
 * Loader ของ "วิธีการอ่านรายบท" ฉบับ merged (default ในโค้ด + override ออนไลน์จาก DB)
 * — server-only (เรียก repository ที่แตะ Neon)
 *
 * หลักประกันความปลอดภัย:
 *  - ถ้า DB ล่ม / ตารางยังไม่ถูกสร้าง / override ผิดรูป → fallback เป็น TOPIC_PATH เดิมเสมอ
 *  - cache สั้น ๆ (TTL) กันยิง DB ถี่เกินไป
 */

const CACHE_TTL_MS = 30_000;

type CacheEntry = { value: TopicDefinition[]; expiresAt: number };
let cache: CacheEntry | null = null;

/** ล้าง cache (เรียกหลัง admin upsert/delete เพื่อให้เห็นผลทันที) */
export function invalidateReadingDoctrineCache(): void {
  cache = null;
}

/**
 * คืน TOPIC_PATH ที่ merge override แล้ว — ถ้ามีปัญหาใด ๆ คืน default
 * @param nowMs เวลาปัจจุบัน (ฉีดได้ในเทสเพื่อคุม cache)
 */
export async function getMergedReadingDoctrine(
  deps: { repository?: ReadingDoctrineRepository; nowMs?: number } = {},
): Promise<TopicDefinition[]> {
  const now = deps.nowMs ?? Date.now();
  if (!deps.repository && cache && cache.expiresAt > now) {
    return cache.value;
  }

  let merged: TopicDefinition[];
  try {
    // สร้าง repository ภายใน try ด้วย เผื่อ DATABASE_URL ไม่ถูกตั้ง (เช่นในเทส) → fallback
    const repository = deps.repository ?? createDbReadingDoctrineRepository();
    const overrides = await repository.listOverrides();
    merged = TOPIC_PATH.map((topic) => mergeTopicDefinition(topic, overrides[topic.id]));
  } catch {
    // DB ล่ม/ตารางยังไม่ถูกสร้าง/ไม่มี env → ใช้ default ในโค้ด (แอปไม่พัง)
    merged = [...TOPIC_PATH];
  }

  // cache เฉพาะเส้นทางปกติ (ไม่ใช้ repository ที่ฉีดมาในเทส)
  if (!deps.repository) {
    cache = { value: merged, expiresAt: now + CACHE_TTL_MS };
  }
  return merged;
}

/** คืนนิยามบทเดียวแบบ merged — fallback เป็น default ของบทนั้นเมื่อหาไม่เจอ/ผิดพลาด */
export async function getMergedTopicDefinition(
  topicId: string,
  deps: { repository?: ReadingDoctrineRepository; nowMs?: number } = {},
): Promise<TopicDefinition> {
  try {
    const merged = await getMergedReadingDoctrine(deps);
    const found = merged.find((topic) => topic.id === topicId);
    if (found) {
      return found;
    }
  } catch {
    // ตกไป fallback ด้านล่าง
  }
  return getTopicDefinition(topicId);
}
