import { localPostgres } from './local-postgres.js';
let pg;
let started = false;
try {
  const local = await localPostgres();
  pg = local.pg;
  await pg.start();
  started = true;
  console.log(`Local PostgreSQL is listening on 127.0.0.1:${local.port}. Keep this terminal open; press Ctrl+C to stop.`);
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; await pg.stop(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} catch { console.error('Could not start local PostgreSQL. Ensure port 54329 is free and run npm run local:setup first.'); if (started) await pg.stop(); process.exitCode = 1; }
