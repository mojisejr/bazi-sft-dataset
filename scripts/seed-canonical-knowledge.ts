import path from "node:path";

import { config as loadEnv } from "dotenv";

import { buildCanonicalKnowledgeDataset } from "../src/lib/bazi/canonical-knowledge";
import { createDbClient } from "../src/db/client";
import {
  baziCanonicalRawRows,
  baziCanonicalSources,
  baziDatasetRecords,
  baziDayMasterProfiles,
  baziDayMasterStrengthStates,
  baziDomainMatrices,
  baziElementInteractions,
  baziFaqTaxonomies,
  baziReferenceDocuments,
  baziSixtyJiaziNarratives,
  baziTimeSolarTerms,
  baziTwelveQiStages,
} from "../src/db/schema";

const CHUNK_SIZE = 250;

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

async function insertInChunks<T extends Record<string, unknown>>(
  name: string,
  table: { _: unknown },
  values: T[],
  db: ReturnType<typeof createDbClient>,
) {
  if (values.length === 0) {
    console.log(`- ${name}: 0 rows`);
    return;
  }

  for (let index = 0; index < values.length; index += CHUNK_SIZE) {
    const chunk = values.slice(index, index + CHUNK_SIZE);
    await db.insert(table as never).values(chunk as never);
  }

  console.log(`- ${name}: ${values.length} rows`);
}

async function clearTables(db: ReturnType<typeof createDbClient>) {
  await db.delete(baziTimeSolarTerms);
  await db.delete(baziDomainMatrices);
  await db.delete(baziSixtyJiaziNarratives);
  await db.delete(baziDayMasterStrengthStates);
  await db.delete(baziDayMasterProfiles);
  await db.delete(baziTwelveQiStages);
  await db.delete(baziElementInteractions);
  await db.delete(baziFaqTaxonomies);
  await db.delete(baziCanonicalRawRows);
  await db.delete(baziReferenceDocuments);
  await db.delete(baziCanonicalSources);

  // Phase 1 dataset rows are not part of the canonical reseed workflow.
  void baziDatasetRecords;
}

async function main() {
  const repoRoot = process.cwd();
  const dataset = buildCanonicalKnowledgeDataset(repoRoot);
  const isDryRun = process.argv.includes("--dry-run");

  const counts = {
    sources: dataset.sources.length,
    referenceDocuments: dataset.referenceDocuments.length,
    canonicalRawRows: dataset.canonicalRawRows.length,
    timeSolarTerms: dataset.timeSolarTerms.length,
    faqTaxonomies: dataset.faqTaxonomies.length,
    elementInteractions: dataset.elementInteractions.length,
    twelveQiStages: dataset.twelveQiStages.length,
    dayMasterProfiles: dataset.dayMasterProfiles.length,
    dayMasterStrengthStates: dataset.dayMasterStrengthStates.length,
    sixtyJiaziNarratives: dataset.sixtyJiaziNarratives.length,
    domainMatrices: dataset.domainMatrices.length,
  };

  console.log("Bazi canonical knowledge dataset");
  console.log(JSON.stringify({ counts, warnings: dataset.warnings }, null, 2));

  if (isDryRun) {
    return;
  }

  const db = createDbClient();

  console.log(`Seeding canonical knowledge into ${path.basename(repoRoot)} ...`);
  await clearTables(db);
  await insertInChunks("bazi_canonical_sources", baziCanonicalSources, dataset.sources, db);
  await insertInChunks(
    "bazi_reference_documents",
    baziReferenceDocuments,
    dataset.referenceDocuments,
    db,
  );
  await insertInChunks(
    "bazi_canonical_raw_rows",
    baziCanonicalRawRows,
    dataset.canonicalRawRows,
    db,
  );
  await insertInChunks(
    "bazi_time_solar_terms",
    baziTimeSolarTerms,
    dataset.timeSolarTerms,
    db,
  );
  await insertInChunks(
    "bazi_faq_taxonomies",
    baziFaqTaxonomies,
    dataset.faqTaxonomies,
    db,
  );
  await insertInChunks(
    "bazi_element_interactions",
    baziElementInteractions,
    dataset.elementInteractions,
    db,
  );
  await insertInChunks(
    "bazi_twelve_qi_stages",
    baziTwelveQiStages,
    dataset.twelveQiStages,
    db,
  );
  await insertInChunks(
    "bazi_day_master_profiles",
    baziDayMasterProfiles,
    dataset.dayMasterProfiles,
    db,
  );
  await insertInChunks(
    "bazi_day_master_strength_states",
    baziDayMasterStrengthStates,
    dataset.dayMasterStrengthStates,
    db,
  );
  await insertInChunks(
    "bazi_sixty_jiazi_narratives",
    baziSixtyJiaziNarratives,
    dataset.sixtyJiaziNarratives,
    db,
  );
  await insertInChunks(
    "bazi_domain_matrices",
    baziDomainMatrices,
    dataset.domainMatrices,
    db,
  );

  if (dataset.warnings.length > 0) {
    console.log(`Warnings: ${dataset.warnings.join(", ")}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});