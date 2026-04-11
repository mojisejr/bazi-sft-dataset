# Bazi AI Annotation & Inference System

A Neuro-Symbolic Web Application designed for deep Bazi data annotation and supervised fine-tuning dataset collection.

## Phase Status

- Phase 0: Git isolation and operator provisioning complete.
- Phase 0.5: App scaffold, Drizzle wiring, and Vitest hard-gate foundation complete.
- Phase 1: Real `bazi_dataset_records` schema is the next implementation slice.

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

The current Drizzle schema is scaffold-only and exists to verify infrastructure wiring. Phase 1 will replace or extend it with the real `bazi_dataset_records` schema.

## Owner

Generated via Oracle HQ
