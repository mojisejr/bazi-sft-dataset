/**
 * ตัวช่วยบันทึกโทเคน/ต้นทุน LLM ลงตาราง "แยกตามฟีเจอร์" (reading_topic_usage ฯลฯ)
 * แบบ fire-and-forget — ล้มเงียบ ไม่กระทบงานหลัก. อ่านกลับด้วย getFeatureRows ให้แดชบอร์ด /stats.
 *
 * server-only.
 */
import { desc } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { LLM_USAGE_TABLES, type InsertLlmUsage, type LlmUsageFeature, type SelectLlmUsage } from "@/db/schema";

export type LlmUsageProvider = "gemini" | "anthropic" | "opencode";

/** เดา provider จากชื่อรุ่น (ใช้เมื่อผู้เรียกไม่ได้ระบุ) */
export function providerOfModel(model: string): LlmUsageProvider {
  if (/^claude/i.test(model)) return "anthropic";
  return "gemini";
}

export type LogLlmInput = {
  provider?: LlmUsageProvider;
  model: string;
  inTokens?: number;
  outTokens?: number;
  label?: string | null;
  anonId?: string | null;
  usedOwnKey?: boolean;
};

/** บันทึกการเรียก LLM 1 ครั้งลงตารางของฟีเจอร์ — ไม่ throw (ล้มเงียบ) */
export function logLlmUsage(feature: LlmUsageFeature, input: LogLlmInput): void {
  // ยิงแบบ fire-and-forget: ไม่ await ในเส้นทางหลัก
  void (async () => {
    try {
      const table = LLM_USAGE_TABLES[feature];
      const inTokens = input.inTokens ?? 0;
      const outTokens = input.outTokens ?? 0;
      const row: InsertLlmUsage = {
        provider: input.provider ?? providerOfModel(input.model),
        model: input.model,
        inTokens,
        outTokens,
        totalTokens: inTokens + outTokens,
        label: input.label ?? null,
        anonId: input.anonId ?? null,
        usedOwnKey: input.usedOwnKey ?? false,
      };
      await createDbClient().insert(table).values(row);
    } catch (error) {
      console.error(`[llm-usage] logLlmUsage(${feature}) failed:`, error);
    }
  })();
}

/** ดึงแถวล่าสุดของฟีเจอร์หนึ่ง (ใหม่ก่อน) — คืน [] ถ้า DB ล่ม/ตารางยังไม่มี */
export async function getFeatureRows(feature: LlmUsageFeature, limit = 500): Promise<SelectLlmUsage[]> {
  try {
    const table = LLM_USAGE_TABLES[feature];
    return await createDbClient().select().from(table).orderBy(desc(table.createdAt)).limit(limit);
  } catch (error) {
    console.error(`[llm-usage] getFeatureRows(${feature}) failed:`, error);
    return [];
  }
}
