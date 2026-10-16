# Cloud quotas

Applied to the connected Supabase project in migrations `enforce_cloud_storage_quotas` and `harden_cloud_quota_access_and_account_cascades`.

For fresh installations, apply `film_lab_cloud.sql` and existing hardening patches, then `film_lab_storage_quota.sql` and `film_lab_storage_quota_hardening.sql` in that order. Do not replay either quota migration on an existing installation.

## Limits

Each account defaults to 1 GiB, 100 projects and 1,000 original files. Each project accepts at most 100 files, including inactive files retained in history. Bucket limits remain 50 MiB/original and 2 MiB/thumbnail. Original and thumbnail bytes both consume the account budget. These are initial beta limits, not subscription entitlements.

The private `film_private.cloud_quotas` table is writable only by trusted backend roles. Change its `limit_bytes`, `max_projects` or `max_assets` administratively for an existing account. Never grant clients write access or base authorization on editable user metadata. Future accounts receive the column defaults.

## Accounting and safety

- A pending asset always reserves 52 MiB, even if the client declares one byte. This covers the maximum original plus thumbnail. Near-full accounts need 52 MiB free to initiate another upload; the implementation deliberately prefers a conservative reservation to trusting client declarations.
- A ready asset is charged the actual sizes observed in Storage metadata, and its original size must match the registered size. Ready assets cannot be overwritten directly. Retrying an upload first reopens a pending reservation.
- Counter updates are atomic and conditional; multiple requests cannot consume the same remaining budget. UPSERT is accounted in AFTER triggers, avoiding double charging on conflict. Existing over-budget accounts retain access, can make non-growing updates and delete projects.
- Registered paths, size and owner/project identity cannot be changed. Metadata/project deletion is rejected while objects still exist. Delete objects through the Storage API first, as the existing project-delete flow does. Do not delete Storage rows with SQL.
- Canceled uploads retain their reservation until their project is deleted or the upload resumes. No automatic destructive cleanup is installed.
- No Storage tables/triggers are modified. Two restrictive policies intersect the existing owner policies for uploads/updates. The quota table has RLS, an explicit deny policy and no client table grants. Internal trigger functions are not client-executable. The public read-only RPC returns only the caller's totals.
- Removed client TRUNCATE, TRIGGER and REFERENCES privileges from the application tables; RLS alone does not protect TRUNCATE.

## Validation

35 existing Node tests and syntax checks pass. `tests/sql/cloud-quota.sql` validates reservation, UPSERT idempotence, understated bytes, quota rejection, fabricated completion, immutable identity, private quota access, lack of TRUNCATE, release and account isolation. It creates diagnostic accounts and always rolls back: run only against a disposable test database.

Optional local PostgreSQL integration (PGlite): install `@electric-sql/pglite@0.3.14` as a local development-only package without changing the lockfile, then run `node tests/sql/cloud-quota.local.mjs`. The fixture also checks actual-size finalization, sealing of ready uploads and orphan-deletion protection. It never connects to Supabase. No new production dependency is required.

The deployed read-only RPC, accounting totals, ready-upload rejection and revoked privileges were verified in Supabase. Full transactional fixture execution through the connector was unavailable due to `Invalid or expired requestState`; the equivalent fixtures passed in isolated PostgreSQL. No production traffic/load stress test or native Safari test was performed.

## Remaining launch work

Per-account quotas do not cap aggregate usage across many accounts, network egress, request rates or authentication abuse. They do not prevent a traffic spike from exhausting compute. Before broad launch, verify the hosting/Supabase plans and budgets, enable usage/error monitoring, configure signup abuse controls and run a staged load test outside production. These changes do not purchase or resize any service.

The Supabase security advisor still reports leaked-password protection disabled. Enable the feature if supported by the current plan: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Performance advisor notices about unused indexes are informational on this small dataset; ownership and foreign-key indexes are retained.

## Missing cloud references

The client validates restored project/asset references on login. A missing reference or `ASSET_NOT_FOUND` from `save_edit` preserves files, settings and undo in a local recovery draft. Automatic cloud retries pause and Reintentar opens the explicit Save Project dialog. Saving creates a new copy with new cloud IDs. The recovery flag survives reloads; no missing cloud content is recreated without an explicit save. The original error was observed in production logs, not inferred from the preview.

Optional DOM integration: `tests/browser/cloud-sync-recovery.mjs` (happy-dom@21.0.1) covers runtime failure, login detection, no retry loop, explicit copy and reload persistence. No production dependency is added.
