# SessionStatus

SessionStatus labels where a Session, Exercise or Set stands: Prévue, Aujourd'hui, Validée, Manquée, Hors programme, Non effectuée.

## When to use
Calendar cells, session lists, the Exercise card header. `today` is the only lime one; `missed` the only solid danger. Each status has a glyph so it reads without color.

## The consumer provides
`status`; optional `children` to override the label.
