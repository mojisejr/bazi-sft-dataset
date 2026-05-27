import { describe, expect, test, vi } from "vitest";

import { createLineWebhookHandler } from "@/features/line-chat/webhook";

function createWebhookRequest(lineUserId = "U-demo-user", text = "สวัสดี") {
  return new Request("http://localhost/api/webhooks/line", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-line-signature": "valid-signature",
    },
    body: JSON.stringify({
      events: [
        {
          type: "message",
          replyToken: "reply-token-demo",
          source: {
            type: "user",
            userId: lineUserId,
          },
          message: {
            type: "text",
            text,
          },
        },
      ],
    }),
  });
}

describe("createLineWebhookHandler", () => {
  test("returns 401 when the LINE signature is invalid", async () => {
    const replyText = vi.fn();
    const handler = createLineWebhookHandler({
      validateSignature: vi.fn().mockReturnValue(false),
      authGuard: {
        getRegisteredUser: vi.fn(),
      },
      messagingClient: {
        replyText,
      },
      scheduleAfter: vi.fn(),
      loginUrl: "https://example.com/line/login",
    });

    const response = await handler(createWebhookRequest());

    expect(response.status).toBe(401);
    expect(replyText).not.toHaveBeenCalled();
  });

  test("replies with a login prompt for unregistered LINE users", async () => {
    const replyText = vi.fn().mockResolvedValue(undefined);
    const scheduleAfter = vi.fn();
    const handler = createLineWebhookHandler({
      validateSignature: vi.fn().mockReturnValue(true),
      authGuard: {
        getRegisteredUser: vi.fn().mockResolvedValue(null),
      },
      messagingClient: {
        replyText,
      },
      scheduleAfter,
      loginUrl: "https://example.com/line/login",
    });

    const response = await handler(createWebhookRequest("U-unknown-user"));

    expect(response.status).toBe(200);
    expect(replyText).toHaveBeenCalledWith(
      "reply-token-demo",
      expect.stringContaining("https://example.com/line/login"),
    );
    expect(scheduleAfter).not.toHaveBeenCalled();
  });

  test("accepts registered users immediately and schedules the temporary echo reply", async () => {
    const replyText = vi.fn().mockResolvedValue(undefined);
    const scheduledCallbacks: Array<() => Promise<void> | void> = [];
    const handler = createLineWebhookHandler({
      validateSignature: vi.fn().mockReturnValue(true),
      authGuard: {
        getRegisteredUser: vi.fn().mockResolvedValue({
          clerkUserId: "user_123",
          lineUserId: "U-known-user",
        }),
      },
      messagingClient: {
        replyText,
      },
      scheduleAfter: (callback) => {
        scheduledCallbacks.push(callback);
      },
      loginUrl: "https://example.com/line/login",
    });

    const response = await handler(createWebhookRequest("U-known-user", "ทดสอบข้อความ"));

    expect(response.status).toBe(200);
    expect(replyText).not.toHaveBeenCalled();
    expect(scheduledCallbacks).toHaveLength(1);

    await scheduledCallbacks[0]();

    expect(replyText).toHaveBeenCalledWith(
      "reply-token-demo",
      "รับข้อความแล้วนะคะ: ทดสอบข้อความ",
    );
  });
});