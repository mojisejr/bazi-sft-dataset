import { describe, expect, test } from "vitest";

import {
  deriveQiStageEntity,
  resolveDisciplines,
  resolveEntities,
} from "../src/lib/bazi/knowledge-graph/entity-resolver";

function ids(entities: { id: string }[]): string[] {
  return entities.map((entity) => entity.id);
}

describe("entity-resolver", () => {
  test("'ดิถีน้ำกุ่ย (癸)' → element:water + stem:癸", () => {
    const resolved = ids(resolveEntities("ดวงดิถีน้ำกุ่ย (癸)"));
    expect(resolved).toContain("element:water");
    expect(resolved).toContain("stem:癸");
  });

  test("'วัยจรตกหมูยก' → branch:亥 (colloquial หมู)", () => {
    const resolved = ids(resolveEntities("ช่วงนี้วัยจรตกหมูยก"));
    expect(resolved).toContain("branch:亥");
  });

  test("'การงาน' → discipline:career", () => {
    expect(resolveDisciplines("เรื่องการงานจะเป็นยังไง")).toContain("discipline:career");
  });

  test("derives qi stage from day master × branch (癸 × 亥 = 帝旺)", () => {
    const qi = deriveQiStageEntity("癸", "亥");
    expect(qi?.id).toBe("qi-stage:帝旺");
  });

  test("gibberish resolves to nothing (no hallucinated entity)", () => {
    expect(resolveEntities("qqqq zzz 12345")).toHaveLength(0);
  });

  test("resolution is deterministic", () => {
    const a = resolveEntities("ดิถีน้ำกุ่ย วัยจรหมู การงาน");
    const b = resolveEntities("ดิถีน้ำกุ่ย วัยจรหมู การงาน");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
