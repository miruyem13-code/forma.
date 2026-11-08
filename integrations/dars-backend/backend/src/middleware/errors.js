import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details;
  if (error instanceof ZodError) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Request validation failed';
    details = error.issues.map(i => ({ path: i.path.join('.'), message: i.message }));
  } else if (error instanceof AppError) {
    ({ status, code, message, details } = error);
  } else if (error.code === 'P2002') {
    status = 409; code = 'CONFLICT'; message = 'A record with these unique values already exists';
  } else if (error.code === 'P2025') {
    status = 404; code = 'NOT_FOUND'; message = 'Resource not found';
  } else if (error.code === 'P2003') {
    status = 409; code = 'RELATED_RECORD'; message = 'A related resource is missing or is still in use';
  } else if (error.code === 'P2034') {
    status = 409; code = 'RETRY_REQUEST'; message = 'Concurrent change detected; retry the request';
  } else if (error.code === 'LIMIT_FILE_SIZE' || error.type === 'entity.too.large') {
    status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'Upload or request exceeds the size limit';
  } else if (error.name === 'MulterError' || error.type === 'entity.parse.failed') {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Malformed request or unexpected upload field';
  }
  // Do not serialize Error objects: database errors can contain SQL values and credentials.
  if (status >= 500) req.log?.error({ requestId: req.id, errorType: error.name, errorCode: typeof error.code === 'string' ? error.code : undefined }, 'Request failed');
  res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });
}
