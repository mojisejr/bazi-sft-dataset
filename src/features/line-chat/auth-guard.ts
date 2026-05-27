import { eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { userLineMappings } from "@/db/schema";

export type RegisteredLineUser = {
  clerkUserId: string;
  lineUserId: string;
};

export type LineUserMappingRepository = {
  findByLineUserId: (lineUserId: string) => Promise<RegisteredLineUser | null>;
};

export function createLineUserMappingRepository(
  db = createDbClient(),
): LineUserMappingRepository {
  return {
    async findByLineUserId(lineUserId: string): Promise<RegisteredLineUser | null> {
      const [mapping] = await db
        .select({
          clerkUserId: userLineMappings.clerkUserId,
          lineUserId: userLineMappings.lineUserId,
        })
        .from(userLineMappings)
        .where(eq(userLineMappings.lineUserId, lineUserId))
        .limit(1);

      return mapping ?? null;
    },
  };
}

export function createLineAuthGuard(
  repository: LineUserMappingRepository = createLineUserMappingRepository(),
) {
  return {
    async getRegisteredUser(lineUserId: string): Promise<RegisteredLineUser | null> {
      return repository.findByLineUserId(lineUserId);
    },
  };
}