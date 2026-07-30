import { describe, expect, test } from "vitest";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";
import { resolveOverallGrade } from "@/lib/bazi/pair-consumer";

/**
 * Slice 2A — pair-match เติม 2 ฟิลด์ลง response (fourPillars + elementInteraction สองทาง)
 * โดยไม่แตะตรรกะและไม่ลบฟิลด์เดิม (done-cond D1–D4 ใน FROZEN plan).
 * getMatchingMap() fallback = {} เมื่อไม่มี DB → engine ใช้ข้อความ JSON เดิม (รันในเทสได้).
 */

const BASE_PERSON = {
  birthDate: "1990-05-15",
  birthTime: "08:30",
  gender: "female",
  province: "กรุงเทพมหานคร",
  displayName: "เอ",
} as const;

const PERSON_B = {
  birthDate: "1988-11-02",
  birthTime: "21:15",
  gender: "male",
  province: "กรุงเทพมหานคร",
  displayName: "บี",
} as const;

function createRequest(body: unknown) {
  return new Request("http://localhost/api/bazi/pair-match", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function callPairMatch(body: unknown) {
  const { createPairMatchHandler } = await import("@/app/api/bazi/pair-match/route");
  const POST = createPairMatchHandler({ repository: createTestKnowledgeRepository() });
  const response = await POST(createRequest(body));
  return response;
}

type PillarView = { stem: string; branch: string; element: string };
type PersonView = {
  displayName: string | null;
  dayGanzhi: string;
  elementTh: string;
  stageTh: string;
  nisai: string[];
  timeKnown: boolean;
  fourPillars: Record<"year" | "month" | "day" | "hour", PillarView>;
};
type ElementRelationView = { relation: string; labelTh: string; meaningTh: string };
type PairMatchBody = {
  relationship: string;
  relationshipLabel: string;
  ourLabel: string;
  partnerLabel: string;
  domain: string;
  note: unknown;
  persons: { a: PersonView; b: PersonView };
  overall: { percent: number | null; grade: string; gradeLabel: string; hearts: number; emoji: unknown; ratingText: string };
  dimensions: unknown[];
  elementInteraction: {
    aElementTh: string;
    bElementTh: string;
    summaryTh: string;
    aToB: ElementRelationView;
    bToA: ElementRelationView;
  };
};

const PILLAR_POSITIONS = ["year", "month", "day", "hour"] as const;

function expectPillar(p: PillarView) {
  expect(typeof p.stem).toBe("string");
  expect(p.stem.length).toBeGreaterThan(0);
  expect(typeof p.branch).toBe("string");
  expect(p.branch.length).toBeGreaterThan(0);
  // D1: element ต้องมีค่าจริง (ธาตุไทย) ไม่ใช่ค่าว่าง — teeth กัน element หลุด/ไม่ derive
  expect(typeof p.element).toBe("string");
  expect(p.element.length).toBeGreaterThan(0);
}

describe("POST /api/bazi/pair-match — Slice 2A เติมฟิลด์", () => {
  test("D1: persons.a/b.fourPillars ครบ 4 เสา แต่ละเสามี stem·branch·element", async () => {
    const response = await callPairMatch({ relationship: "love", personA: BASE_PERSON, personB: PERSON_B });
    expect(response.status).toBe(200);
    const body = (await response.json()) as PairMatchBody;

    for (const person of [body.persons.a, body.persons.b]) {
      expect(person.fourPillars).toBeTruthy();
      for (const pos of PILLAR_POSITIONS) {
        expect(person.fourPillars[pos]).toBeTruthy();
        expectPillar(person.fourPillars[pos]);
      }
      // เสา day ต้องตรงกับ dayGanzhi เดิม (พิสูจน์ว่ามาจาก state เดียวกัน ไม่ใช่ก้อนแยก)
      expect(`${person.fourPillars.day.stem}${person.fourPillars.day.branch}`).toBe(person.dayGanzhi);
    }
  }, 30000);

  test("D2: elementInteraction.aToB/bToA มี relation·labelTh·meaningTh", async () => {
    const response = await callPairMatch({ relationship: "love", personA: BASE_PERSON, personB: PERSON_B });
    const body = (await response.json()) as PairMatchBody;

    for (const rel of [body.elementInteraction.aToB, body.elementInteraction.bToA]) {
      expect(rel).toBeTruthy();
      expect(typeof rel.relation).toBe("string");
      expect(rel.relation.length).toBeGreaterThan(0);
      expect(typeof rel.labelTh).toBe("string");
      expect(rel.labelTh.length).toBeGreaterThan(0);
      // meaningTh อาจว่างสำหรับบางความสัมพันธ์ แต่ต้องเป็น string เสมอ (ไม่ใช่ undefined)
      expect(typeof rel.meaningTh).toBe("string");
    }
  }, 30000);

  test("D3: ฟิลด์เดิมทุกตัวยังอยู่ครบ ไม่มีตัวไหนหาย/เปลี่ยนชื่อ", async () => {
    const response = await callPairMatch({ relationship: "love", personA: BASE_PERSON, personB: PERSON_B });
    const body = (await response.json()) as PairMatchBody;

    // top-level เดิม
    for (const k of ["relationship", "relationshipLabel", "ourLabel", "partnerLabel", "domain", "note", "persons", "overall", "dimensions", "elementInteraction"]) {
      expect(body).toHaveProperty(k);
    }
    // persons เดิม
    for (const person of [body.persons.a, body.persons.b]) {
      for (const k of ["displayName", "dayGanzhi", "elementTh", "stageTh", "nisai", "timeKnown"]) {
        expect(person).toHaveProperty(k);
      }
    }
    // overall เดิม
    for (const k of ["percent", "grade", "gradeLabel", "hearts", "emoji", "ratingText"]) {
      expect(body.overall).toHaveProperty(k);
    }
    // elementInteraction เดิม (aElementTh/bElementTh/summaryTh) ต้องไม่หาย
    for (const k of ["aElementTh", "bElementTh", "summaryTh"]) {
      expect(body.elementInteraction).toHaveProperty(k);
    }
    expect(Array.isArray(body.dimensions)).toBe(true);
    expect(body.dimensions.length).toBeGreaterThan(0);
  }, 30000);

  test("D4: ไม่ทราบเวลา → timeKnown=false แต่เสา hour ยังคืนค่าครบ (จอแสดง — เอง)", async () => {
    const { birthTime: _omit, ...personBNoTime } = PERSON_B;
    void _omit;
    const response = await callPairMatch({ relationship: "love", personA: BASE_PERSON, personB: personBNoTime });
    expect(response.status).toBe(200);
    const body = (await response.json()) as PairMatchBody;

    expect(body.persons.b.timeKnown).toBe(false);
    expect(body.persons.a.timeKnown).toBe(true);
    // เสา hour ยังต้องมีค่าจริง (route ใส่เที่ยงวันแทน) — จอเป็นคนซ่อนจาก timeKnown ไม่ใช่ route ทิ้งเสา
    expectPillar(body.persons.b.fourPillars.hour);
  }, 30000);
});

// D9-hardening: เกรดรวมต้องไม่หายเมื่อมิติหลักมี percent แต่เกรดเป็นสตริงว่าง (band เกรดว่างหลุดจาก
// RATING คงที่). helper ตัวเดียวกันใช้ทั้ง route /pair-match และหน้า report เพื่อไม่ให้ sibling บิดคนละทาง.
// เทียบพฤติกรรมเดิมฝั่ง consumer: mainFacet.grade || overall.overallGrade || ''.
describe("resolveOverallGrade — เกรดรวมไหลไป fallback เมื่อเกรดหลักว่าง (กัน grade หาย)", () => {
  test("มี percent + เกรดหลักไม่ว่าง → ใช้เกรดหลัก", () => {
    expect(resolveOverallGrade(62, "C", "D")).toBe("C");
  });

  test("มี percent แต่เกรดหลัก '' → ไหลไปเอา fallback (จุดที่ route เดิมทำเกรดหาย)", () => {
    expect(resolveOverallGrade(62, "", "D+")).toBe("D+");
    expect(resolveOverallGrade(62, "", "-")).toBe("-");
  });

  test("percent = null → ใช้ fallback เสมอ (ไม่พึ่งเกรดหลัก)", () => {
    expect(resolveOverallGrade(null, "C", "D")).toBe("D");
    expect(resolveOverallGrade(undefined, "C", "D")).toBe("D");
  });

  test("both-empty: เกรดหลักและ fallback ว่างพร้อมกัน → '' (เท่าพฤติกรรมเดิม)", () => {
    expect(resolveOverallGrade(62, "", "")).toBe("");
    expect(resolveOverallGrade(null, "", "")).toBe("");
  });
});
