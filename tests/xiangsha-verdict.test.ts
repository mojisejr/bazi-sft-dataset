// ANCHOR: xiangsha-verdict-bands — เกณฑ์ 12 เซียงแซ 5 ระดับที่ซินแสเคาะ (สำหรับแชทฮีลใจ)
// ตรึง 3 อย่าง:
//   1. ทั้ง 12 สภาวะเข้าระดับตามที่ซินแสสั่ง (ไม่ใช่ระดับที่โค้ดเดาเอง)
//   2. คะแนนที่ใช้ตัดสินไม่ได้นิยามใหม่ — 2 implementation ของ 十二長生 ในโปรเจกต์ต้องตรงกันทั้ง 120 คู่
//      (ถ้าวันหน้าใครแก้ตารางใดตารางหนึ่ง เทสนี้จะพัง แทนที่จะเพี้ยนเงียบ ๆ)
//   3. จุดที่ต่างจาก classifyQiTier ของหน้าอ่านดวง 15 บท ถูกบันทึกไว้จริงและตรงกับผลที่ฟังก์ชันคืน
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { lifeStageScore } from "@/lib/bazi/almanac/almanac-engine";
import { resolveCanonicalTwelveQiStage } from "@/lib/bazi/pillar-display";
import { TWELVE_QI_LABELS_TH } from "@/lib/bazi/symbolic-engine.constants";
import {
  buildXiangshaBoard,
  DIVERGENCE_FROM_READING_TIERS,
  formatXiangshaBoard,
  readXiangsha,
  xiangshaVerdict,
  type XiangshaVerdict,
} from "@/lib/bazi/xiangsha-verdict";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

/** ระดับที่ซินแสเคาะ รายสภาวะ (เขียนตรงตามที่ซินแสส่งมา ไม่ derive จากโค้ด) */
const SHINSE_BANDS: Record<string, XiangshaVerdict> = {
  "ตี้อ๋วง": "ดีมาก",
  "ลิ่มกัว": "ดีมาก",
  "กวงตั่ว": "ดีมาก",
  "เชี่ยงแซ": "ดี",
  "เอี้ยง": "ดี",
  "ทอ": "กลาง",
  "หมอ": "กลาง",
  "หมกยก": "เสีย",
  "ซวย": "เสีย",
  "แป่": "เสียมาก",
  "ซี่": "เสียมาก",
  "เจ๊าะ": "เสียมาก",
};

describe("xiangsha-verdict (ANCHOR: xiangsha-verdict-bands)", () => {
  test("ครบ 12 สภาวะ และแต่ละตัวเข้าระดับตามที่ซินแสเคาะ", () => {
    // กวาดทุกก้าน×กิ่ง เพื่อให้เจอทั้ง 12 สภาวะจริง ๆ ไม่ใช่ hardcode ตำแหน่งกิ่ง
    const seen = new Map<string, XiangshaVerdict>();
    for (const s of STEMS) {
      for (const b of BRANCHES) {
        const r = readXiangsha(s, b);
        expect(r, `อ่านไม่ออก: ${s}@${b}`).not.toBeNull();
        seen.set(r!.labelTh, r!.verdict);
      }
    }
    expect([...seen.keys()].sort()).toEqual(Object.keys(SHINSE_BANDS).sort());
    for (const [label, expected] of Object.entries(SHINSE_BANDS)) {
      expect(seen.get(label), `สภาวะ ${label} ควรเป็น ${expected}`).toBe(expected);
    }
  });

  test("คะแนนไม่ได้นิยามใหม่: 2 implementation ของ 十二長生 ตรงกันทั้ง 120 คู่", () => {
    const SCORE_BY_STAGE: Record<string, number> = {
      长生: 80, 沐浴: 40, 冠带: 90, 临官: 100, 帝旺: 110, 衰: 30,
      病: 20, 死: 10, 墓: 50, 绝: 0, 胎: 60, 养: 70,
    };
    const mismatched: string[] = [];
    for (const s of STEMS) {
      for (const b of BRANCHES) {
        const stage = resolveCanonicalTwelveQiStage(s, b) as string;
        const fromPillarDisplay = SCORE_BY_STAGE[stage];
        const fromAlmanac = lifeStageScore(s, b);
        if (fromPillarDisplay !== fromAlmanac) {
          mismatched.push(`${s}@${b}: pillar-display=${stage}(${fromPillarDisplay}) almanac=${fromAlmanac}`);
        }
      }
    }
    expect(mismatched, mismatched.join(" | ")).toEqual([]);
  });

  test("จุดตัดของแต่ละระดับ (ค่าขอบ)", () => {
    expect(xiangshaVerdict(110)).toBe("ดีมาก");
    expect(xiangshaVerdict(90)).toBe("ดีมาก");
    expect(xiangshaVerdict(80)).toBe("ดี");
    expect(xiangshaVerdict(70)).toBe("ดี");
    expect(xiangshaVerdict(60)).toBe("กลาง");
    expect(xiangshaVerdict(50)).toBe("กลาง");
    expect(xiangshaVerdict(40)).toBe("เสีย");
    expect(xiangshaVerdict(30)).toBe("เสีย");
    expect(xiangshaVerdict(20)).toBe("เสียมาก");
    expect(xiangshaVerdict(0)).toBe("เสียมาก");
  });

  test("บันทึกความต่างจาก classifyQiTier ของหน้าอ่านดวง ตรงกับผลจริงของฟังก์ชัน", () => {
    // หา (ก้าน,กิ่ง) ที่ให้สภาวะนั้น แล้วเช็คว่า verdict ตรงกับที่บันทึกไว้
    const labelToVerdict = new Map<string, XiangshaVerdict>();
    for (const s of STEMS) {
      for (const b of BRANCHES) {
        const r = readXiangsha(s, b)!;
        labelToVerdict.set(r.labelTh, r.verdict);
      }
    }
    expect(DIVERGENCE_FROM_READING_TIERS.length).toBeGreaterThan(0);
    for (const d of DIVERGENCE_FROM_READING_TIERS) {
      expect(Object.values(TWELVE_QI_LABELS_TH), `${d.stage} ต้องเป็นชื่อสภาวะจริงในเอนจิน`).toContain(d.stage);
      expect(labelToVerdict.get(d.stage), `${d.stage} ที่บันทึกไว้ไม่ตรงกับผลจริง`).toBe(d.shinseChat);
    }
  });

  test("ตารางเซียงแซ: ครบ 4 เสา (ราศีบน+ราศีล่าง) + ชั้นจร และไม่หลุดคะแนนดิบไปในข้อความ", () => {
    const rows = buildXiangshaBoard({
      dayMasterStem: "甲",
      pillars: {
        year: { stem: "戊", branch: "寅" },
        month: { stem: "己", branch: "卯" },
        day: { stem: "甲", branch: "亥" },
        hour: { stem: "壬", branch: "申" },
      },
      transits: [{ label: "ปีจร", pillar: { stem: "丙", branch: "午" } }],
    });
    // ทุกเสาต้องได้ทั้งราศีบนและราศีล่าง — ซินแสอ้าง "ราศีบนหลักเดือน" บ่อย ขาดไม่ได้
    expect(rows.map((r) => `${r.position}/${r.place}`)).toEqual([
      "หลักปี/ราศีบน", "หลักปี/ราศีล่าง",
      "หลักเดือน/ราศีบน", "หลักเดือน/ราศีล่าง",
      "หลักวัน/ราศีบน", "หลักวัน/ราศีล่าง",
      "หลักยาม/ราศีบน", "หลักยาม/ราศีล่าง",
      "ปีจร/ราศีบน", "ปีจร/ราศีล่าง",
    ]);
    // ราศีล่าง อ่านตรง ๆ — 甲: 寅=临官(ลิ่มกัว) 卯=帝旺(ตี้อ๋วง) 亥=长生(เชี่ยงแซ) 申=绝(เจ๊าะ) 午=死(ซี่)
    expect(rows.filter((r) => r.place === "ราศีล่าง").map((r) => `${r.read.labelTh}/${r.read.verdict}`)).toEqual([
      "ลิ่มกัว/ดีมาก",
      "ตี้อ๋วง/ดีมาก",
      "เชี่ยงแซ/ดี",
      "เจ๊าะ/เสียมาก",
      "ซี่/เสียมาก",
    ]);
    // ราศีบน ต้องผ่านกิ่งอ้างอิงก่อน — ดิถี 甲 × ก้าน 甲 (เสาวัน) = 长生 เพราะ 甲 เกิดที่ 亥 และ 甲@亥=长生
    const dayUpper = rows.find((r) => r.position === "หลักวัน" && r.place === "ราศีบน")!;
    expect(dayUpper.read.labelTh).toBe("เชี่ยงแซ");
    // และต้องไม่ใช่ค่าเดียวกับราศีล่างเสมอไป (ถ้าเท่ากันหมด แปลว่าคำนวณผิดเป็นตัวเดียวกัน)
    const upper = rows.filter((r) => r.place === "ราศีบน").map((r) => r.read.labelTh);
    const lower = rows.filter((r) => r.place === "ราศีล่าง").map((r) => r.read.labelTh);
    expect(upper).not.toEqual(lower);
    const text = formatXiangshaBoard(rows);
    // คะแนนดิบเป็นค่าหลังบ้าน — โมเดลเคยเผลอพูดตัวเลขออกไปให้ผู้ใช้เห็น (ดู dithiLine)
    for (const score of [110, 100, 90, 80, 10, 0]) {
      expect(text, `ข้อความไม่ควรมีคะแนนดิบ ${score}`).not.toContain(String(score));
    }
    // ห้ามมีตัวอักษรจีน — stripInternalJargon ที่ chat route ลบ CJK ทิ้ง ข้อมูลจะหายกลางทาง
    expect(text, `ข้อความมีตัวอักษรจีนหลุดไป: ${text}`).not.toMatch(/[㐀-䶿一-鿿]/);
    // ต้องแปลงเป็นชื่อไทยแทน — กิ่งเป็นนักษัตร (寅=ขาล 午=มะเมีย) ก้านเป็นธาตุ
    expect(text).toContain("ราศีล่าง ขาล");
    expect(text).toContain("ราศีล่าง มะเมีย");
    expect(text).toMatch(/ราศีบน ธาตุ/);
  });

  // ซินแสตัดสินแล้วว่าเกณฑ์ 5 ระดับนี้ใช้กับ "แชท" เท่านั้น หน้าอ่านดวง 15 บท ใช้ของเดิมต่อ
  // เทสนี้กันคนมารวม 2 เกณฑ์เข้าด้วยกันภายหลัง ซึ่งจะเปลี่ยนคำอ่าน 15 บทของผู้ใช้ทุกคนแบบเงียบ ๆ
  // ตรวจที่ source เพราะ classifyQiTier / RISING_QI / FALLING_QI เป็น private (ไม่ export)
  test("กันการรวมเกณฑ์: หน้าอ่านดวงต้องยังจัดกลุ่มสภาวะแบบเดิม", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/bazi/topic-knowledge.ts"), "utf8");
    const setOf = (name: string): string[] => {
      const m = new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]`).exec(src);
      // ถ้าหาไม่เจอ = มีการ refactor ชื่อ/รูปแบบ → ให้เทสพัง เพื่อบังคับให้กลับมาทบทวนข้อตกลงนี้
      expect(m, `หา ${name} ใน topic-knowledge.ts ไม่เจอ — ถ้า refactor ให้อัปเดตเทสนี้พร้อมทบทวนว่าเกณฑ์ 2 ชุดยังต้องแยกกันอยู่`).not.toBeNull();
      return [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    };
    const rising = setOf("RISING_QI");
    const falling = setOf("FALLING_QI");
    for (const d of DIVERGENCE_FROM_READING_TIERS) {
      const actual = rising.includes(d.stage) ? "RISING_QI" : falling.includes(d.stage) ? "FALLING_QI" : "transitional";
      expect(
        actual,
        `"${d.stage}" ในหน้าอ่านดวงย้ายกลุ่มจาก ${d.readingSet} → ${actual}. ` +
          `ซินแสสั่งให้เกณฑ์ 5 ระดับใช้กับแชทเท่านั้น — ถ้าจะรวมเกณฑ์ต้องถามซินแสก่อน`,
      ).toBe(d.readingSet);
    }
  });

  test("กิ่งที่ไม่รู้จัก → null (degrade ไม่ throw)", () => {
    expect(readXiangsha("甲", "?")).toBeNull();
    expect(readXiangsha("?", "子")).toBeNull();
  });
});
