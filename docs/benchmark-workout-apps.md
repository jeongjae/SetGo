# SetGo Workout App Benchmark

SetGo's completed PWA phases proved the logging, routine, recovery, and local analytics model. The next product direction changes from PWA-first to native-first because long-term workout records must survive app updates without asking the user to restore data.

- local-first workout logging
- iPhone native app as the next foundation
- PWA retained as the migration source and web fallback
- no backend, no authentication, no cloud lock-in
- fast strength logging with useful local analytics
- Korean-first UI with English support

This benchmark focuses on patterns worth borrowing, not feature parity. The v5 execution roadmap is `docs/v5-native-intelligent-coach-roadmap.md`.

## Primary Benchmark Apps

| App | Why It Matters | What To Study | What SetGo Should Avoid |
|---|---|---|---|
| Strong | Fast, focused lifting log | Low-friction set entry, routine picker, rest timer, PR/1RM/volume stats, Apple Watch, CSV export | Cloud/account assumptions, too many paid gates |
| Hevy | Modern routine + workout tracker | Routine library, custom exercises, exercise notes, progress charts, Apple Watch, shareable summaries | Social feed as a core dependency, account-centric flows |
| Fitbod | Adaptive planning and recovery | AI-generated workouts, recovery-aware recommendations, muscle balancing, goal/equipment adaptation | Opaque auto-programming that overrides user intent |
| JEFIT | Large exercise library and templates | Exercise library filters, routine templates, exercise order, rep ranges, rest times | Heavy information architecture and noisy screens |
| Apple Fitness / Health | Native iOS health data ecosystem | HealthKit workout import/export possibilities, Watch capture, permission UX | Letting imported data noise pollute strength recommendations |

## Source Notes

- Strong's App Store listing emphasizes simple workout logging, custom routines, Apple Watch logging, advanced stats, 1RM/volume graphs, set tags, warm-up/plate calculators, notes, and CSV export.
- Hevy's official feature material frames the product around workout logging, progress tracking, routines, custom exercises, and social sharing.
- Fitbod's official site and App Store listing emphasize AI-generated plans that adapt to strength, recovery, goals, equipment, and training history.
- JEFIT's official planner pages emphasize custom routines, templates, exercise order, rep ranges, rest times, and access to an exercise library.
- Apple's HealthKit and WorkoutKit documentation make native integration the right place to explore Apple Health and Watch-connected workflows.
- Capacitor's storage guidance separates lightweight Preferences from larger database-backed app data; SetGo v5 should use native SQLite-style persistence for workout records.

Reference links:

- Strong App Store: https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577
- Hevy App Store: https://apps.apple.com/us/app/hevy-gym-tracker-workout-log/id1458862350
- Fitbod: https://fitbod.me/
- Apple HealthKit: https://developer.apple.com/documentation/healthkit
- Apple WorkoutKit: https://developer.apple.com/documentation/workoutkit
- Capacitor storage guidance: https://capacitorjs.com/docs/guides/storage
- Capacitor Preferences: https://capacitorjs.com/docs/apis/preferences

## SetGo Benchmark Checklist

### 1. Workout Start

Measure:

- taps from home screen to first set input
- whether the planned routine day is obvious
- whether rest-day override is clear
- whether past-date logging is easy

SetGo target:

- Today -> Workout Log should open the active or selected routine day in one tap.
- Calendar -> selected date should support add/edit workout without exposing implementation language.
- If there is no plan, show Rest / free workout clearly.

### 2. Set Logging Speed

Measure:

- taps to edit weight, reps, RIR, completed state
- previous set copy behavior
- add/delete set behavior
- keyboard friendliness on iPhone Safari

SetGo target:

- each set row must stay compact and thumb-friendly
- previous completed set copy should be visible but not dominant
- warmup and hard-set state should be fast to toggle
- no horizontal overflow on iPhone

### 3. Routine Editing

Measure:

- add exercise to routine
- replace exercise
- reorder routine exercises
- edit planned sets/reps/RIR
- reset only unsaved screen edits vs reset template

SetGo target:

- Settings should be split into clear sections: Routine, Exercises, Weekly Plan, Language/Data.
- Routine exercise search should not dump 50+ items without filters.
- Routine changes should affect new workout sessions, not mutate completed logs.

### 4. Exercise Library

Measure:

- search by name
- filter by muscle group
- filter by equipment / movement pattern / use
- custom exercise editing
- CSV or bulk management support

SetGo target:

- no default/custom visual split in normal UX
- each exercise supports Korean name, English name, description, muscle tags, use tags
- Push-up can be bodyweight, warmup, chest, and push
- Shoulder Press and other common exercises must appear in routine and workout add flows

### 5. Calendar And Past Records

Measure:

- month scan readability
- status badges
- past workout add/edit
- planned vs completed distinction
- custom date plan display

SetGo target:

- calendar shows completed / in progress / planned / missed only
- date-specific plan edits should not be labeled as "custom plan" in the calendar grid
- selected date panel should show the actual workout records and add/edit actions

### 6. Stats

Measure:

- 7- or 8-week trend readability
- volume / sets / workout days summary
- muscle-group balance
- hard-set ratio
- exercise-level PR and 1RM tracking

SetGo target:

- stats should answer: "What changed, what is undertrained, what is overloaded, what should I adjust next week?"
- no chart should require explanation to be useful
- empty state should still teach what will appear later

### 7. Export / Restore / Native Migration

Measure:

- full backup availability
- settings-only backup
- CSV exercise editing
- clear save-location explanation on iPhone
- import error handling
- whether an app update requires any manual restore

SetGo target:

- Export/Restore must remain trustworthy, but it must not be required after normal app updates.
- Native app data should persist through app updates.
- PWA backup import should be a one-time migration path.
- backup files must include local settings and workout logs when expected
- CSV import must validate exercise rows and report failures clearly

### 8. Intelligent Coaching

Measure:

- whether today's recommendation has a clear reason
- whether recovery, volume, hard-set ratio, skipped sessions, and training goal affect the recommendation
- whether the user can accept, edit, or ignore a recommendation
- whether completed workouts preserve the recommendation snapshot

SetGo target:

- Today should provide one primary recommendation and one fallback.
- Workout set targets should adjust after recent performance and low recovery.
- Weekly review should propose volume, deload, or rest adjustments.
- Recommendations must be explainable through structured reason codes.
- Any future AI layer must be optional and must not replace deterministic local rules for core logging.

## Feature Priority After Benchmark

### P0: Fix Before Broader Beta

1. Workout session add/edit for past dates
2. Routine-to-workout propagation for new sessions
3. Exercise add/replace search with filters
4. Exercise library data cleanup and CSV round-trip validation
5. Full Korean/English i18n pass for all user-facing text

### P1: Make Daily Use Fast

1. Faster set entry controls
2. Warmup / hard-set toggles
3. Rest timer or simple elapsed set timer
4. Previous-set copy polish
5. Better completed-workout edit mode

### P2: Make Stats Useful

1. Muscle-group weekly set targets
2. Hard-set ratio warnings
3. 8-week trend polish
4. Exercise PR / 1RM history
5. Automatic weekly summary based on local calculations
6. Keep the label as local/automatic analysis until an actual AI integration exists

Implemented direction: SetGo keeps these analytics local-first. The summary is automatic local analysis, not an external AI call.

### P3: Native Foundation

1. Native iPhone wrapper
2. Native SQLite storage
3. PWA backup -> native migration
4. App update without data restore
5. Data Health / backup status screen

### P4: Later, Only If Needed

1. Apple Health import
2. Apple Watch capture
3. Optional encrypted sync
4. Social sharing

## Product Positioning

SetGo should not compete by having the largest feature list. It should compete by being:

- faster than a spreadsheet
- clearer than a notebook
- more private than cloud-first apps
- stable enough to trust across app updates
- native-feeling on iPhone without sacrificing local ownership
