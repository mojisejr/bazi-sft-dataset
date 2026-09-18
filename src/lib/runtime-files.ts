import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Files the SERVER reads from disk at request time, relative to process.cwd() (mumate-infra-move-001 slice 1).
 *
 * On Vercel these travel with the function through file tracing. In a container nothing is traced for us:
 * `next start` on a standalone build has process.cwd() = the standalone root, and every `path.join(process.cwd(),
 * …)` in src/lib resolves against it. This list is therefore the contract between the code that reads and the
 * Dockerfile that copies — the readiness route reports it, tests/runtime-files.test.ts keeps it honest against
 * the repository, and the image smoke proves the image satisfies it.
 *
 * Readers (one entry per distinct root; keep in step when adding a `process.cwd()` read):
 *   src/lib/bazi/knowledge/knowledge-loader.ts        → src/lib/bazi/knowledge/compiled-knowledge.json
 *   src/lib/bazi/hour-rectification/adapters/…        → src/lib/bazi/hour-rectification/question-network.json
 *   src/lib/bazi/life-path.ts                         → src/lib/bazi/data/life-path-scores.json (optional: absent in
 *                                                        the repo today, derive-only fallback; not listed)
 *   src/lib/bazi/shinse-chat-retrieval.ts             → src/lib/bazi/shinse-chat-index.generated.json
 *   src/lib/louise-hay/retrieval.ts                   → src/lib/louise-hay/data/louise-hay-index.json
 *   src/lib/bazi/topic-knowledge.ts                   → knownlage/<txt files>, knownlage/extracted/
 *   src/lib/bazi/hybrid-retrieval.ts                  → knownlage/distilled/ (repo mirror of the external corpus)
 *
 * The external corpus at ../../.tmp/p-pol/Mootech AI (canonical-knowledge.ts, hybrid-retrieval.ts) exists only
 * on the author's machine; production has never had it and every reader falls back, so it is not listed.
 */
export const RUNTIME_FILE_MANIFEST = [
  "src/lib/bazi/knowledge/compiled-knowledge.json",
  "src/lib/bazi/hour-rectification/question-network.json",
  "src/lib/bazi/shinse-chat-index.generated.json",
  "src/lib/louise-hay/data/louise-hay-index.json",
  "knownlage/ลักษณะนิสัย60แบบ_ราศีบน-ล่าง_12เซี่ยงแซ.txt",
  "knownlage/นิสัย12นักษัตร.txt",
  "knownlage/extracted",
  "knownlage/distilled",
] as const;

export type RuntimeFilesReport = {
  ok: boolean;
  root: string;
  missing: string[];
};

export function checkRuntimeFiles(root: string = process.cwd()): RuntimeFilesReport {
  const missing = RUNTIME_FILE_MANIFEST.filter((rel) => !existsSync(path.join(root, rel)));
  return { ok: missing.length === 0, root, missing: [...missing] };
}
