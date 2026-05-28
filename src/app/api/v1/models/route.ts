import { OPEN_WEBUI_DUMMY_MODEL } from "@/features/open-webui/sse-streamer";

export const runtime = "edge";

const DUMMY_MODEL_CREATED_AT = 1779975303;

export async function GET() {
  return Response.json({
    object: "list",
    data: [
      {
        id: OPEN_WEBUI_DUMMY_MODEL,
        object: "model",
        created: DUMMY_MODEL_CREATED_AT,
        owned_by: "bazi",
      },
    ],
  });
}