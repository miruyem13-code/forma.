import { assert, found } from '../utils/errors.js';
import { decimal } from '../utils/money.js';
import { pagination, paginated } from '../validators/index.js';

export function courseWhere(query, admin = false) {
  const where = { deletedAt: null, ...(!admin ? { published: true } : {}) };
  if (query.search) where.OR = ['title', 'description'].map(field => ({ [field]: { contains: query.search, mode: 'insensitive' } }));
  if (query.category) where.category = { slug: query.category };
  if (query.discounted !== undefined) where.discountPrice = query.discounted ? { not: null } : null;
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const bounds = { ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}), ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}) };
    where.AND = [{ OR: [{ discountPrice: bounds }, { discountPrice: null, price: bounds }] }];
  }
  return where;
}
export function catalogService(repos) {
  return {
    async list(query, admin = false) {
      if (query.minPrice && query.maxPrice) assert(decimal(query.minPrice).lte(query.maxPrice), 400, 'VALIDATION_ERROR', 'minPrice must not exceed maxPrice');
      const where = courseWhere(query, admin);
      const { skip, take } = pagination(query);
      const orderBy = query.sort === 'popular' ? [{ enrollments: { _count: 'desc' } }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'asc' }];
      const [items, total] = await Promise.all([
        ['price_asc', 'price_desc'].includes(query.sort) ? repos.course.byEffectivePrice(query, admin, skip, take) : repos.course.list(where, orderBy, skip, take),
        repos.course.count(where),
      ]);
      return paginated(items, total, query);
    },
    detail: async slug => found(await repos.course.bySlug(slug)),
    categories: () => repos.category.list(),
    async reviews(courseId, query) {
      const course = found(await repos.course.get(courseId));
      assert(course.published && !course.deletedAt, 404, 'NOT_FOUND', 'Course not found');
      const where = { courseId, hidden: false };
      const { skip, take } = pagination(query);
      return paginated(await repos.review.list(where, skip, take), await repos.review.count(where), query);
    },
    async review(userId, courseId, input) {
      assert(await repos.enrollment.get(userId, courseId), 403, 'NOT_ENROLLED', 'Enrollment is required to review this course');
      return repos.review.create({ userId, courseId, ...input });
    },
  };
}
