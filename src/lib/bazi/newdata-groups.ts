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
  | "stem" // ราศีบนเดี่ยว เช่น "甲" (นิสัยราศีบน 10 ก้าน)
  | "element" // ธาตุ เช่น "น้ำ"
  | "group3" // กลุ่มซำเฮ้ง เช่น "พาหะ"
  | "stemBand" // ราศีบน × กำลังดิถี เช่น "甲|over_strong" (50 ช่อง)
  | "stemTransfer" // ดิถีถ่ายเท เช่น "甲|丙" (ก้านดิถี|ปลายทาง)
  | "elementCategory" // หมวด × ธาตุ เช่น "สี|ไม้" (บท 14/15 ตามธาตุที่ดวงต้องการ)
  | "rasi" // อักษรราศี เช่น "甲"/"子"/"乾" (บท 15 องค์เทพราย 26 ราศี)
  | "role" // บทบาทธาตุ "resource"/"output"/"wealth" (ประโยคนำบท4 — template มี {ดิถี}/{ธาตุ})
  | "healthZoah" // บท13 สุขภาพเจ๊าะ "{กะจื่อ}@{เสา}" / "{ดิถี}→{ปลายทาง}@{เสา}" เช่น "甲申@ปี" / "甲→申@ปี"
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
  /**
   * true = เนื้อเป็น pre-fill "generic" (คัดลอกจากตำรากลาง ยังไม่ถูกซินแส curate เฉพาะบทบาทนี้)
   * → โหมด AI ควร "เขียนใหม่" (generate) แทน "ขัดเกลา" (polish) — engine track ยังใช้ generic เป็น fallback ปกติ
   */
  templatePrefill?: boolean;
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
  {
    key: "career_by_element",
    label: "อาชีพ/ธุรกิจ ตามธาตุ (5 ธาตุ)",
    description: "รายชื่ออาชีพ/ธุรกิจของแต่ละธาตุ — บทอาชีพหยิบตามธาตุที่ควร/ไม่ควรทำ (ตารางหาอาชีพ)",
    keyKind: "element",
    sourceFile: "อาชีพ 5 ธาตุ.txt",
  },
  {
    key: "daymaster_strength",
    label: "บท 1 · ดิถี/กำลัง (10 ราศีบน × 5 ดิถี)",
    description: "นิสัยตามราศีบนหลักวัน × กำลังดิถี (50 ช่อง) — บท 1 กล่อง 'กำลังดิถี' (ซินแสกรอก)",
    keyKind: "stemBand",
    sourceFile: "(กรอกในแอดมิน)",
  },
  {
    key: "zodiac_nisai",
    label: "บท 1 · 12 นักษัตร (ราศีล่างหลักวัน)",
    description: "นิสัยราย 12 นักษัตร (ราศีล่าง) — บท 1 กล่อง '12 นักษัตร'",
    keyKind: "branch",
    sourceFile: "นิสัย 12 นักษัตร.txt",
  },
  {
    key: "ganzhi_nisai",
    label: "บท 1 · 60 กะจื่อ (ราศีบน-ล่างหลักวัน)",
    description: "นิสัยราย 60 กะจื่อ (ราศีบน+ล่างหลักวัน) — บท 1 กล่อง '60 กะจื่อ'",
    keyKind: "ganzhi",
    sourceFile: "ลักษณะนิสัย 60 แบบ.txt",
  },
  {
    key: "stem_nisai",
    label: "บท 1 · นิสัยราศีบน 10 ก้าน (ฉายา/พลังงาน/อุปนิสัย)",
    description:
      "นิสัยรายราศีบน 10 ก้าน (ฉายา+ลักษณะพลังงาน+อุปนิสัย) — บท 1 เพิ่มเติมในกล่อง '60 กะจื่อ' มุมธรรมชาติของราศีบนหลักวัน",
    keyKind: "stem",
    sourceFile: "บท1 นิสัยราศีบน 10 ก้าน.txt",
  },
  {
    key: "dark_side_by_element",
    label: "บท 1 · นิสัยด้านมืด 5 ธาตุ (ตามธาตุดิถี)",
    description:
      "ด้านมืดของอารมณ์เมื่อธาตุร้อน/แห้งเกินไป รายธาตุดิถี (ราศีบนหลักวัน) — บท 1 กล่อง 'นิสัยด้านมืดตามธาตุ'",
    keyKind: "element",
    sourceFile: "บท1 นิสัยด้านมืด 5 ธาตุ.txt",
  },
  {
    key: "develop_by_element",
    label: "บท 1 · ข้อเสนอแนะ พัฒนานิสัย 5 ธาตุ (ตามธาตุปรับดวง 用神)",
    description:
      "ข้อเสนอแนะการพัฒนานิสัย/ปรับดวง รายธาตุ — iterate ตามธาตุปรับดวง (用神/favorableElements) · กล่อง 'ข้อเสนอแนะ' บท 1/6/7 (จิตวิทยา พฤติกรรมแก้ไข)",
    keyKind: "element",
    sourceFile: "บท1 พัฒนานิสัย 5 ธาตุ.txt",
  },
  {
    key: "sila_by_element",
    label: "บท 15 · ข้อเสนอแนะ ศีล 5 ธาตุ (ตามธาตุดิถี)",
    description:
      "ศีล 5 ผูกตามธาตุ (ข้อ1 ดิน/ข้อ2 ทอง/ข้อ3 น้ำ/ข้อ4 ไม้/ข้อ5 ไฟ) + อานิสงส์ — บท 15 กล่อง 'ข้อเสนอแนะ' ตามธาตุดิถี",
    keyKind: "element",
    sourceFile: "บท15 ศีล 5 ธาตุ.txt",
  },
  {
    key: "dithi_transfer",
    label: "บทที่ 1 ดิถีถ่ายเท พูดและแสดงออก",
    description: "คำอ่าน 'ดิถี → ถ่ายเท → ผลลัพธ์' รายก้านดิถี×ปลายทาง — บท 1 (พูด)",
    keyKind: "stemTransfer",
    sourceFile: "ดิถีถ่ายเททุกแบบ.txt",
  },
  {
    key: "dithi_transfer_invest",
    label: "บทที่ 3 ดิถีถ่ายเทการลงทุน",
    description: "คำอ่าน 'ดิถี → ถ่ายเท → ผลลัพธ์' รายก้านดิถี×ปลายทาง — บท 3 (การลงทุน)",
    keyKind: "stemTransfer",
    sourceFile: "(กรอกในแอดมิน)",
  },
  {
    key: "dithi_transfer_spend",
    label: "บทที่ 3 ดิถีถ่ายเทการใช้จ่าย",
    description: "คำอ่าน 'ดิถี → ถ่ายเท → ผลลัพธ์' รายก้านดิถี×ปลายทาง — บท 3 (การใช้จ่าย)",
    keyKind: "stemTransfer",
    sourceFile: "(กรอกในแอดมิน)",
  },
  {
    key: "dithi_transfer_study",
    label: "บทที่ 11 ดิถีถ่ายเทการเรียนและการศึกษา",
    description: "คำอ่าน 'ดิถี → ถ่ายเท → ผลลัพธ์' รายก้านดิถี×ปลายทาง — บท 11 (การเรียนและการศึกษา)",
    keyKind: "stemTransfer",
    sourceFile: "(กรอกในแอดมิน)",
  },
  {
    key: "fortune_dithi",
    label: "บท 3 · โชคลาภดิถี (ก้านดิถี|ปลายทาง)",
    description: "คำอ่านโชคลาภของดิถี = ก้านดิถี → ธาตุที่ดิถีพิฆาต (財) · คีย์ '{ดิถี}|{ปลายทาง}' (ซินแสกรอกในแอดมิน)",
    keyKind: "stemTransfer",
    sourceFile: "(กรอกในแอดมิน)",
  },
  {
    key: "fortune_business",
    label: "บท 3 · โชคลาภจากธุรกิจ (ก้านดิถี|ปลายทาง)",
    description: "คำอ่านโชคลาภธุรกิจ = ลาภของลาภ (財 ของ 財) · คีย์ '{ดิถี}|{ปลายทาง}' (ซินแสกรอกในแอดมิน)",
    keyKind: "stemTransfer",
    sourceFile: "(กรอกในแอดมิน)",
  },
  {
    key: "fortune_month",
    label: "บท 3 · โชคลาภหลักเดือน (ก้านเดือน|ปลายทาง)",
    description: "คำอ่านโชคลาภหลักเดือน = ก้านเดือน → 財 ของก้านเดือน (สูตรรอซินแสยืนยัน) · คีย์ '{ก้านเดือน}|{ปลายทาง}'",
    keyKind: "stemTransfer",
    sourceFile: "(กรอกในแอดมิน)",
  },
  {
    key: "benefactor_lead",
    label: "บท 4 · ประโยคนำ (ธาตุส่งเสริม/ถ่ายเท/โชคลาภ)",
    description: "ประโยคนำบอกชื่อธาตุตามบทบาท คีย์ = resource/output/wealth · template ใช้ {ดิถี} {ธาตุ} (ซินแสเปลี่ยนคำได้)",
    keyKind: "role",
    sourceFile: "(กรอกในแอดมิน)",
    templatePrefill: true,
  },
  {
    key: "customer_60",
    label: "บท 4 · ลูกค้า 60 กะจื่อ (ธาตุโชคลาภ 財)",
    description: "คำอ่าน 'ลูกค้า' ของเสาที่ธาตุโชคลาภ (財) นั่ง ตาม 60 กะจื่อ (ละเอียดกว่า 12 เชี่ยงแซ) — เพิ่มต่อจาก benefactor_wealth",
    keyKind: "ganzhi",
    sourceFile: "(กรอกในแอดมิน)",
  },
  {
    key: "partner_60",
    label: "บท 4 · หุ้นส่วน 60 กะจื่อ (ธาตุเดียวกับดิถี 比)",
    description: "คำอ่าน 'หุ้นส่วน' ของเสาที่ธาตุเดียวกับดิถี (比) นั่ง ตาม 60 กะจื่อ",
    keyKind: "ganzhi",
    sourceFile: "(กรอกในแอดมิน)",
  },
  {
    key: "benefactor_resource",
    label: "บท 4 · ผู้อุปถัมป์ (ธาตุส่งเสริม 印) ตาม 12 เชี่ยงแซ",
    description: "คำอ่าน 'ผู้อุปถัมป์' ของเสาที่ธาตุส่งเสริม (印) นั่ง ตาม 12 เชี่ยงแซ — แยกจาก shengxiang กลาง (ซินแสแก้คำเฉพาะบทนี้ได้)",
    keyKind: "state",
    sourceFile: "12 เชี่ยงแซ.txt",
    templatePrefill: true,
  },
  {
    key: "benefactor_output",
    label: "บท 4 · บริวาร (ธาตุถ่ายเท 食傷) ตาม 12 เชี่ยงแซ",
    description: "คำอ่าน 'บริวาร/ลูกน้อง' ของเสาที่ธาตุถ่ายเท (食傷) นั่ง ตาม 12 เชี่ยงแซ — แยกจาก shengxiang กลาง",
    keyKind: "state",
    sourceFile: "12 เชี่ยงแซ.txt",
    templatePrefill: true,
  },
  {
    key: "benefactor_wealth",
    label: "บท 4 · ลูกค้า (ธาตุโชคลาภ 財) ตาม 12 เชี่ยงแซ",
    description: "คำอ่าน 'ลูกค้า/แหล่งทรัพย์' ของเสาที่ธาตุโชคลาภ (財) นั่ง ตาม 12 เชี่ยงแซ — แยกจาก shengxiang กลาง",
    keyKind: "state",
    sourceFile: "12 เชี่ยงแซ.txt",
    templatePrefill: true,
  },
  {
    key: "study_by_element",
    label: "บท 11 · วิชา/คณะ ตามธาตุ (5 ธาตุ)",
    description: "รายชื่อวิชา/คณะของแต่ละธาตุ — บท 11 'เรียนวิชาตามอาชีพถูกดวง' หยิบตามธาตุที่ควรทำ (คลังความรู้ 5 ธาตุ)",
    keyKind: "element",
    sourceFile: "การเรียน 5 ธาตุ.txt",
  },
  {
    key: "merit_by_element",
    label: "ทำบุญตามธาตุ (5 ธาตุ)",
    description: "คำทำบุญเสริมดวงของแต่ละธาตุ — บท 15 หยิบตามธาตุที่ควรเสริม (ตารางทำบุญ 5 ธาตุ)",
    keyKind: "element",
    sourceFile: "ทำบุญ 5 ธาตุ.txt",
  },
  {
    key: "love_base",
    label: "บท 7 · ลักษณะชีวิตคู่ (ปฏิกิริยาธาตุหลักวัน)",
    description: "ปฏิกิริยาธาตุ ราศีบน↔ราศีล่างหลักวัน (5 แบบ) → ลักษณะชีวิตคู่ตามพื้นดวง",
    keyKind: "element",
    sourceFile: "ความรักและความสัมพันธ์.txt",
  },
  {
    key: "love_base_60",
    label: "บท 7 · ลักษณะชีวิตคู่ 60 กะจื่อ (หลักวัน ราศีบน-ล่าง)",
    description: "ลักษณะชีวิตคู่ราย 60 กะจื่อ (ราศีบน+ล่างหลักวัน) — บท 7 กล่อง 'ลักษณะชีวิตคู่ตามพื้นดวง'",
    keyKind: "ganzhi",
    sourceFile: "ความรัก (หลักวัน ราศีบน-ล่าง).xlsx",
  },
  {
    key: "spouse_knowledge_60",
    label: "บท 7 · ความรู้คู่ครอง 60 กะจื่อ (หลักวัน ราศีบน-ล่าง)",
    description:
      "ความรู้คู่ครองราย 60 กะจื่อ (ราศีบน+ล่างหลักวัน) — กล่องใหม่แยกจาก 'ลักษณะชีวิตคู่' เตรียมคีย์ครบ 60 ไว้ให้ ซินแสเติมเนื้อหาในแอดมิน (ช่องว่าง = ยังไม่ขึ้นในหน้าอ่าน)",
    keyKind: "ganzhi",
    sourceFile: "ซินแสกรอกในแอดมิน /reading/newdata",
  },
  {
    key: "love_chance",
    label: "บท 7 · โอกาสมีคู่ (เพศ × กำลังดิถี)",
    description: "โอกาสมีคู่ตามเพศกำเนิด × กำลังดิถี (10 ช่อง) — บท 7 'มีคู่ครองที่เหมาะสมหรือไม่'",
    keyKind: "stemBand",
    sourceFile: "ความรักและความสัมพันธ์.txt",
  },
  {
    key: "subordinate_60",
    label: "บท 10 · ลักษณะบริวาร 60 กะจื่อ (เสายาม)",
    description: "ลักษณะลูกน้องบริวารราย 60 กะจื่อ (ราศีบน+ล่างเสายาม) — บท 10 กล่อง 'ลักษณะบริวารตามพื้นดวง' (ระบบ matching)",
    keyKind: "ganzhi",
    sourceFile: "(กรอกในแอดมิน)",
  },
  {
    key: "health_by_element",
    label: "บท 13 · โรคตามธาตุ มาก/น้อย (5 ธาตุ × 2 = 10 ช่อง)",
    description:
      "โรค/จุดอ่อนสุขภาพเมื่อธาตุนั้นมาก/น้อยเกินไปในพื้นดวง — คีย์ '{ธาตุ}|มาก' / '{ธาตุ}|น้อย' เช่น 'ไม้|มาก' (แยกเนื้อมาก/น้อยคนละชุด) — บท 13 กล่อง 'โรคจากธาตุมาก/น้อย'",
    keyKind: "element",
    sourceFile: "(กรอกในแอดมิน)",
  },
  {
    key: "health_zoah",
    label: "บท 13 · สุขภาพเจ๊าะ (กะจื่อ/ดิถี × ตำแหน่งเสา)",
    description:
      "คำทำนายสุขภาพราย 'กะจื่อประจำเสา' และ 'ดิถีถ่ายเท' ตามตำแหน่งเสา — คีย์ '{กะจื่อ}@{เสา}' เช่น '甲申@ปี' และ '{ดิถี}→{ปลายทาง}@{เสา}' เช่น '甲→申@ปี' (ช่องว่าง = ยังไม่ขึ้นในหน้าอ่าน) — บท 13 กล่อง 'โรคจากเจ๊า/ผั่ว'",
    keyKind: "healthZoah",
    sourceFile: "(กรอกในแอดมิน)",
  },
  {
    key: "auspicious_by_element",
    label: "บท 14 · ของมงคลตามธาตุที่ดวงต้องการ (หมวด × ธาตุ)",
    description:
      "สี/เสื้อผ้า/เครื่องประดับ/กระเป๋าเงิน/รถ/สัตว์มงคล/ทิศ ตามธาตุที่ดวงต้องการ — คีย์ '{หมวด}|{ธาตุ}' เช่น 'รถ|ไฟ' (สัตว์มงคล/ทิศ รอซินแสเติม)",
    keyKind: "elementCategory",
    sourceFile: "บท14 สี/เสื้อผ้า/เครื่องประดับ/กระเป๋าเงิน/รถ 5 ธาตุ.txt",
  },
  {
    key: "deity_by_element",
    label: "บท 15 · องค์เทพตามธาตุ (หมวด × ธาตุ) — สำรอง",
    description:
      "องค์เทพรายธาตุ (คุ้มครอง) — สำรอง/อ้างอิง; บท 15 ใช้ deity_by_rasi (ราย 26 ราศี) เป็นหลักแล้ว",
    keyKind: "elementCategory",
    sourceFile: "บท15 องค์เทพคุ้มครอง 5 ธาตุ.txt",
  },
  {
    key: "deity_by_rasi",
    label: "บท 15 · องค์เทพราย 26 ราศี (ราศีบน/ล่าง/มุม)",
    description:
      "องค์เทพประจำราศี 26 ตัว (10 ราศีบน + 12 ราศีล่าง + 4 องค์มุม 乾坤巽艮) — บท 15 เลือกตามราศีที่ถือธาตุที่ต้องใช้ (คุ้มครอง/การงาน/โชคลาภ) + เชี่ยงแซดี · คีย์ = อักษรราศี เช่น '甲' '子' '乾'",
    keyKind: "rasi",
    sourceFile: "บท15 องค์เทพ 26 ราศี.txt",
  },
] as const;

export const NEWDATA_GROUP_KEYS = NEWDATA_GROUPS.map((g) => g.key);

export function getNewdataGroup(key: string): NewdataGroup | undefined {
  return NEWDATA_GROUPS.find((g) => g.key === key);
}
