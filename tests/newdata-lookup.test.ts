import { describe, expect, test } from "vitest";

import type { NewdataMap } from "@/lib/bazi/newdata-repository";
import {
  matchBranchPairs,
  matchSelfPunish,
  matchStemPairs,
  type ChartFacts,
} from "@/lib/bazi/newdata-lookup";
import {
  CHAPTER_NEWDATA,
  resolveChapterNewdata,
} from "@/lib/bazi/chapter-newdata-map";

/**
 * ดวงจริง 1988-05-15 14:30 ชาย (ยืนยันจาก /api/bazi/calculate):
 *   ปี 戊辰 (เอี้ยง) · เดือน 丁巳 (เชี่ยงแซ) · วัน 庚午 (หมกยก) · ยาม 癸未 (กวงตั่ว)
 *   ราศีล่าง: 辰巳午未 (ไม่ซ้ำ) → 午未 ภาคี · 戊+癸 ภาคีราศีบน · ไม่มีชง/จื่อเฮ้ง
 */
const FACTS: ChartFacts = {
  dayMaster: "庚",
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

describe("chapter-newdata-map: resolve", () => {
  test("education → edu_level + study_style ของ หมกยก", () => {
    const r = resolveChapterNewdata("education", FACTS, MAP);
    expect(r.hasContent).toBe(true);
    const texts = r.sections.flatMap((s) => s.blocks.map((b) => b.text));
    expect(texts).toContain("การศึกษามักล่าช้า เรียนซ้ำชั้น");
    expect(texts).toContain("การเรียนซ้ำชั้น เรียนรู้เรื่องลึกลับ");
  });

  test("chart_foundation → เชี่ยงแซดิถี(หมกยก) + ภาคีราศีล่าง(午未) + ภาคีราศีบน(戊癸), ไม่มีจื่อเฮ้ง", () => {
    const r = resolveChapterNewdata("chart_foundation", FACTS, MAP);
    const ids = r.sections.map((s) => s.id);
    expect(ids).toContain("core-state");
    expect(ids).toContain("combine-branch");
    expect(ids).toContain("combine-stem");
    expect(ids).not.toContain("self-punish"); // ตัด section ว่างออก
  });

  test("love_partner → ภาคี(午未) ติด แต่ ชง ไม่ติด", () => {
    const r = resolveChapterNewdata("love_partner", FACTS, MAP);
    const ids = r.sections.map((s) => s.id);
    expect(ids).toContain("combine-branch");
    expect(ids).not.toContain("clash");
  });

  test("turning_points → เชี่ยงแซตามวัยจร (lowerState ของแต่ละช่วง)", () => {
    const r = resolveChapterNewdata("turning_points", FACTS, MAP);
    expect(r.hasContent).toBe(true);
    const blocks = r.sections[0].blocks;
    expect(blocks.map((b) => b.context)).toEqual([
      "อายุ 6-15",
      "อายุ 16-25 (ปัจจุบัน)",
    ]);
    expect(blocks.map((b) => b.itemKey)).toEqual(["เอี้ยง", "ตี้อ๋วง"]);
  });

  test("บทที่ยังไม่มี NewData → defined=false, hasContent=false", () => {
    for (const id of ["career_potential", "subordinates", "colors_directions", "guardian_deities"]) {
      const r = resolveChapterNewdata(id, FACTS, MAP);
      expect(r.defined, id).toBe(false);
      expect(r.hasContent, id).toBe(false);
    }
  });

  test("ครบ 15 บทใน CHAPTER_NEWDATA", () => {
    expect(Object.keys(CHAPTER_NEWDATA)).toHaveLength(15);
  });
});
