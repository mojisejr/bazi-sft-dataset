# Bazi AI Annotation & Inference System

A Neuro-Symbolic Web Application designed for deep Bazi data annotation and supervised fine-tuning dataset collection.

## Phase Status

- Phase 0: Git isolation and operator provisioning complete.
- Phase 0.5: App scaffold, Drizzle wiring, and Vitest hard-gate foundation complete.
- Phase 1: `bazi_dataset_records` schema is live in Drizzle and Neon.
- Phase 1.5: Canonical knowledge normalization landed for the current Mootech corpus, including FAQ taxonomy, interaction tables, day-master profiles, 60 Jiazi narratives, and domain matrices.
- Phase 1.5 blocker: the raw 100-year solar-term source is still missing from the current corpus, so `bazi_time_solar_terms` exists in schema but remains unseeded.

## Stack

- Next.js 16 with App Router and TypeScript
- Neon PostgreSQL via `@neondatabase/serverless`
- Drizzle ORM + Drizzle Kit
- Vitest for deterministic tests
- Zod for environment validation

## Quick Start

1. Copy `.env.example` to `.env.local` and place the active Neon connection string in `DATABASE_URL`.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev`.
4. Run the hard gate with `npm run build && npm run lint && npm run test`.

## Database Scripts

- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:push`
- `npm run db:studio`
- `npm run db:seed:canonical:dry`
- `npm run db:seed:canonical`

The current Drizzle schema defines the Phase 1 `bazi_dataset_records` table plus the Phase 1.5 canonical knowledge tables used to store the online single source for the distilled Mootech corpus.

## Owner

Generated via Oracle HQ
