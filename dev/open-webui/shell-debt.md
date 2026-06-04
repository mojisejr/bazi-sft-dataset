# Open WebUI Shell-Only Failure Tracker

This file isolates Open WebUI shell debt from Bazi backend release confidence.

If `npm run gate:open-webui` and `npm run test:open-webui-regression` pass, do not reopen backend correctness work by default. Classify the runtime symptom here first.

## Ownership Split

Operator-owned:
1. Start the local shell runtime.
2. Complete Clerk/OIDC login, consent, and browser-session steps.
3. Confirm the correct model is selected in the Open WebUI UI.

AI-owned:
1. Run deterministic validation in `/Users/non/dev/opilot/projects/bazi`.
2. Interpret structured operational events from the Bazi route.
3. Decide whether the failure belongs to backend, shell, auth, or forwarding lanes.

## Deterministic First

Run these before any browser-only investigation:

1. `cd /Users/non/dev/opilot/projects/bazi && npm run gate:open-webui`
2. `cd /Users/non/dev/opilot/projects/bazi && npm run test:open-webui-regression`

If both pass, backend release confidence remains intact unless new deterministic evidence disagrees.

## Named Waiting States

- `Awaiting Operator Auth`: the shell is not yet authenticated or consent is still pending.
- `Awaiting OpenWebUI Session Ready`: auth is complete but the operator has not yet confirmed the correct chat-ready model/runtime.
- `Browser Truth Pending`: deterministic checks passed, but a runtime-only symptom still needs a minimal same-thread/fresh-thread smoke flow.

## Known Shell-Only Failure Classes

| Failure Class | Typical Symptom | Lane | First Action |
|---|---|---|---|
| `stale_auth_state` | Open WebUI keeps reusing an old local admin/session instead of Clerk-backed login | shell/auth | Run `./reset-auth-state.sh`, restart the shell, and re-login with Clerk only |
| `cookie_or_session_expired` | Browser returns to sign-in or loses the ready-to-chat shell after restart | shell/auth | Re-authenticate; do not treat this as backend persistence failure first |
| `model_binding_mismatch` | Open WebUI talks to the wrong upstream model/runtime despite successful login | shell/runtime | Confirm the visible model binding before rerunning smoke checks |
| `forwarded_identity_missing` | Browser chat reaches Bazi but structured events show `userIdentitySource: none` or nonpersistent due to missing user/thread state | forwarding/shell | Check `ENABLE_FORWARD_USER_INFO_HEADERS=True`, shell config, and thread creation behavior |
| `runtime_artifact_drift` | Screenshots, JSON reports, or text captures start leaking into the repo change set | harness/process | Keep runtime evidence in `/Users/non/dev/opilot/projects/bazi/.playwright-mcp/` only and verify `.playwright-mcp/**` is not tracked |

## Minimal Runtime Smoke Rules

Use the smallest smoke set that can resolve a runtime-only uncertainty:

1. Same-thread continuity check after refresh.
2. Fresh-thread isolation check.

Do not widen into exploratory browser work unless these two checks are ambiguous.

## Artifact Sink Rule

- Local runtime evidence belongs in `/Users/non/dev/opilot/projects/bazi/.playwright-mcp/`.
- Do not use bare filenames that can fall back into the repo root.
- Do not treat runtime evidence as release material unless the human explicitly asks to ship it.

## Escalate To Backend Only When

- `npm run gate:open-webui` fails, or
- `npm run test:open-webui-regression` fails, or
- structured operational events from Bazi contradict the shell-only explanation