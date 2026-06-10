import JSZip from "jszip";
import { describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { buildReadingDocument, buildReadingDocxBuffer } from "@/lib/bazi/reading-docx";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

async function documentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  return zip.file("word/document.xml")!.async("string");
}

async function stateFor(birthDate: string, birthTime: string, gender: "male" | "female") {
  const repo = createTestKnowledgeRepository();
  const raw = RawInputSchema.parse({
    birthDate, birthTime, gender, province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
  });
  return { raw, state: await calculateBaziChart(raw, repo) };
}

describe("reading-docx export", () => {
  test("builds a valid .docx buffer (zip header + reasonable size)", async () => {
    const { raw, state } = await stateFor("1966-09-29", "11:44", "female");
    const buffer = await buildReadingDocxBuffer(raw, state);
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK"); // docx = zip
    expect(buffer.length).toBeGreaterThan(3000);
  });

  test("renders markdown (bold + bullets) instead of dumping raw markers", async () => {
    const { raw, state } = await stateFor("1966-09-29", "11:44", "female");
    const xml = await documentXml(await buildReadingDocxBuffer(raw, state));
    // ตัวหนา/เน้นแดง (คู่ ** ที่ปิดครบ) ต้องกลายเป็น run จริง ไม่เหลือ **...** ดิบ
    // (หมายเหตุ: ** เดี่ยวที่ไม่ปิดในข้อมูลต้นทาง PDF ก็ปล่อยเป็นตัวอักษรเช่นกัน จึงไม่เช็ก)
    expect(xml).not.toMatch(/\*\*[^*\s][^*]*\*\*/);
    expect(xml).not.toMatch(/<w:t[^>]*>\s*##/); // ## หัวข้อย่อยต้องถูกแปลง ไม่เหลือดิบ
    // บทที่ 12 (พยากรณ์ปีจร) ออกมาเป็น bullet → ต้องมี numbering reference
    expect(xml).toContain("<w:numPr>");
    // มี run ตัวหนาอย่างน้อยหนึ่งจุด
    expect(xml).toMatch(/<w:b\b/);
  });

  test("renders [[pagebreak]] override as a real page break", async () => {
    const { raw, state } = await stateFor("1966-09-29", "11:44", "female");
    const xml = await documentXml(
      await buildReadingDocxBuffer(raw, state, {
        readings: { chart_foundation: "ก่อนหน้า\n\n[[pagebreak]]\n\nหลังจาก" },
      }),
    );
    expect(xml).not.toContain("[[pagebreak]]");
    expect(xml).toMatch(/<w:br[^>]*w:type="page"/);
  });

  test("document builds without throwing for diverse charts", async () => {
    for (const c of [
      { d: "1981-03-12", t: "05:59", g: "male" as const },
      { d: "1949-06-25", t: "12:00", g: "female" as const },
      { d: "1977-11-27", t: "00:26", g: "female" as const },
    ]) {
      const { raw, state } = await stateFor(c.d, c.t, c.g);
      expect(() => buildReadingDocument(raw, state)).not.toThrow();
    }
  });
});
