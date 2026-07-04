/**
 * ต้นทุนต่อ 1 คำถามของแชท "โค้ชฮีลใจ" — ประกอบจาก 3 การเรียก API (classify / embed / generate).
 * ใช้ตารางราคากลางที่ [llm-usage/pricing](../llm-usage/pricing.ts) เป็นแหล่งความจริงเดียว.
 */
import { priceCall, USD_TO_THB, usdToThb } from "@/lib/llm-usage/pricing";

export { USD_TO_THB, usdToThb };

export const CLASSIFY_MODEL = "gemini-2.5-flash-lite";
export const EMBED_MODEL = "gemini-embedding-001";

export type UsageTokens = {
  model: string;
  classifyInTokens: number;
  classifyOutTokens: number;
  embedTokens: number;
  genInTokens: number;
  genOutTokens: number;
};

/** ต้นทุนรวมของ 1 คำถาม (USD) จาก breakdown โทเคน 3 การเรียก API */
export function costUsdOf(u: UsageTokens): number {
  return (
    priceCall({ provider: "gemini", model: CLASSIFY_MODEL, inTokens: u.classifyInTokens, outTokens: u.classifyOutTokens }) +
    priceCall({ provider: "gemini", model: EMBED_MODEL, inTokens: u.embedTokens }) +
    priceCall({ provider: "gemini", model: u.model, inTokens: u.genInTokens, outTokens: u.genOutTokens })
  );
}
