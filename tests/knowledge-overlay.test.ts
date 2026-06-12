import { describe, expect, test, vi } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { buildTopicHumanReading } from "@/lib/bazi/topic-knowledge";
import {
  EMPTY_OVERLAY,
  mergeKnowledgeOverlay,
  resolveTable,
  type KnowledgeOverlay,
} from "@/lib/bazi/knowledge/knowledge-overlay";
import {
  currentKnowledgeOverlay,
  runWithKnowledgeOverlay,
} from "@/lib/bazi/knowledge/knowledge-overlay-context";
import { rowsToOverlay } from "@/lib/bazi/knowledge-override-repository";
import { decodeKnowledgeEntityKey } from "@/lib/bazi/doctrine-draft-repository";
import { publishDraft, type PublishDeps } from "@/lib/bazi/doctrine-publish.service";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

describe("resolveTable / mergeKnowledgeOverlay", () => {
  test("ไม่มี override → คืน defaults อ้างอิงเดิม", () => {
    const defaults = { a: "1", b: "2" };
    expect(resolveTable(EMPTY_OVERLAY, "T", defaults)).toBe(defaults);
  });

  test("มี override → ทับเฉพาะคีย์ที่ระบุ", () => {
    const overlay: KnowledgeOverlay = { tables: { T: { a: "X" } }, appends: {} };
    expect(resolveTable(overlay, "T", { a: "1", b: "2" })).toEqual({ a: "X", b: "2" });
  });

  test("merge: draft ทับ published รายคีย์ + appends ราย topic", () => {
    const base: KnowledgeOverlay = { tables: { T: { a: "1", b: "2" } }, appends: { x: ["p"] } };
    const over: KnowledgeOverlay = { tables: { T: { b: "B" } }, appends: { x: ["d"] } };
    const merged = mergeKnowledgeOverlay(base, over);
    expect(merged.tables.T).toEqual({ a: "1", b: "B" });
    expect(merged.appends.x).toEqual(["d"]);
  });
});

describe("rowsToOverlay", () => {
  test("table + append (เรียงตาม item เชิงเลข)", () => {
    const overlay = rowsToOverlay([
      { kind: "table", groupKey: "QI_WEALTH_TH", itemKey: "养", value: { text: "ใหม่" } },
      { kind: "append", groupKey: "health", itemKey: "2", value: { text: "สอง" } },
      { kind: "append", groupKey: "health", itemKey: "1", value: { text: "หนึ่ง" } },
    ] as never);
    expect(overlay.tables.QI_WEALTH_TH["养"]).toBe("ใหม่");
    expect(overlay.appends.health).toEqual(["หนึ่ง", "สอง"]);
  });
});

describe("decodeKnowledgeEntityKey", () => {
  test("แตก kind|group|item", () => {
    expect(decodeKnowledgeEntityKey("table|QI_WEALTH_TH|养")).toEqual({
      kind: "table",
      group: "QI_WEALTH_TH",
      item: "养",
    });
    expect(decodeKnowledgeEntityKey("append|health|1")).toEqual({
      kind: "append",
      group: "health",
      item: "1",
    });
    expect(decodeKnowledgeEntityKey("bad")).toBeNull();
  });
});

describe("buildTopicHumanReading + overlay (request-scoped)", () => {
  test("override CHAPTER_INTRO + append ปรากฏในผล แล้วไม่รั่วออกนอก scope", async () => {
    const repo = createTestKnowledgeRepository();
    const raw = RawInputSchema.parse({
      birthDate: "1990-01-01",
      birthTime: "12:00",
      gender: "male",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    });
    const state = await calculateBaziChart(raw, repo);

    const baseline = buildTopicHumanReading(state, "chart_foundation", raw);
    expect(baseline).not.toContain("ZZINTRO");

    const overlay: KnowledgeOverlay = {
      tables: { CHAPTER_INTRO_TH: { chart_foundation: "ZZINTRO ทดสอบเกริ่นนำ" } },
      appends: { chart_foundation: ["ZZAPPENDED ความรู้ใหม่ที่ซินแสเพิ่ม"] },
    };
    const overridden = runWithKnowledgeOverlay(overlay, () =>
      buildTopicHumanReading(state, "chart_foundation", raw),
    );
    expect(overridden).toContain("ZZINTRO ทดสอบเกริ่นนำ");
    expect(overridden?.trimEnd().endsWith("ZZAPPENDED ความรู้ใหม่ที่ซินแสเพิ่ม")).toBe(true);
    expect(overridden).not.toBe(baseline);

    // นอก scope กลับเป็น default
    expect(currentKnowledgeOverlay()).toBe(EMPTY_OVERLAY);
    expect(buildTopicHumanReading(state, "chart_foundation", raw)).toBe(baseline);
  });
});

describe("publishDraft surface=knowledge", () => {
  test("เขียน live + ลบ draft + audit + invalidate", async () => {
    const row = {
      surface: "knowledge",
      entityKey: "table|QI_WEALTH_TH|养",
      value: { text: "ข้อความใหม่" },
      actor: "ซินแส",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const draftRepo = {
      get: vi.fn().mockResolvedValue(row),
      remove: vi.fn().mockResolvedValue(undefined),
      listRaw: vi.fn(),
      loadParsed: vi.fn(),
      upsert: vi.fn(),
    };
    const knowledgeRepo = {
      upsert: vi.fn().mockResolvedValue(undefined),
      load: vi.fn(),
      listRaw: vi.fn(),
      remove: vi.fn(),
    };
    const appendAudit = vi.fn().mockResolvedValue(undefined);
    const onInvalidate = vi.fn();

    const deps: PublishDeps = {
      draftRepo: draftRepo as never,
      knowledgeRepo: knowledgeRepo as never,
      appendAudit,
      onInvalidate,
    };
    const result = await publishDraft("knowledge", "table|QI_WEALTH_TH|养", "ซินแส", deps);

    expect(result.ok).toBe(true);
    expect(knowledgeRepo.upsert).toHaveBeenCalledWith("table", "QI_WEALTH_TH", "养", "ข้อความใหม่", "ซินแส");
    expect(draftRepo.remove).toHaveBeenCalledWith("knowledge", "table|QI_WEALTH_TH|养");
    expect(onInvalidate).toHaveBeenCalledWith("knowledge");
    expect(appendAudit).toHaveBeenCalledTimes(1);
    expect(appendAudit.mock.calls[0][0]).toMatchObject({ surface: "knowledge", action: "upsert" });
  });
});
