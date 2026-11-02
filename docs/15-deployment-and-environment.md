# Deployment and environment

Use separate development, staging, and production environments. Keep secrets in the hosting provider's secret manager, not source control.

Suggested environment variables:
- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `AI_PROVIDER`
- `AI_MODEL`
- `AI_API_KEY`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `APP_ORIGIN`

Use migrations as a controlled deployment step. Add health checks, logs, backups, and a rollback procedure. Restrict database and object-storage access to the application environment.
