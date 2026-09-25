const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { signToken } = require('../utils/jwt');
const { recordAudit } = require('../middleware/audit');

const PUBLIC_FIELDS =
  'id, name, email, role, department, is_active, created_at';

/**
 * Self-registration always creates an "employee" — the only role a stranger
 * to the system should be able to grant themselves. Agents and admins are
 * provisioned by an existing admin via POST /api/users.
 */
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash, role, department)
       VALUES ($1, $2, $3, 'employee', NULL)
       RETURNING ${PUBLIC_FIELDS}`,
      [name, email.toLowerCase(), passwordHash]
    );
    const user = rows[0];
    await recordAudit({ actorId: user.id, action: 'user.registered', details: { email: user.email } });

    const token = signToken(user);
    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { rows } = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user);
    await recordAudit({ actorId: user.id, action: 'user.login' });

    delete user.password_hash;
    res.json({ user, token });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me };
