import { describe, expect, test, vi } from "vitest";

import { mergeConfigV2, mergeTopicOverrides } from "@/lib/bazi/doctrine-overlay";
import { publishAllDrafts, publishDraft } from "@/lib/bazi/doctrine-publish.service";
import type {
  DoctrineDraftRepository,
  DoctrineDraftRow,
} from "@/lib/bazi/doctrine-draft-repository";
import type { ReadingDoctrineRepository } from "@/lib/bazi/reading-doctrine-repository";
import type { DoctrineConfigRepository } from "@/lib/bazi/doctrine-config-repository";

describe("doctrine overlay merge (preview)", () => {
  test("mergeTopicOverrides: draft wins per topicId", () => {
    const out = mergeTopicOverrides(
      { a: { lens: "pub-a" }, b: { lens: "pub-b" } },
      { b: { lens: "draft-b" }, c: { lens: "draft-c" } },
    );
    expect(out.a.lens).toBe("pub-a");
    expect(out.b.lens).toBe("draft-b");
    expect(out.c.lens).toBe("draft-c");
  });

  test("mergeConfigV2: draft wins per scope/key", () => {
    const out = mergeConfigV2(
      { steps: { "balance-core": { title: "pub" } }, roles: {}, stars: {} },
      {
        steps: { "balance-core": { title: "draft" }, "output-transfer": { title: "new" } },
        roles: { power: { meaning: "m" } },
        stars: {},
      },
    );
    expect(out.steps["balance-core"]?.title).toBe("draft");
    expect(out.steps["output-transfer"]?.title).toBe("new");
    expect(out.roles.power?.meaning).toBe("m");
  });
});

function draftRow(p: Partial<DoctrineDraftRow>): DoctrineDraftRow {
  return {
    surface: "config",
    entityKey: "step:balance-core",
    value: { title: "ใหม่" },
    actor: "ซินแส",
    updatedAt: new Date(),
    createdAt: new Date(),
    ...p,
  } as DoctrineDraftRow;
}

function mocks() {
  const removed: Array<[string, string]> = [];
  const draftRepo: DoctrineDraftRepository = {
    listRaw: vi.fn(async () => [] as DoctrineDraftRow[]),
    loadParsed: vi.fn(async () => ({ topicOverrides: {}, config: { steps: {}, roles: {}, stars: {} } })),
    upsert: vi.fn(async () => {}),
    remove: vi.fn(async (s: string, k: string) => void removed.push([s, k])),
    get: vi.fn(async () => null),
  };
  const topicRepo: ReadingDoctrineRepository = {
    listOverrides: vi.fn(async () => ({})),
    upsertOverride: vi.fn(async () => {}),
    deleteOverride: vi.fn(async () => {}),
  };
  const configRepo: DoctrineConfigRepository = {
    load: vi.fn(async () => ({ steps: {}, roles: {}, stars: {} })),
    upsert: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  };
  const audits: unknown[] = [];
  return {
    draftRepo,
    topicRepo,
    configRepo,
    removed,
    audits,
    deps: {
      draftRepo,
      topicRepo,
      configRepo,
      appendAudit: async (e: unknown) => void audits.push(e),
      onInvalidate: () => {},
    },
  };
}

describe("publishDraft", () => {
  test("config: upsert live + remove draft + audit", async () => {
    const m = mocks();
    m.draftRepo.get = vi.fn(async () => draftRow({ surface: "config", entityKey: "step:balance-core", value: { title: "T" } }));
    const res = await publishDraft("config", "step:balance-core", "tester", m.deps);
    expect(res.ok).toBe(true);
    expect(m.configRepo.upsert).toHaveBeenCalledWith("step", "balance-core", { title: "T" }, "tester");
    expect(m.removed).toContainEqual(["config", "step:balance-core"]);
    expect(m.audits).toHaveLength(1);
  });

  test("topic: upsertOverride live + remove draft", async () => {
    const m = mocks();
    m.draftRepo.get = vi.fn(async () => draftRow({ surface: "topic", entityKey: "wealth_and_investment", value: { lens: "x" } }));
    const res = await publishDraft("topic", "wealth_and_investment", "tester", m.deps);
    expect(res.ok).toBe(true);
    expect(m.topicRepo.upsertOverride).toHaveBeenCalledWith("wealth_and_investment", { lens: "x" }, "tester");
    expect(m.removed).toContainEqual(["topic", "wealth_and_investment"]);
  });

  test("missing draft → ok:false", async () => {
    const m = mocks();
    m.draftRepo.get = vi.fn(async () => null);
    const res = await publishDraft("config", "step:balance-core", "tester", m.deps);
    expect(res.ok).toBe(false);
  });

  test("malformed config draft → ok:false, no live write", async () => {
    const m = mocks();
    m.draftRepo.get = vi.fn(async () => draftRow({ value: { bogus: 1 } }));
    const res = await publishDraft("config", "step:balance-core", "tester", m.deps);
    expect(res.ok).toBe(false);
    expect(m.configRepo.upsert).not.toHaveBeenCalled();
  });
});

describe("publishAllDrafts", () => {
  test("publishes every draft row", async () => {
    const m = mocks();
    m.draftRepo.listRaw = vi.fn(async () => [
      draftRow({ surface: "config", entityKey: "role:power", value: { meaning: "ภาระ" } }),
      draftRow({ surface: "topic", entityKey: "health", value: { lens: "L" } }),
    ]);
    const res = await publishAllDrafts("tester", m.deps);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.published).toBe(2);
    expect(m.configRepo.upsert).toHaveBeenCalledWith("role", "power", { meaning: "ภาระ" }, "tester");
    expect(m.topicRepo.upsertOverride).toHaveBeenCalledWith("health", { lens: "L" }, "tester");
  });
});
