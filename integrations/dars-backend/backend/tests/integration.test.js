import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config/env.js';
import { createDatabase } from '../src/config/database.js';
import { hashPassword, hashToken } from '../src/utils/crypto.js';
import { createRepositories } from '../src/repositories/index.js';
import { createProviders } from '../src/services/providers.js';
import { PostgresRateLimitStore } from '../src/middleware/security.js';

const origin = 'http://localhost:5173';
const password = 'TestPassword123!';
const url = process.env.TEST_DATABASE_URL;
if (process.env.NODE_ENV !== 'test' || !url || !/(?:^|_)test(?:_|$)/i.test(new URL(url).pathname.slice(1))) throw new Error('Run tests with npm run test:integration against a dedicated test database');
const config = readConfig({ NODE_ENV: 'test', DATABASE_URL: url, SESSION_SECRET: 'test-only-'.repeat(8), FRONTEND_URL: `${origin},http://127.0.0.1:5176`, LOG_LEVEL: 'silent', DEV_ENROLLMENT_ENABLED: 'true' });
const db = createDatabase(url);
const rateLimits = { authLimit: 1000, accountLimit: 1000, apiLimit: 10000 };
let app, admin, category, course, secondCourse, section, lesson, secondLesson, instructorId;
let counter = 0;

async function client(application = app) {
  const agent = request.agent(application);
  agent.csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.data.csrfToken;
  return agent;
}
async function mutate(agent, method, route, data = {}) {
  const response = await agent[method](`/api/v1${route}`).set('Origin', origin).set('X-CSRF-Token', agent.csrf).send(data);
  if (response.body.data?.csrfToken) agent.csrf = response.body.data.csrfToken;
  return response;
}
async function student(application = app) {
  const agent = await client(application);
  const email = `student-${++counter}@example.com`;
  const response = await mutate(agent, 'post', '/auth/register', { fullName: 'Test Student', email, password });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  agent.user = response.body.data.user;
  agent.email = email;
  return agent;
}
async function login(email, application = app) {
  const agent = await client(application);
  const response = await mutate(agent, 'post', '/auth/login', { email, password });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  agent.user = response.body.data.user;
  return agent;
}
async function enroll(agent, target = course) {
  const response = await mutate(admin, 'post', '/admin/dev/enrollments', { userId: agent.user.id, courseId: target.id });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response;
}
async function addToCart(agent, target = course) {
  const response = await mutate(agent, 'post', '/cart/items', { courseId: target.id });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response;
}
function order(agent, key = randomUUID()) {
  return agent.post('/api/v1/orders').set('Origin', origin).set('X-CSRF-Token', agent.csrf).set('Idempotency-Key', key).send({});
}

beforeAll(async () => {
  await db.$connect();
  await db.$executeRawUnsafe('TRUNCATE TABLE "User", "Category", "RateLimit" CASCADE');
  const operator = await db.user.create({ data: { email: 'admin@example.com', fullName: 'Test Admin', passwordHash: await hashPassword(password), role: 'ADMIN' } });
  instructorId = operator.id;
  category = await db.category.create({ data: { name: 'Development', slug: 'development' } });
  course = await db.course.create({ data: { title: 'JavaScript Masterclass', slug: 'javascript-masterclass', description: 'Learn modern JavaScript', instructorId, categoryId: category.id, price: '100000.10', discountPrice: '80000.05', published: true } });
  secondCourse = await db.course.create({ data: { title: 'PostgreSQL Fundamentals', slug: 'postgresql-fundamentals', description: 'Learn relational databases', instructorId, categoryId: category.id, price: '90000.00', published: true } });
  section = await db.section.create({ data: { courseId: course.id, title: 'Introduction', position: 1 } });
  lesson = await db.lesson.create({ data: { sectionId: section.id, title: 'First lesson', position: 1, videoUrl: 'private-secret-asset', durationSeconds: 600, isPreview: true } });
  secondLesson = await db.lesson.create({ data: { sectionId: section.id, title: 'Second lesson', position: 2, videoUrl: 'private-secret-second', durationSeconds: 300 } });
  app = await createApp({ db, config, rateLimits });
  admin = await login('admin@example.com');
});
afterAll(async () => { await db.$disconnect(); });

describe('Frontend course editor integration', () => {
  it('saves full curriculum atomically and retains progress on unchanged lesson IDs', async () => {
    const fresh = await login('admin@example.com');
    const sectionId = randomUUID(), lessonId = randomUUID();
    const payload = { title: 'Editor integration', slug: `editor-${randomUUID()}`, description: 'Course created from the frontend editor', instructorId, categoryId: category.id, price: '350000.00', discountPrice: '280000.00', published: true, level: 'Beginner', instructorRole: 'Developer', outcomes: ['Build an app'], requirements: ['A computer'], sections: [{ id: sectionId, title: 'Getting started', lessons: [{ id: lessonId, title: 'Welcome', description: null, durationSeconds: 90, videoUrl: 'private-editor-asset', isPreview: false }] }] };
    const response = await mutate(fresh, 'post', '/admin/courses', payload);
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const id = response.body.data.id;
    const learner = await student();
    await enroll(learner, { id });
    expect((await mutate(learner, 'patch', `/learning/lessons/${lessonId}/progress`, { completed: true })).status).toBe(200);
    payload.sections[0].lessons[0].title = 'Updated welcome';
    expect((await mutate(fresh, 'patch', `/admin/courses/${id}`, payload)).status).toBe(200);
    const progress = await learner.get(`/api/v1/learning/courses/${id}`).expect(200);
    expect(progress.body.data.sections[0].lessons[0].progress.completed).toBe(true);
    const publicCourse = await request(app).get(`/api/v1/courses/${payload.slug}`).expect(200);
    expect(publicCourse.body.data.level).toBe('Beginner');
    expect(JSON.stringify(publicCourse.body)).not.toContain('private-editor-asset');
    const invalid = { ...payload, title: 'Must roll back', sections: [{ id: section.id, title: 'Foreign section', lessons: [] }] };
    expect((await mutate(fresh, 'patch', `/admin/courses/${id}`, invalid)).status).toBe(403);
    const stored = await fresh.get(`/api/v1/admin/courses/${id}`).expect(200);
    expect(stored.body.data.title).toBe(payload.title);
    expect(stored.body.data.sections[0].lessons[0].id).toBe(lessonId);
  });
});

describe('Browser to PostgreSQL', () => {
  it('registers, persists a profile and adds a real course to the cart through the frontend', async () => {
    const { createServer } = await import('../../../../node_modules/vite/dist/node/index.js');
    const { chromium } = await import('../../../../node_modules/playwright/index.mjs');
    const apiServer = app.listen(0, '127.0.0.1');
    await new Promise(resolve => apiServer.once('listening', resolve));
    let vite, browser;
    try {
      vite = await createServer({ root: path.resolve('../../..'), configFile: false, cacheDir: 'node_modules/.vite-live-test',
        plugins: [(await import('../../../../node_modules/@vitejs/plugin-react/dist/index.js')).default()],
        define: { 'import.meta.env.VITE_USE_MOCKS': JSON.stringify('false'), 'import.meta.env.VITE_API_URL': JSON.stringify('/api/v1') },
        server: { host: '127.0.0.1', port: 5176, strictPort: true, proxy: { '/api': { target: `http://127.0.0.1:${apiServer.address().port}`, changeOrigin: false } }, watch: { ignored: ['**/integrations/**'] } },
      });
      await vite.listen();
      browser = await chromium.launch({ channel: 'chrome', headless: true });
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const email = `browser-${randomUUID()}@example.com`;
      await page.goto('http://127.0.0.1:5176/register');
      await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('Browser Learner');
      await page.getByRole('textbox', { name: 'Email address', exact: true }).fill(email);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByLabel('Confirm password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      await page.waitForURL('**/dashboard');
      await page.goto('http://127.0.0.1:5176/profile/edit');
      await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('Persisted Browser');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.getByText('Your profile has been updated.').waitFor();
      const stored = await db.user.findUnique({ where: { email } });
      expect(stored.fullName).toBe('Persisted Browser');
      await page.goto(`http://127.0.0.1:5176/courses/${course.slug}`);
      await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
      await page.goto('http://127.0.0.1:5176/cart');
      await page.getByText(course.title, { exact: true }).waitFor();
      expect(await db.cartItem.count({ where: { userId: stored.id, courseId: course.id } })).toBe(1);
      expect(errors).toEqual([]);
    } finally {
      await browser?.close();
      await vite?.close();
      await new Promise(resolve => apiServer.close(resolve));
    }
  }, 90000);
});

describe('Authentication, sessions and CSRF', () => {
  it('connects to PostgreSQL and reports health', async () => {
    const response = await request(app).get('/api/v1/health').expect(200);
    expect(response.body.data.database).toBe('connected');
  });
  it('registers with normalized email, Argon2id, opaque cookies, and no leaked hash', async () => {
    const agent = await client();
    const response = await mutate(agent, 'post', '/auth/register', { email: '  Normalized@EXAMPLE.com ', fullName: 'Student', password });
    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe('normalized@example.com');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(response.headers['set-cookie'].join(';')).toContain('HttpOnly');
    const user = await db.user.findUnique({ where: { email: 'normalized@example.com' } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    const session = await db.session.findFirst({ where: { userId: user.id } });
    expect(session.tokenHash).toHaveLength(64);
    expect(response.headers['set-cookie'].join(';')).not.toContain(session.tokenHash);
    await agent.get('/api/v1/auth/me').expect(200);
  });
  it('rejects weak passwords, duplicate emails, and registration role injection', async () => {
    const agent = await client();
    for (const extra of [{ password: 'weak' }, { role: 'ADMIN' }]) {
      const res = await mutate(agent, 'post', '/auth/register', { email: 'bad@example.com', fullName: 'Bad', password, ...extra });
      expect(res.status).toBe(400);
      expect(res.body.error.details).toBeInstanceOf(Array);
    }
    const duplicate = await mutate(agent, 'post', '/auth/register', { email: 'normalized@example.com', fullName: 'Duplicate', password });
    expect(duplicate.status).toBe(409);
  });
  it('requires an authenticated session and verifies login credentials', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
    const agent = await client();
    expect((await mutate(agent, 'post', '/auth/login', { email: 'admin@example.com', password: 'wrong' })).status).toBe(401);
    expect((await mutate(agent, 'post', '/auth/login', { email: 'missing@example.com', password })).status).toBe(401);
    expect((await mutate(agent, 'post', '/auth/login', { email: 'ADMIN@example.com', password })).status).toBe(200);
  });
  it('rejects missing, forged, and cross-origin CSRF requests', async () => {
    const agent = await student();
    await agent.patch('/api/v1/users/me').set('Origin', origin).send({ bio: 'no token' }).expect(403);
    await agent.patch('/api/v1/users/me').set('Origin', origin).set('X-CSRF-Token', 'forged').send({ bio: 'bad token' }).expect(403);
    await agent.patch('/api/v1/users/me').set('Origin', 'https://evil.example').set('X-CSRF-Token', agent.csrf).send({ bio: 'bad origin' }).expect(403);
    await agent.patch('/api/v1/users/me').set('X-CSRF-Token', agent.csrf).send({ bio: 'no origin' }).expect(403);
  });
  it('rotates session tokens and revokes old sessions', async () => {
    const agent = await student();
    const old = await db.session.findFirst({ where: { userId: agent.user.id, revokedAt: null } });
    expect((await mutate(agent, 'post', '/auth/refresh')).status).toBe(200);
    expect((await db.session.findUnique({ where: { id: old.id } })).revokedAt).not.toBeNull();
    expect(await db.session.count({ where: { userId: agent.user.id, revokedAt: null } })).toBe(1);
    await agent.get('/api/v1/auth/me').expect(200);
  });
  it('revokes logout sessions and rejects expired sessions', async () => {
    const agent = await student();
    expect((await mutate(agent, 'post', '/auth/logout')).status).toBe(200);
    await agent.get('/api/v1/auth/me').expect(401);
    expect(await db.session.count({ where: { userId: agent.user.id, revokedAt: null } })).toBe(0);
    const expired = await student();
    await db.session.updateMany({ where: { userId: expired.user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expired.get('/api/v1/auth/me').expect(401);
  });
  it('prevents users from reaching any admin resources', async () => {
    const agent = await student();
    for (const route of ['stats', 'courses', 'users', 'orders', 'categories', 'reviews']) await agent.get(`/api/v1/admin/${route}`).expect(403);
    expect((await mutate(agent, 'post', '/admin/dev/enrollments', { userId: agent.user.id, courseId: course.id })).status).toBe(403);
  });
  it('uses shared PostgreSQL rate limits', async () => {
    const store = new PostgresRateLimitStore(createRepositories(db), `unit-${randomUUID()}`);
    store.init({ windowMs: 60000 });
    expect((await store.increment('same-client')).totalHits).toBe(1);
    expect((await store.increment('same-client')).totalHits).toBe(2);
    const limitedApp = await createApp({ db, config, rateLimits: { ...rateLimits, accountLimit: 2 } });
    const agent = await client(limitedApp);
    const email = `limited-${randomUUID()}@example.com`;
    expect((await mutate(agent, 'post', '/auth/login', { email, password })).status).toBe(401);
    expect((await mutate(agent, 'post', '/auth/login', { email, password })).status).toBe(401);
    expect((await mutate(agent, 'post', '/auth/login', { email, password })).status).toBe(429);
  });
});

describe('Public catalog and administrator course management', () => {
  it('never exposes private video identifiers or drafts publicly', async () => {
    const draft = await db.course.create({ data: { title: 'Draft', slug: 'hidden-draft', description: 'Hidden', instructorId, categoryId: category.id, price: '0.00' } });
    const response = await request(app).get(`/api/v1/courses/${course.slug}`).expect(200);
    expect(response.body.data.sections[0].lessons).toHaveLength(2);
    expect(JSON.stringify(response.body)).not.toContain('private-secret');
    expect(JSON.stringify(response.body)).not.toContain('videoUrl');
    await request(app).get(`/api/v1/courses/${draft.slug}`).expect(404);
    const listing = await request(app).get('/api/v1/courses').expect(200);
    expect(listing.body.data.items.some(c => c.id === draft.id)).toBe(false);
  });
  it('filters search, category, discounts, and effective decimal prices with pagination', async () => {
    const response = await request(app).get('/api/v1/courses?search=JavaScript&category=development&discounted=true&minPrice=80000&maxPrice=85000&limit=1').expect(200);
    expect(response.body.data.items[0].id).toBe(course.id);
    expect(response.body.data.pagination.total).toBe(1);
    const sorted = await request(app).get('/api/v1/courses?sort=price_asc').expect(200);
    expect(sorted.body.data.items[0].id).toBe(course.id);
    await request(app).get('/api/v1/courses?minPrice=100&maxPrice=1').expect(400);
    await request(app).get('/api/v1/courses?limit=100000').expect(400);
    await request(app).get('/api/v1/courses?search=%27%3B%20DROP%20TABLE%20%22User%22%3B--').expect(200);
  });
  it('creates, updates, and archives courses while preserving the record', async () => {
    const data = { title: 'Admin course', slug: 'admin-course', description: 'Course description', instructorId, categoryId: category.id, price: '150000.00', published: true };
    const created = await mutate(admin, 'post', '/admin/courses', data);
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await mutate(admin, 'patch', `/admin/courses/${id}`, { discountPrice: '160000' })).status).toBe(400);
    expect((await mutate(admin, 'patch', `/admin/courses/${id}`, { title: 'Updated', discountPrice: '120000.00' })).status).toBe(200);
    expect((await mutate(admin, 'delete', `/admin/courses/${id}`)).status).toBe(200);
    await request(app).get('/api/v1/courses/admin-course').expect(404);
    expect((await db.course.findUnique({ where: { id } })).deletedAt).not.toBeNull();
  });
  it('creates, reorders, updates, and deletes curriculum with parent checks', async () => {
    const base = `/admin/courses/${secondCourse.id}/sections`;
    const a = (await mutate(admin, 'post', base, { title: 'A' })).body.data;
    const b = (await mutate(admin, 'post', base, { title: 'B' })).body.data;
    const reordered = await mutate(admin, 'patch', `${base}/reorder`, { ids: [b.id, a.id] });
    expect(reordered.status).toBe(200);
    expect(reordered.body.data.map(s => s.id)).toEqual([b.id, a.id]);
    expect((await mutate(admin, 'patch', `${base}/reorder`, { ids: [a.id, a.id] })).status).toBe(400);
    expect((await mutate(admin, 'patch', `${base}/${section.id}`, { title: 'Hijacked' })).status).toBe(404);
    const lessonBase = `/admin/sections/${a.id}/lessons`;
    const l1 = (await mutate(admin, 'post', lessonBase, { title: 'One', durationSeconds: 50, isPreview: true })).body.data;
    const l2 = (await mutate(admin, 'post', lessonBase, { title: 'Two' })).body.data;
    expect((await mutate(admin, 'post', lessonBase, { title: 'Raw URL', videoUrl: 'https://private.example/video.mp4' })).status).toBe(400);
    expect((await mutate(admin, 'patch', `${lessonBase}/reorder`, { ids: [l2.id, l1.id] })).status).toBe(200);
    const updated = await mutate(admin, 'patch', `${lessonBase}/${l1.id}`, { title: 'Renamed' });
    expect(updated.body.data.durationSeconds).toBe(50);
    expect(updated.body.data.isPreview).toBe(true);
    expect((await mutate(admin, 'delete', `${lessonBase}/${l2.id}`)).status).toBe(200);
    expect((await mutate(admin, 'delete', `${base}/${b.id}`)).status).toBe(200);
  });
  it('supports category CRUD and rejects deletion while referenced', async () => {
    const created = await mutate(admin, 'post', '/admin/categories', { name: 'Design', slug: 'design' });
    expect(created.status).toBe(201);
    expect((await mutate(admin, 'patch', `/admin/categories/${created.body.data.id}`, { name: 'Visual Design' })).status).toBe(200);
    expect((await mutate(admin, 'delete', `/admin/categories/${created.body.data.id}`)).status).toBe(200);
    expect((await mutate(admin, 'delete', `/admin/categories/${category.id}`)).status).toBe(409);
  });
});

describe('Cart, orders and disabled payments', () => {
  it('requires authentication and refuses client-supplied prices', async () => {
    await request(app).get('/api/v1/cart').expect(401);
    const agent = await student();
    expect((await mutate(agent, 'post', '/cart/items', { courseId: course.id, price: '0' })).status).toBe(400);
  });
  it('deduplicates cart entries and calculates server totals exactly', async () => {
    const agent = await student();
    const first = await addToCart(agent);
    const duplicate = await addToCart(agent);
    expect(first.body.data.id).toBe(duplicate.body.data.id);
    await addToCart(agent, secondCourse);
    const cart = await agent.get('/api/v1/cart').expect(200);
    expect(cart.body.data.total).toBe('170000.05');
    expect(cart.body.data.discountTotal).toBe('20000.05');
    expect((await mutate(agent, 'delete', `/cart/items/${secondCourse.id}`)).status).toBe(200);
  });
  it('cleans unavailable cart entries safely', async () => {
    const agent = await student();
    const unavailable = await db.course.create({ data: { title: 'Temporary', slug: 'temporary', description: 'Temporary', instructorId, categoryId: category.id, price: '1', published: true } });
    await addToCart(agent, unavailable);
    await db.course.update({ where: { id: unavailable.id }, data: { published: false } });
    const cart = await agent.get('/api/v1/cart').expect(200);
    expect(cart.body.data.items).toHaveLength(0);
    expect((await mutate(agent, 'post', '/cart/items', { courseId: unavailable.id })).status).toBe(409);
  });
  it('creates pending snapshots, never enrolls, and disables checkout/webhooks', async () => {
    const agent = await student();
    await addToCart(agent);
    const response = await order(agent);
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data.status).toBe('PENDING_PAYMENT');
    expect(response.body.data.items[0].priceSnapshot).toBe('100000.10');
    expect(response.body.data.total).toBe('80000.05');
    expect(await db.enrollment.count({ where: { userId: agent.user.id } })).toBe(0);
    expect((await mutate(agent, 'post', `/orders/${response.body.data.id}/checkout`)).status).toBe(503);
    await request(app).post('/api/v1/payments/webhook/payme').send({ status: 'paid' }).expect(503);
    const other = await student();
    await other.get(`/api/v1/orders/${response.body.data.id}`).expect(404);
  });
  it('handles repeated and concurrent order keys without duplicate fulfillment', async () => {
    const agent = await student();
    await addToCart(agent);
    const key = randomUUID();
    const results = await Promise.all([order(agent, key), order(agent, key)]);
    expect(results.map(r => r.status).sort(), JSON.stringify(results.map(r => r.body))).toEqual([200, 201]);
    expect(results[0].body.data.id).toBe(results[1].body.data.id);
    expect((await order(agent, randomUUID())).status).toBe(409);
    expect(await db.order.count({ where: { userId: agent.user.id } })).toBe(1);
    expect((await mutate(agent, 'post', `/orders/${results[0].body.data.id}/cancel`)).status).toBe(200);
    expect((await order(agent)).status).toBe(201);
  });
  it('requires idempotency keys and a nonempty cart', async () => {
    const agent = await student();
    expect((await mutate(agent, 'post', '/orders')).status).toBe(400);
    expect((await order(agent)).status).toBe(409);
  });
});

describe('Enrollment, lessons and profiles', () => {
  it('gates full courses and progress behind enrollment', async () => {
    const agent = await student();
    await agent.get(`/api/v1/learning/courses/${course.id}`).expect(403);
    await agent.get(`/api/v1/learning/courses/${course.id}/lessons/${lesson.id}`).expect(403);
    expect((await mutate(agent, 'patch', `/learning/lessons/${lesson.id}/progress`, { completed: true })).status).toBe(403);
    await enroll(agent);
    await enroll(agent);
    expect(await db.enrollment.count({ where: { userId: agent.user.id, courseId: course.id } })).toBe(1);
    expect(await db.payment.count({ where: { order: { userId: agent.user.id } } })).toBe(0);
    const detail = await agent.get(`/api/v1/learning/courses/${course.id}`).expect(200);
    expect(detail.body.data.sections[0].lessons[0].number).toBe(1);
    const playback = await agent.get(`/api/v1/learning/courses/${course.id}/lessons/${lesson.id}`).expect(200);
    expect(playback.body.data.playback).toBeNull();
    expect(playback.body.data.nextLessonId).toBe(secondLesson.id);
    expect(JSON.stringify(playback.body)).not.toContain('private-secret');
    await enroll(agent, secondCourse);
    await agent.get(`/api/v1/learning/courses/${secondCourse.id}/lessons/${lesson.id}`).expect(404);
    expect((await mutate(agent, 'post', '/cart/items', { courseId: course.id })).status).toBe(409);
  });
  it('records positions and completion, and issues certificates only on completion', async () => {
    const agent = await student();
    await enroll(agent);
    expect((await mutate(agent, 'post', `/learning/courses/${course.id}/certificate`)).status).toBe(409);
    const first = await mutate(agent, 'patch', `/learning/lessons/${lesson.id}/progress`, { completed: true, lastPositionSeconds: 120 });
    expect(first.status).toBe(200);
    expect(first.body.data.completedAt).not.toBeNull();
    expect((await mutate(agent, 'patch', `/learning/lessons/${lesson.id}/progress`, { lastPositionSeconds: 601 })).status).toBe(400);
    const detail = await agent.get(`/api/v1/learning/courses/${course.id}`).expect(200);
    expect(detail.body.data.progress.percentage).toBe(50);
    await mutate(agent, 'patch', `/learning/lessons/${secondLesson.id}/progress`, { completed: true });
    const cert = await mutate(agent, 'post', `/learning/courses/${course.id}/certificate`);
    expect(cert.status).toBe(201);
    expect((await mutate(agent, 'post', `/learning/courses/${course.id}/certificate`)).body.data.id).toBe(cert.body.data.id);
  });
  it('disables development grants unless the flag is explicitly enabled', async () => {
    const disabled = await createApp({ db, config: { ...config, DEV_ENROLLMENT_ENABLED: false }, rateLimits });
    const operator = await login('admin@example.com', disabled);
    expect((await mutate(operator, 'post', '/admin/dev/enrollments', { userId: instructorId, courseId: course.id })).status).toBe(404);
  });
  it('updates profiles but refuses privilege and avatar URL injection', async () => {
    const agent = await student();
    const changed = await mutate(agent, 'patch', '/users/me', { fullName: 'Updated Name', bio: 'Learning APIs' });
    expect(changed.body.data.fullName).toBe('Updated Name');
    expect((await mutate(agent, 'patch', '/users/me', { role: 'ADMIN' })).status).toBe(400);
    expect((await mutate(agent, 'patch', '/users/me', { avatarUrl: 'https://evil.example/image' })).status).toBe(400);
  });
  it('validates actual image content and persists re-encoded avatars in PostgreSQL', async () => {
    const agent = await student();
    await agent.post('/api/v1/users/me/avatar').set('Origin', origin).set('X-CSRF-Token', agent.csrf).attach('avatar', Buffer.from('<script>bad</script>'), { filename: 'avatar.png', contentType: 'image/png' }).expect(400);
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const uploaded = await agent.post('/api/v1/users/me/avatar').set('Origin', origin).set('X-CSRF-Token', agent.csrf).attach('avatar', bytes, { filename: 'avatar.png', contentType: 'image/png' });
    expect(uploaded.status, JSON.stringify(uploaded.body)).toBe(200);
    const asset = await request(app).get(uploaded.body.data.avatarUrl).expect(200);
    expect(asset.headers['content-type']).toContain('image/webp');
    expect(await db.asset.count({ where: { userId: agent.user.id } })).toBe(1);
  });
  it('requires current password and invalidates all sessions after password changes', async () => {
    const agent = await student();
    const another = await login(agent.email);
    expect((await mutate(agent, 'patch', '/users/me/password', { currentPassword: 'incorrect', newPassword: 'NewPassword123!' })).status).toBe(400);
    expect((await mutate(agent, 'patch', '/users/me/password', { currentPassword: password, newPassword: 'NewPassword123!' })).status).toBe(200);
    await agent.get('/api/v1/auth/me').expect(401);
    await another.get('/api/v1/auth/me').expect(401);
    const fresh = await client();
    expect((await mutate(fresh, 'post', '/auth/login', { email: agent.email, password: 'NewPassword123!' })).status).toBe(200);
  });
  it('supports enrolled-user reviews and admin moderation', async () => {
    const agent = await student();
    expect((await mutate(agent, 'post', `/courses/${course.id}/reviews`, { rating: 5, comment: 'Useful' })).status).toBe(403);
    await enroll(agent);
    const created = await mutate(agent, 'post', `/courses/${course.id}/reviews`, { rating: 5, comment: 'Useful' });
    expect(created.status).toBe(201);
    expect((await mutate(agent, 'post', `/courses/${course.id}/reviews`, { rating: 5, comment: 'Duplicate' })).status).toBe(409);
    expect((await mutate(admin, 'patch', `/admin/reviews/${created.body.data.id}`, { hidden: true })).status).toBe(200);
    const reviews = await request(app).get(`/api/v1/courses/${course.id}/reviews`).expect(200);
    expect(reviews.body.data.items.some(r => r.id === created.body.data.id)).toBe(false);
  });
  it('protects the final administrator and revokes sessions on role changes', async () => {
    expect((await mutate(admin, 'patch', `/admin/users/${instructorId}/role`, { role: 'USER' })).status).toBe(409);
    const agent = await student();
    expect((await mutate(admin, 'patch', `/admin/users/${agent.user.id}/role`, { role: 'ADMIN' })).status).toBe(200);
    await agent.get('/api/v1/auth/me').expect(401);
    expect((await mutate(admin, 'patch', `/admin/users/${agent.user.id}/role`, { role: 'USER' })).status).toBe(200);
  });
  it('does not count pending orders or development enrollments as revenue', async () => {
    const stats = await admin.get('/api/v1/admin/stats').expect(200);
    expect(stats.body.data.confirmedRevenue).toBe('0.00');
    expect(stats.body.data.totalUsers).toBeGreaterThan(0);
  });
});

describe('Provider contracts and signed local media', () => {
  it('only fulfills verified matching payments, idempotently', async () => {
    // Test-only adapter, injected into this app instance; never loaded by production configuration.
    const providers = await createProviders(config, createRepositories(db));
    providers.payment = { enabled: true, provider: 'custom', createCheckout: async () => ({ unavailableInTest: true }),
      verifyWebhook: async ({ rawBody, headers }) => ({ verified: headers['x-test-verification'] === 'verified-test-event', event: JSON.parse(rawBody.toString()) }) };
    const paymentApp = await createApp({ db, config, providers, rateLimits });
    const agent = await student(paymentApp);
    await addToCart(agent);
    const pending = await order(agent);
    const event = { provider: 'custom', providerPaymentId: randomUUID(), orderId: pending.body.data.id, amount: '80000.05', currency: 'UZS', status: 'SUCCEEDED' };
    await request(paymentApp).post('/api/v1/payments/webhook/custom').send(event).expect(401);
    await request(paymentApp).post('/api/v1/payments/webhook/custom').set('X-Test-Verification', 'verified-test-event').send({ ...event, amount: '1.00' }).expect(400);
    const sendEvent = () => request(paymentApp).post('/api/v1/payments/webhook/custom').set('X-Test-Verification', 'verified-test-event').send(event);
    const results = await Promise.all([sendEvent(), sendEvent()]);
    expect(results.map(r => r.status), JSON.stringify(results.map(r => r.body))).toEqual([200, 200]);
    expect(await db.payment.count({ where: { orderId: event.orderId } })).toBe(1);
    expect(await db.enrollment.count({ where: { userId: agent.user.id, courseId: course.id } })).toBe(1);
    expect((await db.order.findUnique({ where: { id: event.orderId } })).status).toBe('PAID');
    const stats = await admin.get('/api/v1/admin/stats').expect(200);
    expect(stats.body.data.confirmedRevenue).toBe('80000.05');
  });
  it('serves only enrolled, session-bound signed media and rejects copied links', async () => {
    const directory = path.resolve('.local', `test-media-${randomUUID()}`);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'private-secret-asset.mp4'), Buffer.from('test video bytes'));
    try {
      const mediaConfig = { ...config, VIDEO_PROVIDER: 'signed-local', MEDIA_LOCAL_DIR: directory };
      const mediaApp = await createApp({ db, config: mediaConfig, rateLimits });
      const agent = await student(mediaApp);
      await enroll(agent);
      const detail = await agent.get(`/api/v1/learning/courses/${course.id}/lessons/${lesson.id}`).expect(200);
      const playback = detail.body.data.playback;
      expect(playback.url).toContain(`/media/${lesson.id}`);
      expect(playback.url).not.toContain('private-secret');
      await agent.get(playback.url).expect(200);
      await agent.get(`${playback.url}tampered`).expect(403);
      const other = await student(mediaApp);
      await enroll(other);
      await other.get(playback.url).expect(403);
      await request(mediaApp).get(playback.url).expect(401);
    } finally {
      // Generated test-only directory is constrained to the workspace .local directory.
      if (path.dirname(directory) !== path.resolve('.local')) throw new Error('Unsafe test cleanup path');
      await rm(directory, { recursive: true, force: true });
    }
  });
});
