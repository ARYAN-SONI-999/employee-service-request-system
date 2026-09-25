/* eslint-disable no-unused-vars */
function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  console.error(err);

  // Postgres unique_violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'A record with these details already exists.' });
  }
  // Postgres foreign_key_violation / check_violation
  if (err.code === '23503' || err.code === '23514') {
    return res.status(400).json({ error: 'Invalid reference or value in request.' });
  }

  const status = err.status || 500;
  const message =
    status === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error.'
      : err.message || 'Internal server error.';

  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
