import { describe, it, expect } from 'vitest';
import { readConfig } from '../src/config/env.js';
import { totals, serialize, decimal } from '../src/utils/money.js';
import { register, updateLesson, moneyInput } from '../src/validators/index.js';
import { constantEqual, hashToken } from '../src/utils/crypto.js';
import { localVideo } from '../src/services/providers.js';

const base = { DATABASE_URL: 'postgresql://test:test@localhost:5432/unit_test', SESSION_SECRET: 'a'.repeat(64) };
describe('Configuration safety', () => {
  it('defaults to development with integrations and development enrollment disabled', () => {
    const c = readConfig(base);
    expect(c.COOKIE_SECURE).toBe(false);
    expect(c.DEV_ENROLLMENT_ENABLED).toBe(false);
    expect(c.PAYMENT_PROVIDER).toBe('');
    expect(c.VIDEO_PROVIDER).toBe('disabled');
  });
  it('requires secure cookies, HTTPS origins, and no development enrollment in production', () => {
    expect(() => readConfig({ ...base, NODE_ENV: 'production' })).toThrow();
    const production = { ...base, NODE_ENV: 'production', FRONTEND_URL: 'https://learn.example.com', COOKIE_SECURE: 'true' };
    expect(readConfig(production).COOKIE_SECURE).toBe(true);
    expect(() => readConfig({ ...production, DEV_ENROLLMENT_ENABLED: 'true' })).toThrow();
    expect(() => readConfig({ ...production, VIDEO_PROVIDER: 'signed-local' })).toThrow();
  });
  it('rejects wildcard origins, URL paths, insecure SameSite=None, and incomplete providers', () => {
    for (const change of [{ FRONTEND_URL: '*' }, { FRONTEND_URL: 'https://example.com/path' }, { COOKIE_SAME_SITE: 'none' }, { PAYMENT_PROVIDER: 'click' }, { VIDEO_PROVIDER: 'custom' }, { STORAGE_PROVIDER: 'custom' }]) expect(() => readConfig({ ...base, ...change })).toThrow();
  });
  it('does not print environment secrets in validation failures', () => {
    expect(() => readConfig({ ...base, DATABASE_URL: 'sensitive-password' })).toThrow('DATABASE_URL');
    try { readConfig({ ...base, DATABASE_URL: 'sensitive-password' }); } catch (e) { expect(e.message).not.toContain('sensitive-password'); }
  });
});
describe('Financial and validation invariants', () => {
  it('uses exact decimals and fixed two-place serialization', () => {
    expect(totals([{ price: '0.10' }, { price: '0.20', discountPrice: '0.15' }])).toEqual({ subtotal: '0.30', discountTotal: '0.05', total: '0.25', currency: 'UZS' });
    expect(serialize({ amount: decimal('100.1') })).toEqual({ amount: '100.10' });
  });
  it('only accepts decimal strings, rejecting numeric/exponent/negative inputs', () => {
    for (const value of [1.01, '1e3', '-1', '0.001', '001', '9999999999999']) expect(moneyInput.safeParse(value).success).toBe(false);
  });
  it('normalizes email and refuses role assignment', () => {
    const data = { fullName: 'Student', email: 'Student@EXAMPLE.com ', password: 'StrongPassword123!' };
    expect(register.parse(data).email).toBe('student@example.com');
    expect(register.safeParse({ ...data, role: 'ADMIN' }).success).toBe(false);
  });
  it('does not reset lesson flags or duration during partial updates', () => {
    expect(updateLesson.parse({ title: 'Renamed' })).toEqual({ title: 'Renamed' });
  });
  it('hashes tokens and safely compares signatures', () => {
    expect(hashToken('token')).toHaveLength(64);
    expect(constantEqual('a', 'a')).toBe(true);
    expect(constantEqual('a', 'longer')).toBe(false);
    expect(constantEqual(undefined, 'a')).toBe(false);
  });
  it('rejects expired or forged local media signatures', () => {
    const adapter = localVideo({ ...readConfig(base), MEDIA_LOCAL_DIR: '.local/media' });
    expect(() => adapter.resolve({ assetId: 'asset', userId: 'user', lessonId: 'lesson', sessionId: 'session' }, 1, 'fake')).toThrow('expired');
    expect(() => adapter.resolve({ assetId: 'asset', userId: 'user', lessonId: 'lesson', sessionId: 'session' }, Math.floor(Date.now() / 1000) + 60, 'fake')).toThrow('signature');
  });
});
