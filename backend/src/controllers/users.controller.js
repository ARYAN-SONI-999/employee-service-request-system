const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { recordAudit } = require('../middleware/audit');

const PUBLIC_FIELDS = 'id, name, email, role, department, is_active, created_at';

/** Admin-only: list all users, optionally filtered by role/department. */
async function listUsers(req, res, next) {
  try {
    const { role, department } = req.query;
    const conditions = [];
    const params = [];

    if (role) {
      params.push(role);
      conditions.push(`role = $${params.length}`);
    }
    if (department) {
      params.push(department);
      conditions.push(`department = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT ${PUBLIC_FIELDS} FROM users ${where} ORDER BY created_at DESC`,
      params
    );
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
}

/** Admin-only: provision an agent or admin account (or another employee). */
async function createUser(req, res, next) {
  try {
    const { name, email, password, role, department } = req.body;
    if (role !== 'employee' && !department) {
      return res.status(422).json({
        error: 'Validation failed.',
        details: [{ field: 'department', message: 'Department is required for agent and admin accounts.' }],
      });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash, role, department)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${PUBLIC_FIELDS}`,
      [name, email.toLowerCase(), passwordHash, role, department || null]
    );
    await recordAudit({
      actorId: req.user.id,
      action: 'user.created_by_admin',
      details: { newUserId: rows[0].id, role, department },
    });
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
}

/** Admin-only: activate/deactivate an account (soft delete, keeps audit trail intact). */
async function setUserActive(req, res, next) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const { rows } = await db.query(
      `UPDATE users SET is_active = $1 WHERE id = $2 RETURNING ${PUBLIC_FIELDS}`,
      [is_active, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    await recordAudit({
      actorId: req.user.id,
      action: is_active ? 'user.activated' : 'user.deactivated',
      details: { targetUserId: Number(id) },
    });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, createUser, setUserActive };
