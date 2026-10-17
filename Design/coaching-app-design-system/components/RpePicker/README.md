# RpePicker

RpePicker enters a Set's RPE on the 6–10 scale and shows what the chosen step means, so the rating stays consistent.

## When to use
Each time a Set is logged. The steps and meanings follow RULES.md: ≤6, 7, 8, 8,5, 9, 9,5, 10. Pass the Training Goal's `max` (9 for Force and Hypertrophie; none for Endurance) to flag the steps that block a weight increase.

## The consumer provides
`value` + `onChange` (controlled) or `defaultValue`; optional `max`.

## Rules
The selected step uses `contrast`, not lime: lime would suggest "good". Steps above `max` get a `warning` underline and `warning-ink` numerals, never a hidden state.
