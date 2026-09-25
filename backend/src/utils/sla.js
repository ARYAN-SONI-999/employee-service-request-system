const db = require('../config/db');

/**
 * Computes the SLA due date for a (category, priority) pair using the
 * sla_policies table, falling back to a conservative 48h default so a
 * missing policy row never silently produces a request with no SLA.
 */
async function computeSlaDueDate(category, priority) {
  const { rows } = await db.query(
    'SELECT resolution_hours FROM sla_policies WHERE category = $1 AND priority = $2',
    [category, priority]
  );
  const hours = rows[0] ? rows[0].resolution_hours : 48;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function isBreached(request) {
  if (!request.sla_due_at) return false;
  const stillOpen = !['resolved', 'closed', 'cancelled'].includes(request.status);
  return stillOpen && new Date(request.sla_due_at) < new Date();
}

module.exports = { computeSlaDueDate, isBreached };
