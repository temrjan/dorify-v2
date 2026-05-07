# REVIEWER-LOG

> Reviewer calibration log per `docs/TEAM-CONSTITUTION.md` §12.

## Session 1 — 2026-05-07

Cold-start session. Team adoption of TEAM-CONSTITUTION v1.3.

### Captain decisions log

- **pgvector** approved as vector store choice (vs Qdrant) — single-Postgres source of truth, fewer moving parts.
- **Admin auth** — env-vars + `JwtAuthGuard` wire (vs DB AdminUser table). Single admin горизонт. Migration to AdminUser table when 2nd admin appears.
- **Multicard reconciliation** — cron-only on PENDING > 10 min via `gateway.getInvoiceStatus` (option a). UI button deferred.
- **Encryption** — AES-256-GCM, key from `ENCRYPTION_KEY` env. Format: `iv:authTag:ciphertext` base64. Used for `Pharmacy.multicardSecret` at rest.
- **OFD fields** (`mxik`, `package_code`) — optional on `Product` entity. Validation enforced at order-creation time when pharmacy has Multicard active. Missing codes block invoice creation with explicit error.
- **Multicard signature** — `MD5({store_id}{invoice_id}{amount}{secret})`. Primary source: `docs/MULTICARD_API_DOCUMENTATION.md:281`. Cross-confirmed: dorify v1 prod code, biotact prod code.
- **Multicard sandbox** — `dev-mesh.multicard.uz` for CI/local e2e tests. Prod merchant for post-deploy smoke.
- **Multicard callback IP whitelist** — `195.158.26.90` (per docs line 266). Implementation as `MULTICARD_CALLBACK_IPS` env-overridable list, default to canonical IP.
- **Frontend payment flow** — deferred.

### Findings

- 0 (baseline session, no diff review yet)

### False positives this session

- N/A

### Missed defects (caught later)

- N/A

### Sycophancy near-miss

- Calibration in progress.

### Updates to TEAM-CONSTITUTION proposed

- **Plan ceremony match by scope.** Micro-chores (≤10 LOC, no logic) — Captain explicit override → execute → review post-fact. Full process reserved for non-trivial work. Anchor: this session — 5+ plan-check rounds на удаление одной строки из `package.json` = §11 tunnel symptom.
- **Cross-session handoff via files for plan-text.** `.claude/plans/<date>-<task-slug>.md` proposed as gitignored convention для plan delivery between Reviewer/Engineer sessions. Eliminates Captain copy-paste bottleneck. Pending Captain decision.
