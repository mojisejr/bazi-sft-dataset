/**
 * ตาข่ายกันภาพหาย/DB พัง (REFRAME-3) — guard 1 (target assert) + guard 2 (image_url digest)
 */
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  assertProdTargets,
  checkProdTargets,
  imageUrlColumnDigest,
  REQUIRED_BUCKET,
  REQUIRED_PROJECT_REF,
} from "../src/lib/bazi/mascot/mascot-v2-guards";

const PROD_URL = `https://${REQUIRED_PROJECT_REF}.supabase.co`;
const DEV_URL = "https://wvcsrsjnkxikngnlwfwn.supabase.co";

describe("ตาข่าย 1 — assertProdTargets", () => {
  it("ผ่านเมื่อ bucket=mootech-v2 + URL ชี้ prod", () => {
    expect(() => assertProdTargets(REQUIRED_BUCKET, PROD_URL)).not.toThrow();
    expect(checkProdTargets(REQUIRED_BUCKET, PROD_URL)).toEqual({ ok: true });
  });

  it("throw เมื่อ bucket เป็น default mascot-60 (กันเผลอ)", () => {
    expect(() => assertProdTargets("mascot-60", PROD_URL)).toThrow(/bucket ต้องเป็น/);
  });

  it("throw เมื่อ bucket เป็น mootech (ระบบอื่น)", () => {
    expect(() => assertProdTargets("mootech", PROD_URL)).toThrow(/bucket/);
  });

  it("throw เมื่อ bucket ว่าง", () => {
    expect(() => assertProdTargets("", PROD_URL)).toThrow(/bucket/);
  });

  it("throw เมื่อ URL ชี้โปรเจกต์ dev (ยิงผิดโปรเจกต์)", () => {
    expect(() => assertProdTargets(REQUIRED_BUCKET, DEV_URL)).toThrow(/prod|โปรเจกต์/);
    expect(checkProdTargets(REQUIRED_BUCKET, DEV_URL).ok).toBe(false);
  });

  it("throw เมื่อ URL ว่าง/undefined", () => {
    expect(() => assertProdTargets(REQUIRED_BUCKET, "")).toThrow();
    expect(() => assertProdTargets(REQUIRED_BUCKET, undefined)).toThrow();
  });
});

describe("ตาข่าย 2 — imageUrlColumnDigest", () => {
  const rows = [
    { ganzhi: "甲子", imageUrl: "https://x/a.png" },
    { ganzhi: "乙丑", imageUrl: "https://x/b.png" },
    { ganzhi: "丙寅", imageUrl: "https://x/c.png" },
  ];

  it("recipe = md5(image_url เรียงตาม ganzhi codepoint คั่น \\n) — reproducible", () => {
    // ganzhi codepoint order: 丙(4E19) < 甲(7532) < 乙(4E59)? — คำนวณตรงจาก sort เดียวกัน
    const sorted = [...rows].sort((a, b) => (a.ganzhi < b.ganzhi ? -1 : a.ganzhi > b.ganzhi ? 1 : 0));
    const expected = createHash("md5").update(sorted.map((r) => r.imageUrl).join("\n")).digest("hex");
    expect(imageUrlColumnDigest(rows)).toBe(expected);
  });

  it("ไม่ขึ้นกับลำดับ input (เรียงภายในก่อน hash)", () => {
    const shuffled = [rows[2], rows[0], rows[1]];
    expect(imageUrlColumnDigest(shuffled)).toBe(imageUrlColumnDigest(rows));
  });

  it("เปลี่ยน image_url แม้แถวเดียว → digest เปลี่ยน (จับ DB พัง)", () => {
    const mutated = rows.map((r, i) => (i === 1 ? { ...r, imageUrl: "https://x/CHANGED.png" } : r));
    expect(imageUrlColumnDigest(mutated)).not.toBe(imageUrlColumnDigest(rows));
  });

  it("null image_url → treat เป็น '' (ไม่ crash)", () => {
    expect(() => imageUrlColumnDigest([{ ganzhi: "甲子", imageUrl: null }])).not.toThrow();
  });
});
