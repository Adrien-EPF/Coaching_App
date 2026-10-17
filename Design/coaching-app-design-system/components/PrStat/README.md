# PrStat

PrStat shows a Personal Record or Estimated 1RM in hero numbers, optionally with progress toward an Objective.

## When to use
Dashboard tiles, the end-of-session summary (`isNew` for a PR just set). For weighted bodyweight exercises pass `addedLoad`: the number is the added load, never bodyweight. Estimated 1RM is Epley on the lifted weight only.

## The consumer provides
`label` (*PR 5 reps*, *1RM estimé*), `value`, `unit`, `detail`, `isNew`, `objective` ({target, reps, by, from}).

## Rules
A new PR is marked by `lime-soft` and the words *Nouveau PR*: no confetti, no animation.
