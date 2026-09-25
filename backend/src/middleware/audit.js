const db = require('../config/db');

/** Writes one row to audit_logs. Never throws into the request path — logging must not break the feature it observes. */
async function recordAudit({ requestId = null, actorId = null, action, details = {} }) {
  try {
    await db.query(
      'INSERT INTO audit_logs (request_id, actor_id, action, details) VALUES ($1, $2, $3, $4)',
      [requestId, actorId, action, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = { recordAudit };
