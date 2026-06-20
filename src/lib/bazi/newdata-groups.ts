/**
 * แคตตาล็อก "กลุ่มก้อนความรู้" ของ NewData (ข้อมูลหลักแบบใหม่) — แหล่งความจริงเดียว
 * ใช้ทั้งหน้าแอดมิน (โชว์ครบทุกกลุ่มแม้ DB ยังว่าง) และ engine lookup (ชิ้น 4)
 *
 * client-safe (ข้อมูลล้วน ไม่มี import side-effect) — เหมือน chapter-outline.ts
 *
 * group_key ตรงกับที่ seed-reading-newdata.ts เขียนลงตาราง bazi_newdata
 */

/** ชนิดของ item_key ในกลุ่ม — บอกตัวแก้/engine ว่าคีย์หน้าตาแบบไหน */
export type NewdataKeyKind =
  | "state" // 12 เชี่ยงแซ เช่น "กวงตั่ว"
  | "branch" // ราศีล่างเดี่ยว เช่น "辰"
  | "branchPair" // คู่ราศีล่าง เช่น "子-午"
  | "stemPair" // คู่ราศีบน เช่น "甲己"
  | "ganzhi" // กะจื่อ (บน+ล่าง) เช่น "甲午"
  | "element" // ธาตุ เช่น "น้ำ"
  | "group3" // กลุ่มซำเฮ้ง เช่น "พาหะ"
  | "pillar"; // เสา เช่น "ปี"

export type NewdataGroup = {
  /** group_key ในตาราง bazi_newdata */
  key: string;
  /** ป้ายไทยอ่านง่ายในหน้าแอดมิน */
  label: string;
  /** อธิบายสั้น ๆ ว่ากลุ่มนี้คือก้อนความรู้อะไร engine หยิบไปใช้ตรงไหน */
  description: string;
  keyKind: NewdataKeyKind;
  /** ไฟล์ต้นฉบับใน knownlage/NewData (อ้างอิงให้ซินแสรู้ที่มา) */
  sourceFile: string;
};

export const NEWDATA_GROUPS: readonly NewdataGroup[] = [
  {
    key: "shengxiang",
    label: "12 เชี่ยงแซ (สภาวะวัฏจักรธาตุ)",
    description: "ความหมายแกนของ 12 เชี่ยงแซ — ใช้แทบทุกบท (นิสัย/พรสวรรค์/อุปถัมภ์/หุ้นส่วน ฯลฯ)",
    keyKind: "state",
    sourceFile: "12 เชี่ยงแซ.txt",
  },
  {
    key: "edu_level",
    label: "การศึกษา — วุฒิ ตาม 12 เชี่ยงแซ",
    description: "ระดับวุฒิการศึกษาที่ทายจากเชี่ยงแซ (บทการศึกษา)",
    keyKind: "state",
    sourceFile: "การศึกษา 12 เชี่ยงแซ.txt",
  },
  {
    key: "study_style",
    label: "การเรียน — สไตล์ ตาม 12 เชี่ยงแซ",
    description: "ลักษณะ/สไตล์การเรียนที่ทายจากเชี่ยงแซ (บทการศึกษา)",
    keyKind: "state",
    sourceFile: "การเรียน12 เชี่ยงแซ.txt",
  },
  {
    key: "clash",
    label: "ชง (ปะทะ/เปลี่ยนแปลงฉับพลัน)",
    description: "คู่ราศีล่างที่ชงกัน — ใช้บทสุขภาพ/วัยจร/ความรัก/มิตรศัตรู",
    keyKind: "branchPair",
    sourceFile: "ชง.txt",
  },
  {
    key: "harm_heng",
    label: "เฮ้ง (ให้โทษเรื้อรัง/คดีความ)",
    description: "คู่ราศีล่างที่เฮ้งกัน — ใช้บทมิตรศัตรู/ความรัก/สุขภาพ",
    keyKind: "branchPair",
    sourceFile: "เฮ้ง.txt",
  },
  {
    key: "harm_hai",
    label: "ไห่ (ทำร้าย/แทงข้างหลัง)",
    description: "คู่ราศีล่างที่ไห่กัน — ใช้บทมิตรศัตรู/การงาน",
    keyKind: "branchPair",
    sourceFile: "ไห่.txt",
  },
  {
    key: "self_punish",
    label: "จื่อเฮ้ง (ทำร้ายตัวเอง)",
    description: "ราศีล่างที่เฮ้งตัวเอง — ใช้บทสุขภาพ/นิสัยพื้นฐาน",
    keyKind: "branch",
    sourceFile: "จื่อเฮ้ง.txt",
  },
  {
    key: "sam_heng",
    label: "ซำเฮ้ง (3 กลุ่มให้โทษ)",
    description: "กลุ่มพาหะ/แม่ธาตุ/ขุนคลัง — ตรวจชุดตัวแทน 3 ตัวในดวง",
    keyKind: "group3",
    sourceFile: "ซำเฮ้ง.txt",
  },
  {
    key: "phua",
    label: "ผั่ว (ผั่วไฉ่โข่ว/รั่วไหลทรัพย์)",
    description: "กะจื่อที่ถ่ายเทเสียหาย — ใช้บทการเงิน (สิ่งพึงระวัง)",
    keyKind: "ganzhi",
    sourceFile: "ผั่ว.txt",
  },
  {
    key: "combine_stem",
    label: "ภาคีราศีบน (ภาคีฟ้า)",
    description: "คู่ราศีบนที่ภาคีแปรธาตุ — ใช้บทนิสัย/ครอบครัว/ความรัก",
    keyKind: "stemPair",
    sourceFile: "ภาคีคู่ บน-ล่าง.txt",
  },
  {
    key: "combine_branch",
    label: "ภาคีราศีล่าง (ภาคีดิน)",
    description: "คู่ราศีล่างที่ภาคีแปรธาตุ — ใช้บทความสัมพันธ์/การกระทำ",
    keyKind: "branchPair",
    sourceFile: "ภาคีคู่ บน-ล่าง.txt",
  },
  {
    key: "trinity",
    label: "ไตรภาคี (ซาฮะ เต็มชุด)",
    description: "3 ราศีล่างครบชุดแปรธาตุทรงพลัง — ใช้บทพรสวรรค์/การงาน",
    keyKind: "element",
    sourceFile: "ไตรภาคี.txt",
  },
  {
    key: "trinity_half",
    label: "ครึ่งไตรภาคี",
    description: "2 ใน 3 ตัวของไตรภาคี (มีแม่ธาตุเป็นแกน)",
    keyKind: "branchPair",
    sourceFile: "ไตรภาคี.txt",
  },
  {
    key: "pillars_meaning",
    label: "4 แถว 8 อักษร (ความหมายเสา)",
    description: "ความหมายเสาปี/เดือน/วัน/ยาม — รากฐานบทนิสัย/ครอบครัว",
    keyKind: "pillar",
    sourceFile: "4 แถว 8 อักษร.txt",
  },
] as const;

export const NEWDATA_GROUP_KEYS = NEWDATA_GROUPS.map((g) => g.key);

export function getNewdataGroup(key: string): NewdataGroup | undefined {
  return NEWDATA_GROUPS.find((g) => g.key === key);
}
