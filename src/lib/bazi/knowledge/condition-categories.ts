/**
 * จัดหมวด "ตารางตามดวง" (condition / keyKind=raw) ในตัวแก้คลัง ให้หาง่าย — แทนก้อน "อื่น ๆ" 37 ตาราง.
 * - CONDITION_TABLE_CATEGORY: tableId → หมวด (เฉพาะตาราง raw; ตาราง keyKind อื่นคงกลุ่มเดิม)
 * - miscEntryCategory: MISC_TEMPLATE_TH คร่อมหลายบท → แตกช่องเข้าหมวดตาม prefix ของ key
 * ใช้ใน API /reading/knowledge-override (ส่ง category ต่อ table; MISC แตกเป็น virtual table ต่อหมวด)
 */

/** ลำดับหมวด (เรียงตามบทอ่าน) — ใช้จัดเรียง dropdown ในตัวแก้ */
export const CONDITION_CATEGORY_ORDER: string[] = [
  "พื้นฐาน/นิสัย",
  "โชคลาภ",
  "อาชีพ/ลูกค้า",
  "ผู้อุปถัมภ์",
  "ความรัก/คู่ครอง",
  "ครอบครัว",
  "เพื่อน/ศัตรู",
  "หุ้นส่วน",
  "ลูกน้อง/บริวาร",
  "การศึกษา/พรสวรรค์",
  "สุขภาพ",
  "สี/ของมงคล",
  "สิ่งศักดิ์สิทธิ์/องค์เทพ",
  "วัยจร/จังหวะ",
  "ความสัมพันธ์ในผัง",
  "ทั่วไป/เบ็ดเตล็ด",
];

/** tableId (raw) → หมวด. MISC_TEMPLATE_TH ไม่อยู่ที่นี่ — แตกตาม miscEntryCategory แทน */
export const CONDITION_TABLE_CATEGORY: Record<string, string> = {
  // พื้นฐาน/นิสัย
  STRENGTH_BALANCE_TH: "พื้นฐาน/นิสัย",
  USEFUL_BALANCE_TEMPLATE_TH: "พื้นฐาน/นิสัย",
  FOUNDATION_TEMPLATE_TH: "พื้นฐาน/นิสัย",
  BAND_OPENING_TH: "พื้นฐาน/นิสัย",
  ELEMENT_TEMPER_TH: "พื้นฐาน/นิสัย",
  SEASON_LABEL_TH: "พื้นฐาน/นิสัย",
  // โชคลาภ
  WEALTH_TEMPLATE_TH: "โชคลาภ",
  WEALTH_BAND_TH: "โชคลาภ",
  VAULT_DAMAGE_TH: "โชคลาภ",
  // อาชีพ/ลูกค้า
  CAREER_BUSINESS_BAND_TH: "อาชีพ/ลูกค้า",
  CAREER_RELATION_TH: "อาชีพ/ลูกค้า",
  // ผู้อุปถัมภ์
  BENEFACTOR_PERSON_TH: "ผู้อุปถัมภ์",
  // ความรัก/คู่ครอง
  LOVE_TEMPLATE_TH: "ความรัก/คู่ครอง",
  LOVE_GENDER_BAND_TH: "ความรัก/คู่ครอง",
  LOVE_DAY_SPOUSE_TH: "ความรัก/คู่ครอง",
  LOVE_DAY_REACTION_TH: "ความรัก/คู่ครอง",
  // การศึกษา/พรสวรรค์
  OUTPUT_STAR_TALENT_TH: "การศึกษา/พรสวรรค์",
  STAGE_APTITUDE_HEADLINE_TH: "การศึกษา/พรสวรรค์",
  TALENT_APTITUDE_TH: "การศึกษา/พรสวรรค์",
  TALENT_BRIDGE_TH: "การศึกษา/พรสวรรค์",
  // สุขภาพ
  HEALTH_TEMPLATE_TH: "สุขภาพ",
  // สี/ของมงคล
  ELEMENT_COLOR_GEM_TH: "สี/ของมงคล",
  COLOR_BAG_TH: "สี/ของมงคล",
  COLOR_CAR_TH: "สี/ของมงคล",
  ANIMAL_LUCKY_TH: "สี/ของมงคล",
  // สิ่งศักดิ์สิทธิ์/องค์เทพ
  ELEMENT_MERIT_DEITY_TH: "สิ่งศักดิ์สิทธิ์/องค์เทพ",
  DEITY_LOWER_TH: "สิ่งศักดิ์สิทธิ์/องค์เทพ",
  SISING_STAR_TH: "สิ่งศักดิ์สิทธิ์/องค์เทพ",
  // วัยจร/จังหวะ
  TIMING_TEMPLATE_TH: "วัยจร/จังหวะ",
  QI_TIER_OUTCOME_TH: "วัยจร/จังหวะ",
  ROLE_OUTCOME_TH: "วัยจร/จังหวะ",
  ROLE_OUTCOME_SCHOOL_TH: "วัยจร/จังหวะ",
  // ความสัมพันธ์ในผัง
  CHONG_POSITION_TH: "ความสัมพันธ์ในผัง",
  HENG_PAIR_MEANING_TH: "ความสัมพันธ์ในผัง",
  SELF_HENG_MEANING_TH: "ความสัมพันธ์ในผัง",
  // ทั่วไป/เบ็ดเตล็ด
  ELEMENT_CLOSING_SIMILE_TH: "ทั่วไป/เบ็ดเตล็ด",
};

/** MISC_TEMPLATE_TH: key → หมวด (ตาม prefix ของ key; ครอบทุก key ด้วย fallback "ทั่วไป/เบ็ดเตล็ด") */
export function miscEntryCategory(key: string): string {
  if (key.startsWith("career")) return "อาชีพ/ลูกค้า";
  if (
    /^(colorItem|colorAvoid|colorsLead|colorBenefitSuffix|bagColor|bagColorFallback|carColor|carColorResource|carColorFallback|direction|luckyAnimal|shape)$/.test(
      key,
    )
  )
    return "สี/ของมงคล";
  if (/^(sising|deity|noGoodQiFallback)/.test(key)) return "สิ่งศักดิ์สิทธิ์/องค์เทพ";
  if (/^(benefactor|bb)/.test(key)) return "ผู้อุปถัมภ์";
  if (/^(partner|backer|capital|sanhe)/.test(key)) return "หุ้นส่วน";
  if (/^(kin|family)/.test(key)) return "ครอบครัว";
  if (key.startsWith("friend")) return "เพื่อน/ศัตรู";
  if (key.startsWith("emp")) return "ลูกน้อง/บริวาร";
  if (/^(edu|talent|speech)/.test(key)) return "การศึกษา/พรสวรรค์";
  if (key.startsWith("rel")) return "ความสัมพันธ์ในผัง";
  if (/^(tp|verdict|dayun|timingAge)/.test(key)) return "วัยจร/จังหวะ";
  if (key.startsWith("imagery")) return "พื้นฐาน/นิสัย";
  if (key.startsWith("wealth")) return "โชคลาภ";
  if (key.startsWith("health")) return "สุขภาพ";
  return "ทั่วไป/เบ็ดเตล็ด";
}
