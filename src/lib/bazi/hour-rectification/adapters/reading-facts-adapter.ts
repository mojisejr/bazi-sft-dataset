// Hour Rectification v3 — reading-facts-adapter (#hour-rectification-engine, สอบจากคำทำนาย lane).
// ไฟล์เดียวของ v3 ที่แตะ engine + คลัง NewData: คำนวณดวง 12 ยาม (reuse buildHourChartProfiles ของ
// v1) แล้วดึง "คำทำนายที่ผูกกับเสายาม" ของแต่ละยามออกมาเป็นข้อความ ให้ domain/reading-diff จับกลุ่ม
// เป็นคำถามต่อ — READ-ONLY ต่อ engine/คลัง ไม่มี LLM
//
// มิติ → แหล่งในคลัง (ทุกแหล่งคือของที่หน้าอ่าน 15 บทใช้จริงอยู่แล้ว = ศาสตร์ที่ซินแสรับรอง):
//   subordinate  → subordinate_state (บท 10 บริวาร ตาม 12 เชี่ยงแซของเสายาม) — matchPillarState
//   hour_palace  → FAMILY_STATE_READING ของสถานะเสายาม (โทนความสัมพันธ์ ภพลูก/บริวาร) — matchFamilyState
//   subconscious → dithi_transfer ผ่านราศีแฝงของกิ่งยาม (บท 5 พรในราศีแฝง/จิตใต้สำนึก) — matchHiddenTransfer
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import {
  extractChartFacts,
  matchFamilyState,
  matchHiddenTransfer,
  matchPillarState,
} from "@/lib/bazi/newdata-lookup";
import { resolveChapterBoxes } from "@/lib/bazi/chapter-newdata-map";
import type { NewdataMap } from "@/lib/bazi/newdata-repository";
import {
  buildHourChartProfiles,
  type ChartProfileBaseInput,
  type HourChartProfile,
} from "./chart-profile-adapter";
import type { HourReadingFacts } from "../domain/reading-diff";
import type { HourBoxFacts } from "../domain/reading-diff-detailed";

export const SUBORDINATE_GROUP = "subordinate_state";
export const HIDDEN_TRANSFER_GROUP = "dithi_transfer";

// บทที่ใช้สร้างคำถามชั้นละเอียด — เฉพาะบทที่ผู้ตอบ "สังเกตตัวเองได้" เท่านั้น
// ตัด: turning_points (ตารางปีจร) · colors_directions / guardian_deities (คำแนะนำ ไม่ใช่ลักษณะที่สังเกตได้)
export const DETAIL_CHAPTER_IDS = [
  "chart_foundation",
  "career_potential",
  "wealth_and_investment",
  "benefactor",
  "talent",
  "family",
  "love_partner",
  "friends_foes",
  "partnership",
  "subordinates",
  "education",
  "health",
] as const;

/**
 * จำลอง "อ่านดวงเต็ม" ต่อยาม (pipeline เดียวกับ /reading/newdata-reading: resolveChapterBoxes)
 * → กล่องคำทำนายทุกกล่องของทุกบทที่สังเกตตัวเองได้ key = "{chapterId}:{boxIndex}"
 * ให้ domain/reading-diff-detailed เอาไป diff ข้ามยามเป็นคำถามเพิ่ม
 */
export function extractHourBoxFacts(
  profiles: readonly HourChartProfile[],
  baseInput: Pick<ChartProfileBaseInput, "gender">,
  map: NewdataMap,
): HourBoxFacts[] {
  return profiles.map(({ hourBranch, chart }) => {
    const facts = extractChartFacts(chart as unknown as CalculatedStateValue, baseInput.gender);
    const boxes: HourBoxFacts["boxes"] = {};
    for (const chapterId of DETAIL_CHAPTER_IDS) {
      const resolved = resolveChapterBoxes(chapterId, facts, map);
      resolved.boxes.forEach((box, index) => {
        if (!box.body.trim()) return;
        boxes[`${chapterId}:${index}`] = { title: box.title, body: box.body };
      });
    }
    return { hourBranch, boxes };
  });
}

/** สกัด 3 มิติ curated (บริวาร/ภพลูก/จิตใต้สำนึก) จาก profiles ที่คำนวณแล้ว — แยกไว้ให้ caller
 * ที่ต้องใช้ทั้ง curated + ชั้นละเอียด คำนวณดวง 12 ยามรอบเดียว */
export function extractHourReadingFacts(
  profiles: readonly HourChartProfile[],
  baseInput: Pick<ChartProfileBaseInput, "gender">,
  map: NewdataMap,
): HourReadingFacts[] {
  return profiles.map(({ hourBranch, chart }) => {
    // calculateBaziChart คืน payload โครงเดียวกับ CalculatedStateValue (เส้นทางเดียวกับหน้าอ่าน
    // 15 บท ที่ส่งผล engine เข้า extractChartFacts ตรงๆ) — cast แบบเดียวกับ timeline-adapter
    const facts = extractChartFacts(chart as unknown as CalculatedStateValue, baseInput.gender);

    const subordinate = matchPillarState(map, SUBORDINATE_GROUP, facts, "hour");
    const familyHour = matchFamilyState(facts, "hour");
    const hidden = matchHiddenTransfer(map, HIDDEN_TRANSFER_GROUP, facts);

    return {
      hourBranch,
      texts: {
        subordinate: subordinate?.text ?? null,
        hour_palace: familyHour[0]?.text ?? null,
        // dedupe ข้อความซ้ำ (คนละคีย์ราศีแฝงอาจให้เนื้อเดียวกัน) + คั่น "·" ให้ตัวสรุปฉลาก
        // หยิบก้อนแรกได้เป็นประโยคเต็ม ไม่ใช่ก้อนยาวติดกันที่ขึ้นต้นเหมือนกันข้ามยาม
        subconscious:
          hidden.length > 0 ? [...new Set(hidden.map((b) => b.text.trim()))].join(" · ") : null,
      },
    };
  });
}

export async function buildHourReadingFacts(
  baseInput: ChartProfileBaseInput,
  map: NewdataMap,
): Promise<HourReadingFacts[]> {
  const profiles = await buildHourChartProfiles(baseInput);
  return extractHourReadingFacts(profiles, baseInput, map);
}
