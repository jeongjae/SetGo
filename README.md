# SetGo

SetGo is a local-first workout logging PWA for strength training, routine-based lifting, and manual cardio logging.

## Mobile Beta Scope

- Target device: iPhone Safari / Home Screen PWA
- Storage: local IndexedDB through Dexie
- Backend: none
- Authentication: none
- Network dependency after install: none for the app shell

## v3 Product Shape

| Area | Feature |
|---|---|
| Today | Recommended next workout, active/in-progress session, recent routine starts, quick free workout/running entry |
| Routines | Active routine, saved routines, routine days, exercise plans, workout cycle, exercise library |
| Workout log | Fast set entry with warmup toggle, exercise-specific set targets, previous-set copy, Hard toggle, PR chips, rest timer |
| History | Calendar/list-oriented review of past workouts, historical add/edit flows, completed/in-progress status |
| Insights | Volume trends, hard-set ratio, muscle-group analysis, exercise PR/1RM history, local automatic analysis |
| Cardio | Manual indoor/outdoor cardio entries |
| More | Exercise library shortcut, Markdown export, JSON backup/restore, CSV exercise library management, language, local-data guidance |
| PWA | Manifest, service worker, offline shell, install/update status |

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

## Test

```bash
npm run test -- --run
```

## Build

```bash
npm run build
```

## Mobile Beta Checklist

1. Run `npm run build`.
2. Run `npm run test -- --run`.
3. Open the Vite URL and confirm the v3 bottom navigation: `Today / Routines / History / Insights / More`.
4. From Today, start or continue a workout and confirm the exercise name remains visible while editing set values.
5. In Workout, edit weight/reps/RIR, toggle warmup and Hard, copy a previous value, and confirm local save feedback.
6. Complete or skip a workout and confirm the result is visible in History.
7. Open Routines and confirm active routine, routine days, exercise library, and workout cycle controls remain reachable.
8. Open Insights and confirm trend/performance sections render without console errors.
9. Open More, export Markdown, create a JSON backup, and review the local-data explanation.
10. Open the app on iPhone Safari using the local network URL.
11. Add SetGo to Home Screen.
12. Relaunch from Home Screen and confirm layout, keyboard input, safe-area spacing, and offline shell.

## Product Direction

SetGo v3 uses `docs/v3-development-roadmap.md` as the product and development guide. The current target is a Strong/Hevy-fast workout logger with Fitbod-like local recovery awareness, motivating PR/completion feedback, and trustworthy local-first data ownership.

`docs/v3-strong-hevy-menu-migration.md` is the IA reference for the v3 menu model. `docs/benchmark-workout-apps.md` remains the benchmark guide for Strong, Hevy, Fitbod, JEFIT, and related workout app patterns.

## Out Of Beta

- Cloud sync
- Authentication
- Apple Watch / HealthKit import
- Native iOS wrapper
