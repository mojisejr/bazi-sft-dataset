/**
 * timeout ของการเรียก LLM / Gemini ทุกตัว — ที่เดียวทั้งรีโป (mumate-vercel-to-do-001 slice 2)
 *
 * บน Vercel ฟังก์ชันถูกฆ่าที่ maxDuration (สูงสุด 300 วินาที) จึงไม่มีการเรียกไหนค้างได้เกินนั้น
 * ใน container บน DigitalOcean ไม่มีใครฆ่า — การเรียกที่ค้างกิน socket และหน่วยความจำของ process เดียวไปเรื่อย ๆ
 * ค่า default 290 วินาทีต่ำกว่าเพดาน Vercel นิดเดียว: บน Vercel ไม่เปลี่ยนอะไร (platform ตัดก่อนหรือพร้อมกัน)
 * บน DO ไม่มีอะไรค้างเกินนี้ · ปรับได้ด้วย env LLM_TIMEOUT_MS · timeout ที่แคบกว่าต่อ route อยู่ที่ proxy (slice 3)
 */
export const DEFAULT_LLM_TIMEOUT_MS = 290_000;

export function llmTimeoutMs(env: Partial<NodeJS.ProcessEnv> = process.env): number {
  const n = Number(env.LLM_TIMEOUT_MS?.trim());
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LLM_TIMEOUT_MS;
}

/** options ของ new GoogleGenAI(...) — httpOptions.timeout ใช้กับทุก request ของ client นั้น */
export function genAiClientOptions(apiKey: string | undefined, timeoutMs: number = llmTimeoutMs()) {
  return { apiKey, httpOptions: { timeout: timeoutMs } };
}

/** signal สำหรับ fetch ไปหา LLM โดยตรง (OpenCode, Anthropic, Gemini REST) */
export function llmFetchSignal(timeoutMs: number = llmTimeoutMs()): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}
