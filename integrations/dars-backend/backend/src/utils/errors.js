export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export function assert(condition, status, code, message) {
  if (!condition) throw new AppError(status, code, message);
}
export function found(value, message = 'Resource not found') {
  assert(value, 404, 'NOT_FOUND', message);
  return value;
}
