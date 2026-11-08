import { access, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { localPostgres } from './local-postgres.js';
const require = createRequire(import.meta.url);

function run(file, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], { stdio: 'inherit', env, windowsHide: true });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error('Setup command failed')));
  });
}
let pg;
let started = false;
try {
  let exists = false;
  try { await access('.env'); exists = true; } catch {}
  if (exists) throw new Error('backend/.env already exists; use its database configuration or run npm run db:local for an already initialized local database.');
  const local = await localPostgres();
  pg = local.pg;
  await pg.start();
  started = true;
  const client = pg.getPgClient();
  await client.connect();
  try {
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', ['dars']);
    if (!result.rowCount) await pg.createDatabase('dars');
  } finally { await client.end(); }
  const secret = randomBytes(48).toString('hex');
  const env = { ...process.env, NODE_ENV: 'development', DATABASE_URL: local.url, SESSION_SECRET: secret };
  await run(require.resolve('prisma/build/index.js'), ['generate'], env);
  await run(require.resolve('prisma/build/index.js'), ['migrate', 'deploy'], env);
  await run('prisma/seed.js', [], env);
  await writeFile('.env', `NODE_ENV=development\nPORT=5000\nDATABASE_URL=${local.url}\nFRONTEND_URL=http://localhost:5173\nSESSION_SECRET=${secret}\nCOOKIE_SECURE=false\nCOOKIE_SAME_SITE=lax\nDEV_ENROLLMENT_ENABLED=false\nSTORAGE_PROVIDER=database\nVIDEO_PROVIDER=disabled\n`, { flag: 'wx', mode: 0o600 });
  console.log('Local PostgreSQL initialized, migrations applied, catalog seeded, and backend/.env created with random secrets.');
  console.log('Next: run npm run db:local in one terminal, npm start in another, then npm run admin:create.');
} catch (error) {
  console.error(error?.message?.startsWith('backend/.env') ? error.message : 'Local setup failed. Check PostgreSQL binary support, port 54329 availability, and dependency installation.');
  process.exitCode = 1;
} finally { if (started) await pg.stop(); }
