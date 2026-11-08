import { Prisma } from '@prisma/client';

export const decimal = value => new Prisma.Decimal(value);
export const money = value => decimal(value).toFixed(2);
export function totals(courses) {
  const subtotal = courses.reduce((sum, c) => sum.plus(c.price), decimal(0));
  const total = courses.reduce((sum, c) => sum.plus(c.discountPrice ?? c.price), decimal(0));
  return { subtotal: money(subtotal), discountTotal: money(subtotal.minus(total)), total: money(total), currency: 'UZS' };
}
// Prisma Decimal serializes without trailing zeros; normalize the whole API consistently.
export function serialize(value) {
  if (value instanceof Prisma.Decimal) return value.toFixed(2);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  return value;
}
