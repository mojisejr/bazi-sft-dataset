import { describe, expect, test, vi } from "vitest";

import {
  createPurgeDatasetDraftsHandler,
  type DatasetDraftPurgeRepository,
  type SaveDatasetAuthenticate,
} from "@/lib/bazi/dataset-records";

describe("createPurgeDatasetDraftsHandler", () => {
  test("purges authenticated user drafts and returns 200", async () => {
    const repository: DatasetDraftPurgeRepository = {
      purgeDrafts: vi.fn().mockResolvedValue(undefined),
    };
    const authenticate: SaveDatasetAuthenticate = vi.fn().mockResolvedValue({
      userId: "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
      isAuthenticated: true,
    });
    const handler = createPurgeDatasetDraftsHandler({ repository, authenticate });

    const response = await handler();

    expect(response.status).toBe(200);
    expect(repository.purgeDrafts).toHaveBeenCalledWith(
      "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
    );
  });

  test("rejects unauthenticated purge requests with 401", async () => {
    const repository: DatasetDraftPurgeRepository = {
      purgeDrafts: vi.fn(),
    };
    const authenticate: SaveDatasetAuthenticate = vi.fn().mockResolvedValue({
      userId: null,
      isAuthenticated: false,
    });
    const handler = createPurgeDatasetDraftsHandler({ repository, authenticate });

    const response = await handler();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized",
    });
    expect(repository.purgeDrafts).not.toHaveBeenCalled();
  });
});