// Hour Rectification — network-repository (#hour-rectification-engine). File-based storage for
// the generated question network, matching the compiled-knowledge.json convention: JSON,
// committed to git, no DB. This is the only file in the module that touches the filesystem.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { QuestionBank } from "../domain/types";

const OUTPUT_RELATIVE_PATH = path.join(
  "src",
  "lib",
  "bazi",
  "hour-rectification",
  "question-network.json",
);

export function resolveQuestionBankPath(repoRoot: string = process.cwd()): string {
  return path.resolve(repoRoot, OUTPUT_RELATIVE_PATH);
}

export function questionBankExists(repoRoot: string = process.cwd()): boolean {
  return existsSync(resolveQuestionBankPath(repoRoot));
}

// Thrown when the file on disk exists but is not a v1 bank (e.g. a stale v0 tree, a truncated
// write, or a draft). Distinct from ENOENT so the route can answer 503 "not generated" rather than
// letting a raw TypeError surface as an opaque 500 deep inside the walk.
export class InvalidQuestionBankError extends Error {
  constructor(reason: string) {
    super(`question bank file is present but not a valid v1 bank: ${reason}`);
    this.name = "InvalidQuestionBankError";
  }
}

export function readQuestionBank(repoRoot: string = process.cwd()): QuestionBank {
  const filePath = resolveQuestionBankPath(repoRoot);
  const raw = readFileSync(filePath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new InvalidQuestionBankError(
      `not valid JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  // Cheap structural guard at the trust boundary — enough to turn a v0/draft/partial file into a
  // clean, distinguishable failure instead of a downstream `Cannot read properties of undefined`.
  // Deep validation stays in validateQuestionBank (run at generation time before the file is ever
  // written), not on every runtime read.
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as QuestionBank).questions) ||
    (parsed as QuestionBank).questions.length === 0
  ) {
    throw new InvalidQuestionBankError('missing a non-empty "questions" array (v0 format?)');
  }
  return parsed as QuestionBank;
}

// Never called unless the caller has already run validateQuestionBank and confirmed
// `valid === true` — see generate-network.ts. This function itself does not validate; it is a
// pure "write what you're given" I/O boundary, kept small and reviewable on purpose.
export function writeQuestionBank(
  bank: QuestionBank,
  repoRoot: string = process.cwd(),
): string {
  const filePath = resolveQuestionBankPath(repoRoot);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(bank, null, 2)}\n`, "utf8");
  return filePath;
}

// For a budget-exhausted or otherwise-not-yet-valid run: save the current best-effort draft
// alongside the real artifact WITHOUT overwriting it, so overnight work is never silently lost.
// Timestamp is injected by the caller (not Date.now() here) so the writer stays a pure I/O boundary.
export function writeDraftQuestionBank(
  bank: QuestionBank,
  timestamp: string,
  repoRoot: string = process.cwd(),
): string {
  const realPath = resolveQuestionBankPath(repoRoot);
  const draftPath = path.join(
    path.dirname(realPath),
    `question-network.draft.${timestamp}.json`,
  );
  mkdirSync(path.dirname(draftPath), { recursive: true });
  writeFileSync(draftPath, `${JSON.stringify(bank, null, 2)}\n`, "utf8");
  return draftPath;
}
