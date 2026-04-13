console.error(
  [
    "db:push is disabled for Phase 1.6.",
    "Use `npm run db:generate` to create reviewed SQL first.",
    "If the reviewed migration is safe, use `npm run db:migrate:safe`.",
  ].join("\n"),
);

process.exit(1);
