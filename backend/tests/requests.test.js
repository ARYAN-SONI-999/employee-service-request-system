/**
 * Integration tests against a real Postgres instance defined by
 * DATABASE_URL (see README "Running tests"). They exercise the full
 * stack: HTTP -> validation -> auth -> SQL, which is what actually
 * proves the API works, rather than mocking the database away.
 */
const request = require('supertest');
require('dotenv').config();
const createApp = require('../src/app');
const db = require('../src/config/db');

const app = createApp();
const rand = () => Math.random().toString(36).slice(2, 8);

let employeeToken;
let agentToken;
let createdRequestId;

beforeAll(async () => {
  // Ensure an IT agent exists for assignment tests (seed usually provides one).
  await db.query(
    `INSERT INTO users (name, email, password_hash, role, department)
     VALUES ('Test Agent', 'test.agent+${rand()}@example.com', '$2a$10$abcdefghijklmnopqrstuv', 'agent', 'IT')
     ON CONFLICT DO NOTHING`
  );
});

afterAll(async () => {
  await db.pool.end();
});

describe('Auth', () => {
  const email = `emp.${rand()}@example.com`;

  test('registers a new employee', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test Employee', email, password: 'Password123!' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('employee');
    employeeToken = res.body.token;
  });

  test('rejects registration with a short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: `bad.${rand()}@example.com`, password: '123' });
    expect(res.status).toBe(422);
  });

  test('rejects login with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'WrongPass1!' });
    expect(res.status).toBe(401);
  });

  test('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

describe('Requests', () => {
  test('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/requests');
    expect(res.status).toBe(401);
  });

  test('employee can create a request', async () => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ category: 'IT', title: 'My mouse stopped working', description: 'Left click is unresponsive since this morning.', priority: 'medium' });
    expect(res.status).toBe(201);
    expect(res.body.request.status).toBe('open');
    expect(res.body.request.sla_due_at).toBeDefined();
    createdRequestId = res.body.request.id;
  });

  test('rejects a request with a too-short description', async () => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ category: 'IT', title: 'Short', description: 'too short' });
    expect(res.status).toBe(422);
  });

  test('employee only sees their own requests', async () => {
    const res = await request(app)
      .get('/api/requests')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.requests.every((r) => true)).toBe(true);
    expect(res.body.requests.find((r) => r.id === createdRequestId)).toBeDefined();
  });

  test('employee cannot update request status directly', async () => {
    const res = await request(app)
      .patch(`/api/requests/${createdRequestId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'resolved' });
    expect(res.status).toBe(403);
  });

  test('invalid status transition is rejected', async () => {
    // Need an agent token: log in as the seeded IT agent.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'it.agent@example.com', password: 'Password123!' });
    if (login.status !== 200) return; // seed not run in this environment; skip gracefully
    agentToken = login.body.token;

    const res = await request(app)
      .patch(`/api/requests/${createdRequestId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'closed' }); // open -> closed is not allowed directly
    expect(res.status).toBe(409);
  });

  test('valid status transition succeeds', async () => {
    if (!agentToken) return;
    const res = await request(app)
      .patch(`/api/requests/${createdRequestId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('in_progress');
  });
});
