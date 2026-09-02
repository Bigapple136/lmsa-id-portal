# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are both:

- LMSA and authorized administrative operators who manage student ID-card records, templates, verification status, submissions, QR codes, exports, and system settings.
- Medical students of A.M. Dogliotti College of Medicine who look up their ID card, preview their details, confirm accuracy, report issues, scan or share QR verification pages, or submit their own information through the public form when enabled.

Support administrators may have narrower admin access than full administrators.

## Product Purpose

The LIMSA ID Card Portal is a full-stack web portal for the Liberia Medical Students Association to manage student ID-card verification for A.M. Dogliotti College of Medicine.

It exists to reduce manual coordination around student rosters, photos, ID-card templates, student confirmations, issue reports, QR verification, and administrative exports. Success means LMSA can maintain accurate card records, collect or correct student details, generate verifiable card assets, and give students a clear, trustworthy path to review their own card information.

## Positioning

A secure LMSA ID-card operations portal that brings student rosters, photo/signature assets, front-and-back card templates, field layout mapping, QR verification, student self-submission, and student self-confirmation into one controlled workflow.

The meaningful product mechanism is not just displaying student data: it connects the operational back office, student-facing confirmation path, public QR verification, configurable card fields, and template/layout tooling around the same source of truth.

## Operating Context

- The institution context is the Liberia Medical Students Association and A.M. Dogliotti College of Medicine.
- Administrators can upload or manually add student records, upload photos/signatures, upload card template images, map printed fields to card sides, configure which fields appear, manage QR-encoded details, review student submissions, manage admin users, export rosters, generate QR codes, renew cohorts, inspect analytics, and download backups.
- Students can search with student ID and full name, preview their card, confirm details, report corrections or photo issues, access a public QR verification page, and use a public self-submission form when admins enable it.
- Bulk student intake expects CSV/Excel-compatible roster data; `sample_students.csv` and backend-generated templates document the expected structure.
- Frontend requests use relative `/api` paths so development can proxy to the backend and production can route through the frontend origin before reaching the Render-hosted API.
- Supabase provides Postgres, storage, and authentication. The backend uses the service role key; browser-side Supabase usage is for authentication/session handling.
- Production deployment is documented as Vercel for the React/Vite frontend and Render for the Express backend, with Supabase for database, storage, and auth.
- The actual production URLs, Supabase keys, QR signing secrets, hCaptcha key, and Sentry DSNs are environment-specific and must not be committed.

## Capabilities and Constraints

- Preserve the existing repository structure unless explicitly asked otherwise: `frontend/` is the React + Vite SPA and `backend/` is the Node.js + Express API.
- Preserve existing routes and workflow intent: `/`, `/preview/:token`, `/qr/:studentId`, `/admin`, `/admin/admins`, `/admin/qr-keys`, `/submit`, `/status`, `/check-status`, `/about`, `/terms`, and `/privacy`.
- Preserve existing API behavior and security posture unless a change is explicitly requested and verified: authenticated admin routes, public student lookup/confirmation/submission flows, rate limits, QR signing, QR key rotation, row-level-security assumptions, audit logs, and backup/export flows.
- Preserve the real LMSA and A.M. Dogliotti identity. Do not replace institution names with placeholders.
- Preserve the current stack and deployment model unless the user explicitly chooses a migration.
- Preserve the navy + gold institutional color system and shared CSS-variable foundation currently recorded in `frontend/src/index.css` and `docs/UI-REDESIGN.md` unless a later redesign request explicitly changes the brand system.
- Use real product content only. Do not invent testimonials, customer names, press, pricing, benchmarks, production URLs, enrollment totals, verification rates, or deployment claims that are not present in the repository or provided by the user.
- Treat missing local `.env` files as expected: local runtime/preview may be blocked until Supabase and backend environment variables are configured.
- Uploaded images and generated files may contain sensitive student information; future work must avoid exposing private records or secrets in public client code, logs, docs, screenshots, or committed artifacts.

## Brand Commitments

- Product name: LIMSA ID Card Portal.
- Organization: Liberia Medical Students Association, shown in the interface as LMSA/LIMSA according to existing copy and assets.
- Institution: A.M. Dogliotti College of Medicine.
- Builder/maintainer credit present in repo docs and admin UI: GoldWay · Emmett Stone Gbatu.
- Existing logo asset: `frontend/public/lmsa-logo.png`.
- Existing visual posture: formal, trustworthy, institutional, readable, and approachable rather than consumer-app playful.
- Current interface language should stay direct and operational: clear labels, concrete status messages, and no invented marketing claims.

## Evidence on Hand

- Product overview, setup, routes, deployment model, CSV format, storage buckets, and stack: `README.md` and `replit.md`.
- Visual redesign notes and current token guidance: `docs/UI-REDESIGN.md`.
- Frontend implementation and routes: `frontend/src/App.jsx`, `frontend/src/pages/`, `frontend/src/components/`, `frontend/src/index.css`, and `frontend/src/lib/api.js`.
- Backend API, security middleware, rate limits, environment validation, and route registration: `backend/index.js`, `backend/env.js`, and `backend/routes/`.
- Database shape, settings, admin roles, RLS, QR signing-key rotation, notifications, templates, submissions, layout history, and support-admin behavior: `sql/` migrations.
- Sample roster input: `sample_students.csv`.
- Existing public assets: `frontend/public/lmsa-logo.png`, `frontend/public/card-template.png`, favicon, and OG images.
- Existing redesign mockups: `mockups/`.
- There is no confirmed testimonial, press quote, pricing model, public metric, live production URL, or enrollment count in the repository evidence. Future work must not fabricate those.

## Product Principles

1. Protect student trust first: student identity, photos, signatures, QR payloads, and administrative actions must stay secure, accurate, and explainable.
2. Keep verification simple for students: lookup, preview, confirm, report, and submit flows should be clear on mobile and resilient to slow or cold-start backend responses.
3. Give admins operational control without hidden side effects: templates, field toggles, layout mapping, QR generation, submissions, exports, renewals, and backups should make state changes visible and reversible where possible.
4. Preserve one source of truth: student records, submission review, card rendering, and QR verification should stay aligned instead of becoming separate manual processes.
5. Prefer institutional clarity over decoration: design decisions should support confidence, readability, and LMSA identity before novelty.

## Accessibility & Inclusion

- The portal must remain usable across desktop, tablet, and narrow mobile screens.
- Interactive states need visible keyboard focus, clear disabled/loading/error states, and readable contrast.
- Student-facing flows should account for shared campus networks, mobile devices, intermittent connectivity, and backend cold starts without prematurely locking users out.
- Forms should use plain language and forgiving guidance for student IDs, names, county/nationality fields, photos, signatures, and correction reporting.
- Privacy-sensitive content should be shown only where the workflow requires it, especially for student records, emergency contacts, addresses, dates of birth, and QR-encoded details.
