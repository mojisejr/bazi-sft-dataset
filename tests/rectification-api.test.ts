// Hour Rectification — POST /api/bazi/rectify-hour (#hour-rectification-engine). Same DB-free-by-
// construction proof pattern as tests/bazi-public-calc-route.test.ts: mocking the DB client to
// throw shows structurally, at runtime, that this route can never touch the DB — not just that it
// doesn't currently import a DB helper. The question network itself is mocked too (a small, known
// fixture) so this test is deterministic and independent of whatever the real LLM-generated
// question-network.json currently contains.
import { describe, expect, test, vi } from "vitest";
import type { QuestionNetwork } from "@/lib/bazi/hour-rectification/domain/types";

vi.mock("@/db/client", () => ({
  createDbClient: vi.fn(() => {
    throw new Error("rectify-hour route must not construct a DB client");
  }),
  createDbSqlClient: vi.fn(() => {
    throw new Error("rectify-hour route must not construct a DB sql client");
  }),
}));

const FIXTURE_NETWORK: QuestionNetwork = {
  version: "test-fixture",
  generatedAt: "2026-07-17T00:00:00.000Z",
  rootNodeId: "q1",
  nodes: {
    q1: {
      id: "q1",
      question: "ตอนเด็กเป็นคนแบบไหน?",
      options: [
        { id: "active", label: "ซุกซน คล่องแคล่ว", next: { kind: "question", nodeId: "q2a" } },
        { id: "calm", label: "เงียบ สงบ", next: { kind: "question", nodeId: "q2b" } },
      ],
    },
    q2a: {
      id: "q2a",
      question: "ชอบเป็นผู้นำในกลุ่มเพื่อนไหม?",
      options: [
        { id: "yes", label: "ใช่", next: { kind: "result", hourBranch: "子" } },
        { id: "no", label: "ไม่ใช่", next: { kind: "result", hourBranch: "午" } },
      ],
    },
    q2b: {
      id: "q2b",
      question: "ชอบอยู่คนเดียวมากกว่าไหม?",
      options: [
        { id: "yes", label: "ใช่", next: { kind: "result", hourBranch: "酉" } },
        { id: "no", label: "ไม่ใช่", next: { kind: "result", hourBranch: "卯" } },
      ],
    },
  },
};

vi.mock("@/lib/bazi/hour-rectification/adapters/network-repository", () => ({
  readQuestionNetwork: vi.fn(() => FIXTURE_NETWORK),
  questionNetworkExists: vi.fn(() => true),
  resolveQuestionNetworkPath: vi.fn(() => "/fake/path/question-network.json"),
  writeQuestionNetwork: vi.fn(),
  writeDraftQuestionNetwork: vi.fn(),
}));

function createRequest(body: unknown) {
  return new Request("http://localhost/api/bazi/rectify-hour", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bazi/rectify-hour", () => {
  test("no answers yet -> returns the root question, never touches DB", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const response = await POST(createRequest({ answeredOptionIds: [] }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; nodeId: string; questionNumber: number };
    expect(body.status).toBe("question");
    expect(body.nodeId).toBe("q1");
    expect(body.questionNumber).toBe(1);
  });

  test("missing body entirely -> defaults answeredOptionIds to [] via schema default, still returns root question", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const response = await POST(createRequest({}));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; nodeId: string };
    expect(body.status).toBe("question");
    expect(body.nodeId).toBe("q1");
  });

  test("mid-path answer -> returns the next question", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const response = await POST(createRequest({ answeredOptionIds: ["active"] }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; nodeId: string; questionNumber: number };
    expect(body.status).toBe("question");
    expect(body.nodeId).toBe("q2a");
    expect(body.questionNumber).toBe(2);
  });

  test("full path to a result -> returns hourBranch + trace + beta confidence flag (no over-promising accuracy)", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const response = await POST(createRequest({ answeredOptionIds: ["active", "yes"] }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      hourBranch: string;
      hourLabel: string;
      confidence: string;
      trace: { steps: string[] };
    };
    expect(body.status).toBe("result");
    expect(body.hourBranch).toBe("子");
    expect(body.hourLabel).toBe("ชวด");
    expect(body.confidence).toBe("beta");
    expect(body.trace.steps.length).toBeGreaterThan(0);
  });

  test("a different path reaches a different, correct result (proves branching actually works, not hardcoded)", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const response = await POST(createRequest({ answeredOptionIds: ["calm", "yes"] }));
    const body = (await response.json()) as { hourBranch: string };
    expect(body.hourBranch).toBe("酉");
  });

  test("an invalid option id -> 400, not a crash", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const response = await POST(createRequest({ answeredOptionIds: ["not-a-real-option"] }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  test("answeredOptionIds not an array -> 400 via zod, not a 500 crash", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const response = await POST(createRequest({ answeredOptionIds: "not-an-array" }));
    expect(response.status).toBe(400);
  });

  test("empty-string option id in the array -> 400 via zod (min length), not silently accepted", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const response = await POST(createRequest({ answeredOptionIds: [""] }));
    expect(response.status).toBe(400);
  });

  test("malformed JSON body -> 500 with a message, does not crash the process", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const request = new Request("http://localhost/api/bazi/rectify-hour", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not valid json",
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
