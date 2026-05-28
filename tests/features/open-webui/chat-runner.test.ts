import { describe, expect, test } from "vitest";

import {
  MAX_TRIAGE_TURNS,
  runChatPipeline,
  sliceMessagesForTriage,
  type NormalizedChatMessage,
} from "@/features/open-webui/chat-runner";

describe("runChatPipeline", () => {
  test("extracts user.id, keeps normalized history, and marks the result stream-ready", () => {
    const result = runChatPipeline({
      user: {
        id: "open-webui-user-123",
      },
      messages: [
        { role: "system", content: "You are Bazi assistant." },
        { role: "user", content: "  อยากรู้ดวงการงาน  " },
        {
          role: "assistant",
          content: [
            { type: "text", text: "ได้เลย" },
            { type: "text", text: " ขอดูวันเกิดก่อนนะคะ " },
          ],
        },
        { role: "user", content: "เกิด 12/08/1992 เวลา 09:15" },
      ],
    });

    expect(result.status).toBe("ready");

    if (result.status !== "ready") {
      throw new Error("Expected ready result.");
    }

    expect(result.userId).toBe("open-webui-user-123");
    expect(result.normalizedMessages).toEqual([
      { role: "system", content: "You are Bazi assistant." },
      { role: "user", content: "อยากรู้ดวงการงาน" },
      { role: "assistant", content: "ได้เลย\nขอดูวันเกิดก่อนนะคะ" },
      { role: "user", content: "เกิด 12/08/1992 เวลา 09:15" },
    ]);
    expect(result.triageMessages).toEqual([
      { role: "user", content: "อยากรู้ดวงการงาน" },
      { role: "assistant", content: "ได้เลย\nขอดูวันเกิดก่อนนะคะ" },
      { role: "user", content: "เกิด 12/08/1992 เวลา 09:15" },
    ]);
    expect(result.latestUserMessage).toEqual({
      role: "user",
      content: "เกิด 12/08/1992 เวลา 09:15",
    });
    expect(result.streamPlan).toEqual({
      transport: "sse",
      status: "deferred",
    });
  });

  test("returns a safe error when messages are missing", () => {
    const result = runChatPipeline({ user: { id: "missing-messages" } });

    expect(result).toMatchObject({
      status: "error",
      phase: "phase-2",
      code: "invalid_payload",
    });
  });

  test("returns a safe error when there is no user message to triage", () => {
    const result = runChatPipeline({
      messages: [
        { role: "system", content: "system only" },
        { role: "assistant", content: "assistant only" },
      ],
    });

    expect(result).toEqual({
      status: "error",
      phase: "phase-2",
      code: "missing_user_message",
      message: "Chat payload must contain at least one user message.",
    });
  });
});

describe("sliceMessagesForTriage", () => {
  test("keeps only the latest two conversational turns", () => {
    const messages: NormalizedChatMessage[] = [
      { role: "system", content: "system" },
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2" },
      { role: "user", content: "u3" },
    ];

    expect(sliceMessagesForTriage(messages, MAX_TRIAGE_TURNS)).toEqual([
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2" },
      { role: "user", content: "u3" },
    ]);
  });
});