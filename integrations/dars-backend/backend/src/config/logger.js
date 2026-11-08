import pino from 'pino';

export const createLogger = level => pino({
  level,
  redact: {
    paths: ['req.headers', 'res.headers', 'req.body', 'body', 'password', 'passwordHash', 'token', 'sessionToken', 'secret'],
    censor: '[REDACTED]',
  },
});
