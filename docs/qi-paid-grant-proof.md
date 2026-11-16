# Atomic paid QI grant repair

The deployed Bazi revision `366b9437e66511de09eccb49274c5877fff6513b` checks a reference, increments a wallet and inserts its ledger in separate statements. Concurrent identical requests can credit twice. The new paid path takes a global reference advisory lock in an explicit READ COMMITTED transaction, then records purchase, wallet, first-purchase claim and bonus atomically. Exact historical retries do not mutate data; conflicting recipient, amount, reason or ledger shape returns 409. An uncertain commit returns 503 without automatic replay; the caller may retry the same payload/reference.

No schema migration or historical balance correction. All paid-grant instances must use this path; advisory locking is cooperative. General earn/spend and referral reward atomicity are outside this repair. The standalone first-buy reward entry point is denied because the purchase transaction owns it.

## Local proof

- Seven actual-SQL cases passed on disposable PostgreSQL 17.6 and transaction PgBouncer 1.26.1 (the isolation-default case uses the direct companion database).
- Ten concurrent identical requests produce one purchase and one 30-QI bonus; three distinct references produce 330 QI with one bonus.
- Changed recipient/amount/reason cannot credit again. A failed ledger insertion rolls back wallet and claim.
- A lost COMMIT acknowledgement followed by an explicit retry does not credit twice. A lock timeout cannot dispatch late writes.
- Explicit READ COMMITTED overrides an inherited repeatable-read default so a lock waiter sees the winner.
- Seven route tests pass, including unauthorized requests, input validation, conflict, sanitized unknown outcome, standalone bonus denial and unrelated earn behavior.
- Runtime regression gate: 12 files, 107 tests pass. Typecheck, changed-file ESLint and optimized Next build pass.
- Repository-wide lint has 91 pre-existing errors outside changed files; source files reporting them match deployed revision. They are not reported as passing or repaired.

Production read-only preflight found 18 paid rows, zero missing references, zero duplicate-reference groups and zero conflicting-reference groups among 9,471 ledger rows. These counts do not prove historical wallet consistency.

## Staging and release gates

Staging synthetic proofs and compiled-image route/cutover proofs must pass before production. Use exact environment-specific images. This branch is based on deployed Bazi, so it must be merged into pdf-dev without squashing and released by its own tested ancestor SHA, avoiding unrelated newer features.

Before cutover, rehearse old-image graceful SIGTERM with an active synthetic paid request. Verify PID 1, signal handler configuration, request completion and ledger/bonus markers; exit 143 alone is insufficient. Suspend health auto-recovery while draining, stop old Bazi with a 120-second grace, and reject a forced kill, OOM or intervening recreation. New requests during the drain fail before grant and rely on existing FE reconciliation. Use the existing named release with its explicit fix-forward option after the old process exits. Resume health recovery after exact image/health verification.

Normal deployment auto-rolls back on failure. Without a schema change this remains compatible, but restoring the old Bazi handler restores its known QI risk; it is not a safe grant-processing hold. Stop affected release work and report that condition. Never describe this patch as proving all QI operations or repairing historical balances.
