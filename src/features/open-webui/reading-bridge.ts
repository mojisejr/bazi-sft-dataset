// Chat-zone bridge (Path A): ground chat answers on the SAME reading engine the PDF uses,
// by calling the existing /api/reading/topic route internally. Zero engine-zone edits —
// only imports read-only constants/types from the engine, never mutates engine files.
//
// Flow: intent (or explicit topic hint) -> topicId -> /api/reading/topic (mode llm, then consumer)
// -> humanReading (ซินแสฟันธง prose, already substitution + doctrine + iron-rules applied).
import { type OpenWebUiIntentClassification } from "@/features/open-webui/intent-router";
import { type CalculatedStateValue, type RawInputValue } from "@/lib/bazi/schema-types";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { getGeminiApiKey } from "@/lib/env";

type Intent = OpenWebUiIntentClassification["intent"];

// Map each chat intent to the canonical reading topic that answers it (engine 15-topic path).
// chit_chat intentionally has no topic (no consult).
export const INTENT_TO_TOPIC: Partial<Record<Intent, string>> = {
  wealth: "wealth_and_investment",
  love: "love_partner",
  career: "career_potential",
  health: "health",
  general_reading: "chart_foundation",
};

const VALID_TOPIC_IDS: ReadonlySet<string> = new Set(TOPIC_PATH.map((topic) => topic.id));

export function isValidTopicId(id: string | null | undefined): id is string {
  return typeof id === "string" && VALID_TOPIC_IDS.has(id);
}

// Prefer an explicit (frontend chip) topic hint; otherwise derive from the routed intent.
export function resolveTopicId(intent: Intent, topicHint?: string | null): string | null {
  if (isValidTopicId(topicHint)) {
    return topicHint;
  }
  return INTENT_TO_TOPIC[intent] ?? null;
}

type GroundArgs = {
  topicId: string;
  rawInput: RawInputValue;
  calculatedState?: CalculatedStateValue | null;
};

// Returns the engine reading prose (humanReading) for the topic, or null on any failure.
// Fallback ladder: llm (ซินแส voice) -> consumer (deterministic) -> null (caller uses truth-packet).
export async function fetchGroundedReading(
  origin: string,
  { topicId, rawInput, calculatedState }: GroundArgs,
): Promise<string | null> {
  let apiKey: string | undefined;
  try {
    apiKey = getGeminiApiKey();
  } catch {
    apiKey = undefined;
  }

  const attempts: Array<Record<string, unknown>> = [];
  // llm mode requires apiKey + rawInput; gives the tuned ซินแสฟันธง voice that matches the PDF.
  if (apiKey) {
    attempts.push({ topicId, mode: "llm", rawInput, calculatedState, apiKey });
  }
  // consumer mode is deterministic (no LLM) — cheaper fallback that still carries doctrine + substitution.
  attempts.push({ topicId, mode: "consumer", rawInput, calculatedState });

  for (const body of attempts) {
    try {
      const res = await fetch(`${origin}/api/reading/topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        continue;
      }
      const json = (await res.json()) as { humanReading?: unknown };
      const text = typeof json.humanReading === "string" ? json.humanReading.trim() : "";
      if (text) {
        return text;
      }
    } catch {
      // network/parse failure — try the next mode, then ultimately null
    }
  }

  return null;
}
