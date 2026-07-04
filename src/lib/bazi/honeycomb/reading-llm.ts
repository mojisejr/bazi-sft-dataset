/**
 * LLM "เรียบเรียงคำอ่าน" สำหรับเบอร์รังผึ้ง — เอาคู่เลขรายชั้น (ความหมายดิบจากตำรา)
 * มาเรียบเรียงเป็นคำอ่านลื่น ๆ ตามหลักการของซินแสนุ้ย โดย **ห้ามแต่งข้อเท็จจริงใหม่**
 * — ตีความจากความหมายคู่เลขที่ให้มาเท่านั้น.
 *
 * reuse provider plumbing เดียวกับ /reading ผ่าน generateProseLlm()
 * server-only (ใช้ใน route).
 */
import type { HoneycombReading } from "@/lib/bazi/honeycomb/pyramid";
import { generateProseLlm, type ReadingLlmProvider } from "@/lib/bazi/reading-llm";

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
  // ส่งเฉพาะชั้นที่ใช้อ่านหลัก (1-6) ให้ครบ พร้อมความหมายคู่เลข
  const lines = reading.layers
    .filter((layer) => layer.layerNo <= 6)
    .map((layer) => {
      const head = `[ชั้น ${layer.layerNo} • ${layer.digitString}]`;
      if (layer.pairs.length === 0 && layer.digitMeaning) {
        return `${head} เลขเดี่ยว ${layer.digitMeaning.digit} — ${layer.digitMeaning.keyword} (${layer.digitMeaning.planet} ธาตุ${layer.digitMeaning.element})`;
      }
      const pairText = layer.pairs
        .map((p) => `คู่ ${p.pair}: ${p.meaning.feeling || p.meaning.analysis || "-"}`)
        .join("\n");
      return `${head}\n${pairText}`;
    });

  return [
    "ปิรามิดของเบอร์นี้ (ไล่จากยอด ชั้น1 ขึ้นไป) — อ่านตามหลักการ ชั้น3 → ชั้น2 → ชั้น4 → ชั้น1 แล้วปิดด้วยคนแวดล้อม ชั้น5-6:",
    "",
    lines.join("\n\n"),
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
