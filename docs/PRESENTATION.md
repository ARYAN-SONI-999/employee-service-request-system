# Final Presentation / Demo Script

Use this as the walkthrough for a mentor review or a recorded demo.
Total runtime: ~6-8 minutes.

## 1. Problem, in one breath (30s)
"IT/HR/Facility requests at most small orgs live in email and Slack DMs —
nobody can see what's overdue, and there's no record of who changed what.
ServiceDesk is a portal that fixes that: employees raise requests, agents
triage them against an SLA clock, admins see it all on one dashboard, and
every change is logged."

## 2. Architecture, in one breath (30s)
"React frontend, Express REST API, PostgreSQL with versioned SQL
migrations, JWT auth with three roles, Docker Compose for one-command
deployment." *(Point at the `project/` tree in `README.md` §2 while
saying this.)*

## 3. Live walkthrough (4-5 min)

| Step | Action | What it demonstrates |
|---|---|---|
| 1 | `docker compose up --build` (or the manual steps in README §3) | Deployment-ready configuration |
| 2 | Log in as `priya@example.com` / `Password123!` | Auth + JWT |
| 3 | Submit a new IT request ("Laptop won't boot") | REST API write path, server-side validation |
| 4 | Show the request detail page — note the auto-computed **SLA due date** | Business logic lives server-side, not trusted from the client |
| 5 | Log out, log in as `it.agent@example.com` | Role-based access — agent only sees IT department requests |
| 6 | Try to jump the new request straight to `closed` | Rejected with `409` + allowed next states — validation/error handling |
| 7 | Move it `open → in_progress`, add a comment | Valid transition + audit trail |
| 8 | Open the request detail again, scroll to **Activity Log** | Audit-friendly activity records |
| 9 | Log in as `admin@example.com`, open **Dashboard** | Org-wide view, SLA breach count, role-based data ownership |
| 10 | Open **Manage Users**, deactivate an account | Admin-only role management |

## 4. Quality evidence (30s)
"This isn't just written, it's tested." Show `docs/TEST_EVIDENCE.md`:
11/11 integration tests passing against a live Postgres instance,
migrations + seed run cleanly, and the production frontend build
succeeds. *(The independent re-verification log at the bottom of that
file was captured from a from-scratch install, not copied from an
earlier run.)*

## 5. Limitations, honestly (30s)
"No email notifications yet, no file attachments, no SLA auto-escalation.
All disclosed with a concrete roadmap in `docs/NEXT_STEPS.md` — the
10x-scale answer is `GET /requests` pagination first, since that's the
one endpoint that returns an unbounded result set today."

## 6. Close (15s)
"Stakeholder is the department service manager; the decision it enables
is what to re-prioritize right now based on real SLA breaches instead of
digging through an inbox."

---

## Portfolio value (brief §15)

### Resume bullet
> Built ServiceDesk, a full-stack employee service-request portal
> (React, Express, PostgreSQL, Docker) with JWT role-based access for
> 3 user roles, automated SLA-due-date computation, and an auditable
> activity log; validated with an 11-test integration suite against a
> live database.

### LinkedIn post draft
> Just shipped ServiceDesk — an internal IT/HR/Facility request portal
> I built end-to-end: React + Vite frontend, an Express REST API,
> PostgreSQL with versioned migrations, and Docker Compose for
> one-command deployment.
>
> A few things I focused on beyond "it works":
> — Role-based access enforced in SQL, not just hidden UI buttons
> — SLA due dates computed server-side so the client can never fake them
> — Every request change lands in an audit log, so "who did what, when"
>   is never a guess
> — 11 integration tests running against a real Postgres instance, not
>   mocks
>
> Repo + docs: [link]. Open to feedback!
> #fullstack #react #postgresql #webdev

### Interview story (STAR)
- **Situation:** Internal requests (IT/HR/Facility) tracked over email
  with no shared visibility into what's overdue.
- **Task:** Build a full-stack portal with role-based access, an SLA
  clock, and an auditable history, deployable with one command.
- **Action:** Designed the schema around auditability first — every
  write path (`request.created`, `request.updated`, `user.login`) logs
  to `audit_logs` — then layered role-scoped SQL queries, a status
  transition allow-list, and server-side SLA computation so none of it
  could be bypassed from the client. Containerized both services and
  wrote an integration suite that runs against a real database instead
  of mocks.
- **Result:** 11/11 tests passing, a working demo with seeded accounts
  for all three roles, and a documented roadmap for the gaps (file
  attachments, notifications, pagination at 10x scale) instead of
  pretending they don't exist.
