# Assumptions, risks, and next steps

## Assumptions to validate
- Factory working calendar, holidays, and shift patterns.
- Whether stage target quantities equal order quantity or vary by stage.
- Definition of accepted good output and treatment of rework/rejections.
- PO uniqueness policy and buyer account model.
- Who approves photos and who confirms buyer-visible warnings.
- Whether Tamil voice transcription is required for MVP or text notes suffice.
- Retention rules for photos, notes, and audit events.

## Risks
Poor or delayed supervisor reporting can distort projections. Subcontractor data may arrive late. AI may misclassify Tamil notes. Patchy connectivity may create duplicate/conflicting submissions if idempotency is omitted. Buyer isolation failures are high severity.

## Next steps
Confirm assumptions with the client, implement the critical end-to-end path, test permissions and offline retry, then run a realistic demo with seeded data.
