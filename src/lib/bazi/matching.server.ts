/**
 * Loader ของ Matching map — server-only, cache สั้น ๆ + fallback {} (DB ล่ม/ตารางยังไม่มี)
 * ถ้าโหลดไม่ได้ → คืน map ว่าง (engine ใช้ค่า JSON เดิม)
 */
import {
  createDbMatchingRepository,
  type MatchingMap,
  type MatchingRepository,
} from "@/lib/bazi/matching-repository";

const CACHE_TTL_MS = 30_000;
const EMPTY_MAP: MatchingMap = {};

type CacheEntry = { value: MatchingMap; expiresAt: number };
let cache: CacheEntry | null = null;

/** ล้าง cache (เรียกหลังซินแสบันทึก เพื่อให้เห็นผลทันที) */
export function invalidateMatchingCache(): void {
  cache = null;
}

export async function getMatchingMap(
  deps: { repository?: MatchingRepository; nowMs?: number } = {},
): Promise<MatchingMap> {
  const now = deps.nowMs ?? Date.now();
  if (!deps.repository && cache && cache.expiresAt > now) {
    return cache.value;
  }

  let map: MatchingMap;
  try {
    const repository = deps.repository ?? createDbMatchingRepository();
    map = await repository.load();
  } catch {
    map = EMPTY_MAP;
  }

  if (!deps.repository) {
    cache = { value: map, expiresAt: now + CACHE_TTL_MS };
  }
  return map;
}
