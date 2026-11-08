import { serialize } from '../utils/money.js';
import { idempotency } from '../validators/index.js';
import { AppError } from '../utils/errors.js';

export const send = (res, data, status = 200) => res.status(status).json({ success: true, data: serialize(data) });
export const handler = (fn, status = 200) => async (req, res) => send(res, await fn(req), status);

export function createControllers(services, security) {
  const authReply = async (req, res, operation, status) => {
    const { user, session, token } = await operation();
    security.setSession(res, token, session.expiresAt);
    send(res, { user, csrfToken: security.issueCsrf(req, res, session.tokenHash), expiresAt: session.expiresAt }, status);
  };
  return {
    csrf: (req, res) => send(res, { csrfToken: security.issueCsrf(req, res) }),
    register: (req, res) => authReply(req, res, () => services.auth.register(req.validated.body), 201),
    login: (req, res) => authReply(req, res, () => services.auth.login(req.validated.body), 200),
    refresh: (req, res) => authReply(req, res, () => services.auth.refresh(req.session), 200),
    logout: async (req, res) => { await services.auth.logout(req.session); security.clearSession(res); send(res, { message: 'Signed out' }); },
    changePassword: async (req, res) => { const data = await services.auth.changePassword(req.user.id, req.validated.body); security.clearSession(res); send(res, data); },
    createOrder: async (req, res) => {
      const key = idempotency.parse(req.get('idempotency-key'));
      const { order, reused } = await services.commerce.createOrder(req.user.id, key);
      send(res, { ...order, reused }, reused ? 200 : 201);
    },
    asset: async (req, res) => {
      const asset = await services.profile.asset(req.params.id);
      res.set({ 'Content-Type': asset.mimeType, 'Cache-Control': 'public, max-age=86400, immutable', 'Cross-Origin-Resource-Policy': 'cross-origin' });
      res.send(Buffer.from(asset.bytes));
    },
    media: async (req, res, next) => {
      const file = await services.media(req.user.id, req.session.id, req.params.lessonId, Number(req.query.expires), req.query.signature);
      res.type('video/mp4');
      // The signed adapter resolves only validated asset IDs; .local is an intentional private parent directory.
      res.sendFile(file, { cacheControl: false, dotfiles: 'allow' }, error => {
        if (error) next(error.code === 'ENOENT' ? new AppError(404, 'MEDIA_UNAVAILABLE', 'Media is unavailable') : error.status === 416 ? new AppError(416, 'INVALID_RANGE', 'Requested media range is unavailable') : error);
      });
    },
  };
}
