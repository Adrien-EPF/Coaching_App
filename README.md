<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./Design/coaching-app/design-system/assets/Logos/coaching-app-lockup-inverse.svg">
  <img alt="Coaching App" src="./Design/coaching-app/design-system/assets/Logos/coaching-app-lockup.svg" width="360">
</picture>

<br><br>

**Log your sets. Get the next session planned, with the reason why.**

A personal Android app to track gym progress. After each session, Gemini and your own rules plan the next one (weights, reps, sets) and explain the change.

<br>

![Platform](https://img.shields.io/badge/PLATFORM-ANDROID-111410?style=for-the-badge&labelColor=111410&color=c6f432)
![Stack](https://img.shields.io/badge/EXPO-REACT%20NATIVE-111410?style=for-the-badge&labelColor=111410&color=c6f432)
![Data](https://img.shields.io/badge/DATA-LOCAL%20ONLY-111410?style=for-the-badge&labelColor=111410&color=c6f432)
![Status](https://img.shields.io/badge/STATUS-DESIGN%20PHASE-111410?style=for-the-badge&labelColor=111410&color=f4f5f0)

[How it works](#how-it-works) &nbsp;·&nbsp; [Decisions](#decisions) &nbsp;·&nbsp; [Design](#design) &nbsp;·&nbsp; [Out of scope](#out-of-scope-for-v1)

</div>

<br>

> **Status: design phase. No code yet.** Vocabulary lives in [CONTEXT.md](./CONTEXT.md), progression rules in [RULES.md](./RULES.md), decisions in [docs/adr](./docs/adr).

<br>

## How it works

| | Step | What happens |
|:-:|---|---|
| **1** | **Program** | A training plan with a cycle of 1 week (default), 2 weeks or 1 month. Sessions are placed on calendar days, each made of exercises with a prescribed number of sets. |
| **2** | **Starting a Program** | Enter your known weights by hand (Initial Weights), run a Gemini-planned Test Session, or let Gemini propose Starting Estimates from related movements, taking the exercise's position in the session into account. |
| **3** | **In the gym** | The session is already planned. For each set you log weight, reps and RPE, with planned values pre-filled and last session's numbers shown beside them. Skipped sets or exercises are marked "Not completed". |
| **4** | **Validation** | Once every set is logged or marked not completed, you validate the session. This triggers one Gemini call that plans the next session. |
| **5** | **The plan** | Gemini receives the last 6 sessions per exercise, your Rules, your Objectives and any Problem Report, and returns structured JSON. Every value is clamped by the Guardrails. If Gemini is unreachable, a rules-only plan is used. |
| **6** | **Explanations** | A short "why this weight" appears only when the weight changes from last time, plus one line for the whole session. |
| **7** | **Calendar** | You can skip, move or add unplanned sessions, and mark rest days and injuries. Missed sessions do not shift the program. A Problem Report (e.g. bad sleep) on an upcoming session re-plans it. |
| **8** | **Dashboard** | PRs at each rep count, Estimated 1RM (Epley, on the lifted weight only, never bodyweight), Objectives (a target PR with a date), and adherence. Trend charts come right after v1. |

<br>

## Decisions

| | |
|---|---|
| **Platform** | Native Android app (Expo / React Native, TypeScript), built to an APK by a GitHub Action. |
| **Data** | Local only (SQLite on the device), with JSON and CSV export. |
| **Gemini** | Free API key stored on the device, one call per validated session. |
| **Rules** | One versioned config file (structured rules, free-text principles, available increments), written separately with Claude Desktop. |
| **History** | Past sessions are frozen; program edits only apply going forward. |

<br>

## Design

Bold and athletic: a scoreboard of big condensed numbers on calm grounds, with one electric-lime accent that means *go*. The UI is in French, light first, with a full dark theme for evenings in the gym.

![Lime](https://img.shields.io/badge/LIME-C6F432-c6f432?style=flat-square&labelColor=c6f432&color=c6f432)
![Ink](https://img.shields.io/badge/INK-111410-111410?style=flat-square&labelColor=111410&color=111410)
![Surface](https://img.shields.io/badge/SURFACE-F4F5F0-f4f5f0?style=flat-square&labelColor=f4f5f0&color=f4f5f0)
![Strength](https://img.shields.io/badge/FORCE-4C2A85-4c2a85?style=flat-square&labelColor=4c2a85&color=4c2a85)
![Hypertrophy](https://img.shields.io/badge/HYPERTROPHIE-E8559B-e8559b?style=flat-square&labelColor=e8559b&color=e8559b)
![Endurance](https://img.shields.io/badge/ENDURANCE-8FDCF5-8fdcf5?style=flat-square&labelColor=8fdcf5&color=8fdcf5)

Everything lives in [`Design/coaching-app`](./Design/coaching-app):

- **[Design system](./Design/coaching-app/design-system)**: tokens, components, fonts (Sofia Sans Condensed and Barlow) and logos. Its [README](./Design/coaching-app/design-system/README.md) holds the content and visual rules.
- **[Screens](./Design/coaching-app/screens)**: 13 screens, from the daily view and set entry to validation, progress and settings.

<br>

## Out of scope for v1

Trend charts, volume and frequency objectives, rest timer, bodyweight tracking, automatic evening-before planning, cloud sync.
