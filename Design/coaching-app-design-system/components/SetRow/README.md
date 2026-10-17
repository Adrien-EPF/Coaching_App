# SetRow

SetRow logs one Set: weight, reps and RPE, with the planned values pre-filled and last session's numbers shown beneath.

## When to use
Inside an ExerciseCard, one row per prescribed Set. Tapping a row opens the inputs and the RpePicker (the app's own sheet). A skipped Set is `status="not-completed"`; it counts as not successful.

## The consumer provides
`index`, `planned` (from the Session Plan), `logged` (what the user entered), `last` (same Set last session), `status`, `active`, `addedLoad` for weighted bodyweight exercises (shows `+10 kg`), `onSelect`.

## Rules
- Planned values show in `ink-muted` on a `surface-sunken` cell until logged; logged values in `ink` on `surface-raised`.
- Always show *Dernière fois* when history exists: it is the reference the user lifts against.
- Never show bodyweight in the load: only the added load.
