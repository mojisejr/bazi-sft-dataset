import { describe, expect, test } from "vitest";

import { GET } from "@/app/api/v1/models/route";
import { OPEN_WEBUI_DUMMY_MODEL } from "@/features/open-webui/sse-streamer";

describe("GET /api/v1/models", () => {
  test("returns an OpenAI-compatible model list for Open WebUI discovery", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    await expect(response.json()).resolves.toEqual({
      object: "list",
      data: [
        {
          id: OPEN_WEBUI_DUMMY_MODEL,
          object: "model",
          created: 1779975303,
          owned_by: "bazi",
        },
      ],
    });
  });
});