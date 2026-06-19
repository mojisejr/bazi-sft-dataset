import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { PendingDraftQueue } from "@/components/bazi/PendingDraftQueue";
import {
  createListDraftDatasetRecordsHandler,
  listDraftDatasetRecords,
  type DatasetDraftListRepository,
  type SaveDatasetAuthenticate,
} from "@/lib/bazi/dataset-records";

describe("PendingDraftQueue", () => {
  test("renders pending draft metadata and the human-readable review link", () => {
    const html = renderToStaticMarkup(
      createElement(PendingDraftQueue, {
        returnToPath: "/?workspace=queue",
        records: [
          {
            id: "d5a591e2-7a5e-4f43-9819-c65a8a3eef87",
            birthDate: "1992-08-21",
            birthTime: "14:35",
            dayMaster: "己",
            intentDomain: "love",
            customerName: "สมบัติ",
            caseNote: "เสียชีวิต",
            queueBatchId: "fresh-2026-04-24",
            reviewState: "active",
            staleReason: null,
            supersedesRecordId: null,
            latestEffectiveRecordId: "d5a591e2-7a5e-4f43-9819-c65a8a3eef87",
            sourceRow: 12,
            annotatorId: "agent_gpt4o",
            createdAt: "2026-04-17T00:00:00.000Z",
            updatedAt: "2026-04-17T01:00:00.000Z",
          },
        ],
        campaignLabel: "fresh-2026-04-24",
      }),
    );

    expect(html).toContain("Pending Queue สำหรับรอตรวจทาน");
    expect(html).toContain("กำลังเปิดคิว fresh-2026-04-24 อยู่ มี 1 เคสพร้อมตรวจ");
    expect(html).toContain("แคมเปญ fresh-2026-04-24");
    expect(html).toContain("AI สร้าง");
    expect(html).toContain("สมบัติ");
    expect(html).toContain("ดิถี 己");
    expect(html).toContain("love");
    expect(html).toContain("ปกติ");
    expect(html).toContain("ต้นฉบับของคิวรอบนี้");
    expect(html).toContain("แถวที่ 12 จากไฟล์ต้นทาง");
    expect(html).toContain("หมายเหตุเคส: เสียชีวิต");
    expect(html).toContain("เกิดวันที่ 21 สิงหาคม พ.ศ.2535 เวลา 14.35 น.");
    expect(html).toContain("อ่านก่อนตรวจ");
    expect(html).toContain("ตรวจเคส");
    expect(html).toContain("d5a591e2-7a5e-4f43-9819-c65a8a3eef87");
    expect(html).toContain("returnTo=%2F%3Fworkspace%3Dqueue");
  });

  test("renders the empty state when no draft records exist", () => {
    const html = renderToStaticMarkup(createElement(PendingDraftQueue, { records: [] }));

    expect(html).toContain("ยังไม่มี draft record ในคิว");
    expect(html).toContain("script generation และ import เข้ามาเป็น");
  });
});

describe("listDraftDatasetRecords", () => {
  test("delegates draft listing to the repository seam with optional campaign filter", async () => {
    const repository: DatasetDraftListRepository = {
      listDraftRecords: vi.fn().mockResolvedValue([
        {
          id: "record-1",
          birthDate: "1992-08-21",
          birthTime: "14:35",
          dayMaster: "己",
          intentDomain: "general",
          customerName: "KD",
          caseNote: null,
          queueBatchId: "fresh-2026-04-24",
          reviewState: "active",
          staleReason: null,
          supersedesRecordId: null,
          latestEffectiveRecordId: "record-1",
          sourceRow: 1,
          annotatorId: "agent_gpt4o",
          createdAt: "2026-04-17T00:00:00.000Z",
          updatedAt: "2026-04-17T01:00:00.000Z",
        },
      ]),
    };

    await expect(listDraftDatasetRecords({ repository, campaignLabel: "fresh-2026-04-24" })).resolves.toEqual([
      {
        id: "record-1",
        birthDate: "1992-08-21",
        birthTime: "14:35",
        dayMaster: "己",
        intentDomain: "general",
        customerName: "KD",
        caseNote: null,
        queueBatchId: "fresh-2026-04-24",
        reviewState: "active",
        staleReason: null,
        supersedesRecordId: null,
        latestEffectiveRecordId: "record-1",
        sourceRow: 1,
        annotatorId: "agent_gpt4o",
        createdAt: "2026-04-17T00:00:00.000Z",
        updatedAt: "2026-04-17T01:00:00.000Z",
      },
    ]);
    expect(repository.listDraftRecords).toHaveBeenCalledWith({ campaignLabel: "fresh-2026-04-24" });
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
          customerName: "KD",
          caseNote: null,
          queueBatchId: "fresh-2026-04-24",
          reviewState: "active",
          staleReason: null,
          supersedesRecordId: null,
          latestEffectiveRecordId: "record-1",
          sourceRow: 1,
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

    const response = await handler(new Request("https://example.test/api/dataset/drafts?campaign=fresh-2026-04-24"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: "record-1",
        birthDate: "1992-08-21",
        birthTime: "14:35",
        dayMaster: "己",
        intentDomain: "general",
        customerName: "KD",
        caseNote: null,
        queueBatchId: "fresh-2026-04-24",
        reviewState: "active",
        staleReason: null,
        supersedesRecordId: null,
        latestEffectiveRecordId: "record-1",
        sourceRow: 1,
        annotatorId: "agent_gpt4o",
        createdAt: "2026-04-17T00:00:00.000Z",
        updatedAt: "2026-04-17T01:00:00.000Z",
      },
    ]);
    expect(repository.listDraftRecords).toHaveBeenCalledWith({ campaignLabel: "fresh-2026-04-24" });
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

    const response = await handler(new Request("https://example.test/api/dataset/drafts"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized",
    });
    expect(repository.listDraftRecords).not.toHaveBeenCalled();
  });
});