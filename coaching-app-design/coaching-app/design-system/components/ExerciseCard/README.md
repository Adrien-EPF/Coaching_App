# ExerciseCard

ExerciseCard shows one Exercise of the Session Plan: its position, Training Goal, the recommended load in big numbers, and its Set rows.

## When to use
The session screen is a stack of these, in session order. Put the RecommendationNote in `note` only when the weight changed since last time.

## The consumer provides
`name`, `goal`, `position` (e.g. "2/5"), `plan` ({weight, reps}), `sets`, `range`, `equipment`, optional `status`, `addedLoad`, `note`, and SetRow `children`.

## Rules
Name in `title-lg` uppercase; the load is the card's hero (Barlow Condensed 800, 48px). Keep detail to one caption line.
