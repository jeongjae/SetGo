# SetGo Workout App Benchmark

SetGo is not trying to become a full native fitness platform. The product direction is:

- local-first workout logging
- iPhone Safari / Home Screen PWA
- no backend, no authentication, no cloud lock-in
- fast strength logging with useful local analytics
- Korean-first UI with English support

This benchmark focuses on patterns worth borrowing, not feature parity.

## Primary Benchmark Apps

| App | Why It Matters | What To Study | What SetGo Should Avoid |
|---|---|---|---|
| Strong | Fast, focused lifting log | Low-friction set entry, routine picker, rest timer, PR/1RM/volume stats, CSV export | Native-only assumptions, cloud-first sync, too many paid gates |
| Hevy | Modern routine + workout tracker | Routine library, custom exercises, exercise notes, progress charts, social sharing patterns | Social feed as a core dependency, account-centric flows |
| Fitbod | Adaptive planning and recovery | AI-generated workouts, recovery-aware recommendations, muscle balancing | Opaque auto-programming that overrides user intent |
| JEFIT | Large exercise library and templates | Exercise library filters, routine templates, web-assisted setup patterns | Heavy information architecture and noisy screens |

## Source Notes

- Strong's App Store listing emphasizes simple workout logging, custom routines, Apple Watch logging, advanced stats, 1RM/volume graphs, set tags, warm-up/plate calculators, notes, and CSV export.
- Hevy's official feature material frames the product around workout logging, progress tracking, routines, custom exercises, and social sharing.
- Fitbod's official site and App Store listing emphasize AI-generated plans that adapt to strength, recovery, goals, equipment, and training history.
- JEFIT's official planner pages emphasize custom routines, templates, exercise order, rep ranges, rest times, and access to an exercise library.

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

### 7. Export / Restore

Measure:

- full backup availability
- settings-only backup
- CSV exercise editing
- clear save-location explanation on iPhone
- import error handling

SetGo target:

- Export/Restore must be trustworthy before adding more features
- backup files must include local settings and workout logs when expected
- CSV import must validate exercise rows and report failures clearly

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
5. AI-style weekly summary based on local calculations
6. Rename "AI Comment" to local/automatic analysis until an actual AI integration exists

### P3: Later, Only If Needed

1. Apple Health / Watch import
2. Native wrapper
3. Optional encrypted sync
4. Social sharing

## Product Positioning

SetGo should not compete by having the largest feature list. It should compete by being:

- faster than a spreadsheet
- clearer than a notebook
- more private than cloud-first apps
- easier to install than a native beta
- good enough for real lifting logs on iPhone Safari
