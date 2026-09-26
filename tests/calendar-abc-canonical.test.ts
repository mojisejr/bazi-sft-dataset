// tests/calendar-abc-canonical.test.ts — ล็อกคะแนน/ชื่อ รหัส B (黃道) + C (建除) ให้ตรง "เงื่อนไขปฏิทิน A B C" ของซินแสนุ้ย
// (Google Doc canonical, 2026-09). กันแก้พลาดย้อน: เจอ C1=50 (ควร 60), C11=80 (ควร 90) แล้วแก้ 2026-09-26.
import { describe, expect, test } from "vitest";

import hourGodLegend from "@/lib/bazi/data/almanac/hour-god-legend.json";
import jianchuLegend from "@/lib/bazi/data/almanac/jianchu-legend.json";

const B = hourGodLegend as Record<string, { god: string; score: number }>;
const C = jianchuLegend as Record<string, { name: string; score: number | string }>;

describe("รหัส B (黃道十二神) — canonical จาก Doc ซินแส", () => {
  // B1..B12: 青龍 明堂 天刑 朱雀 金匱 天德 白虎 玉堂 天牢 玄武 司命 勾陳
  const CANON: [string, string, number][] = [
    ["B1", "แชเล้ง", 70], ["B2", "เหม่งตึ๊ง", 80], ["B3", "เทียนเฮ้ง", 20], ["B4", "จูเฉียก", 30],
    ["B5", "กิมกุ่ย", 100], ["B6", "เทียนเต็ก", 90], ["B7", "แป่โฮ่ว", 0], ["B8", "เหง็กอ๋วง", 90],
    ["B9", "เทียนล้อ", 50], ["B10", "เหี่ยงบู้", 40], ["B11", "ซีเหม็ง", 60], ["B12", "กาวทิ้ง", 10],
  ];
  test.each(CANON)("%s = %s (%d คะแนน)", (code, god, score) => {
    expect(B[code].god).toBe(god);
    expect(B[code].score).toBe(score);
  });
});

describe("รหัส C (建除十二神) — canonical จาก Doc ซินแส", () => {
  // C1..C12: 建 除 满 平 定 执 破 危 成 收 开 闭 (ตือ/ซิว/ปี่ = 30/70)
  const CANON: [string, string, number | string][] = [
    ["C1", "เกี้ยง", 60], ["C2", "ตือ", "30/70"], ["C3", "มั่ว", 80], ["C4", "เพ้ง", 50],
    ["C5", "เตีย", 80], ["C6", "จิบ", 80], ["C7", "ผั่ว", 10], ["C8", "งุ้ย", 20],
    ["C9", "เซ้ง", 100], ["C10", "ซิว", "30/70"], ["C11", "ไค", 90], ["C12", "ปี่", "30/70"],
  ];
  test.each(CANON)("%s = %s (%s คะแนน)", (code, name, score) => {
    expect(C[code].name).toBe(name);
    expect(C[code].score).toBe(score);
  });
});
