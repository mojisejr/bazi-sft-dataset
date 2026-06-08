/**
 * โหลดและแตกบทจาก gptCase reference outputs (example/gptCase/_txt/<odd>.txt)
 * + manifest ข้อมูลเกิดของแต่ละเคส (ดึงจาก header บท 1 ของไฟล์ + เทียบ case list เดิม)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type GptCaseEntry = {
  /** ชื่อย่อเคส */
  name: string;
  /** path ไฟล์ output (.txt) ใน example/gptCase/_txt */
  outputTxt: string;
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  gender: "male" | "female";
};

const TXT_DIR = "example/gptCase/_txt";

/** 8 คู่ใน gptCase (even=input, odd=output) — ใช้เฉพาะ output เป็น reference */
export const GPTCASE_MANIFEST: GptCaseEntry[] = [
  { name: "A", outputTxt: "01.txt", birthDate: "2001-07-29", birthTime: "21:35", gender: "female" },
  { name: "B", outputTxt: "03.txt", birthDate: "1999-06-17", birthTime: "15:25", gender: "female" },
  { name: "กัญญารัตน์", outputTxt: "05.txt", birthDate: "2002-12-02", birthTime: "11:30", gender: "female" },
  { name: "วรรัตน์-1", outputTxt: "07.txt", birthDate: "1988-06-08", birthTime: "12:08", gender: "female" },
  { name: "ประภาวรินท์-1", outputTxt: "09.txt", birthDate: "1986-09-16", birthTime: "14:23", gender: "female" },
  { name: "ประภาวรินท์-2", outputTxt: "11.txt", birthDate: "1986-09-16", birthTime: "14:23", gender: "female" },
  { name: "ภวรัญชน์", outputTxt: "13.txt", birthDate: "2000-02-14", birthTime: "09:53", gender: "male" },
  { name: "วรรัตน์-2", outputTxt: "15.txt", birthDate: "1988-06-08", birthTime: "12:08", gender: "female" },
];

/** บทเลข 1-15 ใน gptCase → topicId (ตามลำดับ predict) + คีย์เวิร์ดหัวข้อสำหรับ anchor การแตกบท */
const CHAPTER_MAP: { num: number; topicId: string; keyword: string }[] = [
  { num: 1, topicId: "chart_foundation", keyword: "พื้นฐานดวงชะตา" },
  { num: 2, topicId: "career_potential", keyword: "อาชีพ" },
  { num: 3, topicId: "wealth_and_investment", keyword: "โชคลาภ" },
  { num: 4, topicId: "benefactor", keyword: "ผู้อุปถัมภ์" },
  { num: 5, topicId: "talent", keyword: "พรสวรรค์" },
  { num: 6, topicId: "family", keyword: "ครอบครัว" },
  { num: 7, topicId: "love_partner", keyword: "ความรัก" },
  { num: 8, topicId: "friends_foes", keyword: "เพื่อนแท้" },
  { num: 9, topicId: "partnership", keyword: "หุ้นส่วน" },
  { num: 10, topicId: "subordinates", keyword: "ลูกน้อง" },
  { num: 11, topicId: "education", keyword: "การเรียน" },
  { num: 12, topicId: "turning_points", keyword: "ช่วงอายุ" },
  { num: 13, topicId: "health", keyword: "การดูแลสุขภาพ" },
  { num: 14, topicId: "colors_directions", keyword: "สี และ" },
  { num: 15, topicId: "guardian_deities", keyword: "องค์เทพ" },
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * แตกข้อความ output เป็น Record<topicId, chapterText>
 * anchor ที่ "เลขบท. + คีย์เวิร์ดหัวข้อ" (กันชนกับ "1." ที่โผล่ในเนื้อความ)
 */
export function splitGptCaseChapters(text: string): Record<string, string> {
  // หา index เริ่มของแต่ละบทตามคีย์เวิร์ด
  const marks: { topicId: string; start: number }[] = [];
  for (const ch of CHAPTER_MAP) {
    // anchor บนคีย์เวิร์ดหัวข้อ + เลขบทใด ๆ (gptCase บางไฟล์รีเซ็ตเลขบทกลางทาง)
    const re = new RegExp(`(?:^|[\\s#*])\\d{1,2}\\.\\s*\\*{0,2}\\s*${escapeRe(ch.keyword)}`, "m");
    const m = re.exec(text);
    if (m) {
      // ตำแหน่งเริ่มจริง = ตรงเลขบท (เลื่อนข้าม whitespace/#/* ที่ match นำหน้า)
      const lead = m[0].length - m[0].replace(/^[\s#*]+/, "").length;
      marks.push({ topicId: ch.topicId, start: m.index + lead });
    }
  }
  marks.sort((a, b) => a.start - b.start);
  const out: Record<string, string> = {};
  for (let i = 0; i < marks.length; i += 1) {
    const end = i + 1 < marks.length ? marks[i + 1].start : text.length;
    out[marks[i].topicId] = text.slice(marks[i].start, end).trim();
  }
  return out;
}

/** อ่านไฟล์ output แล้วแตกบท */
export function loadGptCaseChapters(outputTxt: string, baseDir = "."): Record<string, string> {
  const text = readFileSync(join(baseDir, TXT_DIR, outputTxt), "utf8");
  return splitGptCaseChapters(text);
}
