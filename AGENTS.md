# AGENTS.md - SetGo Development Guide

## Project

SetGo is a local-first mobile workout logging app for strength training, routine-based lifting, and manual cardio.

Primary target:

- iPhone Safari / Home Screen PWA
- v5 planning target: native-first iPhone app with durable local storage
- Android browser compatibility
- Desktop browser for development and testing

## Development Assumptions

- Current shipped app is a PWA. v5 planning now explicitly explores a native iPhone app because the product scope has changed.
- Current PWA stores user data locally in IndexedDB through Dexie.
- v5 native work should introduce a storage repository boundary before moving durable workout data to native SQLite.
- Do not add a backend, authentication, or cloud sync unless the product scope explicitly changes.
- Keep Tailwind on v3.
- Apple Watch / HealthKit direct integration is out of scope for the current PWA; native v5 may explore it only after durable local storage is proven.
- Do not commit local backup/settings artifacts unless explicitly requested.

## Tech Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- Dexie.js for IndexedDB
- Vitest for domain logic and component tests
- Playwright/e2e scripts for rendered app checks

## Current v3 Priorities

P0:

1. Strong/Hevy-style navigation and routine-first product flow.
2. Fast workout logging with stable keyboard and scroll behavior.
3. Explicit warmup, Hard, PR, previous-copy, delete, and completion controls.
4. Routines as training templates rather than settings.
5. Today as immediate start/continue surface.
6. Recovery-aware Insights and next-action guidance.
7. PR and workout-completion feedback.

P1:

1. History cleanup for review and correction.
2. PWA rest timer, notification, vibration, and wake-lock polish where supported.
3. Safer backup/restore and import preview flows.

P2:

1. CSV/cardio import expansion.
2. GPX/FIT import if parsing cost is justified.
3. Native wrapper only if PWA constraints become unacceptable.

## Product Rules

- Input speed is more important than visual sophistication.
- Every strength set must support:
  - `weightKg`
  - `reps`
  - `rir`
  - `completed`
  - `isWarmup`
  - `isHard`
- Exercise volume formula: `weightKg x reps`.
- Workout exercise volume is the sum of completed set volumes.
- Workout session strength volume is the sum of completed strength exercise volumes.
- Planned values and actual values must be separate.
- Users must be able to add, delete, replace, and reorder exercises during a workout.
- Markdown export must be readable and suitable for copy/paste into an AI chatbot.
- Keep the v3 roadmap in `docs/v3-development-roadmap.md` aligned with shipped behavior.

## Code Style

- Prefer small pure functions in `src/domain`.
- Avoid large monolithic components when changing shared behavior.
- Keep UI state separate from persistent domain records.
- Use TypeScript union types for controlled values.
- Prefer repo-local helpers and established UI primitives over new abstractions.
- Do not add paid SaaS dependencies.
- Do not use complex state management until necessary.

## Current App Shell

```text
Today / Routines / History / Insights / More
```

Workout mode is a focused flow outside the bottom navigation.

## Folder Conventions

```text
src/
  app/
  components/
  db/
  domain/
  pages/
  types/
  utils/
```

## Verification

For source changes, run the relevant checks before committing:

```powershell
npm.cmd run test -- --run
npm.cmd run build
```

For rendered UI changes, also verify the affected flow in the in-app browser or the existing Playwright/e2e workflow. Check mobile widths around 375px, 390px, and 427px when layout is affected.

## v3 Completion Reference

Use `docs/v3-development-roadmap.md` as the execution contract. A change is not complete until the relevant tests, production build, and rendered mobile checks pass for the affected flow.
