import { describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { buildTopicHumanReading, findKheangkhungReference } from "@/lib/bazi/topic-knowledge";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

// เคส M.docx (ai gen + ซินแซแก้): 1993-11-24 15:09 ชาย — ดิถี 己 อ่อน, ผัง 癸酉 癸亥 己酉 壬申
const M_INPUT = {
  birthDate: "1993-11-24", birthTime: "15:09", gender: "male" as const,
  province: "Bangkok", calendarSystem: "solar" as const, timezone: "Asia/Bangkok" as const,
};

async function readM() {
  const raw = RawInputSchema.parse(M_INPUT);
  const result = await calculateBaziChart(raw, createTestKnowledgeRepository());
  return { raw, result };
}

describe("source integration — ซินแซ corrections from ai gen M.docx", () => {
  test("บท15 องค์เทพ: นำด้วยเทพเฉพาะดวง (Source7 §5) จากตัวอักษรที่ขึ้นเชี่ยงแซดี + คงเทพตามธาตุ", async () => {
    const { raw, result } = await readM();
    const deities = buildTopicHumanReading(result, "guardian_deities", raw)!;
    // custom deity = เลือกธาตุปรับดวง (己 อ่อน → คู่ธาตุ=ดิน + ส่งเสริม=ไฟ) แล้วคัดตัวอักษรเชี่ยงแซดี
    expect(deities).toContain("สิ่งศักดิ์สิทธิ์เฉพาะดวง");
    expect(deities).toContain("พระแม่ธรณี"); // 己 (คู่ธาตุ) ราศีบน
    expect(deities).toContain("เทพสุริยัน ท้าววิรุฬหก"); // 丙 (ส่งเสริม) ราศีบน + องศา
    expect(deities).toContain("องศา 165°");
    // ไม่ดึงธาตุที่ไม่ใช่ธาตุปรับดวง (申/酉 = ทอง → ไม่เอาเจ้าพ่อเห้งเจีย/พระสังกัจจายน์)
    expect(deities).not.toContain("เจ้าพ่อเห้งเจีย");
    // คงบล็อกตามธาตุ (useful god) ไว้
    expect(deities).toContain("สิ่งศักดิ์สิทธิ์ตามธาตุที่ดวงต้องการ");
    expect(deities).toContain("เจ้าพ่อพระเพลิง");
  });

  test("บท14 สี: สีกระเป๋า/รถ มาจากตาราง Source7 §3.1/§3.2 (ดิถี×ราศีบนเดือน/ยาม)", async () => {
    const { result } = await readM();
    const colors = buildTopicHumanReading(result, "colors_directions")!;
    expect(colors).toContain("สีมงคล");
    expect(colors).toContain("ราศีบนหลักเดือน 癸");
    expect(colors).toContain("ราศีบนหลักยาม 壬");
  });

  test("บท7 ความรัก: มีคำทำนายคู่ครองจากตารางหลักวัน (xlsx) + คง marker เพศ", async () => {
    const { raw, result } = await readM();
    const love = buildTopicHumanReading(result, "love_partner", raw)!;
    // 己酉 → เชี่ยงแซ → คู่ครองส่งเสริมให้เจริญรุ่งเรือง
    expect(love).toContain("ตารางหลักวัน 己酉");
    expect(love).toContain("คู่ครองส่งเสริมให้มีความเจริญรุ่งเรือง");
    // ไม่มี gender → null
    expect(buildTopicHumanReading(result, "love_partner")).toBeNull();
  });

  test("บท2 อาชีพ: Target/Market อ่านจาก 12 เชี่ยงแซเสาปี (癸酉 → แป่)", async () => {
    const { raw, result } = await readM();
    const career = buildTopicHumanReading(result, "career_potential", raw)!;
    expect(career).toContain("Target/Market");
    expect(career).toContain("เชี่ยงแซเสาปี 癸酉 → แป่");
    expect(career).toContain("อาชีพธาตุ"); // marker เดิมคงอยู่
  });

  test("บท3 โชคลาภ: อ่านดาวลาภหลายตำแหน่งตาม 12 เชี่ยงแซ", async () => {
    const { raw, result } = await readM();
    const wealth = buildTopicHumanReading(result, "wealth_and_investment", raw)!;
    expect(wealth).toContain("โชคลาภปรากฏหลายทาง");
    // อ่าน 2 เซียงแซต่อตำแหน่ง: ตัวแรก (เทียบดิถี ~80%) + ตัวขยาย self-seat (~20%)
    // ราศีบน 癸 × กิ่งวัน 酉 → แป่ ; ราศีล่าง 亥 × ก้านวัน 己 → ทอ ; self-seat 癸亥 = ตี้อ๋วง
    expect(wealth).toContain("ราศีบน 癸 → แป่");
    expect(wealth).toContain("ราศีล่าง 亥 → ทอ");
    expect(wealth).toContain("ตี้อ๋วง");
  });

  test("บท8 เพื่อน/ศัตรู: สแกน 7 ตำแหน่งตาม 12 เชี่ยงแซ ทายตามความหมายของเสา", async () => {
    const { result } = await readM();
    const friends = buildTopicHumanReading(result, "friends_foes")!;
    expect(friends).toContain("เพื่อน");
    // ราศีล่างวัน 酉 (เชี่ยงแซ) = มิตรแท้
    expect(friends).toContain("เสาวัน 酉");
    expect(friends).toContain("มิตรแท้");
  });

  test("บท9 หุ้นส่วน: นำด้วยราศีล่างวัน × 12 เชี่ยงแซ (มีได้/ไม่ได้)", async () => {
    const { result } = await readM();
    const partnership = buildTopicHumanReading(result, "partnership")!;
    expect(partnership).toContain("ราศีล่างหลักวัน 酉");
    expect(partnership).toContain("ธุรกิจ"); // marker เดิม
  });

  test("บท10 บริวาร: หมกยกที่เสายาม = ต้องขัดเกลา (ตามซินแซ) ไม่ใช่มีคุณภาพ", async () => {
    const { result } = await readM();
    const subordinates = buildTopicHumanReading(result, "subordinates")!;
    expect(subordinates).toContain("บริวาร");
    expect(subordinates).toContain("ขัดเกลา");
    expect(subordinates).not.toContain("มีคุณภาพ");
  });

  test("บท12 วัยจร: อ่านสั้น — ช่วงวัยจร (บทบาทธาตุ + 12 เซียงแซ) ไม่มีบล็อก 8 ตัว/พยากรณ์รายปี", async () => {
    const { raw, result } = await readM();
    const turning = buildTopicHumanReading(result, "turning_points", raw)!;
    // ตามคำกำชับให้ "อ่านสั้น" — คงเฉพาะวิเคราะห์จังหวะชีวิตช่วงวัยจร
    expect(turning).toContain("วิเคราะห์จังหวะชีวิต");
    // ตัดบล็อกยาวออก (บทเสริม 8 ตัว + พยากรณ์รายปี 20 ปี)
    expect(turning).not.toContain("เทียบทีละตัวอักษรในผัง");
    expect(turning).not.toContain("พยากรณ์ปีจร");
  });

  test("ตำราเคี้ยงคุง: ค้น reference เป็น fallback ได้ (วัยจร)", () => {
    const excerpt = findKheangkhungReference(["วัยจร"], 2);
    expect(excerpt).not.toBeNull();
    expect(excerpt).toContain("วัยจร");
    // หัวข้อที่ไม่รู้จัก → ไม่มีคำค้น → null
    expect(findKheangkhungReference([])).toBeNull();
  });
});
