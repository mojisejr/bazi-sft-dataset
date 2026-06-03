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
  getTopicKnowledgeSourceLabel,
} from "@/lib/bazi/topic-knowledge";
import { generateReadingTopicLlm } from "@/lib/bazi/reading-llm";

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
    mode: z.enum(["engine", "llm"]).default("engine"),
    rawInput: RawInputSchema.optional(),
    calculatedState: CalculatedStateSchema.optional(),
    apiKey: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
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

  const { topicId, mode, rawInput, calculatedState: providedState, apiKey, model } = parsed.data;

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
  // ตาราง Relationship Lines เฉพาะบทวัยจร (อ้างอิง M.docx บทเสริม)
  const relationshipLines =
    topicId === "turning_points" ? buildRelationshipLinesMapping(calculatedState) : undefined;

  if (mode === "engine") {
    return Response.json({
      source: "engine",
      reading,
      humanReading: humanKnowledge,
      sourceLabel,
      ...(relationshipLines ? { relationshipLines } : {}),
    });
  }

  // mode === "llm" — เรียบเรียงสไตล์ 1.docx ด้วย prompt ต่อหัวข้อ (ground จาก excerpt + engine signal)
  try {
    const llm = await generateReadingTopicLlm({
      topicId,
      rawInput: rawInput!,
      calculatedState,
      humanKnowledge,
      sourceLabel,
      engineSignals: engineSignalsFor(reading),
      apiKey,
      model,
    });

    return Response.json({
      source: "llm",
      model: llm.model,
      reading, // คำอ่าน/ตาราง engine คงเดิม
      humanReading: llm.text, // ผลการทำนาย = ฉบับ LLM เรียบเรียงสไตล์ 1.docx
      sourceLabel,
      ...(relationshipLines ? { relationshipLines } : {}),
    });
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "เรียก LLM ไม่สำเร็จ",
      "llm_failed",
    );
  }
}