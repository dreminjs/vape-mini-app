# Money as integer kopecks

Status: accepted (2026-10-10)

## Context

Floating point cannot represent money exactly (0.1 + 0.2).

## Decision

All amounts are `Int` minor units (`*Minor` fields). Percent discounts round half up in kopecks. Formatting uses `Intl.NumberFormat('ru-BY', { currency: 'BYN' })`.

## Consequences

No rounding drift. The admin form converts typed BYN strings to kopecks.
