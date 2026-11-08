import { readConfig } from '../src/config/env.js';
import { createDatabase } from '../src/config/database.js';
import { createRepositories } from '../src/repositories/index.js';
const db = createDatabase(readConfig().DATABASE_URL);
try {
  const r = createRepositories(db);
  console.log({ sessions: (await r.session.prune()).count, rateLimitWindows: (await r.rate.prune()).count });
} finally { await db.$disconnect(); }
