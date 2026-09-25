# Viva / Interview Prep

**What business or user problem does the project solve, and how did you
define success?**
Employees had no single place to raise IT/HR/Facility issues, and
department managers had no shared view of SLA performance. Success was
defined as: every request gets a server-computed SLA due date at creation,
every state change is reconstructable from an audit log, and each role
sees exactly the data it's entitled to — nothing more.

**Which design, technical, analytical or research decision had the
biggest impact on the result?**
Enforcing role-based visibility *in the SQL WHERE clause* rather than
filtering results after fetching them. It means an employee literally
cannot receive another employee's request row from the database, which is
a stronger guarantee than a frontend check or a post-hoc filter — a bug in
the UI can't leak data if the API never returned it.

**How did you validate the quality or correctness of your work?**
Ran the whole stack for real: applied the SQL migrations against a live
PostgreSQL 16 instance, seeded demo data, and ran an 11-test Jest +
Supertest suite that exercises actual HTTP requests against a running
Express app and a real database — not mocks. Also manually smoke-tested
with curl (health check, login, dashboard aggregation, and confirming
unauthenticated requests are rejected with 401) and produced a clean
production build of the React frontend. Full transcript in
`docs/TEST_EVIDENCE.md`.

**What edge cases, limitations or risks did you identify?**
Illegal status transitions (e.g. jumping straight from `open` to
`closed`), duplicate email registration, an agent trying to act outside
their department, a missing SLA policy row, and a deactivated user trying
to log in — all handled explicitly with tests or server-side checks. Known
gaps (no notifications, no attachments, no SLA escalation automation, no
browser-level E2E tests) are disclosed in `docs/NEXT_STEPS.md` rather than
left implicit.

**What would you change if this solution had to support 10× the
users/data/workload?**
First: paginate `GET /requests`, which currently returns the full scoped
result set. Then: move SLA-breach detection from a per-read calculation to
a scheduled background job, add a read replica for dashboard aggregates,
and put the frontend behind a CDN since it's a static bundle post-build.

**How would you explain the project to a non-technical stakeholder?**
"It's a help-desk portal. You submit a request, it goes to the right team
automatically based on what kind of issue it is, and everyone — including
you — can see whether it's on track to be handled in time. Nothing gets
lost in an inbox, and there's a full history of who did what and when."

**Which part of the project required the most independent
problem-solving?**
Designing the status-transition guard rail (`ALLOWED_TRANSITIONS`) so the
API rejects invalid state jumps with a `409` and tells the caller what
transitions *are* valid, rather than either silently allowing any
transition or hard-coding a single linear path that couldn't handle a
reopened ("resolved → in_progress") request.
