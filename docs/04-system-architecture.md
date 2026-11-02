# System architecture

## Recommended architecture: modular monolith
A modular monolith is easier to build, test, and deploy within the short MVP timeline than microservices. Maintain clear module boundaries so individual modules can be extracted later if justified.

## Logical components
- React PWA client
- Stateless Express API
- PostgreSQL as source of truth
- Private object storage for photos
- Background worker for AI classification and report generation
- Optional Redis only if queueing/caching needs justify it

## Main modules
Auth, users, buyers, units, orders, TNA, production, risk, AI, buyer portal, audit, and reports.

## Main flow
Supervisor submits update → API validates assignment and idempotency key → transaction stores production update → risk recalculation is queued or performed → issue note classification runs asynchronously → merchandiser reviews risk → confirmed alert is exposed to the relevant buyer.

## Consistency
Use database transactions for production updates and related audit records. Do not calculate production completion by adding quantities across different stages.
