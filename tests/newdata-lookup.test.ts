import { describe, expect, test } from "vitest";

import type { NewdataMap } from "@/lib/bazi/newdata-repository";
import {
  annualGanzhi,
  avoidFavorableElements,
  favorableElements,
  findElementByMechanism,
  gradeLuckPhase,
  matchAnnualYears,
  matchBranchPairs,
  matchDithiTransferPrioritized,
  matchFavorableSummary,
  matchFriendTrue,
  matchHealthElement,
  matchHealthZoah,
  matchLuckyAnimal,
  matchFortune,
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
  strengthScore: 2.5, // ดวงอ่อน (band weak ตามสเปก 8.1: 2–3.75) — ทดสอบเส้นทาง weak
  pillars: [
    { position: "year", stem: "戊", branch: "辰", state: "เอี้ยง", upperState: "ตี้อ๋วง" },
    { position: "month", stem: "丁", branch: "巳", state: "เชี่ยงแซ", upperState: "กวงตั่ว" },
    { position: "day", stem: "庚", branch: "午", state: "หมกยก", upperState: "เอี้ยง" },
    { position: "hour", stem: "癸", branch: "未", state: "กวงตั่ว", upperState: "หมกยก" },
  ],
  daYun: [
    { startAge: 6, endAge: 15, stem: "丙", branch: "辰", isCurrent: false, upperState: "แป่", lowerState: "เอี้ยง", phases: [] },
    { startAge: 16, endAge: 25, stem: "乙", branch: "卯", isCurrent: true, upperState: "ซี่", lowerState: "ตี้อ๋วง", phases: [] },
  ],
};

const STATES_12 = {
  หมกยก: { text: "มีเสน่ห์ดึงดูด ลุ่มหลงในความสวยงาม", label: "หมกยก" },
  เอี้ยง: { text: "การเลี้ยงให้เจริญเติบโต", label: "เอี้ยง" },
  เชี่ยงแซ: { text: "มีนิสัยใฝ่รู้ ชอบพัฒนาตัวเอง", label: "เชี่ยงแซ" },
  กวงตั่ว: { text: "เรียนรู้สำเร็จการศึกษา", label: "กวงตั่ว" },
  ตี้อ๋วง: { text: "อยู่จุดสูงสุด มีอำนาจวาสนา", label: "ตี้อ๋วง" },
};
const MAP: NewdataMap = {
  shengxiang: STATES_12,
  // บท4 ใช้กลุ่มเฉพาะ (pre-fill เหมือน shengxiang) — แยก group แต่เนื้อเริ่มต้นเดียวกัน
  benefactor_resource: STATES_12,
  benefactor_output: STATES_12,
  benefactor_wealth: STATES_12,
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
  love_base_60: {
    庚午: { text: "คู่ครองที่มีการใช้อำนาจ หรือ มีตำแหน่ง", label: "庚午" },
  },
  study_by_element: {
    ทอง: { text: "วิศวกรรมเครื่องกล นิติศาสตร์ เตรียมทหาร", label: "วิชา/คณะ ธาตุทอง" },
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

  // FACTS: 戊辰 丁巳 庚午 癸未 → นับธาตุ ดิน=3(戊辰未) ไฟ=3(丁巳午) ทอง=1 น้ำ=1 ไม้=0
  //   maxEl=ไฟ (เสมอ 3 กับดิน แต่ ไฟ มาก่อนใน order) · minEl=ไม้ (0)
  describe("matchHealthElement: คีย์แยก มาก/น้อย", () => {
    test("มาก=ไฟ|มาก, น้อย=ไม้|น้อย (เลือกคีย์ถูก band)", () => {
      const map: NewdataMap = {
        health_by_element: {
          "ไฟ|มาก": { text: "หัวใจ/ความดัน", label: "ไฟมาก" },
          "ไม้|น้อย": { text: "ตับอ่อนแอ", label: "ไม้น้อย" },
          "ไฟ|น้อย": { text: "ไม่ควรขึ้น", label: "ไฟน้อย" }, // ไฟ ไม่ใช่ธาตุน้อย → ไม่ match
        },
      };
      expect(matchHealthElement(map, "health_by_element", FACTS).map((b) => b.itemKey)).toEqual([
        "ไฟ|มาก",
        "ไม้|น้อย",
      ]);
    });

    test("ช่องว่าง (text ว่าง) = ไม่ขึ้น", () => {
      const map: NewdataMap = {
        health_by_element: { "ไฟ|มาก": { text: "", label: "ว่าง" } },
      };
      expect(matchHealthElement(map, "health_by_element", FACTS)).toHaveLength(0);
    });
  });

  describe("matchHealthZoah: กะจื่อ/ดิถี × ตำแหน่งเสา", () => {
    test("จับ กะจื่อประจำเสา + ดิถีถ่ายเท ของเสาวัน 庚午 (ดิถี 庚)", () => {
      const map: NewdataMap = {
        health_zoah: {
          "庚午@วัน": { text: "โรคเสาวันกะจื่อ", label: "庚午@วัน" },
          "庚→午@วัน": { text: "ดิถีถ่ายเทราศีล่างวัน", label: "庚→午@วัน" },
          "甲申@ปี": { text: "ไม่อยู่ในดวงนี้", label: "甲申@ปี" }, // ไม่ match
        },
      };
      expect(matchHealthZoah(map, "health_zoah", FACTS).map((b) => b.itemKey).sort()).toEqual(
        ["庚午@วัน", "庚→午@วัน"].sort(),
      );
    });

    test("ช่องว่างไม่ขึ้น + ไม่ match เมื่อคีย์ไม่ตรงดวง", () => {
      const map: NewdataMap = {
        health_zoah: { "庚午@วัน": { text: "", label: "ว่าง" } },
      };
      expect(matchHealthZoah(map, "health_zoah", FACTS)).toHaveLength(0);
    });
  });

  describe("matchFriendTrue: บท 8 มิตรแท้ (เงื่อนไขธาตุ + ดิถี→ธาตุเดียวกันรายเสา)", () => {
    const FRIEND_MAP: NewdataMap = {
      friend_true: {
        "庚→庚@วัน": { text: "มิตรแท้เพศเดียวกัน...", label: "ดิถี 庚→庚 ที่เสาวัน" },
        "庚→申@ปี": { text: "มิตรแท้ลูกค้า...", label: "ดิถี 庚→申 ที่เสาปี" },
        "庚|มิตรแย่ง": { text: "ธาตุทอง ≥3 เป็นมิตรแย่งผลประโยชน์", label: "มิตรแย่ง" },
      },
    };

    test("ธาตุดิถี ≤2 ในดวง → อ่านรายเสา (จับเฉพาะคีย์ที่ตรงดวง ไม่จับมิตรแย่ง)", () => {
      // FACTS: 庚 (ทอง) มีทองตัวเดียวคือดิถี → เส้นทางมิตรแท้ · 庚→庚@วัน ตรงเสาวัน (ราศีบน 庚)
      // 庚→申@ปี ไม่ตรง (เสาปีคือ 戊辰) → ไม่ขึ้น
      const blocks = matchFriendTrue(FRIEND_MAP, "friend_true", FACTS);
      expect(blocks.map((b) => b.itemKey)).toEqual(["庚→庚@วัน"]);
      expect(blocks[0].label).toBe("ดิถี 庚→庚 ที่เสาวัน");
    });

    test("ธาตุดิถี ≥3 ในดวง (รวมดิถี) → อ่านก้อนมิตรแย่งก้อนเดียว", () => {
      // ทอง 3 ตัว: 庚(ปี) 申(ปี) 庚(ดิถี) → เข้าเงื่อนไขมิตรแย่งผลประโยชน์
      const facts: ChartFacts = {
        ...FACTS,
        pillars: [
          { position: "year", stem: "庚", branch: "申", state: null, upperState: null },
          { position: "month", stem: "丁", branch: "巳", state: null, upperState: null },
          { position: "day", stem: "庚", branch: "午", state: null, upperState: null },
          { position: "hour", stem: "癸", branch: "未", state: null, upperState: null },
        ],
      };
      const blocks = matchFriendTrue(FRIEND_MAP, "friend_true", facts);
      expect(blocks.map((b) => b.itemKey)).toEqual(["庚|มิตรแย่ง"]);
      expect(blocks[0].context).toContain("3 ตัว");
    });

    test("ช่องว่าง/ไม่มี group → ไม่ขึ้น", () => {
      expect(matchFriendTrue({}, "friend_true", FACTS)).toHaveLength(0);
      const empty: NewdataMap = { friend_true: { "庚→庚@วัน": { text: "", label: "ว่าง" } } };
      expect(matchFriendTrue(empty, "friend_true", FACTS)).toHaveLength(0);
    });
  });
});

describe("chapter-newdata-map: resolveChapterBoxes (box ครบทุก bullet)", () => {
  test("education → box=3: box0=สไตล์เรียน+วุฒิ, box1=ดิถีถ่ายเท(ว่าง), box2=อาชีพถูกดวง", () => {
    const r = resolveChapterBoxes("education", FACTS, MAP);
    expect(r.hasContent).toBe(true);
    expect(r.boxes).toHaveLength(3); // 3 bullets
    expect(r.boxes[0].body).toContain("การเรียนซ้ำชั้น เรียนรู้เรื่องลึกลับ"); // study_style
    expect(r.boxes[0].body).toContain("การศึกษามักล่าช้า เรียนซ้ำชั้น"); // + edu_level (รวมในข้อ 1)
    expect(r.boxes[1].body).toBe(""); // ดิถี→ถ่ายเท→เชี่ยงแซ — MAP ไม่มี dithi_transfer = ว่าง
    expect(r.boxes[2].body).toContain("วิศวกรรมเครื่องกล"); // เรียนตามอาชีพถูกดวง = study_by_element ธาตุทอง
  });

  test("chart_foundation → box=7, ภาคี+เชี่ยงแซเติม, ด้านมืด/จื่อเฮ้งว่าง (ดวงนี้ไม่มี)", () => {
    const r = resolveChapterBoxes("chart_foundation", FACTS, MAP);
    expect(r.boxes).toHaveLength(10); // 10 bullets (+รูปร่างหน้าตา/คุณธรรม/ชื่อเสียง)
    expect(r.boxes[0].body).toBe(""); // กำลังดิถี — ว่าง
    expect(r.boxes[2].body).toContain("ความผูกพันแห่งความกลมเกลียว"); // ภาคีราศีล่าง 午未
    expect(r.boxes[3].body).toContain("มีเสน่ห์ดึงดูด"); // เชี่ยงแซดิถี หมกยก
    expect(r.boxes[4].body).toBe(""); // นิสัยด้านมืดตามธาตุ — MAP ว่าง
    expect(r.boxes[5].body).toBe(""); // สิ่งพึงระวัง (จื่อเฮ้ง) — ดวงนี้ไม่มี
    // หัว box = ข้อความ bullet เต็มจาก outline
    expect(r.boxes[1].title).toContain("12 นักษัตร");
  });

  test("love_partner → box=5, ภาคีติด(box0) ชง/ไห่ ไม่ติด(box3 ว่าง)", () => {
    const r = resolveChapterBoxes("love_partner", FACTS, MAP);
    expect(r.boxes).toHaveLength(5); // 5 bullets
    expect(r.boxes[0].body).toContain("คู่ครองที่มีการใช้อำนาจ"); // ลักษณะชีวิตคู่ 60 box (庚午 หลักวัน)
    expect(r.boxes[0].body).toContain("ความผูกพันแห่งความกลมเกลียว"); // + ภาคีราศีล่าง 午未
    expect(r.boxes[3].body).toBe(""); // สิ่งที่ควรระวัง (ชง/ไห่) — ดวงนี้ไม่มี
  });

  test("family → เชี่ยงแซโทนครอบครัว (family_state) ไม่ใช่ shengxiang กลาง", () => {
    const r = resolveChapterBoxes("family", FACTS, MAP);
    expect(r.boxes).toHaveLength(6); // 6 bullets
    expect(r.boxes[0].body).toContain("เลี้ยงดูฟูมฟัก"); // เอี้ยง (เสาปี) โทนครอบครัว
    expect(r.boxes[2].body).toContain("การศึกษาและการวางรากฐาน"); // กวงตั่ว (ราศีบนเดือน) = พ่อ
    expect(r.boxes[2].body).toContain("ราศีบน 丁巳 (กวงตั่ว)"); // ป้ายเสาแบบซินแส
    expect(r.boxes[3].body).toContain("ใฝ่เรียนรู้ไปด้วยกัน"); // เชี่ยงแซ (ราศีล่างเดือน) = แม่
    // โทนวัฏจักร (เจ็บป่วย/เสื่อมถอย) ต้องไม่หลุดเข้าบทครอบครัว
    expect(r.boxes.map((b) => b.body).join(" ")).not.toContain("เจ็บป่วย");
  });

  test("talent box2 → ราศีแฝง: 庚 ถ่ายเท ราศีแฝงหลักยาม 未(己丁乙)", () => {
    const map: NewdataMap = {
      ...MAP,
      // หลักยาม 癸未 → ราศีล่าง 未 ราศีแฝง = 己丁乙 → lookup 庚|乙
      dithi_transfer: { "庚|乙": { text: "พรแฝงด้านการสร้างสรรค์", label: "庚 ถ่ายเท 乙" } },
    };
    const r = resolveChapterBoxes("talent", FACTS, map);
    expect(r.boxes[2].body).toContain("พรแฝงด้านการสร้างสรรค์");
  });

  test("friends_foes box0 มิตรแท้ → ภาคีราศีล่าง + หลักวันเชี่ยงแซ(หมกยก)", () => {
    const r = resolveChapterBoxes("friends_foes", FACTS, MAP);
    expect(r.boxes[0].body).toContain("ความผูกพันแห่งความกลมเกลียว"); // ภาคี 午未
    expect(r.boxes[0].body).toContain("มีเสน่ห์ดึงดูด"); // หลักวันเชี่ยงแซ หมกยก
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
    expect(r.boxes).toHaveLength(5); // 5 bullets
    expect(r.boxes[0].body).toContain("เหล็ก เครื่องประดับ"); // ควรทำ1 = ธาตุทอง
    expect(r.boxes[1].body).toBe(""); // ควรทำ2 — ตารางให้ธาตุเดียว = ว่าง
    expect(r.boxes[2].body).toBe(""); // ควรทำ3 — ว่าง
    expect(r.boxes[3].body).toContain("ครู อาจารย์"); // ไม่ควรทำ1 = ธาตุไฟ (พิฆาตทอง)
    expect(r.boxes[4].body).toContain("สื่อสิ่งพิมพ์"); // ไม่ควรทำ2 = ธาตุไม้ (ทรัพย์)
  });

  test("love_partner → ชีวิตคู่(60 box หลักวัน) + โอกาสมีคู่(ชาย×อ่อน)", () => {
    const map: NewdataMap = {
      ...MAP,
      love_chance: { "male|weak": { text: "เพศชายดิถีอ่อน โอกาสมีคู่ยาก (20-40%)", label: "ชาย อ่อน" } },
    };
    // หลักวัน 庚午 → love_base_60[庚午] · gender male · score -1.25 = weak
    const r = resolveChapterBoxes("love_partner", { ...FACTS, gender: "male" }, map);
    expect(r.boxes[0].body).toContain("คู่ครองที่มีการใช้อำนาจ"); // ลักษณะชีวิตคู่ 60 box
    expect(r.boxes[2].body).toContain("โอกาสมีคู่ยาก"); // มีคู่เหมาะไหม
  });

  test("love_partner ลักษณะคู่ครอง → หญิง: ธาตุพิฆาต(ไฟ)ที่เสาเดือน=เชี่ยงแซ · ชาย: ธาตุโชคลาภ(ไม้)ไม่มี=ว่าง", () => {
    const female = resolveChapterBoxes("love_partner", { ...FACTS, gender: "female" }, MAP);
    // 庚(ทอง) หญิง → ธาตุพิฆาต = ไฟ → เสาเดือน 丁巳(ไฟ) เชี่ยงแซ → shengxiang
    expect(female.boxes[1].body).toContain("มีนิสัยใฝ่รู้");
    const male = resolveChapterBoxes("love_partner", { ...FACTS, gender: "male" }, MAP);
    // 庚 ชาย → ธาตุโชคลาภ = ไม้ → ดวงนี้ไม่มีธาตุไม้ = ว่าง
    expect(male.boxes[1].body).toBe("");
  });

  test("love_chance ไม่มี gender → ไม่ทาย (กล่องว่าง)", () => {
    const map: NewdataMap = { ...MAP, love_chance: { "male|weak": { text: "x", label: "y" } } };
    const r = resolveChapterBoxes("love_partner", FACTS, map); // FACTS ไม่มี gender
    expect(r.boxes[2].body).toBe("");
  });

  test("guardian_deities box ทำบุญ → ดิถีทองอ่อน เสริมธาตุ ดิน+ทอง (merit band)", () => {
    const map: NewdataMap = {
      ...MAP,
      merit_by_element: {
        ดิน: { text: "ทำบุญ ดิน หิน ปูน ทราย", label: "ทำบุญ ธาตุดิน" },
        ทอง: { text: "ทำบุญถวายของโลหะ", label: "ทำบุญ ธาตุทอง" },
      },
    };
    const r = resolveChapterBoxes("guardian_deities", FACTS, map);
    expect(r.defined).toBe(true);
    // ทำบุญใช้ favorableElements (merit band) → 庚อ่อน = ส่งเสริม(ดิน)+คู่ธาตุ(ทอง)
    // boxes ของ resolveChapterBoxes = ตาม bullets ตรง ๆ (intro เติมที่ API) → bullet[3] = box[3]
    expect(r.boxes[3].body).toContain("ทำบุญ ดิน หิน ปูน");
    expect(r.boxes[3].body).toContain("ทำบุญถวายของโลหะ");
  });

  test("colors_directions → DB ว่าง แต่ สัตว์มงคล(รายดิถี) เติมจาก static", () => {
    // บท 14 wire resolver ตามธาตุที่ดวงต้องการแล้ว แต่ตาราง auspicious_by_element ยังไม่มีใน MAP
    const r = resolveChapterBoxes("colors_directions", FACTS, MAP);
    expect(r.defined).toBe(true);
    expect(r.hasContent).toBe(true); // สัตว์มงคล เติมตามดิถีเสมอ (static ไม่พึ่ง DB)
    expect(r.boxes).toHaveLength(8); // 8 bullets
    expect(r.boxes[5].body).toContain("แพะ"); // box5 สัตว์มงคล: ดิถี 庚 = แพะ, กระต่าย
    // ช่องพึ่ง DB (สี/เสื้อผ้า/เครื่องประดับ/กระเป๋า/รถ/ทิศ/ข้อเสนอแนะ) ยังว่างในดวงนี้
    for (const i of [0, 1, 2, 3, 4, 6, 7]) expect(r.boxes[i].body, `box${i}`).toBe("");

    // เติมตาราง 1 ช่อง (สี × ธาตุดิน = ธาตุที่ดวงต้องการของ 庚อ่อน ตาม merit band) → box แรกมีเนื้อ
    const filled: NewdataMap = {
      ...MAP,
      auspicious_by_element: { "สี|ดิน": { text: "สีเหลือง น้ำตาล", label: "สีมงคล ธาตุดิน" } },
    };
    const r2 = resolveChapterBoxes("colors_directions", FACTS, filled);
    expect(r2.boxes[0].body).toContain("สีเหลือง น้ำตาล");
  });

  test("ข้อเสนอแนะ(จิตวิทยา) = พัฒนานิสัยตาม用神 (merit) ไม่ใช่ธาตุดิถีเดี่ยว", () => {
    // 庚(weak) → 用神 = ดิน(印)+ทอง(比); develop ต้องออก ดิน+ทอง ไม่ใช่แค่ทอง(ธาตุดิถี) และไม่มีไฟ
    const map: NewdataMap = {
      ...MAP,
      develop_by_element: {
        ดิน: { text: "สุขุม รอบคอบ มั่นคง", label: "พัฒนานิสัย ธาตุดิน" },
        ทอง: { text: "กล้าหาญ มีเหตุมีผล", label: "พัฒนานิสัย ธาตุทอง" },
        ไฟ: { text: "มีมารยาท เป็นผู้ให้", label: "พัฒนานิสัย ธาตุไฟ" },
      },
    };
    for (const [ch, i] of [["chart_foundation", 6], ["family", 5], ["love_partner", 4]] as const) {
      const advice = resolveChapterBoxes(ch, FACTS, map).boxes[i].body;
      expect(advice, ch).toContain("สุขุม รอบคอบ"); // ดิน = 用神 (พิสูจน์ว่า iterate用神 ไม่ใช่ธาตุดิถี)
      expect(advice, ch).toContain("กล้าหาญ"); // ทอง = 用神
      expect(advice, ch).not.toContain("มีมารยาท"); // ไฟ ไม่ใช่用神 → ต้องไม่โผล่
    }
  });

  test("ข้อเสนอแนะ wealth/health/talent = รายธาตุ用神 (static, iterate favorableElements)", () => {
    // FACTS 庚(weak) → 用神 ดิน+ทอง; แต่ละกล่องต้องมีเนื้อธาตุดิน (用神) และไม่มีธาตุไฟ (ไม่ใช่用神)
    // wealth bullets: [โชคลาภ, ธุรกิจ, ลูกค้า, การใช้จ่าย, ผั่ว, ข้อเสนอแนะ] → ข้อเสนอแนะ = box[5]
    const wealth = resolveChapterBoxes("wealth_and_investment", FACTS, MAP).boxes[5].body;
    expect(wealth).toContain("เก็บออมแบบมั่นคง"); // ดิน
    expect(wealth).not.toContain("แปลงชื่อเสียง"); // ไฟ (ไม่ใช่用神)
    expect(resolveChapterBoxes("talent", FACTS, MAP).boxes[3].body).toContain("บริหารทรัพย์สิน"); // ดิน
    expect(resolveChapterBoxes("health", FACTS, MAP).boxes[2].body).toContain("ม้าม"); // ดิน
  });

  test("benefactor box2/3 → ถ่ายเท(น้ำ=癸เสายาม ธาตุแท้) · โชคลาภ(ไม้) มาทางจิตใต้สำนึก (乙แฝงใน辰/未)", () => {
    // 庚(ทอง): ถ่ายเท(食傷)=น้ำ → 癸เสายาม (ธาตุแท้) เชี่ยงแซกวงตั่ว
    // โชคลาภ(財)=ไม้ → ไม่มีธาตุแท้/ภาคี แต่ 乙(ไม้) แฝงใน 辰(เสาปี เอี้ยง) + 未(เสายาม กวงตั่ว) = จิตใต้สำนึก
    const r = resolveChapterBoxes("benefactor", FACTS, MAP);
    expect(r.boxes[2].body).toContain("เรียนรู้สำเร็จการศึกษา"); // กวงตั่ว (เสายาม ธาตุน้ำ แท้)
    expect(r.boxes[3].body).toContain("การเลี้ยงให้เจริญเติบโต"); // เอี้ยง (เสาปี 辰 แฝงไม้ จิตใต้สำนึก)
    expect(r.boxes[3].body).toContain("จิตใต้สำนึก"); // ป้ายบอกกลไก
  });

  test("health box1 → ธาตุไฟมากเกินไป + ธาตุไม้น้อยเกินไป (นับจาก 4 เสา)", () => {
    const map: NewdataMap = {
      ...MAP,
      health_by_element: {
        "ไฟ|มาก": { text: "ระวังหัวใจ ความดัน นอนไม่หลับ", label: "โรคธาตุไฟ มาก" },
        "ไม้|น้อย": { text: "ระวังตับ เส้นเอ็น ดวงตา", label: "โรคธาตุไม้ น้อย" },
      },
    };
    const r = resolveChapterBoxes("health", FACTS, map);
    expect(r.boxes[1].body).toContain("ระวังหัวใจ"); // ไฟ มากสุด (3 ตำแหน่ง)
    expect(r.boxes[1].body).toContain("ระวังตับ"); // ไม้ น้อยสุด (0 ตำแหน่ง)
  });

  test("กลุ่มใหม่: คุณธรรม(บท1)/ลูกค้า+ธุรกิจ(บท3) — ตามธาตุดิถี/เชี่ยงแซหลักปี/หลักเดือน", () => {
    const map: NewdataMap = {
      ...MAP,
      // 庚 = ทอง → คุณธรรม ธาตุทอง
      virtue_by_element: { ทอง: { text: "ยุติธรรม เด็ดขาด มีหลักการ", label: "คุณธรรม ธาตุทอง" } },
      // ลูกค้า = เชี่ยงแซหลักปี (戊辰 = เอี้ยง) · ธุรกิจ = เชี่ยงแซหลักเดือน (丁巳 = เชี่ยงแซ)
      customer_state: { เอี้ยง: { text: "ลูกค้าที่ต้องคอยดูแล วัยเด็ก", label: "เอี้ยง" } },
      business_state: { เชี่ยงแซ: { text: "ธุรกิจเริ่มต้นสิ่งใหม่ เพื่อการพัฒนา", label: "เชี่ยงแซ" } },
      // การใช้จ่าย = เชี่ยงแซของเสาที่ธาตุถ่ายเท(食傷=น้ำ)ปรากฏ → 癸เสายาม เชี่ยงแซกวงตั่ว
      spending_state: { กวงตั่ว: { text: "ใช้จ่ายกับการเรียนรู้ เรื่องเฉพาะทาง", label: "กวงตั่ว" } },
    };
    const cf = resolveChapterBoxes("chart_foundation", FACTS, map);
    expect(cf.boxes[8].body).toContain("ยุติธรรม เด็ดขาด"); // box8 = คุณธรรม (ตามธาตุดิถี ทอง)
    const w = resolveChapterBoxes("wealth_and_investment", FACTS, map);
    expect(w.boxes[1].body).toContain("ธุรกิจเริ่มต้นสิ่งใหม่"); // box1 = ธุรกิจ (หลักเดือน เชี่ยงแซ)
    expect(w.boxes[2].body).toContain("ลูกค้าที่ต้องคอยดูแล"); // box2 = ลูกค้า (หลักปี เอี้ยง)
    expect(w.boxes[3].body).toContain("ใช้จ่ายกับการเรียนรู้"); // box3 = การใช้จ่าย (ธาตุถ่ายเท น้ำ → กวงตั่ว)
  });

  test("ชื่อเสียงและเกียรติยศ (fame_honor) — จับกะจื่อเด่นดังในเสาใดก็ได้", () => {
    // FACTS หลักวัน 庚午 ไม่ใช่กะจื่อเด่นดัง → ว่าง
    const none = resolveChapterBoxes("chart_foundation", FACTS, {
      ...MAP,
      fame_honor: { 甲子: { text: "ดาวเด่นดังแห่งหมกยก", label: "甲子" } },
    });
    expect(none.boxes[9].body).toBe(""); // box9 = ชื่อเสียง (ดวงนี้ไม่มีกะจื่อเด่นดัง)
    // ดวงที่หลักวันเป็น 甲子 → จับได้
    const withFame: ChartFacts = {
      ...FACTS,
      dayMaster: "甲",
      pillars: [
        { position: "year", stem: "戊", branch: "辰", state: null, upperState: null },
        { position: "month", stem: "丁", branch: "巳", state: null, upperState: null },
        { position: "day", stem: "甲", branch: "子", state: null, upperState: null },
        { position: "hour", stem: "癸", branch: "未", state: null, upperState: null },
      ],
    };
    const hit = resolveChapterBoxes("chart_foundation", withFame, {
      ...MAP,
      fame_honor: { 甲子: { text: "ดาวเด่นดังแห่งหมกยก", label: "甲子" } },
    });
    expect(hit.boxes[9].body).toContain("ดาวเด่นดังแห่งหมกยก");
  });

  test("CHAPTER_BULLET_RESOLVERS มีครบ 15 บท และ resolver align กับจำนวน bullets", () => {
    expect(Object.keys(CHAPTER_BULLET_RESOLVERS)).toHaveLength(15);
    for (const [id, resolvers] of Object.entries(CHAPTER_BULLET_RESOLVERS)) {
      const bullets = CHAPTER_OUTLINE[id]?.bullets.length ?? -1;
      expect(resolvers.length, id).toBe(bullets);
    }
  });
});

describe("ดิถีถ่ายเท ทุกรูปแบบ + จัดลำดับกลไก (matchDithiTransferPrioritized)", () => {
  /** สร้างดวงสั้น (state ไม่ใช้ใน prioritized) */
  const chart = (dayMaster: string, p: Array<[string, string]>): ChartFacts => ({
    dayMaster,
    strengthScore: 3,
    pillars: (["year", "month", "day", "hour"] as const).map((position, i) => ({
      position,
      stem: p[i][0],
      branch: p[i][1],
      state: null,
      upperState: null,
    })),
    daYun: [],
  });

  test("กลไก1 (ธาตุแท้) มี → ใช้แค่กลไก1 ไม่ดู residual + คืนจิตใต้สำนึกแยกเสมอ", () => {
    // 甲(ไม้) → ถ่ายเท=ไฟ · เสาวัน 甲午 (午=ไฟ ธาตุแท้) · เสาปี 戊子 (residual)
    // จิตใต้สำนึก: 午 แฝง 丁(ไฟ) → 甲|丁
    const facts = chart("甲", [["戊", "子"], ["庚", "申"], ["甲", "午"], ["庚", "申"]]);
    const map: NewdataMap = {
      dithi_transfer: {
        "甲|午": { text: "ถ่ายเทธาตุแท้ไฟ", label: "甲 ถ่ายเท 午" },
        "甲|戊": { text: "residual ไม่ควรโผล่", label: "甲 ถ่ายเท 戊" },
        "甲|丁": { text: "ถ่ายเทจิตใต้สำนึก", label: "甲 ถ่ายเท 丁" },
      },
    };
    const blocks = matchDithiTransferPrioritized(map, "dithi_transfer", facts);
    const keys = blocks.map((b) => b.itemKey);
    expect(keys).toContain("甲|午"); // กลไก1
    expect(keys).toContain("甲|丁"); // จิตใต้สำนึก (แยกเสมอ)
    expect(keys).not.toContain("甲|戊"); // residual ถูกข้าม เพราะมีกลไก1
  });

  test("ไม่มีกลไก1 → ตกไปกลไก2 (ภาคี/ไตรภาคี)", () => {
    // 甲(ไม้) → ถ่ายเท=ไฟ · ไม่มีไฟแท้ · 卯+戌=ไฟ (6合) → 卯,戌 เป็นกลไก2
    const facts = chart("甲", [["庚", "戌"], ["辛", "卯"], ["甲", "申"], ["庚", "申"]]);
    const map: NewdataMap = {
      dithi_transfer: {
        "甲|卯": { text: "ภาคีไฟ 卯", label: "甲 ถ่ายเท 卯" },
        "甲|戌": { text: "ภาคีไฟ 戌", label: "甲 ถ่ายเท 戌" },
        "甲|丁": { text: "จิตใต้สำนึก (戌แฝง丁)", label: "甲 ถ่ายเท 丁" },
      },
    };
    const keys = matchDithiTransferPrioritized(map, "dithi_transfer", facts).map((b) => b.itemKey);
    expect(keys).toEqual(expect.arrayContaining(["甲|卯", "甲|戌"])); // กลไก2
    expect(keys).toContain("甲|丁"); // จิตใต้สำนึก (戌 แฝง 丁)
  });

  test("findElementByMechanism จัด tier ถูก (ไฟ สำหรับดวง 甲)", () => {
    const facts = chart("甲", [["戊", "子"], ["庚", "申"], ["甲", "午"], ["庚", "申"]]);
    const res = findElementByMechanism(facts, "fire");
    expect(res.tiers[0].map((h) => h.targetChar)).toContain("午"); // ธาตุแท้
    expect(res.subconscious.map((h) => h.targetChar)).toContain("丁"); // 午 แฝง 丁
  });
});

describe("บท3 โชคลาภ (matchFortune — คีย์ {ก้านอ้างอิง}|{ปลายทาง})", () => {
  const chart = (dayMaster: string, p: Array<[string, string]>): ChartFacts => ({
    dayMaster,
    strengthScore: 3,
    pillars: (["year", "month", "day", "hour"] as const).map((position, i) => ({
      position,
      stem: p[i][0],
      branch: p[i][1],
      state: null,
      upperState: null,
    })),
    daYun: [],
  });

  test("โชคลาภดิถี: 甲 → ธาตุโชคลาภ=ดิน · 戊(ธาตุแท้) ในดวง → คีย์ 甲|戊", () => {
    // 甲(ไม้) → 財=ดิน · เสาปี 戊辰 (戊=ดินแท้)
    const facts = chart("甲", [["戊", "辰"], ["庚", "申"], ["甲", "午"], ["庚", "申"]]);
    const map: NewdataMap = {
      fortune_dithi: {
        "甲|戊": { text: "โชคลาภจากอสังหา/ที่ดิน", label: "โชคลาภดิถี 甲 → 戊" },
      },
    };
    const keys = matchFortune(map, "fortune_dithi", facts, "dithi").map((b) => b.itemKey);
    expect(keys).toContain("甲|戊");
  });

  test("โชคลาภหลักเดือน: อ้างอิงก้านเดือน (丙เดือน → 財=ทอง) → คีย์ 丙|庚", () => {
    // ก้านเดือน 丙(ไฟ) → 財ของไฟ=ทอง · 庚(ทองแท้) ในดวง → คีย์ 丙|庚
    const facts = chart("甲", [["庚", "申"], ["丙", "申"], ["甲", "午"], ["庚", "申"]]);
    const map: NewdataMap = {
      fortune_month: { "丙|庚": { text: "โชคลาภจากหน้าที่การงาน", label: "โชคลาภหลักเดือน 丙 → 庚" } },
    };
    const keys = matchFortune(map, "fortune_month", facts, "month").map((b) => b.itemKey);
    expect(keys).toContain("丙|庚");
  });
});

describe("บท 12 · เกรดวัยจร (0-3) + ปีจร (annual years)", () => {
  test("gradeLuckPhase: 用神×คุณภาพ qi ตามระบบเกรด PDF ซินแส", () => {
    // FACTS 庚 อ่อน → 用神 = ดิน+ทอง
    expect(gradeLuckPhase(FACTS, "earth", "กวงตั่ว")).toBe(3); // ธาตุ∈用神 + qi ดี = ยุคทอง
    expect(gradeLuckPhase(FACTS, "fire", "ลิ่มกัว")).toBe(2); // ธาตุ∉用神 + qi ดี = โอกาสมาพร้อมภาระ
    expect(gradeLuckPhase(FACTS, "water", "ซวย")).toBe(1); // qi เสียแรง = เฝ้าระวัง
    expect(gradeLuckPhase(FACTS, "wood", "ทอ")).toBe(1); // ลาภ (財 ของ庚=ไม้) นอก用神 + qi กลาง = เฝ้าติดตาม
    expect(gradeLuckPhase(FACTS, "fire", "ทอ")).toBe(0); // อำนาจ + qi กลาง = ช่วงทั่วไป
  });

  test("annualGanzhi: 2026 = 丙午 (base 1984 甲子)", () => {
    expect(annualGanzhi(2026)).toEqual({ stem: "丙", branch: "午" });
    expect(annualGanzhi(1984)).toEqual({ stem: "甲", branch: "子" });
  });

  test("matchAnnualYears (ดวงแบบธานัท 甲/หลักวัน午): ปีจร 丙午→ซี่ เกรด(1) + ชง 2575 + ให้ร้าย 2576 ตรง GT", () => {
    const thanat: ChartFacts = {
      dayMaster: "甲",
      strengthScore: 2.25, // อ่อน → 用神 น้ำ+ไม้
      birthYear: 1986,
      pillars: [
        { position: "year", stem: "丙", branch: "寅", state: null, upperState: null },
        { position: "month", stem: "甲", branch: "午", state: null, upperState: null },
        { position: "day", stem: "甲", branch: "午", state: null, upperState: null },
        { position: "hour", stem: "癸", branch: "酉", state: null, upperState: null },
      ],
      daYun: [],
    };
    const blocks = matchAnnualYears(thanat, 2026);
    const current = blocks[0];
    expect(current.label).toContain("丙午");
    expect(current.label).toContain("พ.ศ. 2569");
    expect(current.label).toContain("อายุ 41 ปี"); // นับแบบจีน (2026-1986+1) ตรง GT
    expect(current.text).toContain("ถ่ายเท → ซี่"); // 丙=ไฟ ถ่ายเทของไม้ · 甲 ที่ 午 = ซี่
    expect(current.text).toContain("เกรด (1)");
    const caution = blocks.find((b) => b.itemKey === "caution");
    expect(caution?.text).toContain("พ.ศ. 2575"); // 壬子 ชงหลักวัน (子-午) ตรง GT
    expect(caution?.text).toContain("ชง (冲)");
    expect(caution?.text).toContain("พ.ศ. 2576"); // 癸丑 ให้ร้ายหลักวัน (丑-午) ตรง GT
    expect(caution?.text).toContain("害");
    const yearly = blocks.find((b) => b.itemKey === "yearly");
    expect(yearly?.text.split("\n")).toHaveLength(10);
  });
});

describe("แกน用神/忌神 canonical (matchFavorableSummary)", () => {
  test("忌神 นำด้วยธาตุพิฆาตดิถี (官杀) และไม่ซ้ำกับ用神", () => {
    const fav = favorableElements(FACTS); // 庚 → ธาตุเสริมดวงชุดหนึ่ง
    const avoid = avoidFavorableElements(FACTS);
    // 庚(ทอง) ถูกพิฆาตด้วยไฟ → ไฟต้องเป็นตัวแรกของธาตุที่ควรเลี่ยง
    expect(avoid[0]).toBe("ไฟ");
    // 用神 กับ 忌神 ต้องไม่ทับกัน และรวมกันเป็นเซ็ตย่อยของ 5 ธาตุ
    expect(fav.filter((e) => avoid.includes(e))).toEqual([]);
    expect(new Set([...fav, ...avoid]).size).toBeLessThanOrEqual(5);
    // 用神 ต้องไม่มีธาตุพิฆาตดิถี (官杀 ตัดออกเสมอ)
    expect(fav).not.toContain("ไฟ");
  });

  test("สัตว์มงคล lookup ตามดิถี (ก้านวัน) ไม่ใช่รายธาตุ", () => {
    expect(matchLuckyAnimal(FACTS)[0].text).toBe("แพะ, กระต่าย"); // ดิถี 庚
    expect(matchLuckyAnimal({ ...FACTS, dayMaster: "甲" })[0].text).toBe("มังกรคู่, วัว");
    expect(matchLuckyAnimal({ ...FACTS, dayMaster: "辛" })[0].label).toBe("สัตว์มงคล");
  });

  test("บล็อกแกน用神 มี group/หัวข้อ用神+忌神 และธาตุที่ engine เลือก", () => {
    const [block, ...rest] = matchFavorableSummary(FACTS);
    expect(rest).toEqual([]);
    expect(block.group).toBe("favorable_element");
    expect(block.text).toContain("用神");
    expect(block.text).toContain("忌神");
    for (const e of favorableElements(FACTS)) expect(block.text).toContain(`ธาตุ${e}`);
  });
});
