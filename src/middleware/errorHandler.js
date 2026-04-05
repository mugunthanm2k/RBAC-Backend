import { sendError } from '../utils/response.js';

export const notFound = (req, res, next) => {
  sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
};

export const errorHandler = (err, req, res, next) => {
  console.error('Unhandled Error:', err);

  if (err.code === 'ER_DUP_ENTRY') {
    return sendError(res, 'Duplicate entry. Record already exists.', 409);
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return sendError(res, 'Referenced record does not exist.', 400);
  }
  if (err.name === 'SyntaxError') {
    return sendError(res, 'Invalid JSON in request body.', 400);
  }

  sendError(
    res,
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    err.statusCode || 500
  );
};
