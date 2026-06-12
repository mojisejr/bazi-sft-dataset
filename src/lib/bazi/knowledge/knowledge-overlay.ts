/**
 * Knowledge overlay (เฟส 2) — ชั้นแทนค่า "องค์ความรู้" ของ engine แบบ deterministic ที่ซินแสแก้ออนไลน์
 *
 * 2 กลไก:
 *  1) tables: แทนค่า TABLE[key] ของตารางถ้อยคำ (เช่น QI_WEALTH_TH["养"] → ข้อความใหม่)
 *  2) appends: ต่อย่อหน้าความรู้ใหม่ท้ายบท (always-on ต่อ topicId)
 *
 * โมดูลนี้ pure (ไม่มี fs/db) → ใช้ได้ทั้ง client/server. โหลดจริงอยู่ใน knowledge-override.server.ts
 * builders ส่ง defaults ของตัวเองเข้ามา (ไม่ผูกกับ catalog) เพื่อให้ seam แตะโค้ดน้อย + ไม่เกิด import cycle
 */
export type KnowledgeOverlay = {
  /** tableId → (entryKey → ข้อความแทน) */
  tables: Record<string, Record<string, string>>;
  /** topicId → ย่อหน้าความรู้ที่ต่อท้าย (เรียงตามลำดับ) */
  appends: Record<string, string[]>;
};

export const EMPTY_OVERLAY: KnowledgeOverlay = Object.freeze({
  tables: {},
  appends: {},
}) as KnowledgeOverlay;

/**
 * คืนตารางถ้อยคำที่ทับ override แล้ว — ถ้าไม่มี override ของ tableId นี้ คืน defaults เดิม (อ้างอิงเดียวกัน)
 * จึง "ไม่แก้อะไร" เมื่อ overlay ว่าง (พฤติกรรมเดิมเป๊ะ)
 */
export function resolveTable<T extends Record<string, string>>(
  overlay: KnowledgeOverlay,
  tableId: string,
  defaults: T,
): T {
  const over = overlay.tables[tableId];
  if (!over) return defaults;
  return { ...defaults, ...over } as T;
}

/** ค่าเดียวจากตาราง (สะดวกเมื่อต้องอ่านคีย์เดียว) */
export function resolveEntry(
  overlay: KnowledgeOverlay,
  tableId: string,
  key: string,
  fallback: string | undefined,
): string | undefined {
  return overlay.tables[tableId]?.[key] ?? fallback;
}

/** ย่อหน้าที่ต่อท้ายบท (ว่างถ้าไม่มี) */
export function appendsForTopic(overlay: KnowledgeOverlay, topicId: string): string[] {
  return overlay.appends[topicId] ?? [];
}

/** คีย์ผสมสำหรับตารางซ้อน (เช่น ELEMENT_TEMPER_TH: "wood|excess") — ตัวคั่น | ปลอดภัยกับคีย์ไทย/จีน */
export function compositeKey(...parts: string[]): string {
  return parts.join("|");
}

/**
 * รวม overlay 2 ชั้น (published + draft) — draft ทับ published
 *  - tables: รวมรายคีย์ (draft ทับเฉพาะคีย์ที่ระบุ)
 *  - appends: draft แทนชุด append ทั้งบท (ถ้ามี) ของ topicId นั้น
 */
export function mergeKnowledgeOverlay(
  base: KnowledgeOverlay,
  over: KnowledgeOverlay,
): KnowledgeOverlay {
  const tables: Record<string, Record<string, string>> = {};
  for (const [tableId, entries] of Object.entries(base.tables)) {
    tables[tableId] = { ...entries };
  }
  for (const [tableId, entries] of Object.entries(over.tables)) {
    tables[tableId] = { ...(tables[tableId] ?? {}), ...entries };
  }
  return {
    tables,
    appends: { ...base.appends, ...over.appends },
  };
}
