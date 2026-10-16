# Coaching App

A personal gym-tracking app: you log your sets, and it recommends the weight and reps for your next sets, with an explanation.

## Language

**Program**:
A named training plan made of **Sessions** laid out over a **Cycle**. Starting a new Program triggers an adaptation of its starting weights.
_Avoid_: Routine, plan

**Cycle**:
The repeating span of a **Program**: 1 week (default), 2 weeks, or 1 month.

**Session**:
One planned workout on a calendar day, made of **Exercises**.
_Avoid_: Workout

**Exercise**:
A movement within a **Session** (e.g. weighted pull-up) with a prescribed number of **Sets** and one **Training Goal**. A bodyweight movement and its weighted version are two distinct Exercises (pull-up and weighted pull-up).

**Training Goal**:
The quality an **Exercise** is trained for in a **Program**: Strength, Endurance or Hypertrophy. It decides which set of **Rules** drives its **Recommendations** (rep ranges, RPE targets, how and when the weight goes up). The same movement can have a different Training Goal in another **Program** or **Session**. Hypertrophy here means building muscle to lift more, never training for looks.
_Avoid_: Objective (reserved for a target **PR**), focus, type

**Set**:
One logged effort: weight, reps and RPE. Entered right after the **Exercise** in the gym.
_Avoid_: Series (use Set)

**RPE**:
Rate of Perceived Exertion, logged on each **Set** from 1 to 10 (10 = no rep left, 9 = 1 left, 8 = 2 left...). The scale with its meaning is shown on screen when you enter it, so the note stays consistent. In the **Rules** it acts as a brake: reps hit at too high an RPE do not earn a weight increase.

**Rules**:
The progression rules you author, with one rule set per **Training Goal** (Strength, Endurance, Hypertrophy) plus shared rules that apply to all: structured condition-to-action rules plus some free-text guidance. Their single aim is performance (more weight, more reps), not appearance.

**Recommendation**:
The weight, reps and number of sets proposed for an **Exercise**, produced by Gemini guided by the **Rules** and your logged history, with an explanation. Always inside the **Guardrails**.

**Session Plan**:
The full set of **Recommendations** for one **Session**, generated in one go before you go to the gym. It takes each **Exercise**'s position in the **Session** into account (fatigue: first vs last).

**Not Completed**:
A status on an **Exercise** or **Set** you skipped. A **Session** can be validated once every **Set** is either logged or marked Not Completed.

**Validation**:
The act of closing a finished **Session**. It triggers the **Session Plan** for the next **Session**. Editing a validated **Session** later re-plans the next one.

**Problem Report**:
A note attached to an upcoming **Session** (e.g. bad sleep) that is passed to Gemini when its **Session Plan** is regenerated. Deviations from the plan (4 reps instead of 5) are not reported separately: you log what you did and the gap is the signal.

**Estimated 1RM**:
A one-rep-max estimate computed from your logged **Sets** for an **Exercise**, on the weight lifted only (for a weighted pull-up, the added load, never bodyweight). Shown next to the **PRs**.

**Guardrail**:
A hard limit in the **Rules** (e.g. max +5% per session) that clamps any **Recommendation**, whatever Gemini says.

**Starting Estimate**:
A proposed weight and reps for an **Exercise** with no history, derived from related movements. Shown for you to approve or edit.

**Missed Session**:
A planned **Session** you did not do. It is marked as missed; the **Program** does not shift.

**Unplanned Session**:
A **Session** logged outside the **Program**.

**Personal Record (PR)**:
Your heaviest weight at each rep count for an **Exercise**.

**Initial Weights**:
Weights you enter by hand when creating a **Program** whose levels you already know. This is the only place you set weights yourself; it replaces **Starting Estimates** and the **Test Session**.

**Test Session**:
An optional **Session** planned by Gemini to measure your level on the new **Exercises** of a new **Program**, so it can be scaled to you. It is logged like any other **Session**.

**Objective**:
A target **PR** you set on an **Exercise**, with a date (e.g. weighted pull-up 5 reps at +10 kg by March), tracked on the dashboard.
