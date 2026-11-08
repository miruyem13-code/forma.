import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
const require = createRequire(import.meta.url);

function run(file, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], { env, stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Command failed with exit code ${code}`)));
  });
}
async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
let pg;
let started = false;
try {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    const port = await freePort();
    const password = randomBytes(24).toString('hex');
    pg = new EmbeddedPostgres({
      databaseDir: path.resolve('.test-postgres', randomUUID()), user: 'test_runner', password, port,
      authMethod: 'scram-sha-256', persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'],
      postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {},
    });
    await pg.initialise();
    await pg.start();
    started = true;
    await pg.createDatabase('marketplace_test');
    url = `postgresql://test_runner:${password}@127.0.0.1:${port}/marketplace_test?schema=public&connection_limit=10`;
    console.log('Started isolated PostgreSQL test server (real disk-backed database).');
  }
  const parsed = new URL(url);
  if (!/(?:^|_)test(?:_|$)/i.test(parsed.pathname.slice(1))) throw new Error('Test database name must contain a separate test segment');
  if (process.env.DATABASE_URL) {
    const production = new URL(process.env.DATABASE_URL);
    if (production.host === parsed.host && production.pathname === parsed.pathname) throw new Error('Test database must differ from DATABASE_URL');
  }
  const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: url, TEST_DATABASE_URL: url, SESSION_SECRET: randomBytes(48).toString('hex'), LOG_LEVEL: 'silent' };
  await run(require.resolve('prisma/build/index.js'), ['generate'], env);
  await run(require.resolve('prisma/build/index.js'), ['migrate', 'deploy'], env);
  await run(path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), ['run', 'tests/integration.test.js', '--maxWorkers=1', '--no-file-parallelism'], env);
} catch (error) {
  // Avoid printing library errors that could embed database URLs or credentials.
  const message = error?.message ?? '';
  console.error(message.startsWith('Command failed') || message.startsWith('Test database') ? message : 'Integration test setup failed. Verify PostgreSQL binaries or provide a separate TEST_DATABASE_URL.');
  console.error({ errorType: error?.name, errorCode: error?.code });
  process.exitCode = 1;
} finally { if (started) await pg.stop(); }
