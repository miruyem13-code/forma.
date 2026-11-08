import { Router } from 'express';
import multer from 'multer';
import * as v from '../validators/index.js';
import { ids, validateRequest } from '../middleware/validate.js';
import { requireAuth, requireAdmin, limiter } from '../middleware/security.js';
import { handler, createControllers } from '../controllers/index.js';

export function createRoutes(services, security, repos, options = {}) {
  const api = Router();
  const c = createControllers(services, security);
  const body = schema => validateRequest({ body: schema });
  const query = schema => validateRequest({ query: schema });
  const authLimit = limiter(repos, 'auth-ip', options.authLimit ?? 30, 15 * 60000);
  const accountLimit = limiter(repos, 'auth-account', options.accountLimit ?? 12, 15 * 60000, req => req.validated.body.email);

  api.get('/health', handler(() => services.health()));
  api.get('/auth/csrf', c.csrf);
  api.post('/auth/register', authLimit, body(v.register), accountLimit, c.register);
  api.post('/auth/login', authLimit, body(v.login), accountLimit, c.login);
  api.post('/auth/logout', requireAuth, body(v.empty), c.logout);
  api.post('/auth/refresh', requireAuth, body(v.empty), c.refresh);
  api.get('/auth/me', requireAuth, handler(req => services.profile.get(req.user.id)));

  api.get('/categories', handler(() => services.catalog.categories()));
  api.get('/courses', query(v.courseQuery), handler(req => services.catalog.list(req.validated.query)));
  api.get('/courses/:courseId/reviews', ids('courseId'), query(v.page.strict()), handler(req => services.catalog.reviews(req.params.courseId, req.validated.query)));
  api.post('/courses/:courseId/reviews', requireAuth, ids('courseId'), body(v.review), handler(req => services.catalog.review(req.user.id, req.params.courseId, req.validated.body), 201));
  api.get('/courses/:slug', handler(req => services.catalog.detail(req.params.slug)));
  api.get('/assets/:id', ids('id'), c.asset);

  const user = Router();
  user.use(requireAuth);
  user.get('/users/me', handler(req => services.profile.get(req.user.id)));
  user.patch('/users/me', body(v.profile), handler(req => services.profile.update(req.user.id, req.validated.body)));
  user.patch('/users/me/password', authLimit, body(v.changePassword), c.changePassword);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 } });
  user.post('/users/me/avatar', limiter(repos, 'avatar', 10, 60000, req => req.user.id), upload.single('avatar'), handler(req => services.profile.avatar(req.user.id, req.file)));
  user.get('/cart', handler(req => services.commerce.cart(req.user.id)));
  user.post('/cart/items', body(v.cartItem), handler(req => services.commerce.addCart(req.user.id, req.validated.body.courseId), 201));
  user.delete('/cart/items/:courseId', ids('courseId'), handler(req => services.commerce.removeCart(req.user.id, req.params.courseId)));
  user.post('/orders', body(v.empty), c.createOrder);
  user.get('/orders/me', query(v.page.strict()), handler(req => services.commerce.orders(req.user.id, req.validated.query)));
  user.get('/orders/:id', ids('id'), handler(req => services.commerce.order(req.user.id, req.params.id)));
  user.post('/orders/:id/cancel', ids('id'), body(v.empty), handler(req => services.commerce.cancelOrder(req.user.id, req.params.id)));
  user.post('/orders/:id/checkout', ids('id'), body(v.empty), handler(req => services.commerce.checkout(req.user.id, req.params.id)));
  user.get('/enrollments/me', query(v.page.strict()), handler(req => services.learning.enrollments(req.user.id, req.validated.query)));
  user.get('/enrollments/me/:courseId', ids('courseId'), handler(req => services.learning.enrollment(req.user.id, req.params.courseId)));
  user.get('/learning/courses/:courseId', ids('courseId'), handler(req => services.learning.course(req.user.id, req.params.courseId)));
  user.get('/learning/courses/:courseId/lessons/:lessonId', ids('courseId', 'lessonId'), handler(req => services.learning.lesson(req.user.id, req.session.id, req.params.courseId, req.params.lessonId)));
  user.patch('/learning/lessons/:lessonId/progress', ids('lessonId'), body(v.progress), handler(req => services.learning.progress(req.user.id, req.params.lessonId, req.validated.body)));
  user.post('/learning/courses/:courseId/certificate', ids('courseId'), body(v.empty), handler(req => services.learning.certificate(req.user.id, req.params.courseId), 201));
  user.get('/media/:lessonId', ids('lessonId'), c.media);
  api.use(user);

  const admin = Router();
  admin.use(requireAuth, requireAdmin);
  admin.get('/stats', handler(() => services.admin.stats()));
  admin.get('/courses', query(v.courseQuery), handler(req => services.catalog.list(req.validated.query, true)));
  admin.post('/courses', body(v.createCourse), handler(req => services.admin.createCourse(req.validated.body), 201));
  admin.get('/courses/:id', ids('id'), handler(req => services.admin.course(req.params.id)));
  admin.patch('/courses/:id', ids('id'), body(v.updateCourse), handler(req => services.admin.updateCourse(req.params.id, req.validated.body)));
  admin.delete('/courses/:id', ids('id'), handler(req => services.admin.deleteCourse(req.params.id)));
  for (const [kind, base, parentName, createSchema, updateSchema] of [
    ['section', '/courses/:courseId/sections', 'courseId', v.section, v.section],
    ['lesson', '/sections/:sectionId/lessons', 'sectionId', v.lesson, v.updateLesson],
  ]) {
    admin.get(base, ids(parentName), handler(req => services.admin.children(kind, req.params[parentName])));
    admin.post(base, ids(parentName), body(createSchema), handler(req => services.admin.createChild(kind, req.params[parentName], req.validated.body), 201));
    admin.patch(`${base}/reorder`, ids(parentName), body(v.reorder), handler(req => services.admin.reorder(kind, req.params[parentName], req.validated.body.ids)));
    admin.patch(`${base}/:id`, ids(parentName, 'id'), body(updateSchema), handler(req => services.admin.updateChild(kind, req.params[parentName], req.params.id, req.validated.body)));
    admin.delete(`${base}/:id`, ids(parentName, 'id'), handler(req => services.admin.deleteChild(kind, req.params[parentName], req.params.id)));
  }
  admin.get('/users', query(v.page.strict()), handler(req => services.admin.users(req.validated.query)));
  admin.get('/users/:id', ids('id'), handler(req => services.admin.user(req.params.id)));
  admin.patch('/users/:id/role', ids('id'), body(v.role), handler(req => services.admin.changeRole(req.user.id, req.params.id, req.validated.body.role)));
  admin.get('/orders', query(v.page.strict()), handler(req => services.admin.orders(req.validated.query)));
  admin.get('/orders/:id', ids('id'), handler(req => services.admin.order(req.params.id)));
  admin.get('/categories', handler(() => services.catalog.categories()));
  admin.post('/categories', body(v.category), handler(req => services.admin.createCategory(req.validated.body), 201));
  admin.patch('/categories/:id', ids('id'), body(v.updateCategory), handler(req => services.admin.updateCategory(req.params.id, req.validated.body)));
  admin.delete('/categories/:id', ids('id'), handler(req => services.admin.deleteCategory(req.params.id)));
  admin.get('/reviews', query(v.page.strict()), handler(req => services.admin.reviews(req.validated.query)));
  admin.patch('/reviews/:id', ids('id'), body(v.moderation), handler(req => services.admin.moderateReview(req.params.id, req.validated.body)));
  admin.delete('/reviews/:id', ids('id'), handler(req => services.admin.deleteReview(req.params.id)));
  admin.post('/dev/enrollments', body(v.devEnrollment), handler(req => services.admin.devEnroll(req.user.id, req.validated.body), 201));
  api.use('/admin', admin);
  return api;
}
