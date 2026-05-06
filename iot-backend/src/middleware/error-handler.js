const { ApiError } = require('../utils/errors');

function notFound(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'not_found'));
}

function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'internal_server_error';
  const message = statusCode >= 500 ? 'Internal server error' : err.message;

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({ ok: false, error: message, code });
}

module.exports = { notFound, errorHandler };
