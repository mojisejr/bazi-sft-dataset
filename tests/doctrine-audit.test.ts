import { describe, expect, test, vi } from "vitest";

import { restoreDoctrineAudit } from "@/lib/bazi/doctrine-audit.service";
import type { DoctrineAuditRow, DoctrineAuditEntry } from "@/lib/bazi/doctrine-audit-repository";
import type { ReadingDoctrineRepository } from "@/lib/bazi/reading-doctrine-repository";
import type { DoctrineConfigRepository } from "@/lib/bazi/doctrine-config-repository";

function row(partial: Partial<DoctrineAuditRow>): DoctrineAuditRow {
  return {
    id: "a1",
    surface: "topic",
    entityKey: "wealth_and_investment",
    action: "upsert",
    value: { lens: "lens เก่า" },
    actor: "ซินแส",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...partial,
  } as DoctrineAuditRow;
}

function topicRepoMock() {
  return {
    listOverrides: vi.fn(async () => ({})),
    upsertOverride: vi.fn(async () => {}),
    deleteOverride: vi.fn(async () => {}),
  } satisfies ReadingDoctrineRepository;
}
function configRepoMock() {
  return {
    load: vi.fn(async () => ({ steps: {}, roles: {}, stars: {} })),
    upsert: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  } satisfies DoctrineConfigRepository;
}

describe("restoreDoctrineAudit", () => {
  test("topic upsert → upsertOverride + audit + invalidate", async () => {
    const topicRepo = topicRepoMock();
    const audits: DoctrineAuditEntry[] = [];
    const onInvalidate = vi.fn();
    const res = await restoreDoctrineAudit(row({}), "tester", {
      topicRepo,
      appendAudit: async (e) => void audits.push(e),
      onInvalidate,
    });
    expect(res.ok).toBe(true);
    expect(topicRepo.upsertOverride).toHaveBeenCalledWith(
      "wealth_and_investment",
      { lens: "lens เก่า" },
      "tester",
    );
    expect(onInvalidate).toHaveBeenCalled();
    expect(audits[0]?.action).toBe("upsert");
  });

  test("topic delete → deleteOverride", async () => {
    const topicRepo = topicRepoMock();
    const res = await restoreDoctrineAudit(row({ action: "delete", value: null }), "tester", {
      topicRepo,
      appendAudit: async () => {},
      onInvalidate: () => {},
    });
    expect(res.ok).toBe(true);
    expect(topicRepo.deleteOverride).toHaveBeenCalledWith("wealth_and_investment");
    expect(topicRepo.upsertOverride).not.toHaveBeenCalled();
  });

  test("config upsert → upsert(scope,key,value)", async () => {
    const configRepo = configRepoMock();
    const res = await restoreDoctrineAudit(
      row({ surface: "config", entityKey: "step:balance-core", value: { title: "T" } }),
      "tester",
      { configRepo, appendAudit: async () => {}, onInvalidate: () => {} },
    );
    expect(res.ok).toBe(true);
    expect(configRepo.upsert).toHaveBeenCalledWith("step", "balance-core", { title: "T" }, "tester");
  });

  test("config delete → remove(scope,key)", async () => {
    const configRepo = configRepoMock();
    const res = await restoreDoctrineAudit(
      row({ surface: "config", entityKey: "role:power", action: "delete", value: null }),
      "tester",
      { configRepo, appendAudit: async () => {}, onInvalidate: () => {} },
    );
    expect(res.ok).toBe(true);
    expect(configRepo.remove).toHaveBeenCalledWith("role", "power");
  });

  test("rejects malformed topic override value", async () => {
    const topicRepo = topicRepoMock();
    const res = await restoreDoctrineAudit(row({ value: { stepNumbers: [99] } }), "t", {
      topicRepo,
      appendAudit: async () => {},
      onInvalidate: () => {},
    });
    expect(res.ok).toBe(false);
    expect(topicRepo.upsertOverride).not.toHaveBeenCalled();
  });

  test("rejects bad config entityKey", async () => {
    const res = await restoreDoctrineAudit(
      row({ surface: "config", entityKey: "bogus", value: { title: "x" } }),
      "t",
      { configRepo: configRepoMock(), appendAudit: async () => {}, onInvalidate: () => {} },
    );
    expect(res.ok).toBe(false);
  });
});
