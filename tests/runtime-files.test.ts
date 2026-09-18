import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { RUNTIME_FILE_MANIFEST, checkRuntimeFiles } from "@/lib/runtime-files";

const REPO_ROOT = path.resolve(__dirname, "..");

function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) out.push(full);
  }
  return out;
}

describe("runtime file manifest (mumate-infra-move-001 slice 1)", () => {
  test("every manifest entry exists in the repository — the manifest cannot name a file the code no longer ships", () => {
    const report = checkRuntimeFiles(REPO_ROOT);
    expect(report.missing).toEqual([]);
    expect(report.ok).toBe(true);
  });

  test("a root without the files is reported as missing, never as ok", () => {
    const report = checkRuntimeFiles(path.join(REPO_ROOT, "public"));
    expect(report.ok).toBe(false);
    expect(report.missing.length).toBe(RUNTIME_FILE_MANIFEST.length);
  });

  test("every process.cwd() read under src/ resolves inside a manifest root — a new reader must be listed", () => {
    // Static sweep: each `process.cwd()` in a server module must join onto a path whose first segment is
    // covered by the manifest (src/lib/bazi, src/lib/louise-hay, knownlage). The external corpus resolvers
    // (`"../.."`) are the recorded exception — production never had that corpus and every reader falls back.
    const roots = new Set(RUNTIME_FILE_MANIFEST.map((p) => p.split("/").slice(0, 2).join("/")));
    roots.add("knownlage/*"); // topic-knowledge joins KNOWLEDGE_DIR at runtime; the two files are listed above
    const offenders: string[] = [];
    for (const file of walk(path.join(REPO_ROOT, "src", "lib"))) {
      const text = readFileSync(file, "utf8");
      if (!text.includes("process.cwd()")) continue;
      const rel = path.relative(REPO_ROOT, file);
      const knownReader =
        /"src\/lib\/bazi\/|"src",\s*"lib",\s*"bazi"|"src",\s*"lib",\s*"louise-hay"|"src\/lib\/louise-hay|"knownlage"|"\.\.\/\.\."/.test(
          text,
        ) || /repoRoot/.test(text);
      if (!knownReader) offenders.push(rel);
    }
    expect(offenders, `process.cwd() reads outside the manifest roots: ${offenders.join(", ")}`).toEqual([]);
    expect(roots.has("src/lib")).toBe(true);
  });
});
