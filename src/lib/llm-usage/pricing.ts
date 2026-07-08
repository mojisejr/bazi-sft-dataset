/**
 * ตารางราคา LLM (โดยประมาณ) — แหล่งความจริงเดียวสำหรับคำนวณต้นทุนทุกฟีเจอร์.
 * ราคาเป็น USD ต่อ 1,000,000 โทเคน (paid tier).
 * เป็นค่าประมาณ ณ ต้นปี 2026 — ปรับได้ที่นี่ที่เดียว แล้วสถิติย้อนหลังอัปเดตตาม.
 */

/** อัตราแลกเปลี่ยน USD → THB (โดยประมาณ) — ปรับได้ */
export const USD_TO_THB = 32;

type ModelPrice = { inPerM: number; outPerM: number };

/** ราคา USD ต่อ 1M โทเคน แยก input/output */
const MODEL_PRICES: Record<string, ModelPrice> = {
  // ── Google Gemini ──
  "gemini-2.5-flash": { inPerM: 0.3, outPerM: 2.5 },
  "gemini-2.5-flash-lite": { inPerM: 0.1, outPerM: 0.4 },
  "gemini-2.5-pro": { inPerM: 1.25, outPerM: 10 },
  "gemini-2.0-flash": { inPerM: 0.1, outPerM: 0.4 },
  // Gemini 3 (ราคาจริง พ.ค.–ก.ค. 2026)
  "gemini-3-flash-preview": { inPerM: 0.3, outPerM: 2.5 },
  "gemini-3-flash": { inPerM: 0.3, outPerM: 2.5 },
  "gemini-3.1-flash-lite": { inPerM: 0.25, outPerM: 1.5 },
  "gemini-3-flash-lite": { inPerM: 0.25, outPerM: 1.5 },
  "gemini-embedding-001": { inPerM: 0.15, outPerM: 0 },
  "text-embedding-004": { inPerM: 0, outPerM: 0 },
  // ── Imagen (คิดต่อรูป ไม่ใช่ต่อโทเคน) ──
  // convention: log 1 รูป = outTokens 1 → ตั้ง outPerM = ราคาต่อรูป(USD) × 1M ให้สูตรเชิงเส้นเดิมคิดถูกพอดี
  "imagen-4.0-generate-001": { inPerM: 0, outPerM: 40_000 }, // $0.04/รูป
  "imagen-4.0-fast-generate-001": { inPerM: 0, outPerM: 20_000 }, // $0.02/รูป
  "imagen-4.0-ultra-generate-001": { inPerM: 0, outPerM: 60_000 }, // $0.06/รูป
  // ── Anthropic Claude ──
  "claude-opus-4-8": { inPerM: 15, outPerM: 75 },
  "claude-opus-4-7": { inPerM: 15, outPerM: 75 },
  "claude-sonnet-5": { inPerM: 3, outPerM: 15 },
  "claude-haiku-4-5": { inPerM: 1, outPerM: 5 },
};

/** เรตสำรองรายผู้ให้บริการ เมื่อไม่รู้จักชื่อรุ่น */
const PROVIDER_FALLBACK: Record<string, ModelPrice> = {
  gemini: { inPerM: 0.3, outPerM: 2.5 },
  anthropic: { inPerM: 3, outPerM: 15 },
  // OpenCode Zen มักเป็น self-host/ฟรี → ตั้ง 0 (ปรับได้ถ้ามีต้นทุนจริง)
  opencode: { inPerM: 0, outPerM: 0 },
};

function priceOf(provider: string, model: string): ModelPrice {
  const stripped = model.replace(/^models\//, "").replace(/\s*\(fallback-engine\)$/, "");
  return MODEL_PRICES[model] ?? MODEL_PRICES[stripped] ?? PROVIDER_FALLBACK[provider] ?? PROVIDER_FALLBACK.gemini;
}

/** ต้นทุน USD ของ 1 การเรียก LLM */
export function priceCall(input: {
  provider: string;
  model: string;
  inTokens?: number;
  outTokens?: number;
}): number {
  const p = priceOf(input.provider, input.model);
  const inCost = ((input.inTokens ?? 0) / 1_000_000) * p.inPerM;
  const outCost = ((input.outTokens ?? 0) / 1_000_000) * p.outPerM;
  return inCost + outCost;
}

/** คิดต้นทุนจาก model + โทเคน (ไม่รู้ provider) — เดา provider จากชื่อรุ่น */
export function priceModel(model: string, inTokens: number, outTokens: number): number {
  const provider = /^claude/.test(model) ? "anthropic" : "gemini";
  return priceCall({ provider, model, inTokens, outTokens });
}

export function usdToThb(usd: number): number {
  return usd * USD_TO_THB;
}
