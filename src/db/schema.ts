import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export type PillarValue = {
  stem: string;
  branch: string;
  hiddenStems?: string[];
};

export type RawInputValue = {
  birthDate: string;
  birthTime: string;
  gender: string;
  province: string;
  calendarSystem?: "solar" | "lunar";
  timezone?: string;
};

export type CalculatedStateValue = {
  fourPillars: {
    year: PillarValue;
    month: PillarValue;
    day: PillarValue;
    hour: PillarValue;
  };
  dayMaster: string;
  strengthScore: number;
  tenGods: Record<string, string>;
  twelveQi: Record<string, string>;
};

export type CanonicalMetadataValue = Record<string, unknown>;

export type CanonicalRawCellsValue = string[];

export type CanonicalHeadingValue = string[];

export const intentDomainEnum = pgEnum("intent_domain", [
  "general",
  "work",
  "study",
  "wealth",
  "love",
  "health",
  "family",
  "other",
  "timing",
]);

export const datasetStatusEnum = pgEnum("dataset_status", [
  "draft",
  "reviewed",
  "exported",
]);

export const knowledgeDomainEnum = pgEnum("bazi_knowledge_domain", [
  "general",
  "work",
  "study",
  "wealth",
  "love",
  "health",
  "family",
  "other",
  "timing",
]);

export const knowledgeSourceFormatEnum = pgEnum("bazi_knowledge_source_format", [
  "csv",
  "markdown",
  "docx",
  "xlsx",
]);

export const sourceRootEnum = pgEnum("bazi_source_root", [
  "distilled",
  "raw",
]);

export const matrixDomainEnum = pgEnum("bazi_matrix_domain", ["love", "work"]);

export const reviewedDatasetContentCheckName =
  "bazi_dataset_records_reviewed_content_check";

export const baziDatasetRecords = pgTable(
  "bazi_dataset_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rawInput: jsonb("raw_input").$type<RawInputValue>().notNull(),
    calculatedState: jsonb("calculated_state")
      .$type<CalculatedStateValue>()
      .notNull(),
    intentDomain: intentDomainEnum("intent_domain").notNull().default("general"),
    chainOfThought: text("chain_of_thought"),
    targetOutput: text("target_output"),
    status: datasetStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      reviewedDatasetContentCheckName,
      sql`(
        ${table.status} <> 'reviewed'
        OR (
          nullif(btrim(${table.chainOfThought}), '') IS NOT NULL
          AND nullif(btrim(${table.targetOutput}), '') IS NOT NULL
        )
      )`,
    ),
  ],
);

export const baziCanonicalSources = pgTable("bazi_canonical_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  relativePath: text("relative_path").notNull().unique(),
  sourceRoot: sourceRootEnum("source_root").notNull(),
  sourceFormat: knowledgeSourceFormatEnum("source_format").notNull(),
  title: text("title").notNull(),
  domain: knowledgeDomainEnum("domain").notNull().default("general"),
  normalizedTable: text("normalized_table"),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const baziReferenceDocuments = pgTable("bazi_reference_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull().unique(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  domain: knowledgeDomainEnum("domain").notNull().default("general"),
  content: text("content").notNull(),
  headings: jsonb("headings").$type<CanonicalHeadingValue>().notNull().default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const baziCanonicalRawRows = pgTable("bazi_canonical_raw_rows", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  sourceGroup: text("source_group").notNull(),
  rowOrder: integer("row_order").notNull(),
  primaryValue: text("primary_value"),
  secondaryValue: text("secondary_value"),
  cells: jsonb("cells").$type<CanonicalRawCellsValue>().notNull().default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziTimeSolarTerms = pgTable("bazi_time_solar_terms", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path"),
  label: text("label").notNull(),
  solarTermName: text("solar_term_name"),
  boundaryAt: text("boundary_at"),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziFaqTaxonomies = pgTable("bazi_faq_taxonomies", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  rowGroup: integer("row_group").notNull(),
  questionOrder: integer("question_order").notNull(),
  rawTypeLabel: text("raw_type_label").notNull(),
  primaryIntent: knowledgeDomainEnum("primary_intent").notNull(),
  intentDomains: jsonb("intent_domains").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  questionText: text("question_text").notNull(),
  normalizedQuestion: text("normalized_question").notNull(),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziElementInteractions = pgTable("bazi_element_interactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  sourceTable: text("source_table").notNull(),
  dayMaster: text("day_master"),
  leftSymbol: text("left_symbol").notNull(),
  rightSymbol: text("right_symbol"),
  relationType: text("relation_type").notNull(),
  qiLabel: text("qi_label"),
  note: text("note"),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziTwelveQiStages = pgTable("bazi_twelve_qi_stages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  stageOrder: integer("stage_order").notNull(),
  stageNameChinese: text("stage_name_chinese").notNull(),
  stageNameThai: text("stage_name_thai").notNull(),
  dayMaster: text("day_master").notNull(),
  branch: text("branch").notNull(),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziDayMasterProfiles = pgTable("bazi_day_master_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  recordNumber: integer("record_number"),
  dayMasterCode: text("day_master_code").notNull(),
  branchCode: text("branch_code").notNull(),
  dayMasterChinese: text("day_master_chinese"),
  branchChinese: text("branch_chinese"),
  baselineOriginal: text("baseline_original"),
  dayMasterTrait: text("day_master_trait"),
  mergedBaseline: text("merged_baseline"),
  interpretedProfile: text("interpreted_profile"),
  conciseProfile: text("concise_profile"),
  combinedNarrative: text("combined_narrative"),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziDayMasterStrengthStates = pgTable("bazi_day_master_strength_states", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  sourceVariant: text("source_variant").notNull(),
  dayMasterCode: text("day_master_code"),
  dayMasterChinese: text("day_master_chinese"),
  strengthState: text("strength_state"),
  scoreText: text("score_text"),
  qiLabel: text("qi_label"),
  narrativeSummary: text("narrative_summary"),
  rowOrder: integer("row_order").notNull(),
  rawCells: jsonb("raw_cells").$type<CanonicalRawCellsValue>().notNull().default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziSixtyJiaziNarratives = pgTable("bazi_sixty_jiazi_narratives", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  rowGroup: integer("row_group").notNull(),
  dayMasterCode: text("day_master_code").notNull(),
  dayMasterChinese: text("day_master_chinese").notNull(),
  branchCode: text("branch_code").notNull(),
  branchChinese: text("branch_chinese").notNull(),
  elementTone: text("element_tone"),
  twelveQiLabel: text("twelve_qi_label"),
  dayMasterNarrative: text("day_master_narrative"),
  branchNarrative: text("branch_narrative"),
  combinedNarrative: text("combined_narrative"),
  rawCells: jsonb("raw_cells").$type<CanonicalRawCellsValue>().notNull().default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziDomainMatrices = pgTable("bazi_domain_matrices", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  domain: matrixDomainEnum("domain").notNull(),
  sourceVariant: text("source_variant").notNull(),
  pairKey: text("pair_key"),
  rowOrder: integer("row_order").notNull(),
  code: text("code"),
  label: text("label"),
  scoreText: text("score_text"),
  narrative: text("narrative"),
  rawCells: jsonb("raw_cells").$type<CanonicalRawCellsValue>().notNull().default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertBaziDatasetRecord = typeof baziDatasetRecords.$inferInsert;
export type SelectBaziDatasetRecord = typeof baziDatasetRecords.$inferSelect;
export type InsertBaziCanonicalSource = typeof baziCanonicalSources.$inferInsert;
export type InsertBaziReferenceDocument = typeof baziReferenceDocuments.$inferInsert;
export type InsertBaziCanonicalRawRow = typeof baziCanonicalRawRows.$inferInsert;
export type InsertBaziTimeSolarTerm = typeof baziTimeSolarTerms.$inferInsert;
export type InsertBaziFaqTaxonomy = typeof baziFaqTaxonomies.$inferInsert;
export type InsertBaziElementInteraction = typeof baziElementInteractions.$inferInsert;
export type InsertBaziTwelveQiStage = typeof baziTwelveQiStages.$inferInsert;
export type InsertBaziDayMasterProfile = typeof baziDayMasterProfiles.$inferInsert;
export type InsertBaziDayMasterStrengthState = typeof baziDayMasterStrengthStates.$inferInsert;
export type InsertBaziSixtyJiaziNarrative = typeof baziSixtyJiaziNarratives.$inferInsert;
export type InsertBaziDomainMatrix = typeof baziDomainMatrices.$inferInsert;