# Technology stack and setup

## Selected stack
- Node.js LTS, Express.js, TypeScript
- React, TypeScript, Vite, Tailwind CSS
- PostgreSQL, Prisma ORM
- Zod validation, Pino logging, OpenAPI
- JWT access tokens and rotating refresh tokens
- IndexedDB, service worker, PWA
- S3-compatible private object storage
- Vitest, Supertest, Playwright
- Docker and Docker Compose

## Local prerequisites
Install Node.js LTS, Git, Docker Desktop, and an editor. Run PostgreSQL through Docker Compose or use a managed PostgreSQL instance.

## Backend setup outline
1. Initialize an npm package in `backend/`.
2. Install Express, TypeScript, Prisma, Zod, Pino, security middleware, and test dependencies.
3. Configure environment variables from `.env.example`.
4. Define the Prisma schema and run migrations.
5. Implement health endpoint, configuration validation, error handling, and module routes.

Do not commit secrets. Keep model identifiers configurable through environment variables.
