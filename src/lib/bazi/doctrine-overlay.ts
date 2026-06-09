import type { ReadingDoctrineOverride } from "@/lib/bazi/reading-doctrine-override";
import type { DoctrineConfigV2 } from "@/lib/bazi/doctrine-config";

/**
 * Merge helpers (pure, client-safe) สำหรับ "preview" — วาง draft overlay ทับ published
 * โดยให้ draft ชนะรายคีย์ (ไม่ field-merge เพราะ admin แก้ทั้ง override/value ของคีย์นั้นทีเดียว)
 */

export function mergeTopicOverrides(
  published: Record<string, ReadingDoctrineOverride>,
  overlay: Record<string, ReadingDoctrineOverride>,
): Record<string, ReadingDoctrineOverride> {
  return { ...published, ...overlay };
}

export function mergeConfigV2(base: DoctrineConfigV2, overlay: DoctrineConfigV2): DoctrineConfigV2 {
  return {
    steps: { ...base.steps, ...overlay.steps },
    roles: { ...base.roles, ...overlay.roles },
    stars: { ...base.stars, ...overlay.stars },
  };
}
