# Button

Button triggers an action; the lime primary is the one main action of a screen.

## When to use
- `primary` (lime): one per screen, the action that moves the session forward: *Valider la séance*, *Enregistrer la série*.
- `secondary`: alternatives beside it: *Modifier*, *Signaler un problème*.
- `ghost`: low-emphasis actions in headers and sheets: *Passer*, *Annuler*.
- `danger`: destructive or negative: *Marquer comme manquée*, *Supprimer*.
- `size="lg"` + `block` for the sticky bottom action.

## The consumer provides
`children` (label in French, sentence-case text; the component uppercases it), `onClick`, `disabled`.

## Don't
- Two lime buttons on one screen.
- Lime text links on a light surface: use `lime-ink`.
