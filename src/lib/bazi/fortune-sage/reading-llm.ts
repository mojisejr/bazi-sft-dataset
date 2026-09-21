/**
 * LLM "เกลาคำ" สำหรับเซียมซีเสี่ยงทาย (fortune-sage) — ตอบ "คำถามของผู้ถาม" ตรง ๆ ในฐานะซินแส
 * โดยตีความจากเนื้อหัวเซี่ยงแซที่จั่วได้ (นิสัย + คำทำนายรายด้าน) ให้เข้ากับคำถาม
 * **ห้ามแต่งข้อเท็จจริงใหม่นอกเหนือจากเนื้อเซี่ยงแซ** — แค่ตีความ/เรียบเรียงให้ตรงคำถาม
 *
 * คืน 1 ย่อหน้า (แสดงเป็น section "คำตอบสำหรับคำถามของคุณ" บนสุดของผล) — 6 section เดิมของใบยังคงไว้
 * reuse provider plumbing เดียวกับ oracle ผ่าน generateProseLlm() · server-only (ใช้ใน route)
 */
import type { FortuneStick, TopicKey } from "@/lib/bazi/fortune-sage/deck";
import { generateProseLlm, type ReadingLlmProvider } from "@/lib/bazi/reading-llm";
import { stripGenderedEnding } from "@/lib/bazi/oracle-cards/reading-llm";
import { aspect15Lines } from "@/lib/bazi/aspect15";

const TOPIC_LABELS: Record<TopicKey, string> = {
  career: "การงาน",
  finance: "การเงิน",
  health: "สุขภาพ",
  love: "ความรัก",
  family: "ครอบครัว",
};

const SYSTEM_INSTRUCTION = [
  "คุณคือ \"ซินแส\" ตัวจริงที่กำลังเสี่ยงเซียมซีให้คนตรงหน้า — พูดด้วยน้ำเสียงคนจริง อบอุ่น มั่นใจ",
  "ผู้ถามได้หัวเซี่ยงแซมา 1 หัว (มีคำอธิบายนิสัย + คำทำนายรายด้าน). งานของคุณคือ \"ตอบคำถามของผู้ถาม\" ตรง ๆ",
  "โดยตีความเนื้อหัวเซี่ยงแซให้เข้ากับคำถาม แล้วฟันธงเป็นคำแนะนำ/แนวโน้มที่ชัดเจน",
  "",
  "ตรงประเด็น (สำคัญที่สุด — เอ็ม/ซินแส 2026-09-21):",
  "- **ประโยคแรกต้องฟันธงตอบคำถามตรง ๆ ก่อนเลย** (เช่น ถามเงินก้อน→\"ช่วงนี้ยังไม่ใช่จังหวะเงินก้อน...\") — ห้ามเปิดด้วยการบรรยาย/คำเปรียบเปรยก่อน (เช่น \"ดวงชะตาเปรียบดั่ง...\")",
  "- ดึงคำทำนายรายด้านที่ตรงคำถามมาเป็นแกน (ถามเงิน→การเงิน, งาน→การงาน, รัก→ความรัก) ตอบให้ตรงเรื่องที่ถาม ไม่พูดรวม ๆ",
  "- ถามสิ่งที่ชี้เป๊ะไม่ได้ (เลขหวย/ตัวเลข/วันเวลา) → ห้ามให้ตัวเลข แต่ฟันธงจังหวะโชค/แนวโน้มให้ชัด ไม่เลี่ยงด้วยการเทศนา",
  "",
  "กฎ (ห้ามผิด):",
  "- ยึดเนื้อหัวเซี่ยงแซเป็นฐาน ห้ามแต่งข้อเท็จจริง/ตัวเลข/วันเวลา/เหตุการณ์เฉพาะที่เซี่ยงแซไม่ได้บอก",
  "- สั้น กระชับ 2-4 ประโยค (ราว 60-100 คำ) ฟันธง ทักตรงใจ ไม่สั่งสอนศีลธรรม ไม่ปิดแบบกำปั้นทุบดิน",
  "- ห้ามเอ่ยกลไกเบื้องหลัง (engine/เลขหัว/%). คำลงท้ายเป็นกลาง ไม่ลงท้าย \"ครับ\"/\"ค่ะ\"",
  "",
  "ตอบเป็นคำทำนายร้อยแก้วย่อหน้าเดียว ไม่ต้องมีหัวข้อ ไม่ต้องมี JSON",
].join("\n");

function buildUserPrompt(stick: FortuneStick, question: string): string {
  // ใช้คลัง 15 ด้าน (รวม 5 ด้านจริงไว้แล้ว) ถ้ามี; ถ้ายังว่าง fallback 5 ด้านจากแหล่งเดิม
  const aspectBlock = aspect15Lines(stick.aspects);
  const topicLines = aspectBlock
    ? aspectBlock
    : (() => {
        const lines = (Object.keys(TOPIC_LABELS) as TopicKey[])
          .map((k) => {
            const v = stick.topics[k]?.trim();
            return v ? `${TOPIC_LABELS[k]}: ${v}` : null;
          })
          .filter((l): l is string => l !== null)
          .join("\n");
        return lines ? `คำทำนายรายด้าน:\n${lines}` : "";
      })();
  return [
    `คำถามจากผู้ถาม: ${question}`,
    "ตอบคำถามนี้ในฐานะซินแส โดยตีความเนื้อเซี่ยงแซด้านล่างให้เข้ากับคำถาม:",
    "",
    `หัวเซี่ยงแซที่จั่วได้: ${stick.pillar} · ${stick.nayin} · องค์เทพ ${stick.deity}`,
    `นิสัย/ภาพรวม: ${stick.personality?.trim() ?? ""}`,
    topicLines,
  ].filter(Boolean).join("\n");
}

export type SageLlmResult = { text: string; model: string };

export async function polishSageReading(
  input: {
    stick: FortuneStick;
    question: string;
    apiKey?: string;
    model?: string;
    provider?: ReadingLlmProvider;
  },
  deps: Parameters<typeof generateProseLlm>[1] = {},
): Promise<SageLlmResult> {
  const result = await generateProseLlm(
    {
      systemInstruction: SYSTEM_INSTRUCTION,
      userPrompt: buildUserPrompt(input.stick, input.question),
      apiKey: input.apiKey,
      model: input.model,
      provider: input.provider ?? "gemini",
      temperature: 0.3,
      usageFeature: "fortune_sage",
      usageLabel: input.question.slice(0, 200),
    },
    deps,
  );
  return { ...result, text: stripGenderedEnding(result.text) };
}
