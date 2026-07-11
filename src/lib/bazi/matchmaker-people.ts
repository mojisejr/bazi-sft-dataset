/**
 * ดวงตัวอย่างสำหรับโหมดจับคู่ (fallback pool) — ใช้เมื่อยังไม่มี "ดวงที่ผูกไว้"
 * ในระบบ (bazi_saved_chart) หรือ DB ล่ม เพื่อให้เด็คมีคนให้ปัดเสมอ.
 *
 * วันเกิดกระจายหลายปี/เดือน/วัน/ยาม เพื่อให้ "หลักวัน" (60 กะจื่อ) หลากหลาย
 * → เกรดสมพงษ์กับตัวเราจะแตกต่างกันจริง (มีทั้ง A และ C/D).
 *
 * seed ลง DB ได้ด้วย: scripts/seed-matchmaker-people.ts (จะกลายเป็น source="saved").
 */
import type { RawInputValue } from "@/lib/bazi/schema-types";

export type SamplePerson = {
  /** key สั้น ๆ (จะได้ id = "sample:<key>"). */
  key: string;
  name: string;
  gender: "male" | "female";
  bio: string;
  tags: string[];
  rawInput: RawInputValue;
};

function raw(birthDate: string, birthTime: string, gender: "male" | "female"): RawInputValue {
  return {
    birthDate,
    birthTime,
    gender,
    province: "กรุงเทพมหานคร",
    calendarSystem: "solar",
    timezone: "Asia/Bangkok",
  };
}

export const SAMPLE_PEOPLE: SamplePerson[] = [
  {
    key: "mook",
    name: "มุก",
    gender: "female",
    bio: "ชอบคาเฟ่เงียบ ๆ กับหนังสือดี ๆ มองหาคนที่คุยกันได้ทุกเรื่อง",
    tags: ["คาเฟ่", "อ่านหนังสือ", "แมว"],
    rawInput: raw("1994-03-15", "08:20", "female"),
  },
  {
    key: "term",
    name: "เติร์ด",
    gender: "male",
    bio: "วิ่งเทรลทุกเสาร์ ทำกับข้าวเป็น อยากมีคนไปเที่ยวภูเขาด้วยกัน",
    tags: ["วิ่งเทรล", "ทำอาหาร", "เที่ยวป่า"],
    rawInput: raw("1990-11-02", "14:45", "male"),
  },
  {
    key: "ploy",
    name: "พลอย",
    gender: "female",
    bio: "สาย content + คราฟต์ ชอบตลาดนัดของแฮนด์เมด รักการวางแผนทริป",
    tags: ["ครีเอทีฟ", "คราฟต์", "ทริป"],
    rawInput: raw("1996-07-28", "22:10", "female"),
  },
  {
    key: "beam",
    name: "บีม",
    gender: "male",
    bio: "เดฟฟรอนต์เอนด์ ชอบเกมบอร์ด กาแฟดริป และมุกแป้ก ๆ",
    tags: ["โค้ดดิ้ง", "บอร์ดเกม", "กาแฟ"],
    rawInput: raw("1992-01-09", "05:30", "male"),
  },
  {
    key: "fern",
    name: "เฟิร์น",
    gender: "female",
    bio: "โยคะ + ต้นไม้ + มินิมอล มองหาความสัมพันธ์ที่สงบและมั่นคง",
    tags: ["โยคะ", "ต้นไม้", "มินิมอล"],
    rawInput: raw("1988-05-19", "17:05", "female"),
  },
  {
    key: "kong",
    name: "ก้อง",
    gender: "male",
    bio: "ทำธุรกิจของตัวเอง ชอบดนตรีสด บาสเก็ตบอล และการลงทุน",
    tags: ["ธุรกิจ", "ดนตรี", "บาส"],
    rawInput: raw("1985-09-23", "11:40", "male"),
  },
  {
    key: "aom",
    name: "ออม",
    gender: "female",
    bio: "พยาบาลใจดี ชอบทะเล ของหวาน และคนที่รับฟังเก่ง",
    tags: ["ทะเล", "ของหวาน", "หนังโรแมนติก"],
    rawInput: raw("1998-12-11", "03:15", "female"),
  },
  {
    key: "jun",
    name: "จูน",
    gender: "female",
    bio: "ครูสอนศิลปะ อินกับสีน้ำ พิพิธภัณฑ์ และแมวจร",
    tags: ["ศิลปะ", "สีน้ำ", "แมวจร"],
    rawInput: raw("1993-04-06", "19:50", "female"),
  },
  {
    key: "pun",
    name: "ปัน",
    gender: "male",
    bio: "ตากล้องอิสระ ชอบขี่มอไซค์เที่ยว ถ่ายรูปวิว และกาแฟข้างทาง",
    tags: ["ถ่ายรูป", "มอเตอร์ไซค์", "เที่ยว"],
    rawInput: raw("1991-08-30", "09:25", "male"),
  },
  {
    key: "nut",
    name: "นัท",
    gender: "male",
    bio: "หมอฟันสายเฮลตี้ ตื่นเช้าออกกำลัง ชอบทำอาหารคลีนและปีนผา",
    tags: ["สุขภาพ", "ปีนผา", "อาหารคลีน"],
    rawInput: raw("1987-02-14", "07:00", "male"),
  },
  {
    key: "meen",
    name: "มีน",
    gender: "female",
    bio: "นักการตลาดสายปาร์ตี้เบา ๆ ชอบคอนเสิร์ต คราฟต์เบียร์ และเดินทาง",
    tags: ["คอนเสิร์ต", "เดินทาง", "การตลาด"],
    rawInput: raw("1995-10-17", "13:35", "female"),
  },
  {
    key: "gun",
    name: "กัน",
    gender: "male",
    bio: "สถาปนิกสายชิล ชอบบ้านไม้ งานคราฟต์ และหมาโกลเด้น",
    tags: ["สถาปัตย์", "งานไม้", "หมา"],
    rawInput: raw("1989-06-25", "23:55", "male"),
  },
];
