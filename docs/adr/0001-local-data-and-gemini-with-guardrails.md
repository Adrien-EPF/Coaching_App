# Local-only data, and Gemini plans within hard Guardrails

Data is stored only on the device (SQLite, with JSON/CSV export). Gemini produces each Session Plan, guided by the Rules, but every value it returns is clamped by Guardrails defined in the Rules, with a rules-only plan as fallback when Gemini fails.

## Why

- Local-only: single user, small data, no account to run. The cost is that a lost phone loses history, so export is the safety net.
- Gemini decides, not just explains: you want it to weigh history, exercise position and notes. The risk is a wrong answer, so Guardrails make a bad weight impossible rather than unlikely.
- One call per validated session keeps the free tier sufficient and means no connectivity is needed in the gym.

## Considered alternatives

- Cloud backend with login: rejected, more infrastructure for one user.
- Rules compute, Gemini only explains: rejected, you prefer Gemini to weigh the context.
- Gemini call per set: rejected, would exceed the free tier.
