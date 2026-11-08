import { z } from 'zod';

export const uuid = z.string().uuid();
const text = max => z.string().trim().min(1).max(max);
const slug = z.string().min(1).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const email = z.string().trim().toLowerCase().email().max(254);
export const password = z.string().min(12).max(128).refine(v => /[a-z]/.test(v) && /[A-Z]/.test(v) && /[0-9]/.test(v), 'Use at least one uppercase letter, lowercase letter, and number');
export const moneyInput = z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/, 'Use a nonnegative decimal string with up to two fractional digits');
const httpsUrl = z.string().url().max(2048).refine(v => { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; }, 'Use an HTTPS URL without credentials');
const privateAsset = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/, 'Use a private provider asset identifier, not a URL');
const strict = shape => z.object(shape).strict();
const nonempty = shape => strict(shape).refine(v => Object.keys(v).length > 0, 'Provide at least one field');

export const register = strict({ fullName: text(120), email, password });
export const login = strict({ email, password: z.string().min(1).max(128) });
export const profile = nonempty({ fullName: text(120).optional(), bio: z.string().trim().max(2000).nullable().optional() });
export const changePassword = strict({ currentPassword: z.string().min(1).max(128), newPassword: password });
export const page = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const courseQuery = page.extend({
  search: z.string().trim().max(100).optional(), category: z.string().max(160).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular']).default('newest'),
  minPrice: moneyInput.optional(), maxPrice: moneyInput.optional(),
  discounted: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
}).strict();
export const courseFields = {
  level: z.enum(['Beginner', 'Intermediate', 'All levels']).optional(),
  outcomes: z.array(text(500)).max(50).optional(), requirements: z.array(text(500)).max(50).optional(),
  instructorRole: text(200).optional(),
  sections: z.array(strict({ id: uuid, title: text(200), lessons: z.array(strict({ id: uuid, title: text(200), description: z.string().max(10000).nullable(), videoUrl: privateAsset.nullable(), durationSeconds: z.number().int().min(0).max(86400), isPreview: z.boolean() })).max(1000) })).max(100).optional(),
  title: text(200), slug, description: text(50000), thumbnailUrl: httpsUrl.nullable().optional(),
  instructorId: uuid, categoryId: uuid, price: moneyInput, discountPrice: moneyInput.nullable().optional(), published: z.boolean().optional(),
};
export const createCourse = strict(courseFields);
export const updateCourse = strict(courseFields).partial().refine(v => Object.keys(v).length > 0, 'Provide at least one field');
export const category = strict({ name: text(120), slug: slug.max(160), description: z.string().trim().max(2000).nullable().optional() });
export const updateCategory = category.partial().refine(v => Object.keys(v).length > 0, 'Provide at least one field');
export const section = strict({ title: text(200) });
export const lesson = strict({ title: text(200), description: z.string().trim().max(10000).nullable().optional(), videoUrl: privateAsset.nullable().optional(), durationSeconds: z.number().int().min(0).max(86400).default(0), isPreview: z.boolean().default(false) });
export const updateLesson = lesson.extend({ durationSeconds: z.number().int().min(0).max(86400), isPreview: z.boolean() }).partial().refine(v => Object.keys(v).length > 0, 'Provide at least one field');
export const reorder = strict({ ids: z.array(uuid).max(1000).refine(v => new Set(v).size === v.length, 'IDs must be unique') });
export const progress = nonempty({ completed: z.boolean().optional(), lastPositionSeconds: z.number().int().min(0).max(86400).optional() });
export const review = strict({ rating: z.number().int().min(1).max(5), comment: text(3000) });
export const moderation = strict({ hidden: z.boolean() });
export const role = strict({ role: z.enum(['USER', 'ADMIN']) });
export const cartItem = strict({ courseId: uuid });
export const devEnrollment = strict({ userId: uuid, courseId: uuid });
export const empty = strict({});
export const idempotency = z.string().min(16).max(100).regex(/^[A-Za-z0-9_-]+$/);
export const paymentEvent = strict({ provider: z.enum(['click', 'payme', 'custom']), providerPaymentId: text(200), orderId: uuid, amount: moneyInput, currency: z.literal('UZS'), status: z.literal('SUCCEEDED') });

export function pagination(query) {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}
export function paginated(items, total, query) {
  return { items, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } };
}
