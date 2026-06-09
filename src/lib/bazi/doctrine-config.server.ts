import { type DoctrineConfigV2 } from "@/lib/bazi/doctrine-config";
import {
  createDbDoctrineConfigRepository,
  type DoctrineConfigRepository,
} from "@/lib/bazi/doctrine-config-repository";

/**
 * Loader ของ doctrine config v2 (server) — โหลด override จาก DB
 * fallback เป็น config ว่าง (= ใช้ default ในโค้ดทั้งหมด) เมื่อ DB ล่ม/ตารางยังไม่ถูกสร้าง
 */

const CACHE_TTL_MS = 30_000;
type CacheEntry = { value: DoctrineConfigV2; expiresAt: number };
let cache: CacheEntry | null = null;

export function invalidateDoctrineConfigCache(): void {
  cache = null;
}

export async function getDoctrineConfigV2(
  deps: { repository?: DoctrineConfigRepository; nowMs?: number } = {},
): Promise<DoctrineConfigV2> {
  const now = deps.nowMs ?? Date.now();
  if (!deps.repository && cache && cache.expiresAt > now) {
    return cache.value;
  }

  let config: DoctrineConfigV2;
  try {
    // สร้าง repository ภายใน try ด้วย เผื่อ DATABASE_URL ไม่ถูกตั้ง (เช่นในเทส) → fallback
    const repository = deps.repository ?? createDbDoctrineConfigRepository();
    config = await repository.load();
  } catch {
    config = { steps: {}, roles: {}, stars: {} };
  }

  if (!deps.repository) {
    cache = { value: config, expiresAt: now + CACHE_TTL_MS };
  }
  return config;
}
