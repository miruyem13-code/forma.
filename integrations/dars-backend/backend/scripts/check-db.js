import { readConfig } from '../src/config/env.js';
import { createDatabase } from '../src/config/database.js';
const db = createDatabase(readConfig().DATABASE_URL);
try {
  await db.$queryRaw`SELECT 1`;
  await db.user.count();
  console.log('PostgreSQL connection and migrated User table verified.');
} catch { console.error('Database check failed. Check DATABASE_URL and run migrations.'); process.exitCode = 1; }
finally { await db.$disconnect(); }
