/**
 * แหล่งรูปหน้าไพ่ "จากไฟล์จริง" ใน knownlage/ (ไม่พึ่ง Supabase)
 * ใช้โดยเส้น GET /api/{oracle,divine}-cards/image/[no] เพื่อให้ FE ดึงรูปจาก engine ได้ตรง ๆ
 *
 * - oracle: knownlage/…ออราเคิล…/N.jpg (1..120, "99(1).jpg" = ใบ 100)
 * - divine: knownlage/ไพ่เทพ/NN.<ชื่อ>.png|jpg (1..80)
 *
 * บีบเป็น JPEG (sharp) ครั้งแรกที่ถูกขอ แล้วแคชใน memory (บูตครั้งเดียวต่อ process)
 * server-only
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { compressCardImage } from "@/lib/bazi/divine-cards/image-gen";

export type CardDeck = "oracle" | "divine" | "sage";

const ROOT = process.cwd();
const KNOWNLAGE = path.join(ROOT, "knownlage");

/** ขนาดรูปที่เสิร์ฟให้ FE. การ์ด = thumbnail/section icon (เล็กพอ); ใบเซียมซี = โปสเตอร์มีตัวหนังสือ ต้องอ่านออก */
const SERVE_QUALITY = 80;
const SERVE_WIDTH: Record<CardDeck, number> = { oracle: 480, divine: 480, sage: 960 };

const indexCache: Partial<Record<CardDeck, Map<number, string>>> = {};
const bytesCache = new Map<string, { buf: Buffer; mime: string }>();

/** หาโฟลเดอร์ไพ่ออราเคิล (ชื่อขึ้นต้น "ไพ่ออราเคิล" — เผื่อมีช่องว่างท้าย); เลือกโฟลเดอร์ที่มี .jpg มากสุด */
function findOracleDir(): string | null {
  const stack = [KNOWNLAGE];
  let best: { dir: string; count: number } | null = null;
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    const jpgs = entries.filter((e) => /\.jpe?g$/i.test(e));
    if (dir.includes("ออราเคิล") && jpgs.length > (best?.count ?? 0)) {
      best = { dir, count: jpgs.length };
    }
    for (const e of entries) {
      const full = path.join(dir, e);
      try {
        if (statSync(full).isDirectory()) stack.push(full);
      } catch {
        /* ignore */
      }
    }
  }
  return best?.dir ?? null;
}

/** "5.jpg" → 5, "99(1).jpg" → 100 (ใบ 100 ที่ตั้งชื่อผิด) */
function oracleNoFromFile(file: string): number | null {
  const base = file.replace(/\.jpe?g$/i, "").trim();
  if (/^99\s*\(1\)$/.test(base)) return 100;
  const m = base.match(/^(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

/** "05เจ้าแม่กวนอิม .อุปสรรค.png" → 5 */
function divineNoFromFile(file: string): number | null {
  const m = file.match(/^(\d+)\s*\.?\s*.+\.(png|jpe?g)$/i);
  return m ? parseInt(m[1], 10) : null;
}

/** ใบเซียมซี "01.jpg".."64.jpg" (เลขนำหน้า 2 หลัก) → 1..64 */
function sageNoFromFile(file: string): number | null {
  const base = file.replace(/\.jpe?g$/i, "").trim();
  const m = base.match(/^(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

function buildIndex(deck: CardDeck): Map<number, string> {
  const map = new Map<number, string>();
  if (deck === "oracle") {
    const dir = findOracleDir();
    if (!dir) return map;
    for (const file of readdirSync(dir)) {
      if (!/\.jpe?g$/i.test(file)) continue;
      const no = oracleNoFromFile(file);
      if (no && no > 0 && !map.has(no)) map.set(no, path.join(dir, file));
    }
    return map;
  }
  if (deck === "sage") {
    const dir = path.join(KNOWNLAGE, "เซียนเสี่ยงทาย");
    if (!existsSync(dir)) return map;
    for (const file of readdirSync(dir)) {
      if (!/\.jpe?g$/i.test(file)) continue;
      const no = sageNoFromFile(file);
      if (no && no > 0 && !map.has(no)) map.set(no, path.join(dir, file));
    }
    return map;
  }
  // divine
  const dir = path.join(KNOWNLAGE, "ไพ่เทพ");
  if (!existsSync(dir)) return map;
  for (const file of readdirSync(dir)) {
    if (!/\.(png|jpe?g)$/i.test(file)) continue;
    const no = divineNoFromFile(file);
    if (no && no > 0 && !map.has(no)) map.set(no, path.join(dir, file));
  }
  return map;
}

function getIndex(deck: CardDeck): Map<number, string> {
  return (indexCache[deck] ??= buildIndex(deck));
}

/** อ่าน+บีบรูปหน้าไพ่จากไฟล์จริง (แคชผลลัพธ์). คืน null ถ้าไม่มีไฟล์ของใบนั้น */
export async function getCardImageBytes(
  deck: CardDeck,
  no: number,
): Promise<{ buf: Buffer; mime: string } | null> {
  const key = `${deck}:${no}`;
  const cached = bytesCache.get(key);
  if (cached) return cached;

  const file = getIndex(deck).get(no);
  if (!file || !existsSync(file)) return null;

  const raw = readFileSync(file);
  const out = await compressCardImage(raw.toString("base64"), {
    width: SERVE_WIDTH[deck],
    quality: SERVE_QUALITY,
  });
  const result = { buf: Buffer.from(out.base64, "base64"), mime: out.mime };
  bytesCache.set(key, result);
  return result;
}

/** เลขไพ่ที่มีไฟล์รูปจริง (สำหรับ health/debug) */
export function listCardNos(deck: CardDeck): number[] {
  return [...getIndex(deck).keys()].sort((a, b) => a - b);
}
