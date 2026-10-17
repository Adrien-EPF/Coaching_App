# Coaching App

A personal Android app to track gym progress. You log your sets; after each session, Gemini and your own rules plan the next session (weights, reps, sets) and explain why.

Status: design phase. No code yet. Vocabulary lives in [CONTEXT.md](./CONTEXT.md); decisions in [docs/adr](./docs/adr).

## How it works

1. **Program**: a training plan with a cycle of 1 week (default), 2 weeks or 1 month. Sessions are placed on calendar days, each made of exercises with a prescribed number of sets.
2. **Starting a Program**: enter your known weights by hand (Initial Weights), run a Gemini-planned Test Session, or let Gemini propose Starting Estimates from related movements (taking the exercise's position in the session into account).
3. **In the gym**: the session is already planned. For each set you log weight, reps and RPE, with planned values pre-filled and last session's numbers shown beside them. Skipped sets or exercises are marked "Not completed".
4. **Validation**: once every set is logged or marked not completed, you validate the session. This triggers one Gemini call that plans the next session.
5. **The plan**: Gemini receives the last 6 sessions per exercise, your Rules, your Objectives and any Problem Report, and returns structured JSON. Every value is clamped by the Guardrails. If Gemini is unreachable, a rules-only plan is used.
6. **Explanations**: a short "why this weight" appears only when the weight changes from last time, plus one line for the whole session.
7. **Calendar**: you can skip, move or add unplanned sessions, and mark rest days and injuries. Missed sessions do not shift the program. A Problem Report (e.g. bad sleep) on an upcoming session re-plans it.
8. **Dashboard**: PRs at each rep count, Estimated 1RM (Epley, on the lifted weight only, never bodyweight), Objectives (a target PR with a date), and adherence. Trend charts come right after v1.

## Decisions

- Platform: native Android app (Expo / React Native, TypeScript), built to an APK by a GitHub Action.
- Data: local only (SQLite on the device), with JSON and CSV export.
- Gemini: free API key stored on the device, one call per validated session.
- Rules: one versioned config file (structured rules, free-text principles, available increments), written separately with Claude Desktop.
- Past sessions are frozen; program edits only apply going forward.

## Out of scope for v1

Trend charts, volume and frequency objectives, rest timer, bodyweight tracking, automatic evening-before planning, cloud sync.

## Design

The design is in [Design/coaching-app](./Design/coaching-app): the design system (tokens, components, fonts, logos; its README holds the content and visual rules) and 13 screens in `screens/` (French UI, light and dark themes).
