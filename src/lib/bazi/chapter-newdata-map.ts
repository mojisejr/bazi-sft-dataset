/**
 * chapter → primitive map — "กาวเชื่อม" ระหว่าง 15 บท กับก้อนความรู้ NewData
 *
 * โครง box ของแต่ละบท = "หัวข้อย่อยมาตรฐาน (bullets)" ใน chapter-outline.ts ครบทุกข้อ
 * แต่ละ bullet = 1 box (หัว box = ข้อความ bullet เต็ม) → NewData เติมอัตโนมัติช่องที่ map ได้
 * ช่องที่ยังไม่มี NewData = กล่องว่าง รอซินแสเติมในตัวแก้ PDF
 *
 * pure + client/server-safe
 */
import { CHAPTER_OUTLINE } from "@/lib/bazi/chapter-outline";
import {
  matchBranchPairs,
  matchCareer,
  matchDaYun,
  matchDayElement,
  matchDeityByRasi,
  matchDayMasterStrength,
  matchDithiTransfer,
  matchElementCategory,
  matchElementRoleState,
  matchHealthElement,
  matchHiddenTransfer,
  matchLoveBase,
  matchLoveChance,
  matchMerit,
  matchSpouseStar,
  matchPhua,
  matchPillarBranch,
  matchPillarGanzhi,
  matchPillarState,
  matchPillarStem,
  matchSamHeng,
  matchSelfPunish,
  matchStemPairs,
  matchTrinity,
  type ChartFacts,
  type NewdataBlock,
  type PillarPosition,
} from "@/lib/bazi/newdata-lookup";
import type { NewdataMap } from "@/lib/bazi/newdata-repository";

/** ตัวดึง NewData 1 ชนิด (ไม่มี title — title มาจาก bullet ของ outline) */
type Resolver =
  | { kind: "state"; group: string; pillar: PillarPosition; tier?: "upper" | "lower" }
  | { kind: "branchPairs"; group: string }
  | { kind: "stemPairs" }
  | { kind: "selfPunish" }
  | { kind: "samHeng" }
  | { kind: "trinity" }
  | { kind: "phua" }
  | { kind: "daYun" }
  | { kind: "career"; role: "do" | "avoid"; order: number; group?: string }
  | { kind: "dayMasterStrength"; group: string }
  | { kind: "dayElement"; group: string }
  | { kind: "deityRasi"; group: string; role: "protect" | "career" | "wealth" }
  | { kind: "branchOf"; group: string; pillar: PillarPosition }
  | { kind: "stemOf"; group: string; pillar: PillarPosition }
  | { kind: "ganzhiOf"; group: string; pillar: PillarPosition }
  | { kind: "dithiTransfer"; group: string; scope?: "all" | "stems" | "branches" }
  | { kind: "hiddenTransfer"; group: string }
  | { kind: "merit"; group: string }
  | { kind: "loveBase"; group: string }
  | { kind: "loveChance"; group: string }
  | { kind: "spouseStar"; group: string }
  | { kind: "elementRoleState"; group: string; role: "output" | "wealth" | "resource" }
  | { kind: "healthElement"; group: string }
  | { kind: "elementCategory"; group: string; category: string };

/**
 * key = topic id · ค่า = array เรียงตาม bullets ใน CHAPTER_OUTLINE[id].bullets (ดัชนีตรงกัน)
 * แต่ละช่อง = Resolver[] (0..n) ที่เติม box ของ bullet นั้น · [] = กล่องว่าง (รอซินแสเติม)
 */
export const CHAPTER_BULLET_RESOLVERS: Record<string, Resolver[][]> = {
  // 7 bullets: [กำลังดิถี] [12นักษัตร] [60กะจื่อ/ราศีบน-ล่าง] [ดิถี→ถ่ายเท→ผลลัพธ์] [นิสัยด้านมืดตามธาตุ] [สิ่งพึงระวัง] [ข้อเสนอแนะ]
  chart_foundation: [
    [{ kind: "dayMasterStrength", group: "daymaster_strength" }],
    [{ kind: "branchOf", group: "zodiac_nisai", pillar: "day" }],
    [
      { kind: "ganzhiOf", group: "ganzhi_nisai", pillar: "day" },
      { kind: "stemOf", group: "stem_nisai", pillar: "day" },
      { kind: "stemPairs" },
      { kind: "branchPairs", group: "combine_branch" },
    ],
    [
      { kind: "dithiTransfer", group: "dithi_transfer" },
      { kind: "state", group: "shengxiang", pillar: "day" },
    ],
    [{ kind: "dayElement", group: "dark_side_by_element" }],
    [{ kind: "selfPunish" }],
    [],
  ],
  // 5 bullets: [ควรทำ1] [ควรทำ2] [ควรทำ3 (บางคนมี)] [ไม่ควรทำ1] [ไม่ควรทำ2 (บางคนมี)]
  career_potential: [
    [{ kind: "career", role: "do", order: 1 }],
    [{ kind: "career", role: "do", order: 2 }],
    [{ kind: "career", role: "do", order: 3 }],
    [{ kind: "career", role: "avoid", order: 1 }],
    [{ kind: "career", role: "avoid", order: 2 }],
  ],
  // 3 bullets: [โชคลาภ ดิถี→ถ่ายเท→ผลลัพธ์] [ผั่วไฉ่โข่ว] [ข้อเสนอแนะ]
  wealth_and_investment: [
    [
      { kind: "dithiTransfer", group: "dithi_transfer" },
      { kind: "dithiTransfer", group: "dithi_transfer_invest" },
      { kind: "dithiTransfer", group: "dithi_transfer_spend" },
      { kind: "state", group: "shengxiang", pillar: "day" },
    ],
    [{ kind: "phua" }],
    [],
  ],
  // 4 bullets: [ธาตุส่งเสริม] [คู่ธาตุ] [ธาตุถ่ายเท/บริวาร] [ธาตุโชคลาภ/ลูกค้า]
  // ข้อ 3-4: หาเสาที่ธาตุถ่ายเท(食傷)/ธาตุโชคลาภ(財) นั่งอยู่ แล้วอ่านเชี่ยงแซเสานั้น (reuse shengxiang)
  benefactor: [
    // ผู้อุปถัมภ์ (印) = หาเสาที่ธาตุส่งเสริมดิถีนั่งอยู่ แล้วอ่านเชี่ยงแซเสานั้น (印 ไม่ได้อยู่เสาเดือนเสมอ)
    [{ kind: "elementRoleState", group: "shengxiang", role: "resource" }],
    [{ kind: "branchPairs", group: "combine_branch" }],
    [{ kind: "elementRoleState", group: "shengxiang", role: "output" }],
    [{ kind: "elementRoleState", group: "shengxiang", role: "wealth" }],
  ],
  // 4 bullets: [พรสวรรค์: ถ่ายเทราศีบน] [พรแสวง: ถ่ายเทราศีล่าง] [พรในราศีแฝง] [ข้อเสนอแนะ]
  talent: [
    [
      { kind: "dithiTransfer", group: "dithi_transfer", scope: "stems" },
      { kind: "state", group: "shengxiang", pillar: "day" },
    ],
    [
      { kind: "dithiTransfer", group: "dithi_transfer", scope: "branches" },
      { kind: "trinity" },
    ],
    // พรในราศีแฝง — ดิถีถ่ายเทไปยังราศีแฝง(藏干)ของหลักยาม (reuse dithi_transfer) · interpretive
    [{ kind: "hiddenTransfer", group: "dithi_transfer" }],
    [],
  ],
  // 6 bullets: [หลักปี] [หลักเดือน] [พ่อ] [แม่] [สิ่งพึงระวัง] [ข้อเสนอแนะ]
  family: [
    [{ kind: "state", group: "shengxiang", pillar: "year" }],
    [{ kind: "state", group: "shengxiang", pillar: "month" }],
    // พ่อ = เชี่ยงแซราศีบนหลักเดือน · แม่ = เชี่ยงแซราศีล่างหลักเดือน (reuse shengxiang, รอซินแสตรวจ)
    [{ kind: "state", group: "shengxiang", pillar: "month", tier: "upper" }],
    [{ kind: "state", group: "shengxiang", pillar: "month", tier: "lower" }],
    [{ kind: "branchPairs", group: "harm_heng" }],
    [],
  ],
  // 5 bullets: [ชีวิตคู่พื้นดวง] [ลักษณะคู่ครอง] [มีคู่เหมาะไหม มาเมื่อไร] [สิ่งที่ควรระวัง] [ข้อเสนอแนะ]
  love_partner: [
    // ลักษณะชีวิตคู่ = 60 box ตามกะจื่อหลักวัน (ราศีบน-ล่าง) + ภาคีราศีล่าง
    [{ kind: "ganzhiOf", group: "love_base_60", pillar: "day" }, { kind: "branchPairs", group: "combine_branch" }],
    [{ kind: "spouseStar", group: "shengxiang" }],
    [{ kind: "loveChance", group: "love_chance" }],
    [{ kind: "branchPairs", group: "clash" }, { kind: "branchPairs", group: "harm_hai" }],
    [],
  ],
  // 4 bullets: [มิตรแท้] [ระวัง/ข้อเสนอ-มิตร] [ศัตรู] [ระวัง/ข้อเสนอ-ศัตรู]
  // มิตรแท้ = ภาคีราศีล่าง + เชี่ยงแซเสาปี(ผู้ใหญ่หนุน) · ศัตรู = ไห่/เฮ้ง/ซำเฮ้ง + ผั่วไฉ่โข่ว · interpretive
  friends_foes: [
    // มิตรแท้/ผู้ใหญ่หนุน = เสาปี (เชี่ยงแซดี) ตามหลักซินแส — ไม่ใช่เสาวัน
    [{ kind: "branchPairs", group: "combine_branch" }, { kind: "state", group: "shengxiang", pillar: "year" }],
    [],
    [
      { kind: "branchPairs", group: "harm_hai" },
      { kind: "branchPairs", group: "harm_heng" },
      { kind: "samHeng" },
      { kind: "phua" },
    ],
    [],
  ],
  // 3 bullets: [ลักษณะหุ้นส่วน หลักวันราศีล่าง] [มีส่วนหา/รักษา/ยักยอกทรัพย์] [ควรมี/ไม่มี]
  partnership: [
    [{ kind: "state", group: "shengxiang", pillar: "day" }],
    [{ kind: "phua" }],
    [],
  ],
  // 3 bullets: [ลักษณะบริวารตามพื้นดวง (เสายาม)] [มีส่วนหา/รักษา/ยักยอกทรัพย์ (ผั่วไฉ่โข่ว)] [ควรมี/ไม่มี]
  // ข้อ 1: เสายามเชี่ยงแซ (มีอยู่) + 60 กะจื่อเสายาม (subordinate_60 รอซินแสเติม ตามที่ซินแสสั่ง matching)
  subordinates: [
    [{ kind: "state", group: "shengxiang", pillar: "hour" }, { kind: "ganzhiOf", group: "subordinate_60", pillar: "hour" }],
    [{ kind: "phua" }],
    [],
  ],
  // 3 bullets: [วิธี/ทักษะได้โชคลาภ (สไตล์เรียน+วุฒิ)] [ดิถี→ถ่ายเท→เชี่ยงแซดี] [เรียนตามอาชีพถูกดวง (คลัง 5 ธาตุ)]
  education: [
    [
      { kind: "state", group: "study_style", pillar: "day" },
      { kind: "state", group: "edu_level", pillar: "day" },
    ],
    [
      { kind: "dithiTransfer", group: "dithi_transfer" },
      { kind: "dithiTransfer", group: "dithi_transfer_study" },
    ],
    [
      { kind: "career", role: "do", order: 1, group: "study_by_element" },
      { kind: "career", role: "do", order: 2, group: "study_by_element" },
    ],
  ],
  // 2 bullets: [วัยจรแต่ละช่วง] [ช่วงดี/ช่วงระวัง]
  turning_points: [
    [{ kind: "daYun" }],
    [],
  ],
  // 3 bullets: [โรคจาก เจ๊า/ผั่ว/ซำเฮ้ง/จื่อเฮ้ง] [โรคจากธาตุมาก/น้อย] [ข้อเสนอแนะดูแล]
  health: [
    [
      { kind: "branchPairs", group: "clash" },
      { kind: "selfPunish" },
      { kind: "samHeng" },
      { kind: "branchPairs", group: "harm_hai" },
    ],
    [{ kind: "healthElement", group: "health_by_element" }],
    [],
  ],
  // 8 bullets: [สี+ทิศ] [เสื้อผ้า] [เครื่องประดับ] [กระเป๋าเงิน] [รถ] [สัตว์มงคล] [ทิศ] [ข้อเสนอแนะ]
  // ทุกช่อง (ยกเว้นข้อเสนอแนะ) = ตามธาตุที่ดวงต้องการ × หมวด (auspicious_by_element รอซินแสเติม)
  colors_directions: [
    [{ kind: "elementCategory", group: "auspicious_by_element", category: "สี" }],
    [{ kind: "elementCategory", group: "auspicious_by_element", category: "เสื้อผ้า" }],
    [{ kind: "elementCategory", group: "auspicious_by_element", category: "เครื่องประดับ" }],
    [{ kind: "elementCategory", group: "auspicious_by_element", category: "กระเป๋าเงิน" }],
    [{ kind: "elementCategory", group: "auspicious_by_element", category: "รถ" }],
    [{ kind: "elementCategory", group: "auspicious_by_element", category: "สัตว์มงคล" }],
    [{ kind: "elementCategory", group: "auspicious_by_element", category: "ทิศ" }],
    [],
  ],
  // 5 bullets: [องค์เทพคุ้มครอง] [ขอพรงาน] [ขอพรโชคลาภ] [ทำบุญเสริมดวง] [ข้อเสนอแนะ]
  // องค์เทพ 3 บทแรก = องค์เทพราย 26 ราศี (deity_by_rasi) เลือกตามราศีที่ถือธาตุที่ต้องใช้+เชี่ยงแซดี · ทำบุญ = ตารางทำบุญ 5 ธาตุ
  guardian_deities: [
    [{ kind: "deityRasi", group: "deity_by_rasi", role: "protect" }],
    [{ kind: "deityRasi", group: "deity_by_rasi", role: "career" }],
    [{ kind: "deityRasi", group: "deity_by_rasi", role: "wealth" }],
    [{ kind: "merit", group: "merit_by_element" }],
    [],
  ],
};

function resolveOne(r: Resolver, facts: ChartFacts, map: NewdataMap): NewdataBlock[] {
  switch (r.kind) {
    case "state": {
      const block = matchPillarState(map, r.group, facts, r.pillar, r.tier ?? "lower");
      return block ? [block] : [];
    }
    case "branchPairs":
      return matchBranchPairs(map, r.group, facts);
    case "stemPairs":
      return matchStemPairs(map, facts);
    case "selfPunish":
      return matchSelfPunish(map, facts);
    case "samHeng":
      return matchSamHeng(map, facts);
    case "trinity":
      return matchTrinity(map, facts);
    case "phua":
      return matchPhua(map, facts);
    case "career":
      return matchCareer(map, facts, r.role, r.order, r.group);
    case "dayMasterStrength":
      return matchDayMasterStrength(map, r.group, facts);
    case "dayElement":
      return matchDayElement(map, r.group, facts);
    case "deityRasi":
      return matchDeityByRasi(map, r.group, facts, r.role);
    case "branchOf":
      return matchPillarBranch(map, r.group, facts, r.pillar);
    case "stemOf":
      return matchPillarStem(map, r.group, facts, r.pillar);
    case "ganzhiOf":
      return matchPillarGanzhi(map, r.group, facts, r.pillar);
    case "dithiTransfer":
      return matchDithiTransfer(map, r.group, facts, r.scope ?? "all");
    case "hiddenTransfer":
      return matchHiddenTransfer(map, r.group, facts);
    case "merit":
      return matchMerit(map, r.group, facts);
    case "loveBase":
      return matchLoveBase(map, r.group, facts);
    case "loveChance":
      return matchLoveChance(map, r.group, facts);
    case "spouseStar":
      return matchSpouseStar(map, r.group, facts);
    case "elementRoleState":
      return matchElementRoleState(map, r.group, facts, r.role);
    case "healthElement":
      return matchHealthElement(map, r.group, facts);
    case "elementCategory":
      return matchElementCategory(map, r.group, facts, r.category);
    case "daYun":
      return matchDaYun(map, facts);
    default:
      return [];
  }
}

/** จัดรูป block เป็นย่อหน้า markdown: **ป้าย** เนื้อ (ไม่ใส่บริบทห้อยท้าย — ซินแสไม่ต้องมาลบเอง) */
function blockToParagraph(b: NewdataBlock): string {
  const head = b.label ? `**${b.label}** ` : "";
  return `${head}${b.text}`.trim();
}

export type ChapterBox = { title: string; body: string };
export type ResolvedChapterBoxes = {
  chapterId: string;
  /** มี resolver ผูก NewData อย่างน้อย 1 ช่องหรือไม่ (false = บทยังไม่มีก้อนความรู้รองรับ) */
  defined: boolean;
  /** มี box ที่ NewData เติมจริงในดวงนี้หรือไม่ */
  hasContent: boolean;
  /** box เรียงตามหัวข้อย่อยมาตรฐาน (1 box ต่อ 1 bullet) — body ว่าง = รอซินแสเติม */
  boxes: ChapterBox[];
};

/** สร้าง box ครบทุก bullet ของบท (NewData เติมที่ map ได้, ที่เหลือว่างรอเติม) */
export function resolveChapterBoxes(
  chapterId: string,
  facts: ChartFacts,
  map: NewdataMap,
): ResolvedChapterBoxes {
  const bullets = CHAPTER_OUTLINE[chapterId]?.bullets ?? [];
  const resolvers = CHAPTER_BULLET_RESOLVERS[chapterId] ?? [];
  const defined = resolvers.some((rs) => rs.length > 0);
  let hasContent = false;

  const boxes: ChapterBox[] = bullets.map((bullet, i) => {
    const blocks = (resolvers[i] ?? []).flatMap((r) => resolveOne(r, facts, map));
    const body = blocks.map(blockToParagraph).join("\n\n");
    if (body.trim()) hasContent = true;
    return { title: bullet, body };
  });

  return { chapterId, defined, hasContent, boxes };
}
