/**
 * mascot v2 — เทสตัวแปลง ganzhi → ชื่อไฟล์ไทย (ก้อน 3A / D50)
 *
 * ยืนยัน: ครบ 60 · ไม่ซ้ำ · ตรงกับ "ไฟล์จริง"
 *  - reference อิสระ: grid 12 นักษัตร × 5 ธาตุ (ถอดจากรายชื่อไฟล์จริงด้วยตา ไม่ใช่จาก map
 *    ตัวเดียวกับที่ฟังก์ชันใช้ → ไม่ circular)
 *  - live cross-check: ถ้าโฟลเดอร์ไฟล์จริง (mootech-fe/public/images/v2/characters) เข้าถึงได้
 *    เทียบ set ตรงตัว; ถ้าไม่มี = เตือนดังๆ (ไม่ skip เงียบ)
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { MASCOT_60 } from "../src/lib/bazi/mascot/mascot-60";
import {
  buildMascotV2Table,
  ganzhiToV2Filename,
  ganzhiToV2StorageKey,
} from "../src/lib/bazi/mascot/mascot-v2";

// ── reference อิสระ: 12 นักษัตรเรียงลำดับ × 5 ธาตุ (ถอดจากรายชื่อไฟล์จริงในโฟลเดอร์ v2) ──
const NAKKASAT_ORDER = [
  "ชวด", "ฉลู", "ขาล", "เถาะ", "มะโรง", "มะเส็ง",
  "มะเมีย", "มะแม", "วอก", "ระกา", "จอ", "กุน",
] as const;
const ELEMENTS = ["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"] as const;

function expectedGrid(): Set<string> {
  const out = new Set<string>();
  NAKKASAT_ORDER.forEach((nak, i) => {
    const nn = String(i + 1).padStart(2, "0");
    for (const el of ELEMENTS) out.add(`${nn}_${nak}-${el}`);
  });
  return out; // 12 × 5 = 60
}

/** โฟลเดอร์ไฟล์จริง (repo พี่น้อง) — override ได้ด้วย MASCOT_V2_DIR */
function realDir(): string {
  return (
    process.env.MASCOT_V2_DIR?.trim() ||
    path.resolve(process.cwd(), "../mootech-fe/public/images/v2/characters")
  );
}

describe("ganzhiToV2Filename", () => {
  it("ตัวอย่างในแผน FROZEN: 甲子 → 01_ชวด-ไม้ (ธาตุจากก้าน ไม่ใช่กิ่ง)", () => {
    expect(ganzhiToV2Filename("甲子")).toBe("01_ชวด-ไม้");
  });

  it("กิ่งกำหนดนักษัตร+ลำดับ, ก้านกำหนดธาตุ", () => {
    expect(ganzhiToV2Filename("乙丑")).toBe("02_ฉลู-ไม้"); // 乙=ไม้, 丑=ฉลู(02)
    expect(ganzhiToV2Filename("庚午")).toBe("07_มะเมีย-ทอง"); // 庚=ทอง(metal), 午=มะเมีย(07)
    expect(ganzhiToV2Filename("癸亥")).toBe("12_กุน-น้ำ"); // 癸=น้ำ, 亥=กุน(12)
  });

  it("โยน error เมื่อ ganzhi ไม่ถูกต้อง (ครบ 60 หรือล้ม — ห้าม skip เงียบ)", () => {
    expect(() => ganzhiToV2Filename("")).toThrow();
    expect(() => ganzhiToV2Filename("甲")).toThrow(); // ก้านเดี่ยว
    expect(() => ganzhiToV2Filename("甲子丑")).toThrow(); // เกิน 2
    expect(() => ganzhiToV2Filename("XY")).toThrow(); // ก้าน/กิ่งไม่รู้จัก
  });
});

describe("buildMascotV2Table — ครบ 60 · ไม่ซ้ำ · ตรงไฟล์จริง", () => {
  const table = buildMascotV2Table();
  const filenames = table.map((e) => e.filename);

  it("ได้ครบ 60 แถว (= จำนวน ganzhi ใน MASCOT_60)", () => {
    expect(MASCOT_60.length).toBe(60);
    expect(table).toHaveLength(60);
  });

  it("ชื่อไฟล์ไม่ซ้ำ ครบ 60 ไม่ซ้ำ", () => {
    expect(new Set(filenames).size).toBe(60);
  });

  it("ทุกชื่อตรงรูปแบบ NN_นักษัตร-ธาตุ", () => {
    const re = /^(0[1-9]|1[0-2])_[^-]+-(ไม้|ไฟ|ดิน|ทอง|น้ำ)$/u;
    for (const f of filenames) expect(f, f).toMatch(re);
  });

  it("set ตรงกับ reference grid 12×5 (อิสระจาก map ที่ฟังก์ชันใช้)", () => {
    expect(new Set(filenames)).toEqual(expectedGrid());
  });

  it("storageKey เป็น ascii ล้วน ไม่ซ้ำ ครบ 60 (คีย์ Supabase ปลอดภัย)", () => {
    const keys = table.map((e) => e.storageKey);
    expect(new Set(keys).size).toBe(60);
    for (const k of keys) expect(k, k).toMatch(/^(0[1-9]|1[0-2])_(wood|fire|earth|metal|water)$/);
    expect(ganzhiToV2StorageKey("甲子")).toBe("01_wood");
    expect(ganzhiToV2StorageKey("癸亥")).toBe("12_water");
  });

  it("cross-check ไฟล์จริงในดิสก์ (เตือนดังๆ ถ้าโฟลเดอร์ไม่พร้อม — ไม่ skip เงียบ)", () => {
    const dir = realDir();
    if (!existsSync(dir)) {
      console.warn(
        `⚠️ mascot-v2 live cross-check ข้าม: ไม่พบโฟลเดอร์ไฟล์จริง ${dir} ` +
          `(ตั้ง MASCOT_V2_DIR เพื่อบังคับ). reference grid ยังคุ้ม 60 ชื่อไว้แล้ว.`,
      );
      return;
    }
    const onDisk = new Set(
      readdirSync(dir)
        .filter((f) => f.endsWith(".png"))
        .map((f) => f.replace(/\.png$/u, "")),
    );
    expect(new Set(filenames)).toEqual(onDisk);
  });
});
