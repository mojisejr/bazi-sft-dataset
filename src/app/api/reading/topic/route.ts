import { z } from "zod";

import {
  BaziEngineAdapterError,
  calculateBaziStateFromRawInput,
  type BaziStatePayload,
} from "@/features/bazi-math/bazi-engine-adapter";
import { buildDayMasterRelationPacket } from "@/lib/bazi/day-master-relation-reading-poc";
import {
  CalculatedStateSchema,
  RawInputSchema,
} from "@/lib/bazi/schema-types";
import {
  buildTopicEngineReading,
  TOPIC_PATH,
  type TopicEngineReading,
} from "@/lib/bazi/topic-reading";
import {
  buildRelationshipLinesMapping,
  buildTopicHumanReading,
  buildTopicConsumerReading,
  getTopicKnownlageExcerpt,
  getTopicKnowledgeSourceLabel,
} from "@/lib/bazi/topic-knowledge";
import { generateReadingTopicLlm, polishRelationshipLinesLlm } from "@/lib/bazi/reading-llm";
import { GPTCASE_TUNED_PROFILE } from "@/lib/bazi/reading-prompt-profiles";

export const runtime = "nodejs";

/** signal กระชับจาก engine reading สำหรับ ground LLM */
function engineSignalsFor(reading: TopicEngineReading): string[] {
  return [
    `หลักการอ่าน: ${reading.lens}`,
    ...reading.table.map((row) => `${row.sourceSymbol} → ${row.pointsTo}: ${row.relationResult}`),
    ...reading.prose,
  ];
}

const TOPIC_IDS = TOPIC_PATH.map((topic) => topic.id) as [string, ...string[]];

const ReadingTopicRequestSchema = z
  .object({
    topicId: z.enum(TOPIC_IDS),
    mode: z.enum(["engine", "consumer", "llm"]).default("engine"),
    rawInput: RawInputSchema.optional(),
    calculatedState: CalculatedStateSchema.optional(),
    apiKey: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    provider: z.enum(["gemini", "opencode", "anthropic"]).default("gemini"),
  })
  .refine((value) => value.rawInput || value.calculatedState, {
    message: "ต้องส่ง rawInput หรือ calculatedState อย่างน้อยหนึ่งอย่าง",
  });

function badRequest(message: string, code = "bad_request") {
  return Response.json({ error: { message, type: code } }, { status: 400 });
}

export async function POST(req: Request) {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.", "invalid_json");
  }

  const parsed = ReadingTopicRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid request.", "invalid_payload");
  }

  const { topicId, mode, rawInput, calculatedState: providedState, apiKey, model, provider } =
    parsed.data;

  if (mode === "llm" && !apiKey) {
    return badRequest("โหมด LLM ต้องมี API key", "missing_api_key");
  }

  if (mode === "llm" && !rawInput) {
    return badRequest("โหมด LLM ต้องส่ง rawInput", "missing_raw_input");
  }

  let calculatedState: BaziStatePayload;

  try {
    calculatedState = providedState ?? (await calculateBaziStateFromRawInput(rawInput));
  } catch (error) {
    if (error instanceof BaziEngineAdapterError) {
      return badRequest(error.message, error.code);
    }
    return badRequest(
      error instanceof Error ? error.message : "คำนวณดวงไม่สำเร็จ",
      "calculation_failed",
    );
  }

  const packet = buildDayMasterRelationPacket(calculatedState);
  const reading = buildTopicEngineReading(calculatedState, topicId, packet);
  const humanKnowledge = buildTopicHumanReading(calculatedState, topicId, rawInput);
  const sourceLabel = getTopicKnowledgeSourceLabel(topicId);
  // ตาราง Relationship Lines เฉพาะบทวัยจร (อ้างอิงตำราเคี้ยงคุง)
  const relationshipLines =
    topicId === "turning_points" ? buildRelationshipLinesMapping(calculatedState) : undefined;

  if (mode === "engine" || mode === "consumer") {
    // consumer = ร้อยแก้วผู้บริโภค (ถอด scaffolding เทคนิคออก) · engine = เทคนิคครบ
    const humanReading =
      mode === "consumer"
        ? buildTopicConsumerReading(calculatedState, topicId, rawInput)
        : humanKnowledge;
    // ข้อความ "ตำรา (knownlage) ตรง ๆ" สำหรับส่วนคำอ่าน
    const knownlageExcerpt = getTopicKnownlageExcerpt(calculatedState, topicId, rawInput);
    return Response.json({
      source: mode,
      reading,
      humanReading,
      knownlageExcerpt,
      sourceLabel,
      ...(relationshipLines ? { relationshipLines } : {}),
    });
  }

  // mode === "llm" — เรียบเรียงสไตล์ gptCase ด้วย Gemini
  // ผล A/B (docs/gemini-prompt-tuning-2026-06-08.md): profile "gptcase-tuned" + ground "consumer"
  // ให้ผลใกล้ gptCase output สุด → ใช้ consumer reading เป็น ground และ profile ที่ปรับโทน
  try {
    const llmGround =
      buildTopicConsumerReading(calculatedState, topicId, rawInput) ?? humanKnowledge;
    const llm = await generateReadingTopicLlm({
      topicId,
      rawInput: rawInput!,
      calculatedState,
      humanKnowledge: llmGround,
      sourceLabel,
      engineSignals: engineSignalsFor(reading),
      apiKey,
      model,
      provider,
      profile: provider === "gemini" ? GPTCASE_TUNED_PROFILE : undefined,
    });

    // บทเสริม (วัยจร) ท้ายบท 15: ให้ LLM แต่งคำช่อง "คำอธิบายดี-ร้ายเชิงลึก" ด้วย
    // (คง ageRange/symbol/relationLine + ป้าย [เฝ้าระวัง]/[ยุคทอง] เดิม; ถ้า LLM ล้มเหลว ใช้ของเดิม)
    let polishedLines = relationshipLines;
    if (relationshipLines && relationshipLines.length > 0) {
      try {
        polishedLines = await polishRelationshipLinesLlm({
          rows: relationshipLines,
          rawInput: rawInput!,
          calculatedState,
          apiKey,
          model,
          provider,
        });
      } catch {
        polishedLines = relationshipLines;
      }
    }

    return Response.json({
      source: "llm",
      model: llm.model,
      reading, // คำอ่าน/ตาราง engine คงเดิม
      humanReading: llm.text, // ผลการทำนาย = ฉบับ LLM เรียบเรียงสไตล์ 1.docx
      knownlageExcerpt: getTopicKnownlageExcerpt(calculatedState, topicId, rawInput),
      sourceLabel,
      ...(polishedLines ? { relationshipLines: polishedLines } : {}),
    });
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "เรียก LLM ไม่สำเร็จ",
      "llm_failed",
    );
  }
}