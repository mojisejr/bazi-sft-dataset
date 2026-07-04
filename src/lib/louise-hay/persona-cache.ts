/**
 * Explicit context caching ของ "persona" แชทโค้ชฮีลใจ (Gemini CachedContent API).
 * persona เป็นก้อนคงที่ ~1.4k โทเคนที่ส่งทุก request → cache ไว้แล้วอ้างอิง จ่ายเพียง ~25% ของราคาปกติ
 * บนส่วนนั้น (input เข้าเท่าเดิม → คำตอบเหมือนเดิมเป๊ะ, คุณภาพไม่เปลี่ยน).
 *
 * - ใช้ได้เฉพาะคีย์ของ "เซิร์ฟเวอร์" (cache ผูกกับ project ของคีย์ที่สร้าง) — คีย์ผู้ใช้เองไม่แคช
 * - เก็บชื่อ cache ระดับ module + refresh ก่อนหมดอายุ; ถ้าสร้าง/เรียกไม่ได้ → คืน null (route ถอยไปส่ง persona แบบ inline)
 * - explicit cache มีขั้นต่ำ (flash-lite = 2,048 tok, flash ต่ำกว่า). ถ้า persona เล็กกว่านั้นจะสร้างไม่สำเร็จ →
 *   เปิด negative-cache กันยิงซ้ำทุก request; จะ auto-เปิดเองเมื่อ persona ใหญ่พอ/เปลี่ยนโมเดลที่รองรับ.
 *   (ระหว่างนี้ flash-lite มี implicit caching ฟรี ขั้นต่ำ 1,024 tok ที่ช่วยลด persona อยู่แล้วตอน traffic ถี่)
 * server-only.
 */

const TTL_SECONDS = 3600; // 1 ชม.
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // ต่ออายุก่อนหมด 5 นาที
const FAIL_BACKOFF_MS = 15 * 60 * 1000; // สร้างไม่สำเร็จ → พักไม่ retry 15 นาที

type CacheEntry = { name: string; expiresAt: number; model: string; personaHash: string };
let entry: CacheEntry | null = null;
let inflight: Promise<string | null> | null = null;
let disabledUntil = 0;

/** hash เร็ว ๆ ของ persona (ไว้ตรวจว่าเปลี่ยนแล้วต้องสร้าง cache ใหม่) */
function hashPersona(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return `${text.length}:${h}`;
}

async function createCache(apiKey: string, model: string, persona: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${model}`,
          systemInstruction: { parts: [{ text: persona }] },
          ttl: `${TTL_SECONDS}s`,
        }),
      },
    );
    if (!res.ok) return null; // เช่น โทเคนต่ำกว่าขั้นต่ำ/โมเดลไม่รองรับ → ไม่แคช
    const data = (await res.json()) as { name?: string };
    return data.name ?? null;
  } catch {
    return null;
  }
}

/**
 * คืนชื่อ cachedContent สำหรับ persona (สร้าง/รียูสให้อัตโนมัติ) หรือ null ถ้าแคชไม่ได้.
 * ใช้เฉพาะเมื่อเรียกด้วยคีย์เซิร์ฟเวอร์.
 */
export async function getPersonaCacheName(apiKey: string, model: string, persona: string): Promise<string | null> {
  const now = Date.now();
  if (now < disabledUntil) return null; // เพิ่งสร้างไม่สำเร็จ → ยังไม่ retry (กันยิงซ้ำทุก request)
  const hash = hashPersona(persona);
  if (entry && entry.model === model && entry.personaHash === hash && entry.expiresAt - REFRESH_MARGIN_MS > now) {
    return entry.name;
  }
  // กันสร้างซ้ำพร้อมกันตอน cold start
  if (inflight) return inflight;
  inflight = (async () => {
    const name = await createCache(apiKey, model, persona);
    if (name) {
      entry = { name, expiresAt: now + TTL_SECONDS * 1000, model, personaHash: hash };
    } else {
      disabledUntil = Date.now() + FAIL_BACKOFF_MS; // negative-cache
    }
    inflight = null;
    return name;
  })();
  return inflight;
}
