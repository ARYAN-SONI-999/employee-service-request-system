# Limitations & Next Steps

## Known limitations (v1)

- **No notifications.** Status changes and assignments don't trigger email
  or Slack messages — an agent/employee has to open the portal to see
  updates.
- **No file attachments.** A request is text-only; screenshots or
  documents can't be attached.
- **No SLA escalation automation.** Breaches are visible on the dashboard
  and flagged per-request, but nothing automatically reassigns or pages
  anyone when a breach occurs.
- **Single shared JWT secret, no rotation/refresh tokens.** Tokens are
  valid for a fixed window (`JWT_EXPIRES_IN`, default 8h) with no refresh
  flow — acceptable for an internal demo, not for production.
- **No rate limiting on auth endpoints**, so brute-force login attempts
  aren't throttled at the application layer.
- **No browser-level end-to-end tests** (Playwright/Cypress) — coverage is
  API/integration-level against a real database, not click-through UI
  testing. See `docs/TEST_EVIDENCE.md` for what was actually run.
- **Frontend is a single JS bundle** (~630KB unminified reference size,
  ~186KB gzipped) with no route-based code splitting yet.

## Realistic production-readiness roadmap

1. **Security**
   - Add refresh tokens + shorter-lived access tokens.
   - Rate-limit `/auth/login` and `/auth/register`.
   - Rotate `JWT_SECRET` via a secrets manager instead of `.env` in prod.
   - Add HTTPS termination (reverse proxy / load balancer) in front of the
     containers — `docker-compose.yml` as shipped is HTTP-only, suitable
     for local/demo use.
2. **Scalability**
   - Move from a single Postgres container to a managed instance with
     read replicas once request volume grows past a single node.
   - Add pagination to `GET /requests` (currently returns the full scoped
     result set — fine at demo scale, not at 10x load).
   - Introduce a job queue (e.g. BullMQ) for SLA-breach checks and
     notification delivery instead of computing breach status on read.
3. **Governance & maintainability**
   - Add OpenAPI/Swagger spec generated from the route validators, so the
     API contract is documented outside this README.
   - Add structured logging (pino/winston) instead of `morgan` dev output,
     shipped to a log aggregator.
   - Add CI (GitHub Actions) running `npm test` and `npm run build` on
     every PR, using the same migrate → seed → test flow documented here.
4. **Product**
   - File attachments (S3-compatible object storage).
   - Notification channel (email via a transactional provider, or a Slack
     webhook per department).
   - A second-level approval flow for HR requests that require manager
     sign-off before an agent can close them.

## If this had to support 10× the users/data/workload

The schema already indexes the columns every query filters on
(`status`, `category`, `employee_id`, `assigned_agent_id`), so the first
real bottleneck would be the *unpaginated* `GET /requests` — add
`LIMIT`/`OFFSET` (or keyset pagination) before anything else. After that:
move SLA-breach computation from "check on every read" to a scheduled job
that flags rows, add a read replica for the dashboard's aggregate queries
so they don't compete with write traffic on the primary, and put the
frontend behind a CDN since it's a static bundle after build.
