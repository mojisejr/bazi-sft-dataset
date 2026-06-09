import { z } from "zod";

import type { TopicDefinition, TopicRelationKey } from "@/lib/bazi/topic-path";

/**
 * Override ของ "วิธีการอ่านรายบท" ที่ซินแสปรับออนไลน์ — ทับเฉพาะฟิลด์เชิงข้อความ/ลำดับ
 * (lens/title/stepNumbers/relationKeys) ไม่แตะ id/chapter/kind/algorithm
 *
 * โมดูลนี้ "client-safe" (ไม่ import DB) ใช้ได้ทั้ง client (admin UI) และ server (loader)
 */

const RELATION_KEYS = ["same", "resource", "output", "power", "wealth"] as const;

/** ขั้น canonical มี 1..7 (ฉบับซินแสปรับ) */
export const ReadingDoctrineOverrideSchema = z
  .object({
    lens: z.string().trim().min(1).max(2000).optional(),
    title: z.string().trim().min(1).max(500).optional(),
    stepNumbers: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
    relationKeys: z.array(z.enum(RELATION_KEYS)).max(5).optional(),
  })
  .strict();

export type ReadingDoctrineOverride = z.infer<typeof ReadingDoctrineOverrideSchema>;

/** map topicId → override (หลัง validate แล้ว) */
export type ReadingDoctrineOverrideMap = Record<string, ReadingDoctrineOverride>;

/**
 * parse override ดิบจาก DB อย่างปลอดภัย — ถ้า payload ผิดรูปคืน null (เพื่อให้ fallback เป็น default)
 */
export function parseReadingDoctrineOverride(raw: unknown): ReadingDoctrineOverride | null {
  const result = ReadingDoctrineOverrideSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** มี field ที่จะ override จริงไหม (กัน override ว่างเปล่าทับ default โดยไม่จำเป็น) */
export function hasOverrideContent(override: ReadingDoctrineOverride): boolean {
  return (
    override.lens !== undefined ||
    override.title !== undefined ||
    (override.stepNumbers?.length ?? 0) > 0 ||
    (override.relationKeys?.length ?? 0) > 0
  );
}

/**
 * merge override ทับ TopicDefinition default — pure function (testable)
 * คงค่า id/chapter/kind/evidenceDimension/usesDaYunTimeline/usefulGodLookup เดิมเสมอ
 */
export function mergeTopicDefinition(
  base: TopicDefinition,
  override: ReadingDoctrineOverride | null | undefined,
): TopicDefinition {
  if (!override || !hasOverrideContent(override)) {
    return base;
  }
  return {
    ...base,
    ...(override.lens !== undefined ? { lens: override.lens } : {}),
    ...(override.title !== undefined ? { title: override.title } : {}),
    ...(override.stepNumbers && override.stepNumbers.length > 0
      ? { stepNumbers: [...override.stepNumbers] }
      : {}),
    ...(override.relationKeys
      ? { relationKeys: [...override.relationKeys] as TopicRelationKey[] }
      : {}),
  };
}
