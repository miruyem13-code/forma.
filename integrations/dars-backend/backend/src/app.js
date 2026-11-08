import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { createRepositories } from './repositories/index.js';
import { createServices } from './services/index.js';
import { createProviders } from './services/providers.js';
import { createLogger } from './config/logger.js';
import { security, limiter } from './middleware/security.js';
import { errorHandler } from './middleware/errors.js';
import { createRoutes } from './routes/index.js';
import { AppError } from './utils/errors.js';
import { handler } from './controllers/index.js';

export async function createApp({ db, config, logger = createLogger(config.LOG_LEVEL), providers, rateLimits = {} }) {
  const app = express();
  const repos = createRepositories(db);
  providers ??= await createProviders(config, repos);
  const services = createServices(repos, config, providers, logger);
  const guards = security(config, repos);
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.set('query parser', 'simple');
  app.use(pinoHttp({ logger, genReqId: () => randomUUID(), serializers: {
    req: req => ({ id: req.id, method: req.method, path: req.url?.split('?')[0] }),
    res: res => ({ statusCode: res.statusCode }),
    err: () => ({ message: 'Request failed' }),
  } }));
  app.use(helmet());
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (config.NODE_ENV === 'production' && !req.secure) return next(new AppError(426, 'HTTPS_REQUIRED', 'HTTPS is required'));
    next();
  });
  app.use(cors({ origin: (origin, done) => {
    if (!origin || config.origins.includes(origin)) return done(null, true);
    done(new AppError(403, 'ORIGIN_FORBIDDEN', 'Origin is not allowed'));
  }, credentials: true, methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'], maxAge: 600 }));
  app.use('/api/v1', limiter(repos, 'api', rateLimits.apiLimit ?? 300, 60000));
  // Provider webhooks authenticate the exact bytes using the configured adapter; they never use browser cookies.
  app.post('/api/v1/payments/webhook/:provider', express.raw({ type: '*/*', limit: '256kb' }), handler(req => services.commerce.webhook(req.params.provider, req.body, req.headers)));
  app.use(express.json({ limit: '64kb', strict: true }));
  app.use(cookieParser());
  app.use(guards.authenticate);
  app.use(guards.csrf);
  app.use('/api/v1', createRoutes(services, guards, repos, rateLimits));
  app.use((req, res, next) => next(new AppError(404, 'NOT_FOUND', 'Endpoint not found')));
  app.use(errorHandler);
  return app;
}
