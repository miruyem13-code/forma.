import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export function createDatabase(url) {
  const parsed = new URL(url);
  const schema = parsed.searchParams.get('schema') || 'public';
  const max = Number(parsed.searchParams.get('connection_limit') || 10);
  if (!Number.isInteger(max) || max < 1 || max > 100) throw new Error('Invalid PostgreSQL connection_limit');
  parsed.searchParams.delete('schema');
  parsed.searchParams.delete('connection_limit');
  const adapter = new PrismaPg({ connectionString: parsed.toString(), max, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 }, { schema });
  return new PrismaClient({ adapter, log: [] });
}
