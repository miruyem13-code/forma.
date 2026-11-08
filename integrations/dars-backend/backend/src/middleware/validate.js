import { z } from 'zod';
import { uuid } from '../validators/index.js';

export function validateRequest(schemas = {}) {
  return (req, res, next) => {
    req.validated ??= {};
    for (const [part, schema] of Object.entries(schemas)) req.validated[part] = schema.parse(req[part] ?? {});
    next();
  };
}
export const ids = (...names) => validateRequest({ params: z.object(Object.fromEntries(names.map(name => [name, uuid]))).passthrough() });
