/**
 * ชนิดข้อมูลของ "ประวัติการดูดวง" (reading session) — แยกไว้ที่ lib เพื่อให้ทั้ง
 * `@/db/schema` (server/script) และ workspace ฝั่ง client ใช้ร่วมกันได้
 * โดย db/ ไม่ต้อง import จาก @/components (อ้างชนิดแบบ type-only เท่านั้น — ถูก erase ตอน build)
 *
 * `sessionData` คือ blob ที่เก็บ "ทุกอย่างที่ใช้ render หน้า reading กลับมาเป๊ะ"
 * เพื่อให้กลับมาแก้ต่อ / ปริ้นซ้ำ / ฝากคนอื่นแก้ได้
 */
import type { RelationshipLineRow, TopicReadingResult } from "@/components/bazi/reading/TopicCard";
import type { ReadingLlmProvider } from "@/lib/bazi/reading-llm";
import type { SinsaeCorrection } from "@/lib/bazi/sinsae-corrections";

/** เวอร์ชันของ schema blob — เผื่อ migrate เมื่อรูป engine reading เปลี่ยน */
export const READING_SESSION_DATA_VERSION = 1;

export type ReadingSessionStatus = "in_progress" | "done";

/** สถานะการอ่านรายบท (มิเรอร์ TopicEntryState ใน ReadingPathWorkspace) */
export type ReadingSessionTopicState = {
  status: "idle" | "loading" | "done" | "error";
  result: TopicReadingResult | null;
  error: string | null;
};

/** blob ที่ใช้คืนสภาพ workspace ทั้งหน้า */
export type ReadingSessionDataValue = {
  version: number;
  provider: ReadingLlmProvider;
  /** คำอ่านรายบท (keyed ด้วย topicId) — รวมตารางวัยจรใน turning_points */
  topicStates: Record<string, ReadingSessionTopicState>;
  /** คลังคำแก้ของซินแส (มิเรอร์ localStorage) */
  corrections: Record<string, SinsaeCorrection[]>;
  /** map คำอ่านสำหรับ export-docx (sinsae.corrected ?? humanReading ของ llm) */
  readings: Record<string, string>;
  /** ชื่อบท (หัวข้อใหญ่) ที่ซินแสแก้เอง — keyed ด้วย topicId; ไม่มี = ใช้ชื่อจาก topic-path */
  titleOverrides?: Record<string, string>;
  /** ตารางเส้นขีดความสัมพันธ์หมวดวัยจร (เฉพาะ turning_points) */
  relationshipLines: RelationshipLineRow[] | null;
};

export type ReadingSessionMetadataValue = Record<string, unknown>;
