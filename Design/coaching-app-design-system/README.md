A personal Android app (Expo / React Native) that plans your next gym session. You log weight, reps and RPE; Gemini, held by your Rules and Guardrails, proposes the next weight and says why. The look is **bold and athletic**: a scoreboard of big condensed numbers on calm grounds, with one electric-lime accent that means *go*.

## Content fundamentals

- **Write the UI in French.** Use the app's vocabulary consistently: *Séance*, *Série*, *charge*, *reps*, *RPE*, *Programme*, *Cycle*, *Objectif*, *PR*, *1RM estimé*, *Non effectuée*, *Séance manquée*, *Séance hors programme*. Never *Workout* or *Entraînement* for a Séance, never *routine*.
- **Training Goals** read *Force*, *Hypertrophie*, *Endurance*. Hypertrophy is about lifting more, never about looks: no body or aesthetic language anywhere.
- **Speak as a coach, plainly, to *tu*.** Short declarative lines with the reason first: « Toutes les séries à 5 reps : on monte de 2,5 kg. » « RPE 9,5 sur la dernière série : on garde la charge. » No exclamation marks, no hype, no emoji.
- **Numbers the French way:** decimal comma (`102,5 kg`), a thin space before the unit is optional, `×` between weight and reps (`100 kg × 5`), `RPE 8,5`. Weighted bodyweight exercises always show the added load with a sign: `+10 kg`.
- **Explanations only when something changes.** A "why" line appears only when the weight differs from last time; one line summarises the whole session.
- **Uppercase is for the display face only** (`display-*`, `title-lg`, `label-caps`). Body text stays sentence case.

## Visual foundations

**Color.** The app is light first (`surface`, `surface-raised`) with a full dark theme (*Sombre*) for evenings in the gym.
- `lime` is a fill, never text on light: the primary action, today's session, an increase. Text on it is `on-lime`. When lime must read as text or a stroke, use `lime-ink`.
- `contrast` / `on-contrast` make the inverted slabs: the session header, a selected chip or RPE step. Use them to say "selected", not lime.
- Each Training Goal has a fill (`strength`, `hypertrophy`, `endurance`), an `on-…` text color and an `…-ink` for text. **Always pair the color with the goal's label**: in dark, strength and hypertrophy are close in lightness.
- States: `danger` (failure, missed, decrease), `warning` (a Guardrail clamped the value, a Problem Report is attached), and lime for success. Each state also carries a word or a glyph (✓, ×, ↑, ↓), never color alone.
- Text: `ink` for primary, `ink-muted` for last-session values and meta, `ink-subtle` only for pre-filled planned values and placeholders.

**Type.** Two faces, one family: **Barlow Condensed** (`--font-display`) for everything you read at arm's length (numbers, titles, labels) and **Barlow** (`--font-sans`) for sentences.
- One hero number per screen in `display-xl` (the next weight, a PR).
- Exercise names in `title-lg`, uppercase; weight × reps in `title-md`.
- Labels, badges and buttons in `label-caps`.
- Gemini's explanations in `body-lg`; everything else in `body` / `caption`.
- Numbers use tabular figures (`font-variant-numeric: tabular-nums`) so columns of weights line up.

**Spacing and layout.** A 4px base: `space-4` is the screen gutter and card padding, `space-5` between cards, `space-6` between sections. Everything tappable is at least `tap-min` (48px); input cells in a Set row and the primary action are `control-lg` (56px). One column on the phone; the primary action sits at the bottom, within thumb reach.

**Shape.** Medium corners: `radius-sm` for badges, chips and cells, `radius-md` for buttons and Set rows, `radius-lg` for cards and sheets.

**Borders, not shadows.** Cards are `surface-raised` with a 1px `line` border. Inputs and secondary buttons take a `line-strong` border. `shadow-sheet` only for bottom sheets and the sticky validate bar.

**States.** Pressed darkens a fill by an overlay of `ink` at 12%; disabled drops to 40% opacity and is never the only signal. The focus ring is 2px solid `focus` at 2px offset, on every interactive element.

**Motion.** Quick and functional: 120–180ms ease-out for presses and sheet entry. No celebratory animation; a new PR is marked by `lime-soft` and the word *PR*.

## Iconography

No icon set yet. Use a simple 2px-stroke outline set (Lucide fits Barlow's weight) at 20 or 24px, colored with an `…-ink` or `ink` token. The status glyphs in the components (✓ validated, × missed / not completed, ↑ ↓ = weight deltas) are drawn inline. No emoji.

## Logo

The mark is two rising chevrons over a dumbbell: progression of load. Files are in the **Logos** group.
- `coaching-app-mark.svg` (ink `#111410`) on light grounds; `coaching-app-mark-lime.svg` (lime `#c6f432`) on `surface` in dark or on a `contrast` slab. Never the lime mark on a light ground.
- `coaching-app-lockup.svg` (mark + **COACHING APP** in Barlow Condensed 800, ink) for headers and the about screen; `coaching-app-lockup-inverse.svg` (lime mark, `#f4f5f0` text) on dark.
- `coaching-app-icon.svg` is the Android launcher icon: ink mark on a lime square. Export its foreground at 108dp with the mark inside the 66dp safe zone.
- Keep clear space of half the mark's height around it; minimum size 24px for the mark, 120px wide for the lockup. Don't recolor it with goal colors, outline it, or add effects.

## Components

- **Button**: primary (lime), secondary, ghost, danger; `lg` for the screen's main action.
- **GoalBadge**: the Training Goal of an exercise.
- **SessionStatus**: Prévue, Aujourd'hui, Validée, Manquée, Hors programme, Non effectuée.
- **SetRow**: log one Set; planned values pre-filled, last session beside them.
- **RpePicker**: the 6–10 scale with its meaning shown, per RULES.md.
- **ExerciseCard**: one exercise of the Session Plan with its Set rows.
- **RecommendationNote**: Gemini's "why this weight", with the delta and a Guardrail flag.
- **PrStat**: a PR or Estimated 1RM, optionally with progress toward an Objective.
