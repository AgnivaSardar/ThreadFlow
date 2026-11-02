# Testing and quality plan

- Unit tests: risk calculations, date/calendar logic, validation, permission policies.
- Integration tests: Express routes with test PostgreSQL, transactions, idempotency.
- Authorization tests: buyer A cannot read buyer B; supervisor cannot update unassigned stage.
- Offline tests: duplicate retry, reconnect, expired session, failed upload.
- AI tests: valid structured response, malformed response, timeout, Tamil note, NEEDS_REVIEW fallback.
- End-to-end tests: order setup → supervisor update → risk alert → merchandiser confirmation → buyer view.
- UI tests: small-screen layout, Tamil text, keyboard accessibility.
- Security checks: upload validation, rate limiting, safe error responses.

Use synthetic seed data and deterministic fixtures.
