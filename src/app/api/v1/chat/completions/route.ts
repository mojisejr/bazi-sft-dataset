import { validateApiToken } from "@/features/open-webui/api-guard";
import { type ChatRunnerSuccess, runChatPipeline } from "@/features/open-webui/chat-runner";
import {
  generateGeminiAssistantReply,
  type OpenWebUiGeminiExecutionContext,
  OpenWebUiGeminiError,
} from "@/features/open-webui/gemini-adapter";
import {
  type OpenWebUiIntentClassification,
  OpenWebUiIntentRouterError,
  routeOpenWebUiIntent,
} from "@/features/open-webui/intent-router";
import { stringifyOpenWebUiTruthPacket } from "@/features/open-webui/truth-packet";
import {
  createGuardedOpenAiSseStream,
} from "@/features/open-webui/sse-streamer";

export const runtime = "edge";

function createBadRequestResponse(message: string, code = "bad_request") {
  return Response.json(
    {
      error: {
        message,
        type: code,
      },
    },
    { status: 400 },
  );
}

function getForwardedUserId(req: Request) {
  return req.headers.get("x-openwebui-user-id");
}

export function buildOpenWebUiExecutionContext(
  result: Pick<ChatRunnerSuccess, "baziConsult">,
  intentClassification: OpenWebUiIntentClassification,
): OpenWebUiGeminiExecutionContext {
  const truthPacket = result.baziConsult && intentClassification.requiresBaziConsult
    ? stringifyOpenWebUiTruthPacket(intentClassification, result.baziConsult.calculatedState)
    : null;

  return {
    intentClassification,
    baziConsult: result.baziConsult
      ? {
        rawInput: result.baziConsult.rawInput,
        truthPacket,
      }
      : null,
  };
}

export async function POST(req: Request) {
  const unauthorizedResponse = validateApiToken(req);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return createBadRequestResponse("Request body must be valid JSON.", "invalid_json");
  }

  const result = runChatPipeline(payload);

  if (result.status === "error") {
    return createBadRequestResponse(result.message, result.code);
  }

  const effectiveUserId = result.userId ?? getForwardedUserId(req);

  console.log("[open-webui] chat completions userId", effectiveUserId);

  const assistantReply = (async () => {
    const intentClassification = await routeOpenWebUiIntent(result);
    const executionContext = buildOpenWebUiExecutionContext(result, intentClassification);

    return generateGeminiAssistantReply(result, { executionContext });
  })().catch((error) => {
    if (error instanceof OpenWebUiGeminiError) {
      throw error;
    }

    if (error instanceof OpenWebUiIntentRouterError) {
      throw new OpenWebUiGeminiError("gemini_upstream_error", error.message);
    }

    throw new OpenWebUiGeminiError(
      "gemini_upstream_error",
      error instanceof Error ? error.message : "Unexpected Gemini transport failure.",
    );
  });

  return new Response(createGuardedOpenAiSseStream({
    assistantReply,
    abortSignal: req.signal,
  }), {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}