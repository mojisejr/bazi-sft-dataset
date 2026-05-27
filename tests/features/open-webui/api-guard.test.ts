import { describe, expect, test } from "vitest";

import { validateApiToken } from "@/features/open-webui/api-guard";

describe("validateApiToken", () => {
  const rawEnv = {
    OPEN_WEBUI_API_TOKEN: "open_webui_api_token_demo",
  };

  test("returns 401 when the authorization header is missing", async () => {
    const request = new Request("https://example.com/api/open-webui");

    const response = validateApiToken(request, rawEnv);

    expect(response?.status).toBe(401);
    await expect(response?.text()).resolves.toBe("Unauthorized");
  });

  test("returns 401 when the authorization scheme is not Bearer", async () => {
    const request = new Request("https://example.com/api/open-webui", {
      headers: {
        Authorization: "Token open_webui_api_token_demo",
      },
    });

    const response = validateApiToken(request, rawEnv);

    expect(response?.status).toBe(401);
    await expect(response?.text()).resolves.toBe("Unauthorized");
  });

  test("returns 401 when the token does not match", async () => {
    const request = new Request("https://example.com/api/open-webui", {
      headers: {
        Authorization: "Bearer wrong_token",
      },
    });

    const response = validateApiToken(request, rawEnv);

    expect(response?.status).toBe(401);
    await expect(response?.text()).resolves.toBe("Unauthorized");
  });

  test("returns null when the token matches", () => {
    const request = new Request("https://example.com/api/open-webui", {
      headers: {
        Authorization: "Bearer open_webui_api_token_demo",
      },
    });

    expect(validateApiToken(request, rawEnv)).toBeNull();
  });
});