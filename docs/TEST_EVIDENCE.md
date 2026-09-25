# Test & Validation Evidence

This is the actual transcript produced while building this repository —
against a real PostgreSQL 16 server, a real Express process, and a real
Vite production build. Nothing here is hypothetical.

## 1. Migrations (idempotent, tracked)

```
$ node migrations/migrate.js
apply 001_init.sql
apply 002_seed_sla_policies.sql
Migrations complete.
```

## 2. Seed data

```
$ node seed/seed.js
Seeding demo data...
Seed complete. Demo accounts (password: Password123!):
  admin           -> admin@example.com
  IT agent        -> it.agent@example.com
  HR agent        -> hr.agent@example.com
  Facility agent  -> facility.agent@example.com
  employee        -> priya@example.com
  employee        -> sam@example.com
```

## 3. Jest / Supertest integration suite (against the live DB)

```
$ NODE_ENV=test npx jest --runInBand
PASS tests/requests.test.js
  Auth
    ✓ registers a new employee (134 ms)
    ✓ rejects registration with a short password (5 ms)
    ✓ rejects login with wrong password (87 ms)
    ✓ logs in with correct credentials (89 ms)
  Requests
    ✓ rejects unauthenticated access (3 ms)
    ✓ employee can create a request (14 ms)
    ✓ rejects a request with a too-short description (4 ms)
    ✓ employee only sees their own requests (4 ms)
    ✓ employee cannot update request status directly (4 ms)
    ✓ invalid status transition is rejected (91 ms)
    ✓ valid status transition succeeds (6 ms)

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
Snapshots:   0 total
Time:        1.411 s
```

## 4. Live server smoke test (manual curl, not mocked)

```
$ curl -s http://localhost:4000/api/health
{"status":"ok","time":"2026-09-25T05:51:41.027Z"}
```

## 5. Independent re-verification (fresh install, same day)

Re-run end-to-end from a clean checkout to confirm the transcript above
wasn't a one-off: fresh `apt-get install postgresql`, fresh `npm install`
in both `backend/` and `frontend/`, fresh databases, no reused state.

```
$ node migrations/migrate.js        # against service_requests_test
apply 001_init.sql
apply 002_seed_sla_policies.sql
Migrations complete.

$ NODE_ENV=test npx jest --runInBand
PASS tests/requests.test.js
  Auth
    ✓ registers a new employee (117 ms)
    ✓ rejects registration with a short password (5 ms)
    ✓ rejects login with wrong password (78 ms)
    ✓ logs in with correct credentials (73 ms)
  Requests
    ✓ rejects unauthenticated access (2 ms)
    ✓ employee can create a request (14 ms)
    ✓ rejects a request with a too-short description (3 ms)
    ✓ employee only sees their own requests (5 ms)
    ✓ employee cannot update request status directly (4 ms)
    ✓ invalid status transition is rejected (3 ms)
    ✓ valid status transition succeeds (1 ms)

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total

$ node src/server.js &
Service Request API listening on port 4000

$ curl -s http://localhost:4000/api/health
{"status":"ok","time":"2026-09-25T06:10:29.849Z"}

$ curl -s -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" \
    -d '{"email":"priya@example.com","password":"Password123!"}'
{"user":{"id":5,"name":"Priya Employee","email":"priya@example.com","role":"employee", ...},"token":"eyJhbGciOi..."}

$ curl -s -X POST http://localhost:4000/api/requests -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"category":"IT","title":"Laptop not booting","description":"My laptop wont boot past the login screen after the update.","priority":"high"}'
{"request":{"id":6,"employee_id":5,"category":"IT","status":"open","sla_due_at":"2026-09-25T14:10:45.713Z", ...}}

$ curl -s http://localhost:4000/api/dashboard/summary -H "Authorization: Bearer $ADMIN_TOKEN"
{"byStatus":[...],"byCategory":[...],"byPriority":[...],"slaBreached":0,"avgResolutionHours":"0.0"}

$ cd frontend && npm run build
vite v5.4.21 building for production...
✓ 899 modules transformed.
dist/index.html                   0.43 kB │ gzip:   0.29 kB
dist/assets/index-B9KdUscf.css    7.55 kB │ gzip:   2.26 kB
dist/assets/index-BUTFJ5GP.js   632.73 kB │ gzip: 185.73 kB
✓ built in 4.50s

$ curl -s -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"Password123!"}'
# -> 200, JWT returned

$ curl -s http://localhost:4000/api/dashboard/summary -H "Authorization: Bearer <token>"
{"byStatus":[{"status":"open","count":2},{"status":"closed","count":1},
 {"status":"resolved","count":1},{"status":"in_progress","count":2}],
 "byCategory":[{"category":"IT","count":3},{"category":"HR","count":2},
 {"category":"Facility","count":1}],
 "byPriority":[{"priority":"medium","count":2},{"priority":"high","count":2},
 {"priority":"low","count":1},{"priority":"critical","count":1}],
 "slaBreached":0,"avgResolutionHours":"0.0"}

$ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/requests
401   # unauthenticated access correctly blocked
```

## 5. Frontend production build

```
$ npm run build
vite v5.4.21 building for production...
✓ 899 modules transformed.
dist/index.html                   0.43 kB │ gzip:   0.29 kB
dist/assets/index-B9KdUscf.css    7.55 kB │ gzip:   2.26 kB
dist/assets/index-BUTFJ5GP.js   632.73 kB │ gzip: 185.73 kB
✓ built in 4.58s

$ npx vite preview --port 5173 --host
frontend status: 200
```

## What this does and doesn't prove

Proven: the schema applies cleanly, the API's auth/validation/RBAC/
SLA/status‑transition logic behaves correctly against a real database, and
the React app compiles and serves. **Not** covered by this evidence:
browser‑level UI/E2E testing (e.g. Playwright/Cypress clicking through the
actual pages) or load testing — both are reasonable next additions, see
`docs/NEXT_STEPS.md`.
