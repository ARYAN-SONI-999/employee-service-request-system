/**
 * Idempotent demo data: one admin, one agent per department, three
 * employees, and a spread of requests across statuses/priorities so the
 * dashboard and SLA-breach logic have something real to show.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
const { computeSlaDueDate } = require('../src/utils/sla');

async function upsertUser({ name, email, password, role, department }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role, department)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name, email, role, department`,
    [name, email, passwordHash, role, department || null]
  );
  return rows[0];
}

async function run() {
  console.log('Seeding demo data...');

  const admin = await upsertUser({
    name: 'Ava Admin', email: 'admin@example.com', password: 'Password123!', role: 'admin', department: null,
  });
  const itAgent = await upsertUser({
    name: 'Ian Technician', email: 'it.agent@example.com', password: 'Password123!', role: 'agent', department: 'IT',
  });
  const hrAgent = await upsertUser({
    name: 'Hana Resources', email: 'hr.agent@example.com', password: 'Password123!', role: 'agent', department: 'HR',
  });
  const facAgent = await upsertUser({
    name: 'Felix Facilities', email: 'facility.agent@example.com', password: 'Password123!', role: 'agent', department: 'Facility',
  });
  const emp1 = await upsertUser({
    name: 'Priya Employee', email: 'priya@example.com', password: 'Password123!', role: 'employee',
  });
  const emp2 = await upsertUser({
    name: 'Sam Employee', email: 'sam@example.com', password: 'Password123!', role: 'employee',
  });

  const sample = [
    { emp: emp1, category: 'IT', title: 'Laptop will not boot', description: 'Screen stays black after the login chime; tried a hard reset already.', priority: 'critical', status: 'open', agent: null },
    { emp: emp1, category: 'IT', title: 'Need VPN access from home', description: 'Starting remote days next week and need VPN client provisioned.', priority: 'medium', status: 'in_progress', agent: itAgent },
    { emp: emp2, category: 'HR', title: 'Payslip missing for August', description: 'August payslip is not showing up in the portal.', priority: 'high', status: 'open', agent: null },
    { emp: emp2, category: 'Facility', title: 'AC not cooling on 3rd floor', description: 'Whole east wing of the 3rd floor is warm since this morning.', priority: 'high', status: 'resolved', agent: facAgent },
    { emp: emp1, category: 'HR', title: 'Update emergency contact', description: 'Need to change my emergency contact details in the system.', priority: 'low', status: 'closed', agent: hrAgent },
  ];

  for (const s of sample) {
    const exists = await db.query('SELECT id FROM requests WHERE title = $1 AND employee_id = $2', [s.title, s.emp.id]);
    if (exists.rows.length) continue;

    const slaDueAt = await computeSlaDueDate(s.category, s.priority);
    const resolvedAt = ['resolved', 'closed'].includes(s.status) ? new Date() : null;
    const { rows } = await db.query(
      `INSERT INTO requests (employee_id, category, title, description, priority, status, assigned_agent_id, sla_due_at, resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [s.emp.id, s.category, s.title, s.description, s.priority, s.status, s.agent ? s.agent.id : null, slaDueAt, resolvedAt]
    );
    await db.query(
      'INSERT INTO audit_logs (request_id, actor_id, action, details) VALUES ($1,$2,$3,$4)',
      [rows[0].id, s.emp.id, 'request.created', JSON.stringify({ seeded: true })]
    );
  }

  console.log('Seed complete. Demo accounts (password: Password123!):');
  console.log(`  admin           -> ${admin.email}`);
  console.log(`  IT agent        -> ${itAgent.email}`);
  console.log(`  HR agent        -> ${hrAgent.email}`);
  console.log(`  Facility agent  -> ${facAgent.email}`);
  console.log(`  employee        -> ${emp1.email}`);
  console.log(`  employee        -> ${emp2.email}`);
  await db.pool.end();
}

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
