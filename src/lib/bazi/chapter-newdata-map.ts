/**
 * chapter → primitive map — "กาวเชื่อม" ระหว่าง 15 บท กับก้อนความรู้ NewData
 * บอกว่าแต่ละบทหยิบ primitive กลุ่มไหนไปใช้ (อิง bullets ใน chapter-outline.ts)
 * นี่คือหัวใจของ "ใช้หลักการคำนวณเดิม แต่ผลคำทายเป็น NewData"
 *
 * บทที่ยังไม่มี NewData (อาชีพ/ลูกน้อง/สี-ทิศ/องค์เทพ) → spec ว่าง → บทแสดง placeholder
 *
 * pure + client/server-safe
 */
import {
  matchBranchPairs,
  matchPhua,
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

type Section =
  | { id: string; title: string; kind: "state"; group: string; pillar: PillarPosition }
  | { id: string; title: string; kind: "branchPairs"; group: string }
  | { id: string; title: string; kind: "stemPairs" }
  | { id: string; title: string; kind: "selfPunish" }
  | { id: string; title: string; kind: "samHeng" }
  | { id: string; title: string; kind: "trinity" }
  | { id: string; title: string; kind: "phua" }
  | { id: string; title: string; kind: "daYun" };

/** key = topic id (ตรงกับ chapter-outline.ts / TOPIC_PATH) */
export const CHAPTER_NEWDATA: Record<string, Section[]> = {
  chart_foundation: [
    { id: "core-state", title: "แก่นตัวตนจากเชี่ยงแซดิถี", kind: "state", group: "shengxiang", pillar: "day" },
    { id: "combine-stem", title: "ภาคีราศีบน (สิ่งที่ถูกกำหนดมา)", kind: "stemPairs" },
    { id: "combine-branch", title: "ภาคีราศีล่าง (สิ่งที่เลือกลงมือทำ)", kind: "branchPairs", group: "combine_branch" },
    { id: "self-punish", title: "จื่อเฮ้ง (สิ่งพึงระวัง — ทำร้ายตัวเอง)", kind: "selfPunish" },
  ],
  career_potential: [], // ยังไม่มี NewData (อาชีพตามธาตุ)
  wealth_and_investment: [
    { id: "wealth-state", title: "ลักษณะโชคลาภจากเชี่ยงแซดิถี", kind: "state", group: "shengxiang", pillar: "day" },
    { id: "phua", title: "สิ่งพึงระวัง (ผั่วไฉ่โข่ว — รั่วไหลทรัพย์)", kind: "phua" },
  ],
  benefactor: [
    { id: "month-state", title: "ผู้อุปถัมภ์ (เชี่ยงแซหลักเดือน)", kind: "state", group: "shengxiang", pillar: "month" },
    { id: "combine-branch", title: "คู่ธาตุภาคี (คนหนุนหลัง)", kind: "branchPairs", group: "combine_branch" },
  ],
  talent: [
    { id: "talent-state", title: "พรสวรรค์จากเชี่ยงแซดิถี", kind: "state", group: "shengxiang", pillar: "day" },
    { id: "trinity", title: "พลังไตรภาคี (ซาฮะ)", kind: "trinity" },
  ],
  family: [
    { id: "year-state", title: "รากฐานบรรพบุรุษ (เชี่ยงแซหลักปี)", kind: "state", group: "shengxiang", pillar: "year" },
    { id: "month-state", title: "ครอบครัวพ่อแม่ (เชี่ยงแซหลักเดือน)", kind: "state", group: "shengxiang", pillar: "month" },
    { id: "combine-branch", title: "ความผูกพันในครอบครัว (ภาคี)", kind: "branchPairs", group: "combine_branch" },
    { id: "heng", title: "สิ่งพึงระวังในครอบครัว (เฮ้ง)", kind: "branchPairs", group: "harm_heng" },
  ],
  love_partner: [
    { id: "combine-branch", title: "ความผูกพัน (ภาคีราศีล่าง)", kind: "branchPairs", group: "combine_branch" },
    { id: "clash", title: "สิ่งที่ควรระวัง (ชง)", kind: "branchPairs", group: "clash" },
    { id: "hai", title: "สิ่งที่ควรระวัง (ไห่)", kind: "branchPairs", group: "harm_hai" },
  ],
  friends_foes: [
    { id: "combine-branch", title: "มิตรแท้ (ภาคีราศีล่าง)", kind: "branchPairs", group: "combine_branch" },
    { id: "hai", title: "ศัตรู — การให้ร้าย/แทงข้างหลัง (ไห่)", kind: "branchPairs", group: "harm_hai" },
    { id: "heng", title: "ความขัดแย้งเรื้อรัง (เฮ้ง)", kind: "branchPairs", group: "harm_heng" },
    { id: "samheng", title: "ภัยหมู่ (ซำเฮ้ง)", kind: "samHeng" },
  ],
  partnership: [
    { id: "day-state", title: "ลักษณะหุ้นส่วน (เชี่ยงแซหลักวันราศีล่าง)", kind: "state", group: "shengxiang", pillar: "day" },
  ],
  subordinates: [], // ยังไม่มี NewData (60 กะจื่อ matching)
  education: [
    { id: "edu", title: "ระดับการศึกษา (วุฒิ)", kind: "state", group: "edu_level", pillar: "day" },
    { id: "study", title: "สไตล์การเรียน", kind: "state", group: "study_style", pillar: "day" },
  ],
  turning_points: [
    { id: "dayun", title: "วัยจรแต่ละช่วง (เชี่ยงแซตามวัยจร)", kind: "daYun" },
  ],
  health: [
    { id: "clash", title: "โรค/อุบัติเหตุจากชง", kind: "branchPairs", group: "clash" },
    { id: "self", title: "โรคจากจื่อเฮ้ง (ทำร้ายตัวเอง)", kind: "selfPunish" },
    { id: "samheng", title: "โรคจากซำเฮ้ง", kind: "samHeng" },
    { id: "hai", title: "โรคจากไห่", kind: "branchPairs", group: "harm_hai" },
  ],
  colors_directions: [], // ยังไม่มี NewData (สี/ทิศ/ของมงคล)
  guardian_deities: [], // ยังไม่มี NewData (องค์เทพ)
};

export type ResolvedSection = { id: string; title: string; blocks: NewdataBlock[] };
export type ResolvedChapter = {
  chapterId: string;
  /** มี spec ผูกกับ NewData หรือไม่ (false = บทนี้ยังไม่มีก้อนความรู้รองรับ) */
  defined: boolean;
  /** มี block ที่ match จริงในดวงนี้หรือไม่ */
  hasContent: boolean;
  sections: ResolvedSection[];
};

function resolveSection(section: Section, facts: ChartFacts, map: NewdataMap): NewdataBlock[] {
  switch (section.kind) {
    case "state": {
      const block = matchPillarState(map, section.group, facts, section.pillar);
      return block ? [block] : [];
    }
    case "branchPairs":
      return matchBranchPairs(map, section.group, facts);
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
    case "daYun": {
      // ทุกช่วงวัยจร → เชี่ยงแซของราศีล่างช่วงนั้น (lookup shengxiang)
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

/** resolve 1 บท → sections ที่ match (ตัด section ที่ไม่มี block ออก) */
export function resolveChapterNewdata(
  chapterId: string,
  facts: ChartFacts,
  map: NewdataMap,
): ResolvedChapter {
  const spec = CHAPTER_NEWDATA[chapterId] ?? [];
  const sections: ResolvedSection[] = [];
  for (const section of spec) {
    const blocks = resolveSection(section, facts, map);
    if (blocks.length > 0) sections.push({ id: section.id, title: section.title, blocks });
  }
  return {
    chapterId,
    defined: spec.length > 0,
    hasContent: sections.length > 0,
    sections,
  };
}

/** resolve ทุกบทตามลำดับ key ที่ส่งเข้ามา (ปกติ = ลำดับ TOPIC_PATH 15 บท) */
export function resolveAllChapters(
  chapterIds: readonly string[],
  facts: ChartFacts,
  map: NewdataMap,
): ResolvedChapter[] {
  return chapterIds.map((id) => resolveChapterNewdata(id, facts, map));
}
