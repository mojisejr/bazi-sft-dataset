import type { CompatibilityMatrixProfileValue } from "@/lib/bazi/schema-types";

import type { DomainMatrixRecord } from "@/lib/bazi/symbolic-engine.types";

export function normalizeCorpusBranchSymbol(value: string) {
  return value.replaceAll("辰", "辰").trim();
}

function buildMatrixStemColumnLookup(rows: DomainMatrixRecord[]) {
  const lookup = new Map<string, { codeIndex: number; branchIndex: number }>();
  const headerRow = rows.find((row) =>
    row.rawCells.some((cell) =>
      ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"].includes(cell.trim()),
    ),
  );

  if (!headerRow) {
    return lookup;
  }

  headerRow.rawCells.forEach((cell, index) => {
    const stem = cell.trim();

    if (
      !["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"].includes(stem) ||
      index < 1
    ) {
      return;
    }

    lookup.set(stem, {
      codeIndex: index - 1,
      branchIndex: index,
    });
  });

  return lookup;
}

export function buildCompatibilityMatrixProfiles(
  dayMasterStem: string,
  rows: DomainMatrixRecord[],
): CompatibilityMatrixProfileValue[] {
  const rowsByPairKey = new Map<string, DomainMatrixRecord[]>();

  for (const row of rows) {
    const pairKey = row.pairKey?.trim() || row.sourceVariant.trim();
    const existing = rowsByPairKey.get(pairKey);

    if (existing) {
      existing.push(row);
      continue;
    }

    rowsByPairKey.set(pairKey, [row]);
  }

  return Array.from(rowsByPairKey.entries()).flatMap(([pairKey, pairRows]) => {
    const stemColumns = buildMatrixStemColumnLookup(pairRows);
    const stemColumn = stemColumns.get(dayMasterStem);

    if (!stemColumn) {
      return [];
    }

    const entries = pairRows
      .filter((row) => row.scoreText || row.narrative)
      .map((row) => {
        const counterpartBranch = normalizeCorpusBranchSymbol(
          row.rawCells[stemColumn.branchIndex] ?? "",
        );

        if (!row.code || !row.label || !counterpartBranch) {
          return null;
        }

        const counterpartCode = row.rawCells[stemColumn.codeIndex]?.trim() || undefined;

        return {
          code: row.code,
          label: row.label,
          scoreText: row.scoreText ?? undefined,
          narrative: row.narrative ?? undefined,
          counterpartCode,
          counterpartBranch,
        };
      })
      .filter((entry) => entry !== null);

    if (entries.length === 0) {
      return [];
    }

    return [
      {
        domain: pairRows[0].domain,
        pairKey,
        entries,
      },
    ];
  });
}