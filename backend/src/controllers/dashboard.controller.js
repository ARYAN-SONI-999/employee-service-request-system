const db = require('../config/db');

/**
 * Aggregated numbers for the dashboard. Scope mirrors listRequests:
 * employees don't get an org-wide dashboard, agents see their department,
 * admins see everything.
 */
async function summary(req, res, next) {
  try {
    const conditions = [];
    const params = [];

    if (req.user.role === 'employee') {
      params.push(req.user.id);
      conditions.push(`employee_id = $${params.length}`);
    } else if (req.user.role === 'agent') {
      params.push(req.user.department);
      conditions.push(`category = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const byStatus = await db.query(
      `SELECT status, COUNT(*)::int AS count FROM requests ${where} GROUP BY status`,
      params
    );
    const byCategory = await db.query(
      `SELECT category, COUNT(*)::int AS count FROM requests ${where} GROUP BY category`,
      params
    );
    const byPriority = await db.query(
      `SELECT priority, COUNT(*)::int AS count FROM requests ${where} GROUP BY priority`,
      params
    );
    const breachClause = conditions.length
      ? `${where} AND status NOT IN ('resolved','closed','cancelled') AND sla_due_at < NOW()`
      : `WHERE status NOT IN ('resolved','closed','cancelled') AND sla_due_at < NOW()`;
    const breached = await db.query(
      `SELECT COUNT(*)::int AS count FROM requests ${breachClause}`,
      params
    );
    const avgResolution = await db.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric(10,1) AS avg_hours
       FROM requests ${where ? where + " AND resolved_at IS NOT NULL" : "WHERE resolved_at IS NOT NULL"}`,
      params
    );

    res.json({
      byStatus: byStatus.rows,
      byCategory: byCategory.rows,
      byPriority: byPriority.rows,
      slaBreached: breached.rows[0].count,
      avgResolutionHours: avgResolution.rows[0].avg_hours,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { summary };
