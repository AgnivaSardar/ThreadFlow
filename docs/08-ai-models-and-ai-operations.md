# AI models and operations

## Narrow AI scope
Classify Tamil or English issue notes into a controlled category and optionally produce a concise English summary. AI must not change production quantities, dates, milestone status, risk status, or send buyer messages.

## Categories
MACHINE_BREAKDOWN, MATERIAL_SHORTAGE, LABOUR_SHORTAGE, QUALITY_ISSUE, POWER_OUTAGE, SUBCONTRACTOR_DELAY, TRANSPORT_DELAY, OTHER, NEEDS_REVIEW.

## Safe workflow
1. Persist the original note first.
2. Queue classification asynchronously.
3. Call a configurable model provider adapter.
4. Require structured output and validate it.
5. On timeout, invalid output, or low confidence, use NEEDS_REVIEW.
6. Show original note and AI suggestion side by side.
7. Allow a merchandiser to correct the category; audit the correction.

Treat model confidence as an uncalibrated signal, not a probability. AI failure must not block a valid production update. Verify current model availability, pricing, and data terms before selecting a provider/model.
