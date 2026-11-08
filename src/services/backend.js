import { client, clearCsrf } from '../api/client';

const get = async (path, params) => (await client.get(path, { params })).data.data;
const write = async (method, path, data = {}, headers) => (await client.request({ method, url: path, data, headers })).data.data;
async function list(path) {
  const first = await get(path, { page: 1, limit: 100 });
  if (Array.isArray(first)) return first;
  const items = [...first.items];
  for (let page = 2; page <= first.pagination.pages; page++) items.push(...(await get(path, { page, limit: 100 })).items);
  return items;
}
const user = (value) => value && ({ ...value, name: value.fullName, role: value.role === 'ADMIN' ? 'admin' : 'student', joined: value.createdAt?.slice(0, 10) });
const duration = (seconds = 0) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
const lesson = (value) => ({ ...value, duration: duration(value.durationSeconds), preview: value.isPreview });
const review = (value) => ({ ...value, name: value.user?.fullName || 'Learner', text: value.comment, date: new Date(value.createdAt).toLocaleDateString(), courseId: value.courseId });
function course(value) {
  const sections = (value.sections || []).map((section) => ({ ...section, lessons: section.lessons.map(lesson) }));
  const seconds = sections.flatMap((section) => section.lessons).reduce((sum, item) => sum + item.durationSeconds, 0);
  const ratings = value.reviews || [];
  return { ...value, category: value.category?.slug || value.categoryId, categoryId: value.category?.id || value.categoryId,
    instructorId: value.instructor?.id || value.instructorId,
    instructor: { name: value.instructor?.fullName || 'Instructor', bio: value.instructor?.bio || '', role: value.instructorRole || 'Instructor' },
    price: Number(value.discountPrice ?? value.price), originalPrice: Number(value.price), currency: 'UZS', thumbnail: value.thumbnailUrl || '',
    art: 'code', badge: '', level: value.level || 'All levels', language: 'English',
    students: value._count?.enrollments || 0, rating: ratings.length ? Number((ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length).toFixed(1)) : 0,
    sections, duration: `${Math.floor(seconds / 3600)}h ${Math.ceil(seconds % 3600 / 60)}m`, updatedAt: value.updatedAt?.slice(0, 10),
    outcomes: value.outcomes || [], requirements: value.requirements || [], reviews: ratings.filter((item) => item.comment).map(review),
  };
}
const completed = (value) => value.sections.flatMap((section) => section.lessons).filter((item) => item.progress?.completed).map((item) => item.id);
const order = (value, users = []) => ({ ...value, total: Number(value.total), user: users.find((entry) => entry.id === value.userId)?.name || value.userId, course: value.items.map((item) => item.courseTitleSnapshot).join(', '), date: value.createdAt.slice(0, 10), status: value.status.toLowerCase() });
async function courseInput(value) {
  const categories = await get('/categories');
  const payload = { title: value.title, slug: value.slug, description: value.description, categoryId: categories.find((item) => item.id === value.category || item.slug === value.category)?.id || value.categoryId,
    instructorId: value.instructorId, instructorRole: value.instructor.role, level: value.level,
    outcomes: value.outcomes, requirements: value.requirements,
    price: Number(value.originalPrice).toFixed(2), discountPrice: Number(value.price) < Number(value.originalPrice) ? Number(value.price).toFixed(2) : null,
    thumbnailUrl: value.thumbnail || null,
    sections: value.sections.map((section) => ({ id: section.id, title: section.title, lessons: section.lessons.map((item) => ({ id: item.id, title: item.title, description: item.description || null, videoUrl: item.videoUrl || null, isPreview: !!item.preview, durationSeconds: item.duration.split(':').reduce((sum, part) => sum * 60 + Number(part), 0) })) })),
  };
  if (typeof value.published === 'boolean') payload.published = value.published;
  return payload;
}
export const backendApi = {
  auth: {
    me: async () => user(await get('/auth/me')),
    login: async (data) => user((await write('post', '/auth/login', { email: data.email, password: data.password })).user),
    register: async (data) => user((await write('post', '/auth/register', { fullName: data.name, email: data.email, password: data.password })).user),
    logout: async () => { await write('post', '/auth/logout'); clearCsrf(); },
  },
  courses: {
    list: async () => (await list('/courses')).map(course),
    get: async (slug) => { const result = await get(`/courses/${encodeURIComponent(slug)}`); result.reviews = await list(`/courses/${result.id}/reviews`); return course(result); },
  },
  categories: async () => {
    const [categories, courses] = await Promise.all([get('/categories'), list('/courses')]);
    return categories.map((item) => ({ ...item, databaseId: item.id, id: item.slug, count: courses.filter((entry) => entry.category.id === item.id).length }));
  },
  cart: {
    get: async () => {
      const value = await get('/cart');
      const result = value.items.map((item) => course({ ...item, id: item.courseId }));
      // Keep server-calculated totals alongside the array consumed by existing cards.
      return { items: result, subtotal: Number(value.subtotal), discount: Number(value.discountTotal), total: Number(value.total), currency: value.currency };
    },
    add: (courseId) => write('post', '/cart/items', { courseId }),
    remove: (courseId) => write('delete', `/cart/items/${courseId}`),
  },
  profile: {
    get: async () => user(await get('/users/me')),
    update: async (data) => user(await write('patch', '/users/me', { fullName: data.name, bio: data.bio })),
    password: async (data) => { const result = await write('patch', '/users/me/password', data); clearCsrf(); return result; },
    avatar: async (file) => { const form = new FormData(); form.append('avatar', file); return user(await write('post', '/users/me/avatar', form)); },
  },
  learning: {
    enrollments: async () => Promise.all((await list('/enrollments/me')).map(async (entry) => {
      const detail = await get(`/learning/courses/${entry.courseId}`);
      return { ...entry, completedLessons: completed(detail), course: course(detail), certificate: detail.certificate || null };
    })),
    course: async (id) => { const result = await get(`/learning/courses/${id}`); return { ...course(result), enrollment: { courseId: id, completedLessons: completed(result) } }; },
    lesson: async (id, lessonId) => { const result = await get(`/learning/courses/${id}/lessons/${lessonId}`); return { ...lesson(result), videoUrl: result.playback?.url, playbackExpiresAt: result.playback?.expiresAt, resources: [] }; },
    progress: (id, completed) => write('patch', `/learning/lessons/${id}/progress`, { completed }),
    certificate: (id) => write('post', `/learning/courses/${id}/certificate`),
  },
  orders: {
    create: (idempotencyKey) => write('post', '/orders', {}, { 'Idempotency-Key': idempotencyKey }),
    mine: async () => (await list('/orders/me')).map((value) => order(value)),
    get: (id) => get(`/orders/${id}`),
    cancel: (id) => write('post', `/orders/${id}/cancel`),
    checkout: (id) => write('post', `/orders/${id}/checkout`),
  },
  admin: {
    courses: async () => (await list('/admin/courses')).map(course),
    course: async (id) => course(await get(`/admin/courses/${id}`)),
    createCourse: async (data) => write('post', '/admin/courses', await courseInput(data)),
    updateCourse: async (id, data) => write('patch', `/admin/courses/${id}`, Object.keys(data).length === 1 && 'published' in data ? data : await courseInput(data)),
    deleteCourse: (id) => write('delete', `/admin/courses/${id}`),
    users: async () => (await list('/admin/users')).map(user),
    user: async (id) => user(await get(`/admin/users/${id}`)),
    role: (id, role) => write('patch', `/admin/users/${id}/role`, { role: role === 'admin' ? 'ADMIN' : 'USER' }),
    orders: async () => { const [orders, users] = await Promise.all([list('/admin/orders'), list('/admin/users')]); return orders.map((entry) => order(entry, users.map(user))); },
    stats: async () => {
      const [value, orders] = await Promise.all([get('/admin/stats'), list('/admin/orders')]);
      const chart = Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - 5 + index); return { month: date.toLocaleDateString('en', { month: 'short' }), year: date.getFullYear(), monthIndex: date.getMonth(), revenue: 0, students: 0 }; });
      for (const item of orders.filter((entry) => entry.status === 'PAID')) { const date = new Date(item.createdAt); const bucket = chart.find((entry) => entry.year === date.getFullYear() && entry.monthIndex === date.getMonth()); if (bucket) bucket.revenue += Number(item.total); }
      return { users: value.totalUsers, courses: value.totalCourses, orders: value.totalOrders, revenue: Number(value.confirmedRevenue), chart };
    },
    categories: () => get('/admin/categories'),
    createCategory: (data) => write('post', '/admin/categories', data),
    updateCategory: (id, data) => write('patch', `/admin/categories/${id}`, data),
    deleteCategory: (id) => write('delete', `/admin/categories/${id}`),
    reviews: async () => (await list('/admin/reviews')).map(review),
    moderateReview: (id, hidden) => write('patch', `/admin/reviews/${id}`, { hidden }),
    deleteReview: (id) => write('delete', `/admin/reviews/${id}`),
  },
};
