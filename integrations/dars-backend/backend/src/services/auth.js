import { assert, found } from '../utils/errors.js';
import { hashPassword, verifyPassword, getDummyHash, randomToken, hashToken } from '../utils/crypto.js';

export function authService(repos, config) {
  async function newSession(r, userId, expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 3600000)) {
    const token = randomToken();
    const session = await r.session.create({ userId, tokenHash: hashToken(token), expiresAt });
    return { token, session };
  }
  return {
    async register(input) {
      const passwordHash = await hashPassword(input.password);
      return repos.transaction(async r => {
        const user = await r.user.create({ email: input.email, fullName: input.fullName, passwordHash });
        return { user, ...await newSession(r, user.id) };
      });
    },
    async login(input) {
      const credentials = await repos.user.byEmail(input.email);
      const valid = await verifyPassword(credentials?.passwordHash ?? await getDummyHash(), input.password);
      assert(credentials && valid, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
      return repos.transaction(async r => {
        await r.lock(`user:${credentials.id}`);
        const current = found(await r.user.credentials(credentials.id));
        assert(current.passwordHash === credentials.passwordHash, 401, 'INVALID_CREDENTIALS', 'Credentials changed; sign in again');
        return { user: await r.user.get(current.id), ...await newSession(r, current.id) };
      });
    },
    logout: session => repos.session.revoke(session.id),
    async refresh(session) {
      return repos.transaction(async r => {
        await r.lock(`user:${session.userId}`);
        const current = await r.session.get(session.tokenHash);
        assert(current && !current.revokedAt && current.expiresAt > new Date(), 401, 'UNAUTHENTICATED', 'Session is no longer active');
        await r.session.revoke(current.id);
        return { user: current.user, ...await newSession(r, current.userId, current.expiresAt) };
      });
    },
    async changePassword(userId, input) {
      const credentials = found(await repos.user.credentials(userId));
      assert(await verifyPassword(credentials.passwordHash, input.currentPassword), 400, 'INVALID_PASSWORD', 'Current password is incorrect');
      const passwordHash = await hashPassword(input.newPassword);
      await repos.transaction(async r => {
        await r.lock(`user:${userId}`);
        const current = found(await r.user.credentials(userId));
        assert(current.passwordHash === credentials.passwordHash, 409, 'CONFLICT', 'Password changed; sign in again');
        await r.user.update(userId, { passwordHash });
        await r.session.revokeAll(userId);
      });
      return { message: 'Password changed. Sign in again on all devices.' };
    },
  };
}
