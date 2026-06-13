/**
 * Loader ของ knowledge overlay (เฟส 2) — server-only, cache สั้น ๆ + fallback EMPTY_OVERLAY
 * มิเรอร์ reading-doctrine.server.ts: DB ล่ม/ตารางยังไม่มี → คืน overlay ว่าง (engine ทายด้วยค่า default)
 */
import {
  createDbKnowledgeOverrideRepository,
  type KnowledgeOverrideRepository,
} from "@/lib/bazi/knowledge-override-repository";
import { EMPTY_OVERLAY, type KnowledgeOverlay } from "@/lib/bazi/knowledge/knowledge-overlay";

const CACHE_TTL_MS = 30_000;

type CacheEntry = { value: KnowledgeOverlay; expiresAt: number };
let cache: CacheEntry | null = null;

/** ล้าง cache (เรียกหลัง publish/restore เพื่อให้เห็นผลทันที) */
export function invalidateKnowledgeOverlayCache(): void {
  cache = null;
}

export async function getKnowledgeOverlay(
  deps: { repository?: KnowledgeOverrideRepository; nowMs?: number } = {},
): Promise<KnowledgeOverlay> {
  const now = deps.nowMs ?? Date.now();
  if (!deps.repository && cache && cache.expiresAt > now) {
    return cache.value;
  }

  let overlay: KnowledgeOverlay;
  try {
    const repository = deps.repository ?? createDbKnowledgeOverrideRepository();
    overlay = await repository.load();
  } catch {
    overlay = EMPTY_OVERLAY;
  }

  if (!deps.repository) {
    cache = { value: overlay, expiresAt: now + CACHE_TTL_MS };
  }
  return overlay;
}
