# SetGo v2 Development Plan

## Product Direction

SetGo v2 should become a fast, efficient workout logging app first.

The recommendation system is important, but it depends on excellent logging. If workout entry is slow, confusing, or too tied to calendar setup, the recommendation engine will not have reliable data and users will not trust it.

The v2 product direction is:

- make workout logging as fast and focused as Strong and Hevy
- allow the current menu and UI structure to change if a better logging flow requires it
- keep SetGo local-first, mobile-first, and Korean-first
- follow Apple Human Interface Guidelines strictly for iPhone-oriented interaction and visual design
- preserve routine planning, calendar review, records, export, and local analytics
- add recommendation features gradually through useful defaults, not opaque automation

## North Star

SetGo v2 helps the user start today's workout quickly, record every set with minimum friction, and use past records to choose better weights and reps.

Longer term, SetGo should recommend a full daily workout plan:

- workout day or routine type
- exercises
- target weight
- target reps
- target sets
- RIR or effort target
- simple reason for each recommendation

## Primary Goals

### 1. Strong/Hevy-Level Workout Logging

The first v2 goal is an efficient set logging experience:

- one-tap start from today's planned or recent routine
- focused workout mode separated from planning and settings
- compact exercise cards with set rows
- fast weight, reps, and RIR entry on iPhone Safari
- previous record and personal best visible inside the logging flow
- add, copy, delete, reorder, replace, and skip actions available during workout
- rest timer or elapsed rest indicator
- automatic local save without interrupting the workout
- clear completion summary with volume, PR, and comparison

### 2. Better Exercise-Level Targets

The first recommendation milestone is not a full AI coach. It is smarter default targets for each exercise.

Current basis:

- last workout record
- personal best

v2 should add:

- recent 3-5 session trend
- target rep range
- last set RIR
- success or failure pattern
- exercise-specific progression style
- recent volume by muscle group
- user override history

The output should be practical:

- suggested weight
- suggested reps
- suggested sets
- confidence or reason
- easy manual override

### 3. Daily Workout Recommendation

After workout logging and exercise-level targets are solid, SetGo can recommend the whole workout.

The daily recommendation should consider:

- active routine
- planned schedule
- last completed workout
- missed or skipped workouts
- muscle group freshness
- recent training volume
- user-selected goal
- available time, if provided
- running or cardio plans, if enabled

## Non-Goals

SetGo v2 should not become:

- a social fitness network
- a cloud-first subscription platform
- a complex coaching system that hides its reasoning
- a generic health dashboard
- a large exercise encyclopedia at the cost of logging speed
- a native-only app unless PWA limitations block core use

## Benchmark Apps

### Primary Benchmarks

| App | Main Use | What SetGo Should Study |
|---|---|---|
| Strong | Fast strength logging | set row UX, routine start, rest timer, PR/1RM/volume display, export |
| Hevy | Modern workout tracker | polished workout mode, routine management, exercise history, add/replace UX |

### Secondary Benchmarks

| App | Main Use | What SetGo Should Study |
|---|---|---|
| Fitbod | Adaptive workout planning | weight/reps/exercise recommendation, recovery-aware planning, recommendation explanation |
| JEFIT | Exercise library and routines | exercise filters, templates, web-assisted setup, avoid noisy IA |
| Runna | Running plan recommendation | daily plan structure, long-term progression, strength plus running coordination |
| Apple Fitness / Health | Workout data source | workout type mapping, heart rate, duration, distance, HealthKit import constraints |
| Strava | Activity history and sharing | import/export expectations, activity summaries, shareable workout recap |

## v2 Information Architecture

The current `Today / Plan / Records / More` structure is not sacred. v2 should choose the IA that best supports fast logging.

Candidate structure:

- Today
- Routines
- History
- Insights
- More

Workout mode should not behave like a normal tab. It should be a focused task flow entered from Today, Routines, Calendar, or History.

### Today

Purpose:

- show today's recommended or planned workout
- start or continue a workout immediately
- show recent routine quick starts
- show the most relevant next action

Today should avoid becoming a dashboard full of management tools.

### Routines

Purpose:

- create, copy, edit, and activate routines
- manage routine days
- define planned exercises, sets, reps, RIR, rest time, and rep ranges
- support fast routine start

Routine setup can be deeper than Today, but it should still avoid heavy forms.

### History

Purpose:

- browse completed workouts
- edit past workouts
- inspect exercise history
- view PRs and previous records
- export a workout or date range

History should support both calendar scanning and exercise-level lookup.

### Insights

Purpose:

- show useful local analytics
- answer what changed, what improved, what is lagging, and what to adjust
- support future recommendation tuning

Insights should remain readable and action-oriented.

### More

Purpose:

- exercise library
- backup and restore
- language
- install/update status
- advanced settings

## Workout Logging UX Requirements

### Start Workout

Target behavior:

- Today opens the recommended routine in one tap
- if a workout is in progress, Continue is the primary action
- if today is a rest day, starting a workout is still easy
- recent routines are available without visiting setup
- free workout remains possible

### Workout Mode

Workout mode should show:

- workout title or routine day
- elapsed time
- save state
- finish button
- exercise list
- rest timer or rest indicator
- compact add exercise action

Workout mode should minimize:

- navigation chrome
- calendar concepts
- settings concepts
- explanatory copy

### Exercise Card

Each exercise should show:

- exercise name
- last session summary
- personal best or best recent set
- target sets
- actual set rows
- add set
- exercise menu

Possible set row columns:

- set number
- previous value or target
- weight
- reps
- RIR
- completed

### Set Entry

Set entry should optimize for thumb use:

- numeric keypad friendly inputs
- stepper or quick increment controls where useful
- previous set copy
- previous workout copy
- complete checkbox or completion swipe
- warmup and working set distinction
- no horizontal overflow on iPhone

### Finish Workout

Finish summary should show:

- completed exercises
- completed working sets
- total strength volume
- PRs
- notable changes from previous workout
- optional markdown export
- option to save this workout as a routine

## Recommendation Model

### Phase 1: Smart Defaults

Use local deterministic rules to prefill planned values.

Inputs:

- last completed session for the exercise
- best recent session
- target rep range
- planned sets
- completed set count
- RIR
- missed reps
- user-edited overrides

Example rules:

- if all working sets reached the top of the target rep range with RIR 1-3, increase weight next time
- if sets fell below the bottom of the target rep range, keep or reduce weight
- if final set RIR was 0 repeatedly, hold weight and target more stable reps
- for small isolation lifts, prefer rep progression before weight progression
- for compound lifts, allow small weight progression when success is stable

### Phase 2: Exercise-Level Recommendation

For each exercise, SetGo recommends:

- weight
- reps
- sets
- RIR target
- reason

Example:

> Bench Press: 62.5 kg x 8 reps x 4 sets. Last two sessions reached 60 kg x 10 with RIR 2, so SetGo suggests a small weight increase.

### Phase 3: Daily Workout Recommendation

SetGo recommends the full workout based on:

- current routine and schedule
- last trained routine day
- missed days
- muscle group training recency
- recent volume trend
- user fatigue notes, if recorded
- cardio or running plans, if enabled

The user should always be able to accept, edit, or ignore the recommendation.

## Data Model Considerations

v2 may need new fields for recommendation and logging speed:

- exercise target rep range
- exercise progression type
- preferred weight increment
- default rest seconds
- set type: warmup, working, drop, failure, backoff
- planned set target separate from actual set
- workout recommendation snapshot
- recommendation reason text
- user accepted or edited recommendation flag
- subjective readiness or session note

All recommendation snapshots should be stored locally so completed workouts remain explainable later.

## Development Phases

### Phase 0: v1 Baseline Audit

Deliverables:

- record current workout start and set entry flows
- compare current flow against Strong and Hevy
- identify screens or concepts that slow logging
- define v2 IA decision

Acceptance criteria:

- documented tap counts for starting and logging a basic workout
- clear decision on whether to keep or change the current tab structure
- list of v1 components to reuse, revise, or replace

Phase 0 audit document: `docs/v2-phase0-baseline-audit.md`

### Phase 1: Focused Workout Mode

Deliverables:

- redesign workout mode around exercise cards and set rows
- reduce non-workout navigation during active logging
- improve set row editing and completion
- add rest timer or rest indicator
- improve previous record visibility

Acceptance criteria:

- user can start a routine workout and log all sets without leaving workout mode
- previous values are visible during entry
- adding and copying sets is faster than v1
- layout is verified on iPhone-sized viewport

### Phase 2: Routine And History Rework

Deliverables:

- simplify routine creation and editing
- make routine quick start obvious
- improve exercise add/replace search
- build stronger exercise history view
- support past workout edit without calendar friction

Acceptance criteria:

- user can manage routines without entering workout mode
- user can inspect an exercise's last records quickly
- user can edit old workouts from History

### Phase 3: Smart Exercise Defaults

Deliverables:

- add target rep ranges and progression settings
- implement deterministic target recommendation rules
- prefill workout set targets from local history
- show short reasons for suggested targets

Acceptance criteria:

- each planned exercise can produce a next weight/reps suggestion
- user can override suggestions without losing the workout flow
- recommendation logic has domain tests

### Phase 4: Daily Workout Recommendation

Deliverables:

- recommend today's routine day or workout type
- adjust recommendations for skipped or missed workouts
- include exercise/weight/reps/set plan
- explain the recommendation simply

Acceptance criteria:

- Today can show a complete recommended workout
- user can start from recommendation and edit during workout
- recommendation snapshot is saved with the workout

### Phase 5: Running And Data Import

Deliverables:

- improve cardio/running model
- explore Apple Health / Watch import constraints
- map imported workouts to SetGo records
- decide whether native wrapper is required

Acceptance criteria:

- SetGo has a clear path for importing or manually managing running records
- strength and running plans can coexist without confusing Today

## Implementation Progress

Current v2 branch: `v2-workout-logging`

Completed startup work:

- v1 deployment baseline completed on `main`
- Apple HIG design rules documented
- major-page v2 UI design plan documented
- workout header extracted from `WorkoutPage`
- workout footer actions extracted from `WorkoutPage`
- HIG-oriented strength set row introduced and legacy row removed
- set-row presentation helpers covered by unit tests
- exercise log card extracted from `WorkoutPage`
- cardio/running section extracted from `WorkoutPage`
- floating rest timer extracted from `WorkoutPage`
- Playwright mobile smoke tests added for Today and workout logging
- exercise-level target recommendation model added with domain tests
- Today-level workout recommendation model added with domain tests
- recommendation snapshots persist when a workout starts from Today
- daily recommendations can prioritize a recently skipped routine
- recommendation snapshots include exercise-level weight/reps/set targets

Current code direction:

- surface the full recommended exercise plan in Today and Workout mode
- add richer missed-workout and fatigue/load handling
- keep test/build/e2e pass after each step

## Open Product Questions

- Should Today remain a tab, or should the app open directly into a start-workout screen?
- Should Calendar remain top-level, or move under History?
- Should Insights be top-level, or remain inside History/More until analytics mature?
- How much routine planning should happen before workout start versus inside workout mode?
- Should recommendation settings be global, per exercise, or per routine exercise?
- What is the minimum HealthKit import path if SetGo remains a PWA?

## Success Metrics

SetGo v2 should be judged by:

- taps from launch to first set entry
- taps to complete one set
- time to add or replace an exercise during workout
- ability to finish a real workout without opening settings
- accuracy and usefulness of previous record display
- user trust in suggested weight and reps
- backup/export reliability after schema changes

## Implementation Principles

- Logging speed beats visual complexity.
- Apple HIG is the default design contract for navigation, controls, feedback, touch targets, and typography.
- Recommendations should be explainable.
- Planned and actual values must stay separate.
- Workout mode should be resilient to interruption.
- Local data must remain portable through backup/export.
- Keep deterministic rules before adding any AI dependency.
- Add tests around recommendation logic before relying on it in the UI.

Design rules document: `docs/v2-apple-hig-design-rules.md`
UI design plan: `docs/v2-ui-design-plan.md`
