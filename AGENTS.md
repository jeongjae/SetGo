# AGENTS.md — SetGo Development Guide

## Project
SetGo is a local-first mobile workout logging PWA.

Primary target:
- iPhone 15 Plus via Safari / Home Screen PWA
- Android browser compatibility
- PC browser for development and testing

## Development Assumptions
- Build as a PWA, not a native iOS app.
- Use open-source tools only.
- Keep the project lean, portable, and robust.
- Store all user data locally in IndexedDB.
- No backend, no authentication, no cloud sync in MVP.
- Apple Watch / HealthKit import is v2, not MVP.

## Tech Stack
- React
- Vite
- TypeScript
- Tailwind CSS
- Dexie.js for IndexedDB
- Vitest for domain logic tests

## MVP Priorities
P0:
1. Exercise master data
2. Routine templates
3. Routine setup
4. Workout session logging
5. Set-level weight / reps / RIR input
6. Volume calculation
7. Previous record lookup
8. Markdown export
9. Monthly calendar display

P1:
1. Cardio manual entry
2. Calendar completed / skipped status
3. Previous session comparison
4. JSON backup / restore

P2:
1. Apple Watch / HealthKit import
2. Statistics dashboard
3. Native wrapper if needed

## Product Rules
- Input speed is more important than visual sophistication.
- Every strength set must support:
  - weightKg
  - reps
  - RIR
  - completed status
- Exercise volume formula:
  - weightKg × reps
- Workout exercise volume:
  - sum of completed set volumes
- Workout session strength volume:
  - sum of completed strength exercise volumes
- Planned values and actual values must be separate.
- Users must be able to add, delete, replace, and reorder exercises during a workout.
- Markdown export must be readable and suitable for copy/paste into an AI chatbot.

## Code Style
- Prefer small pure functions in `src/domain`.
- Avoid large monolithic components.
- Keep UI state separate from persistent domain records.
- Use TypeScript union types for controlled values.
- Do not introduce a backend unless explicitly requested.
- Do not add paid SaaS dependencies.
- Do not use complex state management until necessary.

## Folder Conventions

```text
src/
├─ app/
├─ components/
├─ db/
├─ domain/
├─ pages/
├─ types/
└─ utils/
```

## First Development Sequence
1. Create Vite React TypeScript app.
2. Add Tailwind CSS.
3. Add Dexie.
4. Add schema and seed data.
5. Implement volume calculation and tests.
6. Implement basic routing.
7. Implement Today page.
8. Implement Workout session page.
9. Implement Markdown export.

## Acceptance Criteria for MVP
- User can create or activate one routine.
- User can start today's workout.
- User can edit exercise list for the session.
- User can input actual set values.
- Total volume recalculates immediately.
- Workout session is saved locally.
- Calendar shows completed and missed workout days.
- Markdown output can be copied.
