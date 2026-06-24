/**
 * คลังคำแก้ของซินแส (ฝั่ง client, localStorage) — เก็บคำที่ซินแสแก้คำทำนายรายบท
 * เพื่อ (1) override ผลของระบบสำหรับดวงเดิม และ (2) ป้อนกลับเป็นตัวอย่างให้ LLM
 * เมื่อเจอดวงอื่นที่ engine ให้ "ผลคล้ายกัน" (fingerprint ตรง) → "คำพวกนี้หรือคำประมาณนี้".
 *
 * ใช้เฉพาะใน browser — ทุกฟังก์ชันกัน try/catch เผื่อ localStorage ปิด/เต็ม (แบบเดียวกับ
 * loadStoredFormState ใน ReadingPathWorkspace).
 */
import type { TopicEngineReading } from "@/lib/bazi/topic-reading";

const STORAGE_KEY = "bazi-reading-sinsae-corrections-v1";

export type SinsaeCorrection = {
  topicId: string;
  /** ลายนิ้วมือของ "ผลความสัมพันธ์" จาก engine — ดวงที่ผลตรงกันถือว่าคล้ายกัน */
  fingerprint: string;
  /** ระบุดวงเดียวกันเป๊ะ (วันเกิด/เวลา/เพศ) สำหรับ override ตรงตัว */
  chartSignature: string;
  /** คำของระบบ ณ ตอนที่ซินแสแก้ (ไว้เทียบ/กู้คืน) */
  original: string;
  /** คำที่ซินแสแก้ */
  corrected: string;
  /** ISO timestamp ที่แก้ล่าสุด */
  editedAt: string;
};

type CorrectionStore = Record<string, SinsaeCorrection[]>;

/** ข้อมูลดวงน้อยที่สุดที่ใช้สร้าง chart signature */
export type ChartIdentity = {
  birthDate: string;
  birthTime: string;
  gender: string;
};

/** signature ระบุดวงเดียวกันเป๊ะ */
export function chartSignatureOf(identity: ChartIdentity): string {
  return `${identity.birthDate}|${identity.birthTime}|${identity.gender}`;
}

/**
 * fingerprint ของผล engine ต่อหนึ่งบท — จับ "ผลความสัมพันธ์เหมือนกัน" = ดวงคล้ายกัน
 * ใช้ topicId + lens + รายการ relationResult ที่ sort แล้ว (ลำดับไม่สำคัญ)
 */
export function readingFingerprint(reading: TopicEngineReading): string {
  const results = reading.table
    .map((row) => row.relationResult.trim())
    .filter((value) => value.length > 0)
    .sort();
  return [reading.topicId, reading.lens.trim(), ...results].join("¦");
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadCorrections(): CorrectionStore {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CorrectionStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persist(store: CorrectionStore): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* localStorage เต็ม/ปิดอยู่ — ข้ามได้ */
  }
}

/**
 * บันทึก/ทับคำแก้ของซินแสสำหรับ (topicId + chartSignature) เดียวกัน แล้วคืน store ใหม่
 * (ดวงเดิมบทเดิม = หนึ่ง entry; ถ้าแก้ซ้ำจะทับของเดิม)
 */
export function saveCorrection(
  store: CorrectionStore,
  entry: SinsaeCorrection,
): CorrectionStore {
  const list = store[entry.topicId] ?? [];
  const others = list.filter((item) => item.chartSignature !== entry.chartSignature);
  const next: CorrectionStore = { ...store, [entry.topicId]: [...others, entry] };
  persist(next);
  return next;
}

/** ลบคำแก้ของดวงนี้บทนี้ (กลับไปใช้คำระบบ) แล้วคืน store ใหม่ */
export function clearCorrection(
  store: CorrectionStore,
  topicId: string,
  chartSignature: string,
): CorrectionStore {
  const list = store[topicId];
  if (!list) return store;
  const remaining = list.filter((item) => item.chartSignature !== chartSignature);
  const next: CorrectionStore = { ...store };
  if (remaining.length > 0) {
    next[topicId] = remaining;
  } else {
    delete next[topicId];
  }
  persist(next);
  return next;
}

/**
 * ย้ายคำแก้ทั้งหมดจาก chart signature เดิม → ใหม่ (ใช้ตอน "แก้เพศ" ของดวงเดิม)
 * เพศเปลี่ยน → chartSignature เปลี่ยน → ถ้าไม่ย้าย คำที่แก้มือจะกลายเป็นกำพร้า (ไม่ exact match)
 * ที่นี่ re-key เฉพาะ signature ให้คำเดิมยังเป็น override บนดวงเพศใหม่ (เนื้อหาเดิม — ผู้ใช้ค่อยตรวจวัยจรใหม่เอง)
 */
export function migrateCorrectionsSignature(
  store: CorrectionStore,
  oldSignature: string,
  newSignature: string,
): CorrectionStore {
  if (oldSignature === newSignature) return store;
  const next: CorrectionStore = {};
  for (const [topicId, list] of Object.entries(store)) {
    next[topicId] = list.map((item) =>
      item.chartSignature === oldSignature
        ? { ...item, chartSignature: newSignature }
        : item,
    );
  }
  persist(next);
  return next;
}

export type CorrectionMatch = {
  /** คำแก้ของดวงนี้เป๊ะ (chartSignature ตรง) — ใช้ override 100% */
  exact: SinsaeCorrection | null;
  /** คำแก้จากดวงอื่นที่ผลคล้ายกัน (fingerprint ตรง, คนละดวง) — ใช้เป็นตัวอย่างให้ LLM */
  similar: SinsaeCorrection[];
};

/**
 * หาคำแก้ที่เกี่ยวข้องกับ (บท + ผล engine + ดวงปัจจุบัน)
 * - exact: chartSignature ตรง = ดวงเดิมที่เคยแก้
 * - similar: fingerprint ตรงแต่คนละดวง = ดวงอื่นที่ engine ให้ผลคล้ายกัน (เรียงใหม่→เก่า)
 */
export function resolveCorrection(
  store: CorrectionStore,
  topicId: string,
  reading: TopicEngineReading,
  chartSignature: string,
): CorrectionMatch {
  const list = store[topicId] ?? [];
  const fingerprint = readingFingerprint(reading);
  const exact = list.find((item) => item.chartSignature === chartSignature) ?? null;
  const similar = list
    .filter(
      (item) =>
        item.chartSignature !== chartSignature && item.fingerprint === fingerprint,
    )
    .sort((a, b) => b.editedAt.localeCompare(a.editedAt));
  return { exact, similar };
}
