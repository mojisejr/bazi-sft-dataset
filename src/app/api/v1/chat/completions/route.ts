import { validateApiToken } from "@/features/open-webui/api-guard";
import { runChatPipeline } from "@/features/open-webui/chat-runner";
import {
  generateGeminiAssistantReply,
  OpenWebUiGeminiError,
} from "@/features/open-webui/gemini-adapter";
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

  const assistantReply = generateGeminiAssistantReply(result).catch((error) => {
    if (error instanceof OpenWebUiGeminiError) {
      throw error;
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