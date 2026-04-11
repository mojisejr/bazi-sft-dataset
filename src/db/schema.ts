import { sql } from "drizzle-orm";
import { check, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

export const intentDomainEnum = pgEnum("intent_domain", [
  "general",
  "work",
  "wealth",
  "love",
  "health",
  "family",
  "timing",
]);

export const datasetStatusEnum = pgEnum("dataset_status", [
  "draft",
  "reviewed",
  "exported",
]);

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

export type InsertBaziDatasetRecord = typeof baziDatasetRecords.$inferInsert;
export type SelectBaziDatasetRecord = typeof baziDatasetRecords.$inferSelect;