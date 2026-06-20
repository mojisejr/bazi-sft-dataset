/**
 * Loader ของ NewData map — server-only, cache สั้น ๆ + fallback {} (DB ล่ม/ตารางยังไม่มี)
 * มิเรอร์ knowledge-override.server.ts: ถ้าโหลดไม่ได้ → คืน map ว่าง (บทจะเป็น placeholder)
 */
import {
  createDbNewdataRepository,
  type NewdataMap,
  type NewdataRepository,
} from "@/lib/bazi/newdata-repository";

const CACHE_TTL_MS = 30_000;
const EMPTY_MAP: NewdataMap = {};

type CacheEntry = { value: NewdataMap; expiresAt: number };
let cache: CacheEntry | null = null;

/** ล้าง cache (เรียกหลังซินแสบันทึก เพื่อให้เห็นผลทันที) */
export function invalidateNewdataCache(): void {
  cache = null;
}

export async function getNewdataMap(
  deps: { repository?: NewdataRepository; nowMs?: number } = {},
): Promise<NewdataMap> {
  const now = deps.nowMs ?? Date.now();
  if (!deps.repository && cache && cache.expiresAt > now) {
    return cache.value;
  }

  let map: NewdataMap;
  try {
    const repository = deps.repository ?? createDbNewdataRepository();
    map = await repository.load();
  } catch {
    map = EMPTY_MAP;
  }

  if (!deps.repository) {
    cache = { value: map, expiresAt: now + CACHE_TTL_MS };
  }
  return map;
}
