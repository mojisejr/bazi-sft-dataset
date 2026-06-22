import { describe, expect, test } from "vitest";

import type { NewdataMap } from "@/lib/bazi/newdata-repository";
import {
  matchBranchPairs,
  matchSelfPunish,
  matchStemPairs,
  type ChartFacts,
} from "@/lib/bazi/newdata-lookup";
import {
  CHAPTER_BULLET_RESOLVERS,
  resolveChapterBoxes,
} from "@/lib/bazi/chapter-newdata-map";
import { CHAPTER_OUTLINE } from "@/lib/bazi/chapter-outline";

/**
 * ดวงจริง 1988-05-15 14:30 ชาย (ยืนยันจาก /api/bazi/calculate):
 *   ปี 戊辰 (เอี้ยง) · เดือน 丁巳 (เชี่ยงแซ) · วัน 庚午 (หมกยก) · ยาม 癸未 (กวงตั่ว)
 *   ราศีล่าง: 辰巳午未 (ไม่ซ้ำ) → 午未 ภาคี · 戊+癸 ภาคีราศีบน · ไม่มีชง/จื่อเฮ้ง
 */
const FACTS: ChartFacts = {
  dayMaster: "庚",
  strengthScore: -1.25, // ดวงอ่อน (band weak) — ตรงกับ ground truth 1988
  pillars: [
    { position: "year", stem: "戊", branch: "辰", state: "เอี้ยง" },
    { position: "month", stem: "丁", branch: "巳", state: "เชี่ยงแซ" },
    { position: "day", stem: "庚", branch: "午", state: "หมกยก" },
    { position: "hour", stem: "癸", branch: "未", state: "กวงตั่ว" },
  ],
  daYun: [
    { startAge: 6, endAge: 15, stem: "丙", branch: "辰", isCurrent: false, upperState: "แป่", lowerState: "เอี้ยง" },
    { startAge: 16, endAge: 25, stem: "乙", branch: "卯", isCurrent: true, upperState: "ซี่", lowerState: "ตี้อ๋วง" },
  ],
};

const MAP: NewdataMap = {
  shengxiang: {
    หมกยก: { text: "มีเสน่ห์ดึงดูด ลุ่มหลงในความสวยงาม", label: "หมกยก" },
    เอี้ยง: { text: "การเลี้ยงให้เจริญเติบโต", label: "เอี้ยง" },
    เชี่ยงแซ: { text: "มีนิสัยใฝ่รู้ ชอบพัฒนาตัวเอง", label: "เชี่ยงแซ" },
    กวงตั่ว: { text: "เรียนรู้สำเร็จการศึกษา", label: "กวงตั่ว" },
    ตี้อ๋วง: { text: "อยู่จุดสูงสุด มีอำนาจวาสนา", label: "ตี้อ๋วง" },
  },
  edu_level: { หมกยก: { text: "การศึกษามักล่าช้า เรียนซ้ำชั้น", label: "หมกยก" } },
  study_style: { หมกยก: { text: "การเรียนซ้ำชั้น เรียนรู้เรื่องลึกลับ", label: "หมกยก" } },
  combine_branch: {
    午未: { text: "ความผูกพันแห่งความกลมเกลียว", label: "ความผูกพันแห่งความกลมเกลียวและบริสุทธิ์" },
    子丑: { text: "ความผูกพันแบบเกื้อกูล", label: "ความผูกพันแบบเกื้อกูล" },
  },
  combine_stem: {
    戊癸: { text: "ภาคีแห่งมารยาทและไร้เยื่อใย", label: "ภาคีแห่งมารยาทและไรเยื่อใย" },
    甲己: { text: "ภาคีแห่งความเที่ยงตรง", label: "ภาคีแห่งความเที่ยงตรง" },
  },
  clash: { "子-午": { text: "ชงรุนแรง เห็นผลชัด", label: "ชวด×มะเมีย" } },
  harm_hai: { "子-未": { text: "ถูกแทงข้างหลัง", label: "ชวด×มะแม" } },
  self_punish: { 辰: { text: "แบกภาระหนัก ทิฐิสูง", label: "มะโรง" } },
  career_by_element: {
    ไม้: { text: "สื่อสิ่งพิมพ์ เสื้อผ้า เฟอร์นิเจอร์ไม้", label: "อาชีพ/ธุรกิจ ธาตุไม้" },
    ไฟ: { text: "ครู อาจารย์ การตลาด แพทย์", label: "อาชีพ/ธุรกิจ ธาตุไฟ" },
    ดิน: { text: "อสังหาริมทรัพย์ รับเหมาก่อสร้าง", label: "อาชีพ/ธุรกิจ ธาตุดิน" },
    ทอง: { text: "เหล็ก เครื่องประดับ เทคโนโลยี ยานยนต์", label: "อาชีพ/ธุรกิจ ธาตุทอง" },
    น้ำ: { text: "อาหารเครื่องดื่ม การเงิน การบริการ", label: "อาชีพ/ธุรกิจ ธาตุน้ำ" },
  },
};

describe("newdata-lookup: matchers (set-membership)", () => {
  test("combine_branch จับ 午未 ได้ แต่ไม่จับ 子丑", () => {
    const blocks = matchBranchPairs(MAP, "combine_branch", FACTS);
    expect(blocks.map((b) => b.itemKey)).toEqual(["午未"]);
  });

  test("combine_stem จับ 戊癸 ได้ (戊+癸 อยู่ในดวง)", () => {
    const blocks = matchStemPairs(MAP, FACTS);
    expect(blocks.map((b) => b.itemKey)).toEqual(["戊癸"]);
  });

  test("clash ไม่ match (ดวงนี้ไม่มี 子午)", () => {
    expect(matchBranchPairs(MAP, "clash", FACTS)).toHaveLength(0);
  });

  test("self_punish ไม่ match (辰 ปรากฏครั้งเดียว)", () => {
    expect(matchSelfPunish(MAP, FACTS)).toHaveLength(0);
  });
});

describe("chapter-newdata-map: resolveChapterBoxes (box ครบทุก bullet)", () => {
  test("education → box=3 (เท่า bullets), เติม study_style + edu_level", () => {
    const r = resolveChapterBoxes("education", FACTS, MAP);
    expect(r.hasContent).toBe(true);
    expect(r.boxes).toHaveLength(3); // = จำนวน bullets
    expect(r.boxes[0].body).toContain("การเรียนซ้ำชั้น เรียนรู้เรื่องลึกลับ"); // study_style
    expect(r.boxes[1].body).toContain("การศึกษามักล่าช้า เรียนซ้ำชั้น"); // edu_level
    expect(r.boxes[2].body).toBe(""); // เรียนตามอาชีพ — ยังไม่มี NewData = ว่าง
  });

  test("chart_foundation → box=6, ภาคี+เชี่ยงแซเติม, จื่อเฮ้งว่าง (ดวงนี้ไม่มี)", () => {
    const r = resolveChapterBoxes("chart_foundation", FACTS, MAP);
    expect(r.boxes).toHaveLength(6);
    expect(r.boxes[0].body).toBe(""); // กำลังดิถี — ว่าง
    expect(r.boxes[2].body).toContain("ความผูกพันแห่งความกลมเกลียว"); // ภาคีราศีล่าง 午未
    expect(r.boxes[3].body).toContain("มีเสน่ห์ดึงดูด"); // เชี่ยงแซดิถี หมกยก
    expect(r.boxes[4].body).toBe(""); // สิ่งพึงระวัง (จื่อเฮ้ง) — ดวงนี้ไม่มี
    // หัว box = ข้อความ bullet เต็มจาก outline
    expect(r.boxes[1].title).toContain("12 นักษัตร");
  });

  test("love_partner → box=5, ภาคีติด(box0) ชง/ไห่ ไม่ติด(box3 ว่าง)", () => {
    const r = resolveChapterBoxes("love_partner", FACTS, MAP);
    expect(r.boxes).toHaveLength(5);
    expect(r.boxes[0].body).toContain("ความผูกพันแห่งความกลมเกลียว");
    expect(r.boxes[3].body).toBe(""); // สิ่งที่ควรระวัง (ชง/ไห่) — ดวงนี้ไม่มี
  });

  test("turning_points → box0 = เชี่ยงแซตามวัยจร พร้อมป้ายอายุ", () => {
    const r = resolveChapterBoxes("turning_points", FACTS, MAP);
    expect(r.hasContent).toBe(true);
    expect(r.boxes[0].body).toContain("อายุ 6-15");
    expect(r.boxes[0].body).toContain("อายุ 16-25 (ปัจจุบัน)");
  });

  test("chart_foundation box3 → ดิถีถ่ายเท: 庚 ถ่ายเท 癸 (เสายาม ราศีบน)", () => {
    const map: NewdataMap = {
      ...MAP,
      dithi_transfer: {
        "庚|癸": { text: "พูด/แสดงออก/ลงทุน แบบ ซวย", label: "庚 ถ่ายเท 癸" },
      },
    };
    const r = resolveChapterBoxes("chart_foundation", FACTS, map);
    // box3 = ดิถีถ่ายเท + เชี่ยงแซดิถี (庚 ถ่ายเท 癸 = ราศีบนเสายาม)
    expect(r.boxes[3].body).toContain("พูด/แสดงออก/ลงทุน แบบ ซวย");
    expect(r.boxes[3].body).toContain("มีเสน่ห์ดึงดูด"); // shengxiang/day ยังอยู่
  });

  test("chart_foundation → บท1 box0/1/2 เติม กำลังดิถี/12นักษัตร/60กะจื่อ จากหลักวัน", () => {
    const map: NewdataMap = {
      ...MAP,
      daymaster_strength: { "庚|weak": { text: "ดิถีทองอ่อน ใจกว้างแต่ขาดกำลัง", label: "庚 × อ่อน" } },
      zodiac_nisai: { 午: { text: "นิสัยมะเมีย รักอิสระ เปิดเผย", label: "午 มะเมีย" } },
      ganzhi_nisai: { 庚午: { text: "庚午 โลหะนั่งบนไฟ เด็ดเดี่ยว", label: "#7 庚午" } },
    };
    const r = resolveChapterBoxes("chart_foundation", FACTS, map);
    expect(r.boxes[0].body).toContain("ดิถีทองอ่อน"); // กำลังดิถี (庚|weak)
    expect(r.boxes[1].body).toContain("นิสัยมะเมีย"); // 12 นักษัตร (ราศีล่างหลักวัน 午)
    expect(r.boxes[2].body).toContain("庚午 โลหะนั่งบนไฟ"); // 60 กะจื่อ (หลักวัน 庚午)
    expect(r.boxes[2].body).toContain("ความผูกพันแห่งความกลมเกลียว"); // + ภาคีเดิมยังอยู่
  });

  test("career_potential → ดิถีทองอ่อน เดือนไฟ: ควรทำ=ทอง, ไม่ควรทำ=ไฟ/ไม้", () => {
    const r = resolveChapterBoxes("career_potential", FACTS, MAP);
    expect(r.defined).toBe(true);
    expect(r.hasContent).toBe(true);
    expect(r.boxes).toHaveLength(5);
    expect(r.boxes[0].body).toContain("เหล็ก เครื่องประดับ"); // ควรทำ1 = ธาตุทอง
    expect(r.boxes[1].body).toBe(""); // ควรทำ2 — ตารางให้ธาตุเดียว = ว่าง
    expect(r.boxes[2].body).toBe(""); // ควรทำ3 — ว่าง
    expect(r.boxes[3].body).toContain("ครู อาจารย์"); // ไม่ควรทำ1 = ธาตุไฟ (พิฆาตทอง)
    expect(r.boxes[4].body).toContain("สื่อสิ่งพิมพ์"); // ไม่ควรทำ2 = ธาตุไม้ (ทรัพย์)
  });

  test("guardian_deities box ทำบุญ → ดิถีทองอ่อน เสริมธาตุ ดิน+ทอง", () => {
    const map: NewdataMap = {
      ...MAP,
      merit_by_element: {
        ดิน: { text: "ทำบุญ ดิน หิน ปูน ทราย", label: "ทำบุญ ธาตุดิน" },
        ทอง: { text: "ทำบุญถวายของโลหะ", label: "ทำบุญ ธาตุทอง" },
      },
    };
    const r = resolveChapterBoxes("guardian_deities", FACTS, map);
    expect(r.defined).toBe(true);
    // boxes ของ resolveChapterBoxes = ตาม bullets ตรง ๆ (intro เติมที่ API) → bullet[3] = box[3]
    expect(r.boxes[3].body).toContain("ทำบุญ ดิน หิน ปูน");
    expect(r.boxes[3].body).toContain("ทำบุญถวายของโลหะ");
  });

  test("บทไม่มี NewData → defined=false, hasContent=false แต่ box ครบทุก bullet (ว่าง)", () => {
    const cases: Record<string, number> = {
      colors_directions: 9,
    };
    for (const [id, n] of Object.entries(cases)) {
      const r = resolveChapterBoxes(id, FACTS, MAP);
      expect(r.defined, id).toBe(false);
      expect(r.hasContent, id).toBe(false);
      expect(r.boxes, id).toHaveLength(n); // box ครบทุก bullet
      expect(r.boxes.every((b) => b.body === ""), id).toBe(true); // ว่างหมด
    }
  });

  test("CHAPTER_BULLET_RESOLVERS มีครบ 15 บท และ resolver align กับจำนวน bullets", () => {
    expect(Object.keys(CHAPTER_BULLET_RESOLVERS)).toHaveLength(15);
    for (const [id, resolvers] of Object.entries(CHAPTER_BULLET_RESOLVERS)) {
      const bullets = CHAPTER_OUTLINE[id]?.bullets.length ?? -1;
      expect(resolvers.length, id).toBe(bullets);
    }
  });
});
