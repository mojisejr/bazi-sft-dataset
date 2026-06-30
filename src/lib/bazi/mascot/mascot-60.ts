/**
 * แม็ป mascot 60 ดิถี (เสาวัน 60 กะจื่อ) — single source of truth
 * ที่มา: knownlage/NewData/รูป 60ดิถี/ชื่อ 60  mascot.xlsx (คอลัมน์ ไฟล์·อังกฤษ·ไทย·กะจื่อ)
 *
 * `file` = ชื่อไฟล์ต้นทาง (ไม่มี .png) ใช้ตอน import เท่านั้น — มี 3 ชื่อที่พิมพ์แปลกตามไฟล์จริง
 * (เว้นวรรค / "ahove") ห้ามแก้ให้ "ถูก" เพราะต้องตรงกับไฟล์บนดิสก์.
 */
export type Mascot60Entry = {
  /** เสาวัน 60 กะจื่อ เช่น "庚午" */
  ganzhi: string;
  /** ชื่อไฟล์ต้นทาง (ไม่รวม .png) */
  file: string;
  nameEn: string;
  nameTh: string;
};

export const MASCOT_60: readonly Mascot60Entry[] = [
  { ganzhi: "甲子", file: "mascot_wood_above_1_below_1", nameEn: "Leafy", nameTh: "ลีฟฟี่" },
  { ganzhi: "丙子", file: "mascot_fire_above_1_below_1", nameEn: "Flammie", nameTh: "เฟลมมี่" },
  { ganzhi: "戊子", file: "mascot_earth_above_1_below_1", nameEn: "Jinsan", nameTh: "จินซัน" },
  { ganzhi: "庚子", file: "mascot_metal_above_1_below_1", nameEn: "Xingjing", nameTh: "ชิงจิ้ง" },
  { ganzhi: "壬子", file: "mascot_water_above_1_below_1", nameEn: "Nautilo", nameTh: "นอติโล" },
  { ganzhi: "乙丑", file: "mascot_wood_above_2_below_2", nameEn: "Muto", nameTh: "มูโตะ" },
  { ganzhi: "丁丑", file: "mascot _fire_above_2_below_2", nameEn: "Tino", nameTh: "ทีโน" },
  { ganzhi: "己丑", file: "mascot_earth_above_2_below_2", nameEn: "Jino", nameTh: "จีโน" },
  { ganzhi: "辛丑", file: "mascot_metal_above_2_below_2", nameEn: "Sino", nameTh: "ชีโน" },
  { ganzhi: "癸丑", file: "mascot_water_above_2_below_2", nameEn: "Kino", nameTh: "คิโน" },
  { ganzhi: "甲寅", file: "mascot_wood_above_1_below_3", nameEn: "Tavi", nameTh: "ทาวี่" },
  { ganzhi: "丙寅", file: "mascot_fire_above_1_below_3", nameEn: "Solin", nameTh: "โซลิน" },
  { ganzhi: "戊寅", file: "mascot_earth_above_1_below_3", nameEn: "Brikko", nameTh: "บริคโกะ" },
  { ganzhi: "庚寅", file: "mascot_metal_above_1_below_3", nameEn: "Luma", nameTh: "ลูม่า" },
  { ganzhi: "壬寅", file: "mascot_water_above_1_below_3", nameEn: "Nejiro", nameTh: "เนจิโระ" },
  { ganzhi: "乙卯", file: "mascot_wood_above_2_below_4", nameEn: "Spiggi", nameTh: "สปิกกี้" },
  { ganzhi: "丁卯", file: "mascot_fire_above_2_below_4", nameEn: "Emberly", nameTh: "เอมเบอรี่" },
  { ganzhi: "己卯", file: "mascot_earth_above_2_below_4", nameEn: "Tuzan", nameTh: "ตูซัน" },
  { ganzhi: "辛卯", file: "mascot_metal_above_2_below_4", nameEn: "Yukelle", nameTh: "ยูเกล" },
  { ganzhi: "癸卯", file: "mascot_water_above_2_below_4", nameEn: "Xiaoyu", nameTh: "เสี่ยวหยู" },
  { ganzhi: "甲辰", file: "mascot_wood_above_1_below_5", nameEn: "Vedino", nameTh: "เวอร์ดิโน่" },
  { ganzhi: "丙辰", file: "mascot_fire_above_1_below_5", nameEn: "Flamino", nameTh: "ฟลามิโน่" },
  { ganzhi: "戊辰", file: "mascot_earth_above_1_below_5", nameEn: "Glacino", nameTh: "กลาชิโน่" },
  { ganzhi: "庚辰", file: "mascot_metal_above_1_below_5", nameEn: "Lunaro", nameTh: "ลูนาโร่" },
  { ganzhi: "壬辰", file: "mascot_water_above_1_below_5", nameEn: "Marino", nameTh: "มาริโน่" },
  { ganzhi: "乙巳", file: "mascot_wood_above_2_below_6", nameEn: "Emberlin", nameTh: "เอ็มเบอร์ลิน" },
  { ganzhi: "丁巳", file: "mascot_fire_above_2_below_6", nameEn: "Terran", nameTh: "เทอร์แรน" },
  { ganzhi: "己巳", file: "mascot_earth_above_2_below_6", nameEn: "Sylvo", nameTh: "ซิลโว" },
  { ganzhi: "辛巳", file: "mascot_metal_above_2_below_6", nameEn: "Aureo", nameTh: "ออเรโอ้" },
  { ganzhi: "癸巳", file: "mascot_water_above_2_below_6", nameEn: "Bubblo", nameTh: "บับโบล" },
  { ganzhi: "甲午", file: "mascot_wood_above_1_below_7", nameEn: "Solbi", nameTh: "โซลบิ" },
  { ganzhi: "丙午", file: "mascot_fire_above_1_below_7", nameEn: "Fareon", nameTh: "แฟเรียน" },
  { ganzhi: "戊午", file: "mascot_earth_above_1_below_7", nameEn: "Solto", nameTh: "ซอลโต" },
  { ganzhi: "庚午", file: "mascot_metal_above_1_below_7", nameEn: "Bublu", nameTh: "บูบู้" },
  { ganzhi: "壬午", file: "mascot_water_above_1_below_7", nameEn: "Mundi", nameTh: "มูนดี้" },
  { ganzhi: "乙未", file: "mascot_wood_above_2_below_8", nameEn: "Munchu", nameTh: "มันชู" },
  { ganzhi: "丁未", file: "mascot_fire_above_2_below_8", nameEn: "Blazehorn", nameTh: "เบลซฮอร์น" },
  { ganzhi: "己未", file: "mascot_earth_above_2_below_8", nameEn: "Lumino", nameTh: "ลูมิโน" },
  { ganzhi: "辛未", file: "mascot_metal_ahove_2_below_8", nameEn: "Glimma", nameTh: "กลิมม่า" },
  { ganzhi: "癸未", file: "mascot_water_above_2_below_8", nameEn: "Cirqua", nameTh: "เซอร์ควา" },
  { ganzhi: "甲申", file: "mascot_wood_above_1_below_9", nameEn: "Saharu", nameTh: "ซาฮารุ" },
  { ganzhi: "丙申", file: "mascot_fire_above_1_below_9", nameEn: "Roskii", nameTh: "โรสกี้" },
  { ganzhi: "戊申", file: "mascot_earth_above_1_below_9", nameEn: "Flipzo", nameTh: "ฟลิพโซ" },
  { ganzhi: "庚申", file: "mascot_metal_above_1_below_9", nameEn: "Luma", nameTh: "ลูมะ" },
  { ganzhi: "壬申", file: "mascot _water_above_1_below_9", nameEn: "Nimbus", nameTh: "นิมบัส" },
  { ganzhi: "乙酉", file: "mascot_wood_above_2_below_10", nameEn: "Piyo", nameTh: "ปิโยะ" },
  { ganzhi: "丁酉", file: "mascot_fire_above_2_below_10", nameEn: "Bloomie", nameTh: "บลูมี่" },
  { ganzhi: "己酉", file: "mascot_earth_above_2_below_10", nameEn: "Dotty", nameTh: "ดอทตี้" },
  { ganzhi: "辛酉", file: "mascot_metal_above_2_below_10", nameEn: "Pippo", nameTh: "พิ๊ปโป้" },
  { ganzhi: "癸酉", file: "mascot_water_above_2_below_10", nameEn: "Skippi", nameTh: "สกิ๊ปปี้" },
  { ganzhi: "甲戌", file: "mascot_wood_above_1_below_11", nameEn: "Flufski", nameTh: "ฟลัฟสกี้" },
  { ganzhi: "丙戌", file: "mascot_fire_above_1_below_11", nameEn: "Poffin", nameTh: "พอฟฟิน" },
  { ganzhi: "戊戌", file: "mascot_earth_above_1_below_11", nameEn: "Nuzzle", nameTh: "นัซเซิล" },
  { ganzhi: "庚戌", file: "mascot_metal_above_1_below_11", nameEn: "Lunari", nameTh: "ลูนารี" },
  { ganzhi: "壬戌", file: "mascot_water_above_1_below_11", nameEn: "Zplash", nameTh: "สแปลช" },
  { ganzhi: "乙亥", file: "mascot_wood_above_2_below_12", nameEn: "Puddi", nameTh: "พุดดี้" },
  { ganzhi: "丁亥", file: "mascot_fire_above_2_below_12", nameEn: "Snugsy", nameTh: "สนั๊กซี่" },
  { ganzhi: "己亥", file: "mascot_earth_above_2_below_12", nameEn: "Peaki", nameTh: "พีคกี้" },
  { ganzhi: "辛亥", file: "mascot_metal_above_2_below_12", nameEn: "Puffin", nameTh: "พัฟฟิน" },
  { ganzhi: "癸亥", file: "mascot_water_above_2_below_12", nameEn: "Splashy", nameTh: "สแปลซซี่" },
] as const;

/** ลุกอัปด้วยกะจื่อ (เสาวัน) */
export function getMascotEntry(ganzhi: string): Mascot60Entry | undefined {
  return MASCOT_60.find((m) => m.ganzhi === ganzhi);
}
