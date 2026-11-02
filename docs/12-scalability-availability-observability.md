# Scalability, availability, and observability

## Scale path
Start with a stateless Express API and modular monolith. Add API instances behind a load balancer when measured load requires it. Use PostgreSQL connection pooling, indexes, pagination, and query review. Move AI and report generation to background workers. Store photos in object storage, not database blobs. Add Redis only for a demonstrated need.

## Reliability
Health/readiness endpoints, graceful shutdown, bounded timeouts, retry policies for transient external failures, AI circuit breaker, database backups, and tested restore procedures.

## Monitor
P50/P95/P99 latency, request/error rate, DB pool saturation, slow queries, offline sync success/failure, queue depth, AI latency/cost, and photo upload failures.

Do not promise an SLA or capacity number without load tests and an operational plan.
