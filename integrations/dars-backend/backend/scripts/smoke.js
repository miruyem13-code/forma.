import { readConfig } from '../src/config/env.js';
const config = readConfig();
const base = `http://localhost:${config.PORT}/api/v1`;
const origin = config.origins[0];

function verify(condition, message) { if (!condition) throw new Error(message); }
const health = await fetch(`${base}/health`);
verify(health.ok && (await health.json()).data.database === 'connected', 'Health check failed');
const catalog = await fetch(`${base}/courses`, { headers: { Origin: origin } });
verify(catalog.ok && catalog.headers.get('access-control-allow-origin') === origin && catalog.headers.get('access-control-allow-credentials') === 'true', 'Catalog/CORS check failed');
const courses = (await catalog.json()).data.items;
verify(courses.length > 0, 'No seeded courses found');
const detail = await (await fetch(`${base}/courses/${courses[0].slug}`)).json();
verify(!JSON.stringify(detail).includes('videoUrl'), 'Public curriculum exposes video fields');
const csrf = await fetch(`${base}/auth/csrf`, { headers: { Origin: origin } });
verify(csrf.ok && csrf.headers.get('set-cookie')?.includes('HttpOnly'), 'CSRF cookie check failed');
verify((await fetch(`${base}/admin/stats`)).status === 401, 'Anonymous admin access was not rejected');
verify((await fetch(`${base}/courses`, { headers: { Origin: 'https://untrusted.example' } })).status === 403, 'Untrusted origin was accepted');
console.log(`HTTP smoke checks passed: healthy PostgreSQL, ${courses.length} seeded courses, private curriculum, credentialed CORS, CSRF cookie, and admin authentication.`);
