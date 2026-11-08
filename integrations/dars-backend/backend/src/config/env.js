import 'dotenv/config';
import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform(v => v === 'true');
const optional = z.string().default('');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: z.string().url().refine(v => /^postgres(ql)?:\/\//.test(v)),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(48),
  COOKIE_DOMAIN: optional,
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: bool.prefault('false'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).default('info'),
  DEV_ENROLLMENT_ENABLED: bool.prefault('false'),
  PAYMENT_PROVIDER: z.enum(['', 'click', 'payme', 'custom']).default(''),
  PAYMENT_WEBHOOK_SECRET: optional,
  PAYMENT_ADAPTER_MODULE: optional,
  STORAGE_PROVIDER: z.enum(['database', 'custom']).default('database'),
  STORAGE_ADAPTER_MODULE: optional,
  VIDEO_PROVIDER: z.enum(['disabled', 'signed-local', 'custom']).default('disabled'),
  VIDEO_ADAPTER_MODULE: optional,
  MEDIA_LOCAL_DIR: z.string().default('.local/media'),
});

export function readConfig(env = process.env) {
  const result = schema.safeParse(env);
  if (!result.success) throw new Error(`Invalid environment variables: ${result.error.issues.map(i => i.path.join('.')).join(', ')}`);
  const c = result.data;
  const origins = c.FRONTEND_URL.split(',').map(v => v.trim());
  for (const origin of origins) {
    let parsed;
    try { parsed = new URL(origin); } catch { throw new Error('FRONTEND_URL must contain exact HTTP(S) origins'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || parsed.username || parsed.password) {
      throw new Error('FRONTEND_URL must contain exact HTTP(S) origins, without paths or wildcards');
    }
    if (c.NODE_ENV === 'production' && parsed.protocol !== 'https:') throw new Error('Production frontend origins require HTTPS');
  }
  if (c.COOKIE_SAME_SITE === 'none' && !c.COOKIE_SECURE) throw new Error('SameSite=None requires Secure cookies');
  if (c.NODE_ENV === 'production' && (!c.COOKIE_SECURE || c.DEV_ENROLLMENT_ENABLED || c.VIDEO_PROVIDER === 'signed-local')) {
    throw new Error('Production requires Secure cookies and disables development enrollment/local video');
  }
  if (c.PAYMENT_PROVIDER && (!c.PAYMENT_ADAPTER_MODULE || c.PAYMENT_WEBHOOK_SECRET.length < 32)) {
    throw new Error('Payment provider requires an adapter module and a webhook secret of at least 32 characters');
  }
  if (c.STORAGE_PROVIDER === 'custom' && !c.STORAGE_ADAPTER_MODULE) throw new Error('Custom storage requires STORAGE_ADAPTER_MODULE');
  if (c.VIDEO_PROVIDER === 'custom' && !c.VIDEO_ADAPTER_MODULE) throw new Error('Custom video requires VIDEO_ADAPTER_MODULE');
  return Object.freeze({ ...c, origins, sessionCookie: c.COOKIE_SECURE ? '__Secure-dars_session' : 'dars_session',
    csrfCookie: c.COOKIE_SECURE ? '__Secure-dars_csrf' : 'dars_csrf' });
}
