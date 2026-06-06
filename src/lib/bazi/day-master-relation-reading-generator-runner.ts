import { createHash } from "node:crypto";

import { GoogleGenAI } from "@google/genai";

import {
  DEFAULT_DAY_MASTER_RELATION_POC_MODEL,
  RELATION_READING_RESPONSE_JSON_SCHEMA,
  RelationReadingResponseSchema,
  buildDayMasterRelationPocSystemInstruction,
  buildDayMasterRelationPocUserPrompt,
} from "@/lib/bazi/day-master-relation-reading-generator";
import {
  assertDayMasterRelationResponseEvidenceRefs,
  buildDayMasterRelationBriefFromReadingSeam,
  type DayMasterRelationBrief,
} from "@/lib/bazi/day-master-relation-reading-interpretation";
import { buildDayMasterRelationReadingFactsFromUpstream } from "@/lib/bazi/day-master-relation-reading-facts";
import {
  type CalculatedStateValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import { type BaziCallerContract } from "@/lib/bazi/symbolic-engine.caller-contract";
import { type Source5RelationshipOverlay } from "@/lib/bazi/source5-relationship-overlay";
import { getGeminiApiKey } from "@/lib/env";
import { buildDayMasterRelationPacket } from "@/lib/bazi/day-master-relation-reading-poc";

function buildSeed(rawInput: RawInputValue) {
  const digest = createHash("sha256")
    .update(JSON.stringify(rawInput))
    .digest();

  return digest.readUInt32BE(0) % 2_147_483_647;
}

export async function runDayMasterRelationReadingGenerator(options: {
  rawInput: RawInputValue;
  brief: DayMasterRelationBrief;
  apiKey?: string;
  model?: string;
}) {
  const apiKey = options.apiKey ?? getGeminiApiKey();
  const model = options.model?.trim() || DEFAULT_DAY_MASTER_RELATION_POC_MODEL;
  const prompt = buildDayMasterRelationPocUserPrompt(options.rawInput, options.brief);
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: buildDayMasterRelationPocSystemInstruction(),
      responseMimeType: "application/json",
      responseJsonSchema: RELATION_READING_RESPONSE_JSON_SCHEMA,
      temperature: 0.35,
      seed: buildSeed(options.rawInput),
    },
  });
  const responseText = response.text?.trim();

  if (!responseText) {
    throw new Error("Gemini returned an empty relation reading response.");
  }

  const parsedResponse = RelationReadingResponseSchema.parse(JSON.parse(responseText) as unknown);
  assertDayMasterRelationResponseEvidenceRefs(parsedResponse, options.brief);

  return {
    model,
    response: parsedResponse,
  };
}

export async function generateDayMasterRelationReadingPoc(options: {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  callerContract?: BaziCallerContract;
  source5RelationshipOverlay?: Source5RelationshipOverlay;
  apiKey?: string;
  model?: string;
}) {
  const seam = buildDayMasterRelationReadingFactsFromUpstream({
    rawInput: options.rawInput,
    calculatedState: options.calculatedState,
    packetBuilder: buildDayMasterRelationPacket,
    callerContract: options.callerContract,
    source5RelationshipOverlay: options.source5RelationshipOverlay,
  });
  const { packet } = seam;
  const brief = buildDayMasterRelationBriefFromReadingSeam(seam);
  const { model, response } = await runDayMasterRelationReadingGenerator({
    rawInput: options.rawInput,
    brief,
    apiKey: options.apiKey,
    model: options.model,
  });

  return {
    model,
    packet,
    brief,
    response,
  };
}