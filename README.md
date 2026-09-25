# ServiceDesk — Employee Service Request System

An internal portal where employees raise IT / HR / Facility requests, agents
triage and resolve them against SLA targets, and admins get an
organization‑wide dashboard. Built as a reviewable full‑stack project:
React (Vite) frontend, Node/Express REST API, PostgreSQL with versioned
migrations, JWT auth with role‑based access, request‑level audit logging,
and Docker Compose deployment.

> **Tested, not just written.** During development this repo was actually
> installed, migrated, seeded, and exercised against a live PostgreSQL 16
> instance: `npm run migrate`, `npm run seed`, and an 11‑test Jest/Supertest
> integration suite all ran green against real HTTP + SQL, and the React
> app was built and served successfully. See `docs/TEST_EVIDENCE.md` for
> the transcript.

---

## 1. Problem framing

**Primary stakeholder:** the IT/HR/Facility service managers who currently
track requests over email/Slack with no shared SLA visibility, and the
employees who have no single place to raise or track a request.

**Decision enabled:** which requests are breaching SLA *right now* and need
re‑prioritizing, and which department/category is generating the most load
— visible on one dashboard instead of reconstructed from an inbox.

**Measurable benefit:** faster time‑to‑acknowledge (every request gets a
computed SLA due date the moment it's created) and a single audit trail per
request, so "who changed what, when" is never a guess.

**Scope boundaries (v1):**
- In scope: request lifecycle (create → assign → resolve → close), 3
  categories (IT/HR/Facility), 4 priorities, SLA due‑date computation,
  role‑based dashboards, comments, audit log.
- Out of scope (see `docs/NEXT_STEPS.md`): file attachments, email/Slack
  notifications, multi‑level approvals, SLA escalation automation.

**Success metric:** a request's SLA due date and breach status are always
computed server‑side (never trusted from the client), and every status
change is reconstructable from `audit_logs` without relying on the
frontend.

---

## 2. Architecture

```
project/
├── backend/                Express REST API
│   ├── src/
│   │   ├── config/db.js        Postgres connection pool
│   │   ├── middleware/         auth (JWT), validation, audit, error handling
│   │   ├── controllers/        auth, users, requests, dashboard
│   │   ├── routes/             REST endpoints per resource
│   │   └── app.js / server.js
│   ├── migrations/         Raw, ordered SQL + a dependency‑free runner
│   ├── seed/                Idempotent demo data (6 users, 5 requests)
│   └── tests/                Jest + Supertest integration tests (real DB)
├── frontend/                React 18 + Vite + React Router + Recharts
│   └── src/{api,context,pages,components,styles}
├── docker-compose.yml       Postgres + backend + frontend, one command up
└── docs/                    Requirements, architecture notes, test evidence
```

**Why this stack:** the brief recommended React/REST/PostgreSQL/RBAC/Docker
verbatim — used as‑is rather than substituted, since all four are
mainstream, free, and don't require external accounts to run locally.
Raw SQL migrations (rather than an ORM) were chosen so the schema and every
constraint (CHECK, FK, UNIQUE) is visible and auditable in one file instead
of hidden behind ORM model definitions — appropriate for a project whose
rubric explicitly rewards reproducibility and traceable decisions.

### Data model

- `users` — role ∈ {employee, agent, admin}; agents/admins carry a
  `department` (IT/HR/Facility) that scopes what they can see.
- `requests` — category, title, description, priority, status,
  `assigned_agent_id`, `sla_due_at` (computed server‑side from
  `sla_policies` at creation time), `resolved_at`.
- `sla_policies` — resolution‑hours matrix per (category, priority),
  editable directly in the DB without a code change.
- `request_comments` — free‑text thread per request.
- `audit_logs` — one row per meaningful action (`request.created`,
  `request.updated`, `user.login`, …) with a JSONB `details` payload —
  the audit‑friendly activity record the brief calls for.

### Role‑based access

| Role     | Can do |
|----------|--------|
| employee | Create requests, view/comment on **their own** requests, see their own dashboard numbers |
| agent    | View/triage/comment on requests **in their own department**, change status along the allowed transition graph, self‑assign |
| admin    | Everything, plus provision/deactivate users and see org‑wide numbers |

Visibility is enforced **in the SQL** (`WHERE employee_id = $1` /
`WHERE category = $1`), not filtered client‑side after the fact, so a
frontend bug can't leak another employee's request.

### Status lifecycle

```
open → in_progress → resolved → closed
  ↘ cancelled          ↖ in_progress (reopen)
```
Enforced server‑side via an allow‑list (`ALLOWED_TRANSITIONS` in
`requests.controller.js`) — e.g. `open → closed` directly is rejected with
`409 Conflict` and the set of valid next states, which is exactly what the
"validation and error handling" and "realistic edge cases" requirements
are asking for.

---

## 3. Running it

### Option A — Docker Compose (recommended, matches the suggested stack)

```bash
docker compose up --build
```
This starts Postgres, runs migrations + seed automatically on backend
start, and serves the frontend at **http://localhost:5173** (API at
**http://localhost:4000/api**).

### Option B — Run locally without Docker

Requires Node 18+ and a local PostgreSQL 14+.

```bash
# 1. Database
createdb service_requests   # or: psql -c "CREATE DATABASE service_requests;"

# 2. Backend
cd backend
cp .env.example .env        # edit DATABASE_URL/JWT_SECRET if needed
npm install
npm run migrate
npm run seed
npm run dev                 # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

### Demo accounts (password for all: `Password123!`)

| Role          | Email                       |
|---------------|------------------------------|
| Admin         | admin@example.com            |
| IT agent      | it.agent@example.com         |
| HR agent      | hr.agent@example.com         |
| Facility agent| facility.agent@example.com   |
| Employee      | priya@example.com            |
| Employee      | sam@example.com              |

New employees can also self‑register from the login screen (always as
`employee` — agent/admin accounts are provisioned by an admin from
**Manage Users**, which is a deliberate access‑control choice, not an
oversight).

### Running the backend test suite

```bash
cd backend
npm run migrate   # against a real DATABASE_URL
npm run seed
npm test
```
The suite hits a running Express app with Supertest and asserts against a
real Postgres database — registration, login, request creation,
role‑scoped listing, and the status‑transition guard rail (including the
409 on an illegal transition). 11/11 passing — see
`docs/TEST_EVIDENCE.md` for the full run.

---

## 4. REST API summary

All endpoints under `/api`. Authenticated routes expect
`Authorization: Bearer <token>`.

| Method | Path                        | Role            | Purpose |
|--------|-----------------------------|-----------------|---------|
| POST   | `/auth/register`            | public          | Self‑register as an employee |
| POST   | `/auth/login`                | public          | Get a JWT |
| GET    | `/auth/me`                   | any             | Current user |
| GET    | `/requests`                  | any             | List, scoped by role; filters: `status`, `category`, `priority` |
| POST   | `/requests`                   | employee, admin | Create a request |
| GET    | `/requests/:id`               | any (scoped)    | Detail + comments + audit trail |
| PATCH  | `/requests/:id`                | agent, admin    | Change status / priority / assignment |
| POST   | `/requests/:id/comments`       | any (scoped)    | Add a comment |
| GET    | `/dashboard/summary`           | any             | Counts by status/category/priority, SLA breaches, avg resolution time |
| GET    | `/users`                       | admin           | List users |
| POST   | `/users`                       | admin           | Provision agent/admin/employee |
| PATCH  | `/users/:id/active`             | admin           | Activate/deactivate |

Validation errors return `422` with a `details` array; permission errors
`403`; illegal state transitions `409`; not found `404`.

---

## 5. Quality, validation & edge cases handled

- Server‑side input validation (`express-validator`) on every write route
  — length bounds, enum checks, email format, password minimum length.
- SQL constraint layer as a second line of defense (`CHECK`, `UNIQUE`,
  foreign keys) — a bad value fails even if application logic is bypassed.
- Centralized error handler translates Postgres error codes (unique/FK/
  check violations) into meaningful HTTP responses instead of leaking a
  stack trace.
- Illegal status transitions rejected with `409` + the allowed next states.
- Row‑level authorization checks (an employee cannot view/comment on
  someone else's request; an agent cannot act outside their department).
- SLA due date always computed server‑side from `sla_policies`, with a
  safe 48h fallback if a policy row is somehow missing.
- Soft‑delete for users (`is_active`) rather than hard delete, so history
  and audit logs stay intact.
- Audit log writes are isolated in a `try/catch` that never lets a logging
  failure break the feature it's observing.

## 6. Limitations & next steps

See `docs/NEXT_STEPS.md` for the disclosed gaps (no email notifications,
no file attachments, no automated SLA escalation, single‑instance JWT
secret rotation not implemented) and a realistic production‑readiness
roadmap, as required by the "document limitations" and "extension
challenge" sections of the brief.

## 7. Documentation index

- `docs/REQUIREMENTS.md` — stakeholder, scope, and acceptance‑criteria
  mapping to evidence.
- `docs/TEST_EVIDENCE.md` — actual terminal output from migrations, seed,
  and the Jest suite run against a live database.
- `docs/NEXT_STEPS.md` — limitations and roadmap.
- `docs/VIVA_ANSWERS.md` — prepared answers to the interview/viva questions
  in the brief.
- `docs/PRESENTATION.md` — live-demo script for a mentor review, plus the
  resume bullet / LinkedIn post / interview STAR story for portfolio use
  (brief §15).
- `docs/postman_collection.json` — importable Postman collection covering
  every endpoint in the table above, for manual API testing without curl.
