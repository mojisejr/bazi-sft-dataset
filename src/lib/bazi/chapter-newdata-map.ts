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
  matchDaYunTransfer,
  matchDayMasterStrength,
  matchDithiTransfer,
  matchPhua,
  matchPillarBranch,
  matchPillarGanzhi,
  matchPillarState,
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
  | { kind: "state"; group: string; pillar: PillarPosition }
  | { kind: "branchPairs"; group: string }
  | { kind: "stemPairs" }
  | { kind: "selfPunish" }
  | { kind: "samHeng" }
  | { kind: "trinity" }
  | { kind: "phua" }
  | { kind: "daYun" }
  | { kind: "career"; role: "do" | "avoid"; order: number }
  | { kind: "dayMasterStrength"; group: string }
  | { kind: "branchOf"; group: string; pillar: PillarPosition }
  | { kind: "ganzhiOf"; group: string; pillar: PillarPosition }
  | { kind: "dithiTransfer"; group: string; scope?: "all" | "stems" | "branches" }
  | { kind: "daYunTransfer"; group: string };

/**
 * key = topic id · ค่า = array เรียงตาม bullets ใน CHAPTER_OUTLINE[id].bullets (ดัชนีตรงกัน)
 * แต่ละช่อง = Resolver[] (0..n) ที่เติม box ของ bullet นั้น · [] = กล่องว่าง (รอซินแสเติม)
 */
export const CHAPTER_BULLET_RESOLVERS: Record<string, Resolver[][]> = {
  // 6 bullets: [กำลังดิถี] [12นักษัตร] [60กะจื่อ/ราศีบน-ล่าง] [ดิถี→ถ่ายเท→ผลลัพธ์] [สิ่งพึงระวัง] [ข้อเสนอแนะ]
  chart_foundation: [
    [{ kind: "dayMasterStrength", group: "daymaster_strength" }],
    [{ kind: "branchOf", group: "zodiac_nisai", pillar: "day" }],
    [
      { kind: "ganzhiOf", group: "ganzhi_nisai", pillar: "day" },
      { kind: "stemPairs" },
      { kind: "branchPairs", group: "combine_branch" },
    ],
    [
      { kind: "dithiTransfer", group: "dithi_transfer" },
      { kind: "state", group: "shengxiang", pillar: "day" },
    ],
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
      { kind: "state", group: "shengxiang", pillar: "day" },
    ],
    [{ kind: "phua" }],
    [],
  ],
  // 4 bullets: [ธาตุส่งเสริม] [คู่ธาตุ] [ธาตุถ่ายเท/บริวาร] [ธาตุโชคลาภ/ลูกค้า]
  benefactor: [
    [{ kind: "state", group: "shengxiang", pillar: "month" }],
    [{ kind: "branchPairs", group: "combine_branch" }],
    [],
    [],
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
    [],
    [],
  ],
  // 6 bullets: [หลักปี] [หลักเดือน] [พ่อ] [แม่] [สิ่งพึงระวัง] [ข้อเสนอแนะ]
  family: [
    [{ kind: "state", group: "shengxiang", pillar: "year" }],
    [{ kind: "state", group: "shengxiang", pillar: "month" }],
    [],
    [],
    [{ kind: "branchPairs", group: "harm_heng" }],
    [],
  ],
  // 5 bullets: [ชีวิตคู่พื้นดวง] [ลักษณะคู่ครอง] [มีคู่เหมาะไหม มาเมื่อไร] [สิ่งที่ควรระวัง] [ข้อเสนอแนะ]
  love_partner: [
    [{ kind: "branchPairs", group: "combine_branch" }],
    [],
    [],
    [{ kind: "branchPairs", group: "clash" }, { kind: "branchPairs", group: "harm_hai" }],
    [],
  ],
  // 4 bullets: [มิตรแท้] [ระวัง/ข้อเสนอ-มิตร] [ศัตรู] [ระวัง/ข้อเสนอ-ศัตรู]
  friends_foes: [
    [{ kind: "branchPairs", group: "combine_branch" }],
    [],
    [{ kind: "branchPairs", group: "harm_hai" }, { kind: "branchPairs", group: "harm_heng" }, { kind: "samHeng" }],
    [],
  ],
  // 3 bullets: [ลักษณะหุ้นส่วน หลักวันราศีล่าง] [มีส่วนหา/รักษา/ยักยอกทรัพย์] [ควรมี/ไม่มี]
  partnership: [
    [{ kind: "state", group: "shengxiang", pillar: "day" }],
    [],
    [],
  ],
  // 3 bullets — ยังไม่มี NewData (60 กะจื่อ matching)
  subordinates: [[], [], []],
  // 3 bullets: [วิธี/ทักษะได้โชคลาภ] [ดิถี→ถ่ายเท→เชี่ยงแซดี] [เรียนตามอาชีพถูกดวง]
  education: [
    [{ kind: "state", group: "study_style", pillar: "day" }],
    [{ kind: "state", group: "edu_level", pillar: "day" }],
    [],
  ],
  // 2 bullets: [วัยจรแต่ละช่วง] [ช่วงดี/ช่วงระวัง]
  turning_points: [
    [{ kind: "daYun" }, { kind: "daYunTransfer", group: "dithi_transfer" }],
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
    [],
    [],
  ],
  // 9 bullets — ยังไม่มี NewData (สี/ทิศ/ของมงคล)
  colors_directions: [[], [], [], [], [], [], [], [], []],
  // 5 bullets — ยังไม่มี NewData (องค์เทพ)
  guardian_deities: [[], [], [], [], []],
};

function resolveOne(r: Resolver, facts: ChartFacts, map: NewdataMap): NewdataBlock[] {
  switch (r.kind) {
    case "state": {
      const block = matchPillarState(map, r.group, facts, r.pillar);
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
      return matchCareer(map, facts, r.role, r.order);
    case "dayMasterStrength":
      return matchDayMasterStrength(map, r.group, facts);
    case "branchOf":
      return matchPillarBranch(map, r.group, facts, r.pillar);
    case "ganzhiOf":
      return matchPillarGanzhi(map, r.group, facts, r.pillar);
    case "dithiTransfer":
      return matchDithiTransfer(map, r.group, facts, r.scope ?? "all");
    case "daYunTransfer":
      return matchDaYunTransfer(map, r.group, facts);
    case "daYun": {
      const blocks: NewdataBlock[] = [];
      for (const d of facts.daYun) {
        const state = d.lowerState;
        if (!state) continue;
        const value = map.shengxiang?.[state];
        if (!value) continue;
        blocks.push({
          group: "shengxiang",
          itemKey: state,
          label: value.label,
          text: value.text,
          context: `อายุ ${d.startAge}-${d.endAge}${d.isCurrent ? " (ปัจจุบัน)" : ""}`,
        });
      }
      return blocks;
    }
    default:
      return [];
  }
}

/** จัดรูป block เป็นย่อหน้า markdown: **ป้าย** เนื้อ _(บริบท)_ */
function blockToParagraph(b: NewdataBlock): string {
  const head = b.label ? `**${b.label}** ` : "";
  const ctx = b.context ? ` _(${b.context})_` : "";
  return `${head}${b.text}${ctx}`.trim();
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
