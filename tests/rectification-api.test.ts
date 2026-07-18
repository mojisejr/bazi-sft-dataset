// Hour Rectification — POST /api/bazi/rectify-hour (#hour-rectification-engine, v1). Same DB-free-
// by-construction proof pattern as tests/bazi-public-calc-route.test.ts: mocking the DB client to
// throw shows structurally, at runtime, that this route can never touch the DB — not just that it
// doesn't currently import a DB helper. The question BANK is mocked too (a small, known fixture via
// the network-repository boundary) so the trail-walking is deterministic and independent of
// whatever the real LLM-generated question-network.json currently contains.
//
// NOTE (intended, end-to-end): the route computes the user's 12 REAL hour charts (adapter is NOT
// mocked — runRectificationStep is async and calls the real calc engine), so birthDate must be a
// real date the engine can compute. v1 is PERSONAL: the answers select a ยาม against that specific
// chart, so which hourBranch comes out is a property of the birth data + the fixture bank, not
// hardcoded — the test asserts a well-formed result, not a fixed branch.
import { describe, expect, test, vi } from "vitest";
import {
  HOUR_BRANCHES,
  SIGNATURE_VOCAB,
  type BankQuestion,
  type QuestionBank,
} from "@/lib/bazi/hour-rectification/domain/types";

// Prove DB-free by construction: any attempt to build a DB client throws loudly.
vi.mock("@/db/client", () => ({
  createDbClient: vi.fn(() => {
    throw new Error("rectify-hour route must not construct a DB client");
  }),
  createDbSqlClient: vi.fn(() => {
    throw new Error("rectify-hour route must not construct a DB sql client");
  }),
}));

// A small, valid fixture bank. Every question's option "a" votes toward the SAME structural profile
// (water stem / same role / strong vitality) so that, whichever question the adaptive selector asks
// first, answering "a" repeatedly drives the accumulated signature toward one coherent hour — the
// walk reaches a stable "result" rather than wandering. Covers all 4 dimensions (validate-tree
// coverage) and holds ≥ MAX_QUESTIONS_TO_ASK questions so the selector never runs the bank dry.
function buildFixtureBank(): QuestionBank {
  const [elemA, elemB] = SIGNATURE_VOCAB.stemElement; // wood, fire (arbitrary, only needs to be valid)
  const questions: BankQuestion[] = [];
  // 10 questions, each probing a different mix so discrimination stays > 0 across a walk.
  const dims = ["stemElement", "stemRole", "branchRole", "strengthBucket"] as const;
  for (let i = 0; i < 10; i += 1) {
    const dim = dims[i % dims.length];
    const vocab = SIGNATURE_VOCAB[dim];
    questions.push({
      id: `q${i}`,
      question: `คำถามที่ ${i + 1}: คุณเป็นคนแบบไหน?`,
      options: [
        // option "a": always vote the FIRST vocab value of this question's dimension (a coherent
        // direction across the whole bank), plus a strong stemElement signal to build margin.
        {
          id: "a",
          label: "แบบ A",
          evidence: [
            { dimension: dim, value: vocab[0], weight: 3 },
            { dimension: "stemElement", value: elemA, weight: 2 },
          ],
        },
        // option "b": vote a different value so the two options genuinely discriminate.
        {
          id: "b",
          label: "แบบ B",
          evidence: [
            { dimension: dim, value: vocab[1] ?? vocab[0], weight: 2 },
            { dimension: "stemElement", value: elemB, weight: 1 },
          ],
        },
      ],
    });
  }
  return { version: "test-fixture", generatedAt: "2026-07-17T00:00:00.000Z", questions };
}

const FIXTURE_BANK = buildFixtureBank();

// Mock the ONLY filesystem boundary the module has, so loadRectificationBank() returns our fixture
// instead of reading question-network.json off disk. All named exports are stubbed because the
// hour-rectification barrel (index.ts) pulls generate-network in, which imports the writers too.
vi.mock("@/lib/bazi/hour-rectification/adapters/network-repository", () => ({
  readQuestionBank: vi.fn(() => FIXTURE_BANK),
  questionBankExists: vi.fn(() => true),
  resolveQuestionBankPath: vi.fn(() => "/fake/path/question-network.json"),
  writeQuestionBank: vi.fn(),
  writeDraftQuestionBank: vi.fn(),
}));

const VALID_BIRTH = {
  birthDate: "1989-01-03",
  gender: "male",
  province: "กรุงเทพมหานคร",
} as const;

function createRequest(body: unknown) {
  return new Request("http://localhost/api/bazi/rectify-hour", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

type QuestionResponse = {
  status: "question";
  questionId: string;
  question: string;
  options: { id: string; label: string }[];
  questionNumber: number;
};

describe("POST /api/bazi/rectify-hour — input validation (400s), never touches DB", () => {
  test('birthDate that passes the shape regex but is not a real date ("2026-99-99") -> 400', async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const response = await POST(createRequest({ ...VALID_BIRTH, birthDate: "2026-99-99", answeredSteps: [] }));
    expect(response.status).toBe(400);
  });

  test('a non-date birthDate string ("not-a-date") -> 400 via the shape regex', async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const response = await POST(createRequest({ ...VALID_BIRTH, birthDate: "not-a-date", answeredSteps: [] }));
    expect(response.status).toBe(400);
  });

  test("a missing birthDate entirely -> 400", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const response = await POST(createRequest({ gender: "male", province: "กรุงเทพมหานคร", answeredSteps: [] }));
    expect(response.status).toBe(400);
  });
});

describe("POST /api/bazi/rectify-hour — the runtime walk", () => {
  test("valid birth data, empty answeredSteps -> 200 status:question with a questionId + options", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const response = await POST(createRequest({ ...VALID_BIRTH, answeredSteps: [] }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as QuestionResponse;
    expect(body.status).toBe("question");
    expect(typeof body.questionId).toBe("string");
    expect(body.questionId.length).toBeGreaterThan(0);
    expect(Array.isArray(body.options)).toBe(true);
    expect(body.options.length).toBeGreaterThanOrEqual(2);
    expect(body.questionNumber).toBe(1);
    // The surfaced question must be one that actually exists in the bank.
    expect(FIXTURE_BANK.questions.some((q) => q.id === body.questionId)).toBe(true);
  });

  test("an unknown question id in the trail -> 400 (tampered/buggy trail, not a 500)", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const response = await POST(
      createRequest({ ...VALID_BIRTH, answeredSteps: [{ questionId: "does-not-exist", optionId: "a" }] }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  test("an unknown option id on a real question -> 400", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const realQuestionId = FIXTURE_BANK.questions[0].id;
    const response = await POST(
      createRequest({ ...VALID_BIRTH, answeredSteps: [{ questionId: realQuestionId, optionId: "nope" }] }),
    );
    expect(response.status).toBe(400);
  });

  test("driving the adaptive walk to completion -> 200 status:result with a valid hourBranch + beta confidence", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/route");
    const answeredSteps: { questionId: string; optionId: string }[] = [];

    // Replay the stateless loop the client would: post the trail so far, take the returned question,
    // answer its "a" option, repeat until the server signals the session is complete. Hard cap the
    // loop well above MAX_QUESTIONS_TO_ASK(8) so a runaway can't hang the test.
    let finalBody: Record<string, unknown> | null = null;
    for (let step = 0; step < 15; step += 1) {
      const response = await POST(createRequest({ ...VALID_BIRTH, answeredSteps }));
      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      if (body.status === "question") {
        answeredSteps.push({ questionId: body.questionId as string, optionId: "a" });
        continue;
      }
      finalBody = body;
      break;
    }

    expect(finalBody).not.toBeNull();
    const result = finalBody as {
      status: string;
      hourBranch: string;
      hourLabel: string;
      confidence: string;
      trace: { steps: string[] };
    };
    expect(result.status).toBe("result");
    expect((HOUR_BRANCHES as readonly string[]).includes(result.hourBranch)).toBe(true);
    expect(typeof result.hourLabel).toBe("string");
    expect(result.hourLabel.length).toBeGreaterThan(0);
    expect(result.confidence).toBe("beta");
    expect(result.trace.steps.length).toBeGreaterThan(0);
    // The walk must have asked at least MIN_QUESTIONS_TO_ASK(5) before resolving.
    expect(answeredSteps.length).toBeGreaterThanOrEqual(5);
  });
});
