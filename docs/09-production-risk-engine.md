# Production risk engine

## Inputs
For each order milestone: target quantity, accepted good completed quantity, remaining working days, and recent valid daily output.

`remaining = max(0, targetQuantity - completedQuantity)`

`requiredPerDay = remaining / workingDaysRemaining`

`actualAveragePerDay = sum(goodQuantity in lookback) / count(valid reported working days)`

A reasonable initial assumption is a five-valid-working-day lookback with at least three valid reports. Tune this with the client; it is not a fixed client requirement.

## Projection
`projectedWorkingDays = ceil(remaining / actualAveragePerDay)`

Project completion using the factory working calendar, holidays, and non-working days.

## Suggested states
- COMPLETED: remaining is zero.
- INSUFFICIENT_DATA: not enough valid reports.
- NO_OUTPUT: valid reports exist but average output is zero.
- RED: projected completion is after the planned milestone date.
- AMBER: projected on time but with less than two working days of buffer.
- GREEN: projected completion has at least two working days of buffer.

Keep thresholds configurable. Missing reports are not automatically zero production. Store formula version, inputs, data window, valid-report count, output, and timestamp for explainability.
