// Hour Rectification — network-repository (#hour-rectification-engine). File-based storage for
// the generated question network, matching the compiled-knowledge.json convention: JSON,
// committed to git, no DB. This is the only file in the module that touches the filesystem.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { QuestionNetwork } from "../domain/types";

const OUTPUT_RELATIVE_PATH = path.join(
  "src",
  "lib",
  "bazi",
  "hour-rectification",
  "question-network.json",
);

export function resolveQuestionNetworkPath(repoRoot: string = process.cwd()): string {
  return path.resolve(repoRoot, OUTPUT_RELATIVE_PATH);
}

export function questionNetworkExists(repoRoot: string = process.cwd()): boolean {
  return existsSync(resolveQuestionNetworkPath(repoRoot));
}

export function readQuestionNetwork(repoRoot: string = process.cwd()): QuestionNetwork {
  const filePath = resolveQuestionNetworkPath(repoRoot);
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw) as QuestionNetwork;
}

// Never called unless the caller has already run validateQuestionNetwork and confirmed
// `valid === true` — see generate-network.ts. This function itself does not validate; it is a
// pure "write what you're given" I/O boundary, kept small and reviewable on purpose.
export function writeQuestionNetwork(
  network: QuestionNetwork,
  repoRoot: string = process.cwd(),
): string {
  const filePath = resolveQuestionNetworkPath(repoRoot);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(network, null, 2)}\n`, "utf8");
  return filePath;
}

// For a budget-exhausted or otherwise-not-yet-valid run: save the current best-effort draft
// alongside the real artifact WITHOUT overwriting it, so overnight work is never silently lost.
export function writeDraftQuestionNetwork(
  network: QuestionNetwork,
  repoRoot: string = process.cwd(),
): string {
  const realPath = resolveQuestionNetworkPath(repoRoot);
  const draftPath = path.join(
    path.dirname(realPath),
    `question-network.draft.${Date.now()}.json`,
  );
  mkdirSync(path.dirname(draftPath), { recursive: true });
  writeFileSync(draftPath, `${JSON.stringify(network, null, 2)}\n`, "utf8");
  return draftPath;
}
