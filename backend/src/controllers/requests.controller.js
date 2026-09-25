const db = require('../config/db');
const { computeSlaDueDate, isBreached } = require('../utils/sla');
const { recordAudit } = require('../middleware/audit');

const REQUEST_FIELDS = `
  r.id, r.category, r.title, r.description, r.priority, r.status,
  r.employee_id, r.assigned_agent_id, r.sla_due_at, r.created_at, r.updated_at, r.resolved_at,
  e.name AS employee_name, a.name AS agent_name
`;

function decorate(row) {
  return { ...row, sla_breached: isBreached(row) };
}

/**
 * Role-based visibility, enforced at the query level rather than by
 * filtering after the fact, so a bug elsewhere can't leak another
 * employee's requests:
 *  - employee: only their own requests
 *  - agent:    requests in their own department
 *  - admin:    every request
 */
async function listRequests(req, res, next) {
  try {
    const { status, category, priority, mine } = req.query;
    const conditions = [];
    const params = [];

    if (req.user.role === 'employee') {
      params.push(req.user.id);
      conditions.push(`r.employee_id = $${params.length}`);
    } else if (req.user.role === 'agent') {
      params.push(req.user.department);
      conditions.push(`r.category = $${params.length}`);
      if (mine === 'true') {
        params.push(req.user.id);
        conditions.push(`r.assigned_agent_id = $${params.length}`);
      }
    }
    // admin: no forced condition, sees everything

    if (status) {
      params.push(status);
      conditions.push(`r.status = $${params.length}`);
    }
    if (category && req.user.role !== 'agent') {
      params.push(category);
      conditions.push(`r.category = $${params.length}`);
    }
    if (priority) {
      params.push(priority);
      conditions.push(`r.priority = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT ${REQUEST_FIELDS}
       FROM requests r
       JOIN users e ON e.id = r.employee_id
       LEFT JOIN users a ON a.id = r.assigned_agent_id
       ${where}
       ORDER BY r.created_at DESC`,
      params
    );
    res.json({ requests: rows.map(decorate) });
  } catch (err) {
    next(err);
  }
}

async function getRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT ${REQUEST_FIELDS}
       FROM requests r
       JOIN users e ON e.id = r.employee_id
       LEFT JOIN users a ON a.id = r.assigned_agent_id
       WHERE r.id = $1`,
      [id]
    );
    const request = rows[0];
    if (!request) return res.status(404).json({ error: 'Request not found.' });

    if (req.user.role === 'employee' && request.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'You cannot view another employee\'s request.' });
    }
    if (req.user.role === 'agent' && request.category !== req.user.department) {
      return res.status(403).json({ error: 'This request belongs to a different department.' });
    }

    const comments = await db.query(
      `SELECT c.id, c.body, c.created_at, u.name AS author_name, u.role AS author_role
       FROM request_comments c JOIN users u ON u.id = c.author_id
       WHERE c.request_id = $1 ORDER BY c.created_at ASC`,
      [id]
    );
    const audit = await db.query(
      `SELECT al.id, al.action, al.details, al.created_at, u.name AS actor_name
       FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_id
       WHERE al.request_id = $1 ORDER BY al.created_at ASC`,
      [id]
    );

    res.json({ request: decorate(request), comments: comments.rows, audit: audit.rows });
  } catch (err) {
    next(err);
  }
}

/** Employees raise requests for themselves; SLA due date is computed server-side, never trusted from the client. */
async function createRequest(req, res, next) {
  const client = await db.pool.connect();
  try {
    const { category, title, description, priority = 'medium' } = req.body;
    const slaDueAt = await computeSlaDueDate(category, priority);

    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO requests (employee_id, category, title, description, priority, sla_due_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, employee_id, category, title, description, priority, status, sla_due_at, created_at, updated_at`,
      [req.user.id, category, title, description, priority, slaDueAt]
    );
    const request = rows[0];
    await client.query(
      'INSERT INTO audit_logs (request_id, actor_id, action, details) VALUES ($1, $2, $3, $4)',
      [request.id, req.user.id, 'request.created', JSON.stringify({ category, priority })]
    );
    await client.query('COMMIT');

    res.status(201).json({ request: decorate(request) });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

const ALLOWED_TRANSITIONS = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['resolved', 'open', 'cancelled'],
  resolved: ['closed', 'in_progress'],
  closed: [],
  cancelled: [],
};

/**
 * Agents/admins update status and/or assignment. Status transitions are
 * whitelisted (ALLOWED_TRANSITIONS) so a request can't jump e.g.
 * open -> closed without passing through in_progress/resolved, which
 * would corrupt SLA and reporting data.
 */
async function updateRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { status, assigned_agent_id, priority } = req.body;

    const current = await db.query('SELECT * FROM requests WHERE id = $1', [id]);
    const request = current.rows[0];
    if (!request) return res.status(404).json({ error: 'Request not found.' });

    if (req.user.role === 'agent' && request.category !== req.user.department) {
      return res.status(403).json({ error: 'This request belongs to a different department.' });
    }

    if (status && status !== request.status) {
      const allowed = ALLOWED_TRANSITIONS[request.status] || [];
      if (!allowed.includes(status)) {
        return res.status(409).json({
          error: `Cannot move a request from "${request.status}" to "${status}".`,
          allowedNext: allowed,
        });
      }
    }

    const nextStatus = status || request.status;
    const nextAgent = assigned_agent_id !== undefined ? assigned_agent_id : request.assigned_agent_id;
    const nextPriority = priority || request.priority;
    const resolvedAt =
      nextStatus === 'resolved' && request.status !== 'resolved' ? new Date() : request.resolved_at;

    const { rows } = await db.query(
      `UPDATE requests
       SET status = $1, assigned_agent_id = $2, priority = $3, resolved_at = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, category, title, priority, status, assigned_agent_id, sla_due_at, updated_at, resolved_at`,
      [nextStatus, nextAgent, nextPriority, resolvedAt, id]
    );

    await recordAudit({
      requestId: id,
      actorId: req.user.id,
      action: 'request.updated',
      details: { from: request.status, to: nextStatus, assigned_agent_id: nextAgent, priority: nextPriority },
    });

    res.json({ request: decorate(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function addComment(req, res, next) {
  try {
    const { id } = req.params;
    const { body } = req.body;

    const current = await db.query('SELECT * FROM requests WHERE id = $1', [id]);
    const request = current.rows[0];
    if (!request) return res.status(404).json({ error: 'Request not found.' });

    if (req.user.role === 'employee' && request.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'You cannot comment on another employee\'s request.' });
    }
    if (req.user.role === 'agent' && request.category !== req.user.department) {
      return res.status(403).json({ error: 'This request belongs to a different department.' });
    }

    const { rows } = await db.query(
      `INSERT INTO request_comments (request_id, author_id, body) VALUES ($1, $2, $3)
       RETURNING id, body, created_at`,
      [id, req.user.id, body]
    );
    await recordAudit({ requestId: id, actorId: req.user.id, action: 'request.comment_added' });

    res.status(201).json({ comment: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listRequests, getRequest, createRequest, updateRequest, addComment };
