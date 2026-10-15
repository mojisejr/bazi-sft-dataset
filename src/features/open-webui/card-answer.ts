/**
 * ตอบคำถามด้วยไพ่แบบ "สูตรเดียวกับแชท" สำหรับหลังบ้าน (ซินแสนุ้ย 2026-10-07: "มีแชทให้ถามได้ด้วย ใช้สูตรเดิม")
 * - persona (เสี่ยวมู่/เสี่ยวมี่) + คำเปิดทำนาย + บล็อกคำสั่งตอบ (card-blocks) เหมือนแชทหน้าบ้านทุกประการ
 * - ต่างแค่: ไม่มีหมายเหตุท้ายคำตอบ (หลังบ้านเห็นไพ่อยู่แล้ว) และรับไพ่ที่จั่ว/โชว์อยู่ → คำตอบตรงกับไพ่บนจอ
 */
import { fengshuiAnswerBlock, siamsiAnswerBlock, tarotAnswerBlock } from "@/features/open-webui/card-blocks";
import { buildMumatePersonaInstruction, pickFortuneOpener, type ChatPersona } from "@/features/open-webui/gemini-adapter";
import type { FengshuiCard } from "@/lib/bazi/fengshui/deck";
import { buildFengshuiReading } from "@/lib/bazi/fengshui/reading-engine";
import { generateProseLlm, type ReadingLlmProvider } from "@/lib/bazi/reading-llm";
import type { SiamsiCard } from "@/lib/bazi/siamsi-kiangkung/deck";
import { buildSiamsiReading } from "@/lib/bazi/siamsi-kiangkung/reading-engine";
import type { TarotCard } from "@/lib/bazi/tarot/deck";
import { tarotChatProseFor } from "@/lib/bazi/tarot/chat-reading";

type Common = { question: string; persona?: ChatPersona; apiKey?: string; model?: string; provider?: ReadingLlmProvider };

async function ask(system: string, block: string, question: string, c: Common) {
  return generateProseLlm({
    systemInstruction: system,
    userPrompt: [block, `Latest user message: ${question}`, "Respond as the assistant."].join("\n\n"),
    apiKey: c.apiKey,
    model: c.model,
    provider: c.provider ?? "gemini",
    temperature: 0.6,
  });
}

/** ฮวงจุ้ย: ตอบจากไพ่ 1 หรือ 3 ใบที่จั่วไว้ */
export function answerFengshuiChat(cards: FengshuiCard[], c: Common) {
  const reading = buildFengshuiReading(cards, c.question);
  const block = fengshuiAnswerBlock(reading.chatProse, pickFortuneOpener(), cards.length);
  return ask(buildMumatePersonaInstruction(c.persona ?? "mu"), block, c.question, c);
}

/** เซียมซีเคี้ยงคุง: ตอบคำถามชี้แนะ/ตัดสินใจจากไพ่ 1 ใบ (ไม่เอ่ยถึงไพ่) */
export function answerSiamsiChat(card: SiamsiCard, c: Common) {
  const mi = (c.persona ?? "mu") === "mi";
  const block = siamsiAnswerBlock(buildSiamsiReading(card, c.question).chatProse, pickFortuneOpener(), {
    polite: mi ? "ค่ะ" : "ครับ",
    soft: mi ? "นะคะ" : "นะครับ",
  });
  return ask(buildMumatePersonaInstruction(c.persona ?? "mu"), block, c.question, c);
}

/** ทาโรต์: ตอบจากไพ่ 3 ใบ (ใบหลัก/รอง/เสริม) ที่จั่วไว้ */
export function answerTarotChat(cards: TarotCard[], flips: boolean[], c: Common) {
  const { chatProse } = tarotChatProseFor(cards.slice(0, 3), flips, c.question);
  const block = tarotAnswerBlock(chatProse, pickFortuneOpener());
  return ask(buildMumatePersonaInstruction(c.persona ?? "mu"), block, c.question, c);
}
