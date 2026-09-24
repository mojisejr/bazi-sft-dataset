/**
 * LLM "เรียบเรียงคำอ่าน" สำหรับเบอร์รังผึ้ง — เอาคู่เลขรายชั้น (ความหมายดิบจากตำรา)
 * มาเรียบเรียงเป็นคำอ่านลื่น ๆ ตามหลักการของซินแสนุ้ย โดย **ห้ามแต่งข้อเท็จจริงใหม่**
 * — ตีความจากความหมายคู่เลขที่ให้มาเท่านั้น.
 *
 * reuse provider plumbing เดียวกับ /reading ผ่าน generateProseLlm()
 * server-only (ใช้ใน route).
 */
import type { HoneycombReading } from "@/lib/bazi/honeycomb/pyramid";
import { detectLuckyCombos } from "@/lib/bazi/honeycomb/pyramid";
import { generateProseLlm, type ReadingLlmProvider } from "@/lib/bazi/reading-llm";
import digitJson from "@/lib/bazi/data/phone/phone-digit-meanings.json";

const DIGIT_KW = digitJson as Record<string, { keyword: string }>;

/** คีย์เวิร์ดของเลขทุกตัวในกลุ่ม (ช่วยให้ LLM อ่าน "ทั้งกลุ่ม" เป็นเรื่องเดียว) */
function groupKeywords(digitString: string): string {
  const uniq = Array.from(new Set(digitString.split("")));
  return uniq.map((d) => `${d}=${DIGIT_KW[d]?.keyword ?? "-"}`).join(", ");
}

type GeminiGenerate = (request: {
  model: string;
  contents: string;
  config: { systemInstruction: string; temperature?: number };
}) => Promise<{ text?: string | null }>;

const SYSTEM_INSTRUCTION = [
  'คุณคือ "ซินแส" ตัวจริงที่กำลังนั่งอ่าน "เบอร์ปิรามิด/เบอร์รังผึ้ง" ให้คนตรงหน้า — พูดด้วยน้ำเสียงคนจริง อบอุ่น มั่นใจ เหมือนเล่าให้ฟัง ไม่ใช่ AI สรุปข้อมูล',
  "",
  "หลักการอ่านปิรามิด (ลำดับสำคัญที่สุด — อ่านตามนี้ให้ต่อเนื่องเป็นเรื่องเดียว ห้ามใส่หัวข้อ/เลขชั้นลงในคำตอบ):",
  '- ชั้น 1-4 = "ตัวเรา" (เจ้าของพลังงาน), ชั้น 5-6 = สิ่งแวดล้อมใกล้ตัว (ญาติ เพื่อน เจ้านาย ลูกน้อง ลูกค้า), ชั้น 7-11 = สิ่งแวดล้อมที่ห่างออกไป',
  "- เริ่มที่ ชั้น3 ก่อน (ชั้นคุมพลังงานทั้งหมด) ว่าพลังงานเหมาะกับใคร เกี่ยวข้องงานด้านไหน",
  "- ต่อด้วย ชั้น2 (พลังงานแฝง อ่านต่อเนื่องจากชั้น3) ว่าสัมพันธ์กับชั้น3 อย่างไร",
  "- แล้วดู ชั้น4 ประกอบ ว่าส่งเสริมชั้น3 และชั้น2 อย่างไร",
  "- ปิดด้วย ชั้น1 (ยอดปิรามิด) บอกลักษณะ/อุปนิสัยหลักของเจ้าของพลังงาน",
  "- จากนั้นสรุปสั้น ๆ เรื่องคนแวดล้อม (ชั้น5-6) ว่าเป็นอย่างไร",
  "",
  "วิธีอ่านแบบซินแส (สำคัญ — ทำให้คำอ่านมีชีวิตแบบตัวจริง):",
  '- อ่าน "ทั้งกลุ่มเลขในชั้น" เป็นภาพเดียว/เรื่องเล่าเดียว โดยสังเคราะห์จากนัยของเลขแต่ละตัวมารวมกัน (ไม่ใช่หยิบคู่เลขมาวางเรียงทีละคู่)',
  '- แถวฐานกว้าง (ชั้น 7-11) อ่านเป็น "คนรอบข้าง/สิ่งแวดล้อม" ว่าจะเจอคนแบบไหน (เช่น คนพูดเก่งค้าขาย พรรคพวกบารมี เจ้าของกิจการ) สั้น ๆ มีชีวิต',
  '- ถ้ามี "เลขมงคลสายจีน" (ระบบจะบอกให้) ให้ทักเป็นจุดเด่น เช่น 168 = หนึ่งทางรวย มงคลสายจีน — วางแผนชีวิตมีระบบ มุ่งหาเงิน',
  "",
  'ตัวอย่างสำนวนการทายของซินแส (เลียนโทน/จังหวะ ไม่ใช่ลอกเนื้อ — เบอร์คนละเบอร์ความหมายย่อมต่าง):',
  '  "861/168 = หนึ่งทางรวย มงคลสายจีน คือการวางแผนใช้ชีวิตอย่างมีระบบ มุ่งมั่นหาเงิน · 9156 = โดดเด่น ชื่อเสียงดี มีไมตรี ผู้ใหญ่เมตตา บั้นปลายสุขกายสบายใจ · 949347 = จะเจอคนแคล่วคล่องว่องไวเรื่องติดต่อประสานงาน เทคโนโลยี พูดตรงจริงใจไม่มีพิษภัย · 8719 = พรรคพวกบารมี เงินก้อนใหญ่ โดดเด่นสง่างาม มีไฟมีพลังชีวิตรุ่งโรจน์ · 681 = คนที่มีกิจการค้าสุดยอด สุดยอดแห่งความร่ำรวย · 59/5 = จิตใจเข้มแข็ง เป็นธรรม ไม่เอาเปรียบใคร มีอสังหาฯมากในอนาคต"',
  "",
  "ความยาว: กระชับ ได้ใจความ รวมราว 5-8 ประโยค (120-200 คำ) พูดตรงประเด็น อย่าน้ำเยอะ",
  "",
  "กฎเหล็ก (ห้ามผิด):",
  "- ตีความได้ แต่ห้ามแต่งข้อเท็จจริงใหม่ที่ไม่มีเค้าในความหมายคู่เลขที่ให้มา (ห้ามเพิ่มตัวเลข วันเวลา เหตุการณ์เฉพาะ)",
  '- ห้ามเอ่ยถึง "engine" "คู่เลข canonical" "เลขชั้น" หรือกลไกเบื้องหลัง — พูดเป็นคำอ่านลื่น ๆ เหมือนซินแสคุยกับคน',
  '- คำลงท้ายเป็นกลาง ไม่ลงท้าย "ครับ"/"ค่ะ"',
  "",
  "ตอบเป็นคำอ่านร้อยแก้วที่ไหลต่อเนื่อง ไม่ต้องมีหัวข้อ ไม่ต้องมี JSON",
].join("\n");

function buildUserPrompt(reading: HoneycombReading): string {
  // ส่งชั้นหลัก (1-6 = ตัวเรา+ใกล้ตัว) แบบละเอียด: กลุ่มเลข + คีย์เวิร์ดรายตัว + คู่เลขประกอบ
  const coreLines = reading.layers
    .filter((layer) => layer.layerNo <= 6)
    .map((layer) => {
      const head = `[ชั้น ${layer.layerNo} • กลุ่มเลข ${layer.digitString}] นัยเลข: ${groupKeywords(layer.digitString)}`;
      if (layer.pairs.length === 0 && layer.digitMeaning) {
        return `${head}\nเลขเดี่ยว ${layer.digitMeaning.digit} — ${layer.digitMeaning.keyword} (${layer.digitMeaning.planet} ธาตุ${layer.digitMeaning.element})`;
      }
      const pairText = layer.pairs
        .map((p) => `  คู่ ${p.pair}: ${p.meaning.feeling || p.meaning.analysis || "-"}`)
        .join("\n");
      return `${head}\n${pairText}`;
    });

  // แถวฐานกว้าง (ชั้น 7-11 = คนรอบข้าง/สิ่งแวดล้อม) — ส่งเป็นกลุ่มเลข + นัยรวม (ไม่ต้องคู่เลข)
  const envLines = reading.layers
    .filter((layer) => layer.layerNo >= 7)
    .map((layer) => `[ชั้น ${layer.layerNo} • ${layer.digitString}] นัยเลข: ${groupKeywords(layer.digitString)}`);

  const combos = detectLuckyCombos(reading);
  const comboBlock =
    combos.length > 0
      ? [
          "",
          "เลขมงคลสายจีนที่ตรวจพบ (ทักเป็นจุดเด่นได้):",
          ...combos.map((c) => `- ${c.combo}: ${c.meaning}`),
        ].join("\n")
      : "";

  return [
    "ปิรามิดของเบอร์นี้ (ไล่จากยอด ชั้น1 ขึ้นไป) — อ่านตามหลักการ ชั้น3 → ชั้น2 → ชั้น4 → ชั้น1 แล้วปิดด้วยคนแวดล้อม ชั้น5-6 (อ่านแต่ละชั้นเป็น 'ทั้งกลุ่มเลข' เป็นเรื่องเดียว):",
    "",
    coreLines.join("\n\n"),
    "",
    "คนรอบข้าง/สิ่งแวดล้อม (แถวฐานกว้าง — สรุปสั้น ๆ ว่าจะเจอคนแบบไหน):",
    envLines.join("\n"),
    comboBlock,
  ].join("\n");
}

export type HoneycombLlmResult = { text: string; model: string };

/** ตัดคำลงท้าย ครับ/ค่ะ/คะ ท้ายประโยค (เผื่อ LLM หลุด) ให้น้ำเสียงเป็นกลาง */
export function stripGenderedEnding(text: string): string {
  return text.replace(/\s*(ครับ|ค่ะ|คะ|นะคะ|นะครับ)([."”\s]*)$/u, "$2").trimEnd();
}

export async function narrateHoneycombReading(
  input: {
    reading: HoneycombReading;
    apiKey?: string;
    model?: string;
    provider?: ReadingLlmProvider;
  },
  deps: { generateContent?: GeminiGenerate } = {},
): Promise<HoneycombLlmResult> {
  const result = await generateProseLlm(
    {
      systemInstruction: SYSTEM_INSTRUCTION,
      userPrompt: buildUserPrompt(input.reading),
      apiKey: input.apiKey,
      model: input.model,
      provider: input.provider ?? "gemini",
      temperature: 0.4,
      usageFeature: "honeycomb",
    },
    deps,
  );
  return { ...result, text: stripGenderedEnding(result.text) };
}
