import { validateApiToken } from "@/features/open-webui/api-guard";
import { runChatPipeline } from "@/features/open-webui/chat-runner";
import {
  buildDummyAssistantReply,
  createOpenAiSseStream,
  splitAssistantReplyIntoChunks,
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

  console.log("[open-webui] chat completions userId", result.userId);

  const dummyReply = buildDummyAssistantReply(result.latestUserMessage.content);
  const contentChunks = splitAssistantReplyIntoChunks(dummyReply);

  return new Response(createOpenAiSseStream({ contentChunks }), {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}