import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => "User menu",
}));

import { PendingDraftQueue } from "@/components/bazi/PendingDraftQueue";
import {
  createListDraftDatasetRecordsHandler,
  listDraftDatasetRecords,
  type DatasetDraftListRepository,
  type SaveDatasetAuthenticate,
} from "@/lib/bazi/dataset-records";

describe("PendingDraftQueue", () => {
  test("renders pending draft metadata and proof hook link", () => {
    const html = renderToStaticMarkup(
      createElement(PendingDraftQueue, {
        records: [
          {
            id: "d5a591e2-7a5e-4f43-9819-c65a8a3eef87",
            birthDate: "1992-08-21",
            birthTime: "14:35",
            dayMaster: "己",
            intentDomain: "love",
            annotatorId: "agent_gpt4o",
            createdAt: "2026-04-17T00:00:00.000Z",
            updatedAt: "2026-04-17T01:00:00.000Z",
          },
        ],
      }),
    );

    expect(html).toContain("Pending Queue สำหรับรอตรวจทาน");
    expect(html).toContain("AI Generated");
    expect(html).toContain("ดิถี 己");
    expect(html).toContain("love");
    expect(html).toContain("เกิดวันที่ 21 สิงหาคม พ.ศ.2535 เวลา 14.35 น.");
    expect(html).toContain("เปิด proofing hook");
    expect(html).toContain("d5a591e2-7a5e-4f43-9819-c65a8a3eef87");
  });

  test("renders the empty state when no draft records exist", () => {
    const html = renderToStaticMarkup(createElement(PendingDraftQueue, { records: [] }));

    expect(html).toContain("ยังไม่มี draft record ในคิว");
    expect(html).toContain("script generation และ import เข้ามาเป็น");
  });
});

describe("listDraftDatasetRecords", () => {
  test("delegates draft listing to the repository seam", async () => {
    const repository: DatasetDraftListRepository = {
      listDraftRecords: vi.fn().mockResolvedValue([
        {
          id: "record-1",
          birthDate: "1992-08-21",
          birthTime: "14:35",
          dayMaster: "己",
          intentDomain: "general",
          annotatorId: "agent_gpt4o",
          createdAt: "2026-04-17T00:00:00.000Z",
          updatedAt: "2026-04-17T01:00:00.000Z",
        },
      ]),
    };

    await expect(listDraftDatasetRecords({ repository })).resolves.toEqual([
      {
        id: "record-1",
        birthDate: "1992-08-21",
        birthTime: "14:35",
        dayMaster: "己",
        intentDomain: "general",
        annotatorId: "agent_gpt4o",
        createdAt: "2026-04-17T00:00:00.000Z",
        updatedAt: "2026-04-17T01:00:00.000Z",
      },
    ]);
    expect(repository.listDraftRecords).toHaveBeenCalledTimes(1);
  });
});

describe("createListDraftDatasetRecordsHandler", () => {
  test("returns draft records for authenticated operators", async () => {
    const repository: DatasetDraftListRepository = {
      listDraftRecords: vi.fn().mockResolvedValue([
        {
          id: "record-1",
          birthDate: "1992-08-21",
          birthTime: "14:35",
          dayMaster: "己",
          intentDomain: "general",
          annotatorId: "agent_gpt4o",
          createdAt: "2026-04-17T00:00:00.000Z",
          updatedAt: "2026-04-17T01:00:00.000Z",
        },
      ]),
    };
    const authenticate: SaveDatasetAuthenticate = vi.fn().mockResolvedValue({
      userId: "user_2v1Jq0iM5JmXgK8A0k7R8rQ8T5R",
      isAuthenticated: true,
    });
    const handler = createListDraftDatasetRecordsHandler({ repository, authenticate });

    const response = await handler();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: "record-1",
        birthDate: "1992-08-21",
        birthTime: "14:35",
        dayMaster: "己",
        intentDomain: "general",
        annotatorId: "agent_gpt4o",
        createdAt: "2026-04-17T00:00:00.000Z",
        updatedAt: "2026-04-17T01:00:00.000Z",
      },
    ]);
    expect(repository.listDraftRecords).toHaveBeenCalledTimes(1);
  });

  test("rejects unauthenticated draft listing requests with 401", async () => {
    const repository: DatasetDraftListRepository = {
      listDraftRecords: vi.fn(),
    };
    const authenticate: SaveDatasetAuthenticate = vi.fn().mockResolvedValue({
      userId: null,
      isAuthenticated: false,
    });
    const handler = createListDraftDatasetRecordsHandler({ repository, authenticate });

    const response = await handler();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized",
    });
    expect(repository.listDraftRecords).not.toHaveBeenCalled();
  });
});