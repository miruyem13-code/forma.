import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';

export const randomToken = () => randomBytes(32).toString('base64url');
export const hashToken = value => createHash('sha256').update(value).digest('hex');
export const sign = (secret, value) => createHmac('sha256', secret).update(value).digest('base64url');
export function constantEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export const hashPassword = password => argon2.hash(password, {
  type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1,
});
export const verifyPassword = (hash, password) => argon2.verify(hash, password);
let dummyHash;
export const getDummyHash = () => (dummyHash ??= hashPassword(randomToken()));
