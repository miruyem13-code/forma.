import { assert, found } from '../utils/errors.js';
import { decimal, money } from '../utils/money.js';
import { pagination, paginated } from '../validators/index.js';

export function adminService(repos, config, logger) {
  // Persist the editor's course and curriculum in one transaction. Unchanged lesson
  // IDs retain progress; deleting a lesson explicitly removes its progress records.
  async function saveCurriculum(r, courseId, sections) {
    const sectionIds = sections.map(item => item.id);
    const lessonIds = sections.flatMap(item => item.lessons.map(lesson => lesson.id));
    assert(new Set(sectionIds).size === sectionIds.length && new Set(lessonIds).size === lessonIds.length, 400, 'DUPLICATE_IDS', 'Curriculum IDs must be unique');
    const oldSections = await r.section.list(courseId);
    for (const section of oldSections) {
      if (!sectionIds.includes(section.id)) await r.section.delete(section.id);
      else await r.section.update(section.id, { position: section.position + 1000000 });
    }
    for (const [index, section] of sections.entries()) {
      const existing = await r.section.get(section.id);
      if (existing) assert(existing.courseId === courseId, 403, 'FORBIDDEN', 'Section belongs to another course');
      const data = { title: section.title, position: index + 1 };
      if (existing) await r.section.update(section.id, data);
      else await r.section.create({ id: section.id, courseId, ...data });
      const oldLessons = await r.lesson.list(section.id);
      for (const item of oldLessons) {
        if (!section.lessons.some(lesson => lesson.id === item.id)) await r.lesson.delete(item.id);
        else await r.lesson.update(item.id, { position: item.position + 1000000 });
      }
      for (const [position, item] of section.lessons.entries()) {
        const previous = await r.lesson.get(item.id);
        if (previous) assert(previous.sectionId === section.id, 403, 'FORBIDDEN', 'Lesson belongs to another section');
        const { id, ...fields } = item;
        if (previous) await r.lesson.update(id, { ...fields, position: position + 1 });
        else await r.lesson.create({ id, sectionId: section.id, ...fields, position: position + 1 });
      }
    }
  }
  async function validCourse(r, data, previous = {}) {
    const merged = { ...previous, ...data };
    assert(merged.discountPrice == null || decimal(merged.discountPrice).lt(merged.price), 400, 'INVALID_DISCOUNT', 'Discount price must be less than the regular price');
    found(await r.category.get(merged.categoryId), 'Category not found');
    found(await r.user.get(merged.instructorId), 'Instructor not found');
    return data;
  }
  async function parent(r, kind, parentId) {
    if (kind === 'section') return found(await r.course.get(parentId));
    return found(await r.section.get(parentId));
  }
  async function rearrange(r, kind, parentId, ids) {
    const items = await r[kind].list(parentId);
    assert(items.length === ids.length && items.every(item => ids.includes(item.id)), 400, 'INVALID_REORDER', 'Provide every child ID exactly once');
    // Temporary positive positions avoid transient violations of the unique parent/position key.
    for (let index = 0; index < ids.length; index++) await r[kind].update(ids[index], { position: 1000000 + index });
    for (let index = 0; index < ids.length; index++) await r[kind].update(ids[index], { position: index + 1 });
    return r[kind].list(parentId);
  }
  return {
    async stats() {
      const [totalUsers, totalCourses, totalOrders, revenue, recentUsers, recentOrders, popularCourses] = await Promise.all([
        repos.user.count({}), repos.course.count({ deletedAt: null }), repos.order.count({}), repos.order.revenue(),
        repos.user.list(0, 5), repos.order.list({}, 0, 5), repos.course.list({ deletedAt: null }, { enrollments: { _count: 'desc' } }, 0, 5),
      ]);
      return { totalUsers, totalCourses, totalOrders, confirmedRevenue: money(revenue._sum.total ?? 0), currency: 'UZS', recentUsers, recentOrders, popularCourses };
    },
    course: async id => found(await repos.course.adminDetail(id)),
    createCourse: data => repos.transaction(async r => {
      const { sections, ...fields } = data;
      const course = await r.course.create(await validCourse(r, fields));
      if (sections) await saveCurriculum(r, course.id, sections);
      return course;
    }),
    updateCourse: (id, data) => repos.transaction(async r => {
      await r.lock(`course:${id}`);
      const course = found(await r.course.get(id));
      assert(!course.deletedAt, 409, 'COURSE_ARCHIVED', 'Archived courses cannot be edited');
      const { sections, ...fields } = data;
      const result = await r.course.update(id, await validCourse(r, fields, course));
      if (sections) await saveCurriculum(r, id, sections);
      return result;
    }),
    deleteCourse: id => repos.transaction(async r => {
      await r.lock(`course:${id}`);
      found(await r.course.get(id));
      // Preserve purchased curriculum, order snapshots, and referential integrity.
      return r.course.update(id, { published: false, deletedAt: new Date() });
    }),
    async children(kind, parentId) { await parent(repos, kind, parentId); return repos[kind].list(parentId); },
    createChild: (kind, parentId, data) => repos.transaction(async r => {
      await r.lock(`${kind}-children:${parentId}`);
      await parent(r, kind, parentId);
      const items = await r[kind].list(parentId);
      assert(items.length < 1000, 409, 'CHILD_LIMIT', 'A parent may contain up to 1000 children');
      return r[kind].create({ ...data, [kind === 'section' ? 'courseId' : 'sectionId']: parentId, position: (items.at(-1)?.position ?? 0) + 1 });
    }),
    updateChild: (kind, parentId, id, data) => repos.transaction(async r => {
      await r.lock(`${kind}-children:${parentId}`);
      const item = found(await r[kind].get(id));
      assert(item[kind === 'section' ? 'courseId' : 'sectionId'] === parentId, 404, 'NOT_FOUND', 'Resource not found under this parent');
      return r[kind].update(id, data);
    }),
    deleteChild: (kind, parentId, id) => repos.transaction(async r => {
      await r.lock(`${kind}-children:${parentId}`);
      const item = found(await r[kind].get(id));
      assert(item[kind === 'section' ? 'courseId' : 'sectionId'] === parentId, 404, 'NOT_FOUND', 'Resource not found under this parent');
      await r[kind].delete(id);
      const items = await r[kind].list(parentId);
      await rearrange(r, kind, parentId, items.map(i => i.id));
      return { deleted: true };
    }),
    reorder: (kind, parentId, ids) => repos.transaction(async r => {
      await r.lock(`${kind}-children:${parentId}`);
      await parent(r, kind, parentId);
      return rearrange(r, kind, parentId, ids);
    }),
    async users(query) { const { skip, take } = pagination(query); return paginated(await repos.user.list(skip, take), await repos.user.count({}), query); },
    user: async id => found(await repos.user.get(id)),
    async changeRole(actorId, id, role) {
      const user = await repos.transaction(async r => {
        await r.lock('admin-membership');
        const actor = found(await r.user.get(actorId));
        assert(actor.role === 'ADMIN', 403, 'FORBIDDEN', 'Administrator access is required');
        const target = found(await r.user.get(id));
        if (target.role === 'ADMIN' && role === 'USER') assert(await r.user.count({ role: 'ADMIN' }) > 1, 409, 'FINAL_ADMIN', 'The final administrator cannot be demoted');
        const updated = await r.user.update(id, { role });
        if (role !== target.role) await r.session.revokeAll(id);
        return updated;
      });
      logger.info({ actorId, targetUserId: id, role, action: 'user.role.changed' }, 'Administrator changed role');
      return user;
    },
    async orders(query) { const { skip, take } = pagination(query); return paginated(await repos.order.list({}, skip, take), await repos.order.count({}), query); },
    order: async id => found(await repos.order.get(id)),
    createCategory: data => repos.category.create(data),
    updateCategory: (id, data) => repos.category.update(id, data),
    async deleteCategory(id) { await repos.category.delete(id); return { deleted: true }; },
    async reviews(query) { const { skip, take } = pagination(query); return paginated(await repos.review.list({}, skip, take), await repos.review.count({}), query); },
    moderateReview: (id, data) => repos.review.update(id, data),
    async deleteReview(id) { await repos.review.delete(id); return { deleted: true }; },
    async devEnroll(actorId, { userId, courseId }) {
      assert(config.NODE_ENV !== 'production' && config.DEV_ENROLLMENT_ENABLED, 404, 'NOT_FOUND', 'Resource not found');
      const enrollment = await repos.transaction(async r => {
        await r.lock(`user:${userId}`);
        found(await r.user.get(userId));
        found(await r.course.get(courseId));
        return r.enrollment.create(userId, courseId, 'DEVELOPMENT');
      });
      logger.info({ actorId, userId, courseId, action: 'enrollment.development' }, 'Development enrollment granted');
      return enrollment;
    },
  };
}
