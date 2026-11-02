# Data model and consistency

## Core entities
User, Role, Buyer, Unit, Order, OrderLine, TnaMilestone, SupervisorAssignment, ProductionUpdate, ProductionPhoto, RiskAssessment, RiskAlert, IssueClassification, AuditEvent, RefreshToken.

## Important fields
Order: id, buyerId, poNumber, style, colour, unitId, totalQuantity, exFactoryDate, status, createdAt, updatedAt.
TnaMilestone: id, orderId, stage, plannedStart, plannedEnd, targetQuantity.
ProductionUpdate: id, orderId, milestoneId, supervisorId, goodQuantity, rejectedQuantity, clientEventAt, receivedAt, idempotencyKey.
RiskAssessment: milestoneId, remainingQuantity, requiredPerDay, actualAveragePerDay, projectedCompletion, status, formulaVersion, calculatedAt.

## Rules
- Unique PO constraint should be scoped according to the client's actual PO policy.
- Idempotency key must be unique for the submitting client/user scope.
- Store client event time and server receipt time separately.
- Keep stage quantities independent.
- Use decimal/date-safe database types and explicit timezone handling.
- Record important changes in an append-only audit log.
