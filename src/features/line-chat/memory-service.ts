import { eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziChatHistories } from "@/db/schema";

import type { LineMessageTurn, LineMessageRole } from "./types";

export const MAX_MEMORY_TURNS = 5;
export const MAX_MEMORY_MESSAGES = MAX_MEMORY_TURNS * 2;
export const MEMORY_AMNESIA_HOURS = 24;

const MEMORY_AMNESIA_MS = MEMORY_AMNESIA_HOURS * 60 * 60 * 1000;
const VALID_ROLES: readonly LineMessageRole[] = ["user", "model"];

function isLineMessageTurn(value: unknown): value is LineMessageTurn {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.content === "string" &&
    VALID_ROLES.includes(candidate.role as LineMessageRole)
  );
}

export function sanitizeLineMemory(messages: unknown): LineMessageTurn[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.filter(isLineMessageTurn);
}

export function pruneLineMemory(messages: readonly LineMessageTurn[]): LineMessageTurn[] {
  return messages.slice(-MAX_MEMORY_MESSAGES);
}

export function isLineMemoryExpired(
  updatedAt: Date | string | null | undefined,
  now = new Date(),
): boolean {
  if (!updatedAt) {
    return true;
  }

  const parsedUpdatedAt = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);

  if (Number.isNaN(parsedUpdatedAt.getTime())) {
    return true;
  }

  return now.getTime() - parsedUpdatedAt.getTime() >= MEMORY_AMNESIA_MS;
}

export function resolveLineMemory(
  messages: unknown,
  updatedAt: Date | string | null | undefined,
  now = new Date(),
): LineMessageTurn[] {
  if (isLineMemoryExpired(updatedAt, now)) {
    return [];
  }

  return pruneLineMemory(sanitizeLineMemory(messages));
}

export function createLineMemoryService(db = createDbClient()) {
  return {
    async getMemory(lineUserId: string): Promise<LineMessageTurn[]> {
      const [memoryRecord] = await db
        .select({
          messages: baziChatHistories.messages,
          updatedAt: baziChatHistories.updatedAt,
        })
        .from(baziChatHistories)
        .where(eq(baziChatHistories.lineUserId, lineUserId))
        .limit(1);

      if (!memoryRecord) {
        return [];
      }

      return resolveLineMemory(memoryRecord.messages, memoryRecord.updatedAt);
    },
    async addTurnAndPrune(
      lineUserId: string,
      newTurn: readonly LineMessageTurn[],
    ): Promise<LineMessageTurn[]> {
      const currentMemory = await this.getMemory(lineUserId);
      const nextMemory = pruneLineMemory([...currentMemory, ...sanitizeLineMemory(newTurn)]);

      await db
        .insert(baziChatHistories)
        .values({
          lineUserId,
          messages: nextMemory,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: baziChatHistories.lineUserId,
          set: {
            messages: nextMemory,
            updatedAt: new Date(),
          },
        });

      return nextMemory;
    },
  };
}

export async function getMemory(lineUserId: string): Promise<LineMessageTurn[]> {
  return createLineMemoryService().getMemory(lineUserId);
}

export async function addTurnAndPrune(
  lineUserId: string,
  newTurn: readonly LineMessageTurn[],
): Promise<LineMessageTurn[]> {
  return createLineMemoryService().addTurnAndPrune(lineUserId, newTurn);
}