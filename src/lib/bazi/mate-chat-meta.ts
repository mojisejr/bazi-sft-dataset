import { createDbClient } from "@/db/client";
import { baziMateChatMeta } from "@/db/schema";

/**
 * บันทึก metadata แชท Mate AI (ไม่มีเนื้อหาข้อความ — PDPA-safe) สำหรับ analytics /ops.
 * fire-and-forget: ห้ามทำให้ flow แชทล้มถ้า insert พลาด. เรียก 1 ครั้งต่อ 1 คำตอบจริง.
 */
export function logMateChatMeta(input: {
  anonId?: string | null;
  persona?: string | null;
  topicId?: string | null;
  timeframe?: string | null;
}): void {
  if (!input.anonId) return;
  void (async () => {
    try {
      await createDbClient().insert(baziMateChatMeta).values({
        anonId: input.anonId as string,
        persona: input.persona ?? null,
        topicId: input.topicId ?? null,
        timeframe: input.timeframe ?? null,
      });
    } catch {
      /* fire-and-forget */
    }
  })();
}
