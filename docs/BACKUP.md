# Backup System

Full-admins download a complete backup from **Admin → Settings → System →
Download Full Backup**. The backup is a ZIP containing every database table
(as JSON) plus every uploaded file (photos, signatures, QR codes,
templates), with a `manifest.json` describing exactly what was captured.

## What's inside the ZIP

```
lmsa-backup-2026-09-09T17-30-00.zip
├── manifest.json            # timestamps, per-table row counts, per-bucket
│                            # file/byte counts, failures, excluded tables
├── database/
│   ├── students.json
│   ├── admins.json
│   ├── admin_role_logs.json
│   ├── portal_settings.json
│   ├── templates.json
│   ├── confirmations.json
│   ├── student_submissions.json
│   ├── correction_requests.json
│   ├── admin_actions.json
│   ├── layout_history.json
│   ├── notifications.json
│   ├── notification_reads.json
│   └── qr_audit.json
└── files/
    ├── photos-and-signatures/   # `id-cards` bucket
    ├── qr-codes/                # `qr-codes` bucket
    └── templates/               # `templates` bucket
```

- **Empty tables still get a file** (`[]`), so "empty" is never ambiguous
  with "skipped". A table that failed to read gets
  `{ "error": "..." }` **and** is flagged in the manifest.
- **Failed file downloads don't abort the run** — they're counted per
  bucket and the first 50 are listed in `manifest.json` (`failed_files`).
  Always check `failed_files_truncated` / the `failed` counts after a
  restore-critical backup.

## Deliberate exclusion: `qr_keys`

`qr_keys` holds QR **signing secrets in plaintext**. It is intentionally
**not** in the ZIP — anyone who can open a backup file must never get the
keys that mint valid student QR codes.

Back the keys up through a separate, access-controlled channel:

1. In Supabase → Table Editor → `qr_keys`, export the rows **once** after
   each rotation (rotations are rare, manual events).
2. Store that export encrypted/offline (password manager secure note,
   encrypted drive) — never next to the downloadable backup ZIPs.
3. The `QR_SIGNING_SECRET` env var (dev fallback / legacy seed) is already
   stored in Render's dashboard, not in git.

`backend/tests/backup.test.js` enforces that every table in `sql/` is
either backed up or a documented exclusion, so a future migration can't
silently fall out of backups.

## How it runs

- `POST /api/backup` (full admin only) queues a background job and returns
  `{ queued, jobId }` immediately. Status/download via `GET
  /api/jobs/:jobId` (or `GET /api/backup/:jobId`).
- Jobs live in a **filesystem-backed store** (`$TMPDIR/lmsa-jobs`, 30-min
  TTL), because production runs multi-worker `node cluster.js` and each
  request can land on any worker. Result files stream from disk.
- Tables are fetched with bounded parallelism (4×) and files downloaded
  through a bounded pool (8×). Photos/binaries are STORED uncompressed
  (they gain nothing from DEFLATE); JSON is DEFLATEd.
- Queueing/downloading is rate-limited (10 per 15 min per IP) and every
  step is audit-logged to `admin_actions`: `backup_queued`,
  `backup_completed` (row/file counts, bytes), `backup_failed`,
  `backup_downloaded` (who, when, bytes).
- Legacy paths kept for compatibility: `GET /api/backup?background=true`
  (queues) and `GET /api/backup` (builds inline and downloads directly —
  fine for small data, but the background job is the recommended path).

### Scaling caveat

The job store is visible to all workers **on one host**. If the backend
ever scales to 2+ hosts/instances, background jobs also need sticky
sessions (or a shared store) or polls may 404 across instances.

## Restore (guided, in-app)

**Admin → Settings → System → Restore from backup.** Full admins only,
every step audit-logged (`restore_uploaded/started/completed/failed/
discarded` in `admin_actions`).

1. **Upload & validate** — attach a backup ZIP. The server streams it to a
   staging area (never fully in memory), rejects anything without a valid
   `manifest.json`, and summarizes tables/rows/files plus warnings.
2. **Review the preview** — a live-vs-backup diff per table (backup rows
   vs current rows, Merge/Skip per table) and per bucket. The preview
   must be viewed before apply is allowed.
3. **Type `RESTORE` to apply** — optionally uncheck file restore to merge
   database rows only. Apply runs as a background job with phase progress:
   - **Snapshot first**: the CURRENT live data is backed up to a
     pre-restore snapshot before a single row changes. If the snapshot
     fails, the restore aborts untouched. The snapshot stays downloadable
     from the result screen for 24 hours.
   - **Tables merge** in foreign-key-safe order (upsert by primary key).
     Backup rows overwrite same-record live rows; **live-only rows are
     never deleted**. Rows that fail (e.g. referencing a removed admin
     login) are skipped and reported, never silently dropped — whole
     batches that fail are retried row-by-row so one bad row can't sink
     499 good ones. Re-running apply after a partial failure is safe.
   - **Files merge** (same-path overwrite, live-only files untouched).
   - The `qr_audit` id sequence is advanced afterwards (requires
     `sql/017_restore_sequence_reset.sql` to have been run once in
     Supabase; otherwise you get a warning naming it).
4. **Verify** — spot-check student lookup, a preview page, and QR
   verification. Keep the pre-restore snapshot until you are satisfied.

Rules that always hold: nothing applies without the typed phrase; nothing
applies without a snapshot; merges never delete; `qr_keys` is never
touched (restore it separately if needed — see above). Staged uploads and
snapshots expire after 24 hours.

## Restore runbook (manual fallback)

If the app itself is down and the guided restore is unreachable, the same
recovery can be done by hand in Supabase:

1. **Stop the bleeding**: disable the affected writes first (e.g. close
   the submission form, pause imports).
2. **Database**: in Supabase → Table Editor (or SQL Editor), re-import each
   `database/*.json` file.
   - `manifest.json → tables` tells you the expected row count per table —
     verify counts after import.
   - Import order matters for foreign keys: `students` before
     `correction_requests` / `confirmations` / `student_submissions`;
     `admins` before `admin_actions` / `notification_reads`.
   - `admins` rows reference Supabase Auth users by `id` — recreating auth
     users is separate (Authentication → Users); the JSON preserves the
     ids to relink.
   - After re-importing `qr_audit`, run
     `sql/017_restore_sequence_reset.sql` (or
     `SELECT setval('qr_audit_id_seq', (SELECT MAX(id) FROM qr_audit));`)
     so the id sequence matches the restored rows.
3. **Files**: re-upload each `files/<folder>/…` tree to its bucket
   (`photos-and-signatures` → `id-cards`, `qr-codes` → `qr-codes`,
   `templates` → `templates`), preserving subfolder paths — the database
   stores full storage paths, so the layout must match exactly.
4. **`qr_keys`**: restore from the separate secure key backup (above), or
   rotate to a fresh key and re-generate QR codes if the keys are lost.
   Without the original keys, previously printed QR codes will not verify.
5. **Verify**: spot-check the student lookup, a preview page, and QR
   verification before re-enabling writes.

## Also worth knowing

- Supabase itself keeps automatic daily database backups (project
  Settings → Database → Backups, retention depends on plan). The portal's
  ZIP backup complements that: it's portable, includes Storage files, and
  can be pulled on demand before risky operations (cohort renewal, bulk
  imports).
- Backup ZIPs contain unencrypted student PII + photos. Download over the
  admin session only, store securely, and delete local copies when done.
