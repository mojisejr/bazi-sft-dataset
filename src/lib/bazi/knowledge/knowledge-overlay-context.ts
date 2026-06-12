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

/** รัน fn โดยมี overlay นี้เป็น context (route ห่อรอบการ build reading) */
export function runWithKnowledgeOverlay<T>(overlay: KnowledgeOverlay, fn: () => T): T {
  return store.run(overlay, fn);
}

export function currentKnowledgeOverlay(): KnowledgeOverlay {
  return store.getStore() ?? EMPTY_OVERLAY;
}

/** ตารางถ้อยคำที่ override แล้วตาม overlay ปัจจุบัน — ใช้แทนการอ่าน const ตรง ๆ */
export function K<T extends Record<string, string>>(tableId: string, defaults: T): T {
  return resolveTable(currentKnowledgeOverlay(), tableId, defaults);
}

/**
 * ค่าช่องเดียวจากตาราง nested (key ผสม) — override ทับได้รายช่อง
 * ใช้กับตารางที่ key เป็น 2 มิติ เช่น ELEMENT_TEMPER_TH[ธาตุ][temper] → KC("ELEMENT_TEMPER_TH", fallback, ธาตุ, temper)
 * itemKey ใน catalog/overlay = parts join ด้วย "|" (compositeKey)
 */
export function KC(tableId: string, fallback: string, ...parts: string[]): string {
  return resolveEntry(currentKnowledgeOverlay(), tableId, compositeKey(...parts), fallback) ?? fallback;
}

/** ย่อหน้าความรู้ที่ต่อท้ายบทตาม overlay ปัจจุบัน */
export function currentAppends(topicId: string): string[] {
  return appendsForTopic(currentKnowledgeOverlay(), topicId);
}
