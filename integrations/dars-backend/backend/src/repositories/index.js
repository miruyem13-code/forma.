import { publicUser, instructor, courseCard, curriculum, orderInclude } from './selectors.js';
import { Prisma } from '@prisma/client';

export function createRepositories(db, transactional = false) {
  const r = {
    async transaction(fn) {
      if (transactional) return fn(r);
      for (let attempt = 0; ; attempt++) {
        try { return await db.$transaction(tx => fn(createRepositories(tx, true)), { isolationLevel: 'Serializable', timeout: 15000 }); }
        catch (error) { if (error.code !== 'P2034' || attempt >= 3) throw error; }
      }
    },
    lock: key => db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`,
    health: () => db.$queryRaw`SELECT 1 AS ok`,
    user: {
      byEmail: email => db.user.findUnique({ where: { email } }),
      credentials: id => db.user.findUnique({ where: { id } }),
      get: id => db.user.findUnique({ where: { id }, select: publicUser }),
      create: data => db.user.create({ data, select: publicUser }),
      update: (id, data) => db.user.update({ where: { id }, data, select: publicUser }),
      list: (skip, take) => db.user.findMany({ skip, take, orderBy: { createdAt: 'desc' }, select: publicUser }),
      count: where => db.user.count({ where }),
    },
    session: {
      get: tokenHash => db.session.findUnique({ where: { tokenHash }, include: { user: { select: publicUser } } }),
      create: data => db.session.create({ data }),
      revoke: id => db.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } }),
      revokeAll: userId => db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      prune: () => db.session.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }] } }),
    },
    category: {
      list: () => db.category.findMany({ orderBy: { name: 'asc' } }),
      get: id => db.category.findUnique({ where: { id } }),
      create: data => db.category.create({ data }),
      update: (id, data) => db.category.update({ where: { id }, data }),
      delete: id => db.category.delete({ where: { id } }),
    },
    course: {
      async byEffectivePrice(query, admin, skip, take) {
        const clauses = [Prisma.sql`c."deletedAt" IS NULL`];
        if (!admin) clauses.push(Prisma.sql`c."published" = true`);
        if (query.search) {
          const term = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
          clauses.push(Prisma.sql`(c."title" ILIKE ${term} OR c."description" ILIKE ${term})`);
        }
        if (query.category) clauses.push(Prisma.sql`cat."slug" = ${query.category}`);
        if (query.discounted === true) clauses.push(Prisma.sql`c."discountPrice" IS NOT NULL`);
        if (query.discounted === false) clauses.push(Prisma.sql`c."discountPrice" IS NULL`);
        if (query.minPrice !== undefined) clauses.push(Prisma.sql`COALESCE(c."discountPrice", c."price") >= ${query.minPrice}::numeric`);
        if (query.maxPrice !== undefined) clauses.push(Prisma.sql`COALESCE(c."discountPrice", c."price") <= ${query.maxPrice}::numeric`);
        const direction = query.sort === 'price_desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
        const ids = await db.$queryRaw(Prisma.sql`SELECT c."id" FROM "Course" c JOIN "Category" cat ON cat."id" = c."categoryId"
          WHERE ${Prisma.join(clauses, ' AND ')} ORDER BY COALESCE(c."discountPrice", c."price") ${direction}, c."id" ASC OFFSET ${skip} LIMIT ${take}`);
        const courses = await db.course.findMany({ where: { id: { in: ids.map(v => v.id) } }, select: courseCard });
        const byId = new Map(courses.map(c => [c.id, c]));
        return ids.map(v => byId.get(v.id)).filter(Boolean);
      },
      list: (where, orderBy, skip, take) => db.course.findMany({ where, orderBy, skip, take, select: courseCard }),
      count: where => db.course.count({ where }),
      bySlug: slug => db.course.findFirst({ where: { slug, published: true, deletedAt: null }, select: { ...courseCard, sections: curriculum } }),
      get: id => db.course.findUnique({ where: { id } }),
      learning: id => db.course.findUnique({ where: { id }, select: { ...courseCard, sections: curriculum } }),
      create: data => db.course.create({ data }),
      update: (id, data) => db.course.update({ where: { id }, data }),
      adminDetail: id => db.course.findUnique({ where: { id }, include: { category: true, instructor: { select: instructor }, sections: { orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' } } } } } }),
    },
    section: {
      get: id => db.section.findUnique({ where: { id } }),
      list: courseId => db.section.findMany({ where: { courseId }, orderBy: { position: 'asc' } }),
      create: data => db.section.create({ data }),
      update: (id, data) => db.section.update({ where: { id }, data }),
      delete: id => db.section.delete({ where: { id } }),
    },
    lesson: {
      get: id => db.lesson.findUnique({ where: { id }, include: { section: true } }),
      list: sectionId => db.lesson.findMany({ where: { sectionId }, orderBy: { position: 'asc' } }),
      create: data => db.lesson.create({ data }),
      update: (id, data) => db.lesson.update({ where: { id }, data }),
      delete: id => db.lesson.delete({ where: { id } }),
    },
    cart: {
      list: userId => db.cartItem.findMany({ where: { userId }, include: { course: true }, orderBy: { createdAt: 'asc' } }),
      add: (userId, courseId) => db.cartItem.upsert({ where: { userId_courseId: { userId, courseId } }, create: { userId, courseId }, update: {} }),
      remove: (userId, courseId) => db.cartItem.deleteMany({ where: { userId, courseId } }),
      removeCourses: (userId, ids) => db.cartItem.deleteMany({ where: { userId, courseId: { in: ids } } }),
      removeInvalid: userId => db.cartItem.deleteMany({ where: { userId, course: { OR: [{ published: false }, { deletedAt: { not: null } }] } } }),
    },
    order: {
      get: id => db.order.findUnique({ where: { id }, include: orderInclude }),
      byKey: (userId, idempotencyKey) => db.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } }, include: orderInclude }),
      pending: userId => db.order.findFirst({ where: { userId, status: 'PENDING_PAYMENT' } }),
      create: data => db.order.create({ data, include: orderInclude }),
      update: (id, data) => db.order.update({ where: { id }, data, include: orderInclude }),
      list: (where, skip, take) => db.order.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: orderInclude }),
      count: where => db.order.count({ where }),
      revenue: () => db.order.aggregate({ where: { status: 'PAID' }, _sum: { total: true } }),
    },
    payment: {
      get: (provider, providerPaymentId) => db.payment.findUnique({ where: { provider_providerPaymentId: { provider, providerPaymentId } } }),
      create: data => db.payment.create({ data }),
    },
    enrollment: {
      get: (userId, courseId) => db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } }),
      list: (userId, skip, take) => db.enrollment.findMany({ where: { userId }, skip, take, orderBy: { enrolledAt: 'desc' }, include: { course: { select: courseCard } } }),
      count: userId => db.enrollment.count({ where: { userId } }),
      create: (userId, courseId, source = 'PAYMENT') => db.enrollment.upsert({ where: { userId_courseId: { userId, courseId } }, update: {}, create: { userId, courseId, source } }),
    },
    progress: {
      list: (userId, courseId) => db.lessonProgress.findMany({ where: { userId, lesson: { section: { courseId } } } }),
      get: (userId, lessonId) => db.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } }),
      upsert: (userId, lessonId, data) => db.lessonProgress.upsert({ where: { userId_lessonId: { userId, lessonId } }, create: { userId, lessonId, ...data }, update: data }),
    },
    review: {
      list: (where, skip, take) => db.review.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } }),
      count: where => db.review.count({ where }),
      create: data => db.review.create({ data }),
      update: (id, data) => db.review.update({ where: { id }, data }),
      delete: id => db.review.delete({ where: { id } }),
    },
    certificate: {
      get: (userId, courseId) => db.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } }),
      create: data => db.certificate.upsert({ where: { userId_courseId: { userId: data.userId, courseId: data.courseId } }, update: {}, create: data }),
    },
    asset: {
      get: id => db.asset.findUnique({ where: { id } }),
      create: data => db.asset.create({ data, select: { id: true } }),
      delete: id => db.asset.deleteMany({ where: { id } }),
      removeOld: (userId, id) => db.asset.deleteMany({ where: { userId, id: { not: id } } }),
    },
    rate: {
      async increment(key, windowMs) {
        const rows = await db.$queryRaw`
          INSERT INTO "RateLimit" ("key", "hits", "expiresAt") VALUES (${key}, 1, NOW() + ${windowMs} * interval '1 millisecond')
          ON CONFLICT ("key") DO UPDATE SET
            "hits" = CASE WHEN "RateLimit"."expiresAt" <= NOW() THEN 1 ELSE "RateLimit"."hits" + 1 END,
            "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= NOW() THEN NOW() + ${windowMs} * interval '1 millisecond' ELSE "RateLimit"."expiresAt" END
          RETURNING "hits", "expiresAt"`;
        return { totalHits: rows[0].hits, resetTime: rows[0].expiresAt };
      },
      decrement: key => db.rateLimit.updateMany({ where: { key, hits: { gt: 0 } }, data: { hits: { decrement: 1 } } }),
      reset: key => db.rateLimit.deleteMany({ where: { key } }),
      prune: () => db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    },
  };
  return r;
}
