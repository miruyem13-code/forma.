# Dars course marketplace backend

The Node.js/Express API is in [`backend/`](backend/README.md). It uses JavaScript ES modules, PostgreSQL, Prisma, opaque cookie sessions, and a separate React frontend contract.

Requires Node.js 24 LTS (or a supported Node.js 22 release). From this directory:

```sh
npm ci
npm run local:setup
```

`local:setup` initializes a real, persistent local PostgreSQL instance, applies migrations, seeds the development catalog, and creates an ignored `backend/.env` with randomly generated secrets. It does not create an admin or simulate purchases. It refuses to overwrite an existing `.env`.

Then keep PostgreSQL running in one terminal:

```sh
npm run db:local
```

In another terminal:

```sh
npm start
```

Create the first admin interactively in a third terminal:

```sh
npm run admin:create
```

Health: `http://localhost:5000/api/v1/health`. React: `VITE_API_URL=http://localhost:5000/api/v1`.

```sh
npm run check
npm test
npm run test:integration
```

The integration command starts a separate, temporary PostgreSQL server when `TEST_DATABASE_URL` is unset. See [backend setup](backend/README.md), [API contract](backend/docs/api.md), and [provider contracts](backend/docs/providers.md) for configuration, endpoints, and integration boundaries.
