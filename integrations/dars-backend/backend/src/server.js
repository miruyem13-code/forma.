import { readConfig } from './config/env.js';
import { createDatabase } from './config/database.js';
import { createLogger } from './config/logger.js';
import { createApp } from './app.js';

let db;
let logger;
try {
  const config = readConfig();
  logger = createLogger(config.LOG_LEVEL);
  db = createDatabase(config.DATABASE_URL);
  await db.$connect();
  const app = await createApp({ db, config, logger });
  const server = app.listen(config.PORT, () => logger.info({ port: config.PORT, environment: config.NODE_ENV }, 'API listening'));
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  let closing = false;
  async function shutdown(signal) {
    if (closing) return;
    closing = true;
    logger.info({ signal }, 'Shutting down');
    const timer = setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 10000);
    timer.unref();
    server.close(async () => { await db.$disconnect(); clearTimeout(timer); process.exit(0); });
    server.closeIdleConnections();
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  server.on('error', async error => { logger.error({ code: error.code }, 'Server failed'); await db.$disconnect(); process.exit(1); });
} catch (error) {
  // Configuration errors intentionally name variables only; DB exception strings can expose credentials.
  if (!db) console.error(error.message);
  else { logger?.error({ errorType: error.name, code: error.code }, 'Startup failed; verify database connectivity and adapter configuration'); await db.$disconnect(); }
  process.exitCode = 1;
}
