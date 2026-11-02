# API contracts

Use `/api/v1` and consistent JSON envelopes. Validate every request with Zod.

## Suggested endpoints
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- `GET/POST /orders`, `GET/PATCH /orders/:id`
- `GET/POST /orders/:id/milestones`
- `GET /supervisor/work`
- `POST /production-updates`
- `GET /risk/alerts`, `POST /risk/alerts/:id/confirm`, `POST /risk/alerts/:id/dismiss`
- `GET /buyer/orders`, `GET /buyer/orders/:id`
- `GET /reports/weekly`
- `GET /health`

## API rules
Authenticate first, authorize the requested object and action server-side, validate input, then execute. Never trust a buyerId supplied by a buyer client; derive it from the authenticated identity. Use pagination and stable sorting for list endpoints. Return safe error messages and correlation IDs.
