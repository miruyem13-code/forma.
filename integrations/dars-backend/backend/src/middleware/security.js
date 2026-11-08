import { rateLimit } from 'express-rate-limit';
import { assert, AppError } from '../utils/errors.js';
import { randomToken, hashToken, sign, constantEqual } from '../utils/crypto.js';

export function security(config, repos) {
  const cookieOptions = { httpOnly: true, secure: config.COOKIE_SECURE, sameSite: config.COOKIE_SAME_SITE, path: '/', ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}) };
  const csrfOptions = { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 };
  const binding = req => req.session?.tokenHash ?? 'anonymous';
  function issueCsrf(req, res, sessionHash = binding(req)) {
    const nonce = randomToken();
    res.cookie(config.csrfCookie, nonce, csrfOptions);
    return `${nonce}.${sign(config.SESSION_SECRET, `csrf:${sessionHash}:${nonce}`)}`;
  }
  return {
    issueCsrf,
    setSession(res, token, expiresAt) { res.cookie(config.sessionCookie, token, { ...cookieOptions, expires: expiresAt }); },
    clearSession(res) { res.clearCookie(config.sessionCookie, cookieOptions); res.clearCookie(config.csrfCookie, cookieOptions); },
    async authenticate(req, res, next) {
      const token = req.cookies[config.sessionCookie];
      if (typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)) {
        const session = await repos.session.get(hashToken(token));
        if (session && !session.revokedAt && session.expiresAt > new Date()) { req.session = session; req.user = session.user; }
      }
      next();
    },
    csrf(req, res, next) {
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
      assert(config.origins.includes(req.get('origin')), 403, 'CSRF_INVALID', 'An allowed Origin header is required');
      const cookie = req.cookies[config.csrfCookie];
      const header = req.get('x-csrf-token');
      assert(typeof cookie === 'string' && /^[A-Za-z0-9_-]{43}$/.test(cookie) && typeof header === 'string', 403, 'CSRF_INVALID', 'A CSRF token is required');
      const expected = `${cookie}.${sign(config.SESSION_SECRET, `csrf:${binding(req)}:${cookie}`)}`;
      assert(constantEqual(header, expected), 403, 'CSRF_INVALID', 'Invalid or expired CSRF token');
      next();
    },
  };
}
export function requireAuth(req, res, next) {
  assert(req.user, 401, 'UNAUTHENTICATED', 'Sign in to continue');
  next();
}
export function requireAdmin(req, res, next) {
  assert(req.user?.role === 'ADMIN', 403, 'FORBIDDEN', 'Administrator access is required');
  next();
}

export class PostgresRateLimitStore {
  constructor(repos, prefix) { this.repos = repos; this.prefix = prefix; this.localKeys = false; }
  init(options) { this.windowMs = options.windowMs; }
  increment(key) { return this.repos.rate.increment(hashToken(`${this.prefix}:${key}`), this.windowMs); }
  decrement(key) { return this.repos.rate.decrement(hashToken(`${this.prefix}:${key}`)); }
  resetKey(key) { return this.repos.rate.reset(hashToken(`${this.prefix}:${key}`)); }
}
export function limiter(repos, prefix, limit, windowMs, keyGenerator) {
  return rateLimit({
    windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    store: new PostgresRateLimitStore(repos, prefix), ...(keyGenerator ? { keyGenerator } : {}),
    handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many requests; try again later')),
  });
}
