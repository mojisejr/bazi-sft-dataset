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
import { guardServerLlm } from "@/lib/bazi/llm-guard";
import { GPTCASE_TUNED_PROFILE } from "@/lib/bazi/reading-prompt-profiles";
import { getMergedTopicDefinition } from "@/lib/bazi/reading-doctrine.server";
import { mergeTopicDefinition } from "@/lib/bazi/reading-doctrine-override";
import { applyRoleConfig, applyStarConfig, applyStepConfig } from "@/lib/bazi/doctrine-config";
import { getDoctrineConfigV2 } from "@/lib/bazi/doctrine-config.server";
import { mergeConfigV2 } from "@/lib/bazi/doctrine-overlay";
import {
  createDbDoctrineDraftRepository,
  type ParsedDrafts,
} from "@/lib/bazi/doctrine-draft-repository";
import { applySubstitutionRules } from "@/lib/bazi/substitution-rules";
import { createDbSubstitutionRuleRepository } from "@/lib/bazi/substitution-rules-repository";
import { getKnowledgeOverlay } from "@/lib/bazi/knowledge-override.server";
import { runWithKnowledgeOverlay } from "@/lib/bazi/knowledge/knowledge-overlay-context";
import { mergeKnowledgeOverlay } from "@/lib/bazi/knowledge/knowledge-overlay";

export const runtime = "nodejs";

/** โหลดฉบับร่างสำหรับ preview แบบ best-effort — คืน null ถ้า DB/ตารางมีปัญหา (preview ก็จะเท่ากับ published) */
async function loadDraftsSafe(): Promise<ParsedDrafts | null> {
  try {
    return await createDbDoctrineDraftRepository().loadParsed();
  } catch {
    return null;
  }
}

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
    /** คำที่ซินแสเคยแก้ให้ดวงที่ได้ผลคล้ายกัน (โหมด llm) — ใช้เป็นตัวอย่างสำนวนให้ LLM */
    masterExamples: z.array(z.string().trim().min(1)).max(3).optional(),
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

  const { topicId, mode, rawInput, calculatedState: providedState, apiKey, model, provider, masterExamples } =
    parsed.data;

  // โหมด AI (gemini) ใช้คีย์เซิร์ฟเวอร์ได้เลย — guard กันยิงรัว/โควตา/เพดานต้นทุน
  // provider อื่น (anthropic/opencode) ยังต้องมีคีย์ของผู้ใช้เอง
  const usedOwnKey = Boolean(apiKey);
  if (mode === "llm" && provider === "gemini") {
    const blocked = guardServerLlm(req, "reading_topic_llm", usedOwnKey);
    if (blocked) return blocked;
  } else if (mode === "llm" && !apiKey) {
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

  // ตารางคำแก้ของซินแส (กฎแทนคำ จาก DB) — ใช้แทนวลีในผลทายทุกโหมดให้เหมือนกันข้ามดวง
  // best-effort: โหลดกฎไม่ได้ (เช่นไม่มี DB) → ทายต่อได้โดยไม่แทนคำ (เทียบเท่าพฤติกรรมไฟล์เดิม)
  const substitutionRules = await createDbSubstitutionRuleRepository()
    .listRules()
    .catch(() => []);

  // preview=1 (เฉพาะผู้มีสิทธิ์): วาง "ฉบับร่าง" ทับ published เพื่อดูตัวอย่างก่อนเผยแพร่
  const previewRequested = new URL(req.url).searchParams.get("preview") === "1";
  const expectedToken = process.env.ADMIN_DOCTRINE_TOKEN?.trim();
  const previewAuthorized =
    !expectedToken || req.headers.get("x-admin-token")?.trim() === expectedToken;
  const usePreview = previewRequested && previewAuthorized;
  const drafts = usePreview ? await loadDraftsSafe() : null;

  // Doctrine config v2 (ซินแสปรับออนไลน์): นิยาม 7 ขั้น / ป้าย-ความหมาย role / ดาวพิเศษ — fallback เป็น default
  let doctrineConfig = await getDoctrineConfigV2();
  if (drafts) {
    doctrineConfig = mergeConfigV2(doctrineConfig, drafts.config);
  }
  // override "ความหมายดาว" ก่อน build packet (เพราะ step 7 อ่าน shenSha จาก state)
  const stateForReading = {
    ...calculatedState,
    shenSha: applyStarConfig(calculatedState.shenSha, doctrineConfig.stars),
  };
  const packetRaw = buildDayMasterRelationPacket(stateForReading);
  // override "นิยามขั้น" + "ป้าย/ความหมาย role" บน packet
  const packet = {
    ...packetRaw,
    stepInsights: applyStepConfig(packetRaw.stepInsights, doctrineConfig.steps),
    relationSummary: applyRoleConfig(packetRaw.relationSummary, doctrineConfig.roles),
  };
  // นิยามบท merged (default ในโค้ด + override ออนไลน์ที่ซินแสปรับ) — fallback เป็น default เมื่อ DB มีปัญหา
  let topicDefinition = await getMergedTopicDefinition(topicId);
  if (drafts?.topicOverrides[topicId]) {
    topicDefinition = mergeTopicDefinition(topicDefinition, drafts.topicOverrides[topicId]);
  }
  // Knowledge overlay (เฟส 2): องค์ความรู้ที่ซินแสแก้ออนไลน์ (+ ร่างเมื่อ preview) — best-effort fallback ว่าง
  const publishedOverlay = await getKnowledgeOverlay();
  const knowledgeOverlay = drafts
    ? mergeKnowledgeOverlay(publishedOverlay, drafts.knowledge)
    : publishedOverlay;

  const reading = buildTopicEngineReading(stateForReading, topicId, packet, topicDefinition);
  const humanKnowledge = runWithKnowledgeOverlay(knowledgeOverlay, () =>
    buildTopicHumanReading(calculatedState, topicId, rawInput),
  );
  const sourceLabel = getTopicKnowledgeSourceLabel(topicId);
  // ตาราง Relationship Lines เฉพาะบทวัยจร (อ้างอิงตำราเคี้ยงคุง)
  const relationshipLines =
    topicId === "turning_points" ? buildRelationshipLinesMapping(calculatedState) : undefined;

  if (mode === "engine" || mode === "consumer") {
    // consumer = ร้อยแก้วผู้บริโภค (ถอด scaffolding เทคนิคออก) · engine = เทคนิคครบ
    const humanReading =
      mode === "consumer"
        ? runWithKnowledgeOverlay(knowledgeOverlay, () =>
            buildTopicConsumerReading(calculatedState, topicId, rawInput),
          )
        : humanKnowledge;
    // ข้อความ "ตำรา (knownlage) ตรง ๆ" สำหรับส่วนคำอ่าน
    const knownlageExcerpt = runWithKnowledgeOverlay(knowledgeOverlay, () =>
      getTopicKnownlageExcerpt(calculatedState, topicId, rawInput),
    );
    return Response.json({
      source: mode,
      reading,
      humanReading: applySubstitutionRules(topicId, humanReading, substitutionRules),
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
      runWithKnowledgeOverlay(knowledgeOverlay, () =>
        buildTopicConsumerReading(calculatedState, topicId, rawInput),
      ) ?? humanKnowledge;
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
      usageFeature: "reading_topic",
      profile: provider === "gemini" ? GPTCASE_TUNED_PROFILE : undefined,
      ...(masterExamples && masterExamples.length > 0
        ? { masterCorrections: masterExamples }
        : {}),
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
      // ผลการทำนาย = ฉบับ LLM เรียบเรียง แล้วผ่านกฎแทนคำของซินแส
      humanReading: applySubstitutionRules(topicId, llm.text, substitutionRules),
      knownlageExcerpt: runWithKnowledgeOverlay(knowledgeOverlay, () =>
        getTopicKnownlageExcerpt(calculatedState, topicId, rawInput),
      ),
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