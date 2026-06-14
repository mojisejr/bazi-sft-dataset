/**
 * Request-scoped knowledge overlay (server-only) — ใช้ AsyncLocalStorage เพื่อส่ง overlay
 * ให้ builders ใน topic-knowledge.ts / reading-phrases.ts โดยไม่ต้องร้อย param ผ่าน ~40 ฟังก์ชัน
 *
 * ปลอดภัยเรื่อง concurrency/SSR (แต่ละ request มี store ของตัวเอง ไม่ใช่ global mutable)
 * นอก scope (เช่นใน unit test ที่เรียก builder ตรง ๆ) → คืน EMPTY_OVERLAY = พฤติกรรม default เป๊ะ
 *
 * โมดูลนี้ import node:async_hooks → server-only; ผู้ใช้ (topic-knowledge/reading-phrases) เป็น server อยู่แล้ว
 */
import { AsyncLocalStorage } from "node:async_hooks";

import {
  appendsForTopic,
  compositeKey,
  EMPTY_OVERLAY,
  resolveEntry,
  resolveTable,
  type KnowledgeOverlay,
} from "@/lib/bazi/knowledge/knowledge-overlay";

const store = new AsyncLocalStorage<KnowledgeOverlay>();

/**
 * Recorder สำหรับ audit (test-only) — เก็บ tableId ทุกตัวที่ engine "อ่านจริง" ผ่าน overlay
 * default = null → no-op ใน prod. เทส coverage ตั้ง recorder แล้ว generate reading เพื่อพิสูจน์ว่า
 * ทุกตารางที่ engine อ่านอยู่ใน KNOWLEDGE_CATALOG (กันตาราง knowledge หลุดจากตัวแก้)
 */
let accessRecorder: ((tableId: string) => void) | null = null;

export function setKnowledgeAccessRecorder(fn: ((tableId: string) => void) | null): void {
  accessRecorder = fn;
}

/** รัน fn โดยมี overlay นี้เป็น context (route ห่อรอบการ build reading) */
export function runWithKnowledgeOverlay<T>(overlay: KnowledgeOverlay, fn: () => T): T {
  return store.run(overlay, fn);
}

export function currentKnowledgeOverlay(): KnowledgeOverlay {
  return store.getStore() ?? EMPTY_OVERLAY;
}

/** ตารางถ้อยคำที่ override แล้วตาม overlay ปัจจุบัน — ใช้แทนการอ่าน const ตรง ๆ */
export function K<T extends Record<string, string>>(tableId: string, defaults: T): T {
  accessRecorder?.(tableId);
  return resolveTable(currentKnowledgeOverlay(), tableId, defaults);
}

/**
 * ค่าช่องเดียวจากตาราง nested (key ผสม) — override ทับได้รายช่อง
 * ใช้กับตารางที่ key เป็น 2 มิติ เช่น ELEMENT_TEMPER_TH[ธาตุ][temper] → KC("ELEMENT_TEMPER_TH", fallback, ธาตุ, temper)
 * itemKey ใน catalog/overlay = parts join ด้วย "|" (compositeKey)
 */
export function KC(tableId: string, fallback: string, ...parts: string[]): string {
  accessRecorder?.(tableId);
  return resolveEntry(currentKnowledgeOverlay(), tableId, compositeKey(...parts), fallback) ?? fallback;
}

/** ย่อหน้าความรู้ที่ต่อท้ายบทตาม overlay ปัจจุบัน */
export function currentAppends(topicId: string): string[] {
  return appendsForTopic(currentKnowledgeOverlay(), topicId);
}

/**
 * template ถ้อยคำที่มี placeholder {key} แล้วแทนด้วยตัวแปรของดวง — override ทับได้ผ่านคลัง
 * ตาราง single-key (entry "default") เก็บโครงประโยค เช่น "แนวทางดูแล: ...ธาตุ {ธาตุ} ..."
 * vars: { "ธาตุ": "ไฟ/ทอง" } → แทน {ธาตุ} ทุกตำแหน่ง. คีย์ที่ไม่ส่ง vars จะคงรูป {key} ไว้
 */
export function fillTemplate(
  tableId: string,
  defaults: Record<string, string>,
  vars: Record<string, string>,
  entryKey = "default",
): string {
  const tpl = K(tableId, defaults)[entryKey] ?? defaults[entryKey] ?? "";
  // แทน {key} ที่ซินแสคงไว้; placeholder ที่สะกดผิด/ลบชื่อ → ตัดทิ้ง (ไม่ให้ {key} หลุดไปคำทำนาย)
  // ยุบช่องว่างซ้ำที่เกิดจาก placeholder ที่ถูกตัด แต่คง leading/trailing space เดิมของ template
  // (บาง fragment ขึ้นต้นด้วยเว้นวรรคโดยตั้งใจ เพราะถูกต่อท้ายประโยคอื่น)
  const lead = /^[^\S\n]*/u.exec(tpl)?.[0] ?? "";
  const trail = /[^\S\n]*$/u.exec(tpl)?.[0] ?? "";
  const body = tpl
    .replace(/\{([^{}]*)\}/gu, (_whole, name: string) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : "",
    )
    // ยุบเฉพาะช่องว่าง/แท็บซ้ำในบรรทัดเดียว (ไม่แตะ \n เพื่อคง bullet/ย่อหน้าใน template)
    .replace(/[^\S\n]{2,}/gu, " ")
    // ตัดช่องว่างหน้า/หลังของแต่ละบรรทัด (จาก placeholder ที่ถูกตัดหัว/ท้ายบรรทัด)
    .replace(/[^\S\n]+\n/gu, "\n")
    .replace(/\n[^\S\n]+/gu, "\n")
    .replace(/^[^\S\n]+|[^\S\n]+$/gu, "");
  return `${lead}${body}${trail}`;
}
