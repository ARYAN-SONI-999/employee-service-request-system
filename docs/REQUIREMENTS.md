# Requirements & Acceptance Criteria Mapping

## Stakeholder & success metric
- **Primary stakeholder:** department service managers (IT/HR/Facility) and
  the admin overseeing all three; secondary stakeholder: every employee who
  raises a request.
- **Decision enabled:** re‑prioritize work based on real‑time SLA breach
  count, visible per department on the dashboard.
- **Success metric:** every request has a server‑computed SLA due date and
  an unbroken audit trail from creation to closure.

## Required feature → where it lives

| Requirement | Implementation |
|---|---|
| Role‑based access | `role` column + `authorize()` middleware + SQL‑level scoping in every list/detail query |
| REST API integration | Express routers under `/api/{auth,users,requests,dashboard}` |
| Relational DB with migrations | PostgreSQL, versioned SQL files in `backend/migrations/`, tracked in `schema_migrations` |
| Validation & error handling | `express-validator` chains + centralized `errorHandler` translating Postgres error codes |
| Audit‑friendly activity records | `audit_logs` table, written on every login, request creation, update, and comment |
| Deployment‑ready configuration | `docker-compose.yml`, per‑service `Dockerfile`, `.env.example` files, `nginx.conf` for the built frontend |

## Acceptance criteria checklist

- [x] All core requirements completed and mapped to evidence (this file +
      `docs/TEST_EVIDENCE.md`).
- [x] Reproducible by a mentor: `docker compose up --build` or the
      documented manual steps in the root `README.md`.
- [x] Quality checks documented: 11 passing integration tests, a manual
      curl smoke test transcript, and a successful production frontend
      build — all in `docs/TEST_EVIDENCE.md`.
- [x] Professionally organized, consistent naming (`backend/`, `frontend/`,
      `docs/`), ready to demo with seeded accounts.
- [x] Decisions, trade‑offs and limitations documented (`README.md` §2,
      `docs/NEXT_STEPS.md`, `docs/VIVA_ANSWERS.md`).

## Realistic edge cases handled

- Duplicate email on registration → `409` via Postgres unique‑violation
  mapping, not a raw stack trace.
- Illegal status jump (e.g. `open → closed`) → `409` with the allowed next
  states returned, so the frontend can react without guessing.
- Employee attempting to view/comment on another employee's request →
  `403`.
- Agent attempting to act on a request outside their department → `403`.
- Missing/expired JWT → `401`, and the frontend clears local storage and
  redirects to `/login` automatically.
- SLA policy missing for a (category, priority) pair → falls back to a
  conservative 48‑hour default instead of leaving `sla_due_at` null.
- Deactivated user (`is_active = false`) cannot log in even with the
  correct password.
