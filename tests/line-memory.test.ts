import { describe, expect, test } from "vitest";

import {
  MAX_MEMORY_MESSAGES,
  MEMORY_AMNESIA_HOURS,
  pruneLineMemory,
  resolveLineMemory,
} from "@/features/line-chat/memory-service";
import type { LineMessageTurn } from "@/features/line-chat/types";

function buildMessage(index: number): LineMessageTurn {
  return {
    role: index % 2 === 0 ? "user" : "model",
    content: `message-${index}`,
  };
}

describe("line memory rules", () => {
  test("keeps only the latest 10 messages", () => {
    const messages = Array.from({ length: 12 }, (_, index) => buildMessage(index));

    const pruned = pruneLineMemory(messages);

    expect(pruned).toHaveLength(MAX_MEMORY_MESSAGES);
    expect(pruned[0]?.content).toBe("message-2");
    expect(pruned.at(-1)?.content).toBe("message-11");
  });

  test("returns an empty array when memory is older than 24 hours", () => {
    const now = new Date("2026-05-25T21:23:00.000Z");
    const expiredUpdatedAt = new Date(
      now.getTime() - (MEMORY_AMNESIA_HOURS + 1) * 60 * 60 * 1000,
    );

    const resolved = resolveLineMemory([buildMessage(0), buildMessage(1)], expiredUpdatedAt, now);

    expect(resolved).toEqual([]);
  });
});