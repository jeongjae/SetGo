# SetGo Mobile Beta Status

SetGo is ready for a local-first mobile beta pass. The app has no backend, no authentication, and stores user data locally in IndexedDB through Dexie.

## Completed

- Tailwind pinned to v3.4.17
- Default exercise seed data with Korean/English names
- Editable exercise library with descriptions and multi-category/multi-use tags
- Routine templates and active routine setup
- Upper/lower routine template cleanup and reset action
- Routine exercise editing using exercise library categories
- Weekly schedule with rest days and planned routine days
- Date-specific calendar overrides for routine days and rest days
- Today screen with date, active routine, planned exercises, last workout, and quick actions
- Workout session creation and continuation
- Routine-plan seeded workout exercises
- Set-level weight, reps, RIR, completion, and notes
- Auto-save feedback during workout logging
- Previous completed workout lookup and previous-set copy
- Strength volume recalculation
- Add, delete, replace, and reorder exercises during a workout
- Add and delete sets during a workout
- Manual cardio records
- Complete and skip workout sessions
- Monthly calendar with completed, in-progress, planned, missed, skipped, and custom-plan indicators
- Calendar today shortcut and direct start/continue action
- Recent 30-day stats screen
- Korean/English UI support across primary app screens
- Korean/English Markdown export
- JSON backup and confirmed full restore
- PWA manifest, service worker, safe-area styling, install prompt, update prompt, and offline shell

## Beta Verification

```bash
npm run build
npm run test -- --run
npm ls tailwindcss
```

Manual smoke test:

- Today -> Routine Setup -> 루틴 / 운동 / 주간 계획 tabs
- Today -> Start/Continue Workout -> edit set -> save feedback
- Workout -> Complete or Skip -> Calendar
- Calendar -> select date -> override plan -> Back to Today
- Export -> copy Markdown -> backup JSON
- Home Screen PWA -> relaunch -> offline shell check

## Known Beta Risks

- IndexedDB data is local only. Removing browser/site data removes SetGo data.
- iPhone Home Screen install must be tested on the physical device.
- Service worker offline behavior should be rechecked after each cache version bump.
- Export restore intentionally replaces all current local data after confirmation.

## Out Of Beta

- Backend, authentication, cloud sync
- Apple Watch and HealthKit import
- Native wrapper
- Multi-device sync
