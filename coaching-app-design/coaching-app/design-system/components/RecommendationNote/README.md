# RecommendationNote

RecommendationNote explains a Recommendation: the change from last time, the reason in one plain line, and whether a Guardrail clamped it.

## When to use
- `variant="exercise"` (default): inside an ExerciseCard, **only when the load changes** (delta ≠ 0), titled *Pourquoi cette charge*.
- `variant="session"`: the single line for the whole Session at the top of the session screen, on a `contrast` slab.
- `clamped`: Gemini proposed more than the Guardrails allow; the shown value is the clamped one.
- `source="rules"`: Gemini was unreachable and the rules-only plan was used.

## The consumer provides
`delta` (kg, or `percent`), `children` (the explanation, French, reason first, no exclamation marks), `clamped`, `source`, `variant`.
