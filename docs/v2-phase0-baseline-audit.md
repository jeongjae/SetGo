# SetGo v2 Phase 0 Baseline Audit

Date: 2026-06-19
Branch: `v2-workout-logging`

## Purpose

This audit starts SetGo v2 by reviewing the v1 workout logging flow against the v2 product direction:

- Strong/Hevy-level workout logging first
- recommendation features later
- logging speed over menu completeness
- workout mode as the primary product surface

The audit is based on current source review and local dev server startup. Browser automation was attempted but blocked by the in-app browser runtime in this environment, so tap counts below are source-derived estimates that should be validated on iPhone Safari.

## Current v1 Structure

Top-level navigation:

- Today
- Plan
- Records
- More

Workout mode:

- entered from Today, Plan, or Records
- hides bottom navigation while active
- has a fixed workout header
- shows session memo, exercise cards, set rows, optional running input, and finish actions

Important files:

- `src/app/App.tsx`
- `src/app/AppBottomNav.tsx`
- `src/pages/TodayPage.tsx`
- `src/pages/WorkoutPage.tsx`
- `src/pages/CalendarPage.tsx`
- `src/pages/RecordsPage.tsx`
- `src/pages/ActualsPage.tsx`
- `src/pages/StatsPage.tsx`
- `src/pages/RoutineSetupPage.tsx`

## Baseline Flow Estimates

### Flow A: Today To First Planned Set

Assumed state:

- active routine exists
- today has a planned routine day
- no workout is currently in progress
- first planned exercise is auto-expanded after workout load

Estimated flow:

| Step | Action | Count |
|---|---|---:|
| 1 | Open app to Today | 0 |
| 2 | Optional: choose routine/running/free segment | 0-1 |
| 3 | Optional: choose routine day chip | 0-1 |
| 4 | Tap `Log workout` | 1 |
| 5 | Tap first set weight/reps/RIR field or use plus/minus | 1 |

Estimated taps to first input:

- best case: 2
- common case with routine-day change: 3
- rest-day or override case: 3-4

Assessment:

- Start path is already short.
- Today carries routine selection, workout type selection, plan explanation, planned exercises, recent routine starts, and in-progress workouts.
- v2 should keep one-tap start but make the primary workout action visually and cognitively simpler.

### Flow B: Continue In-Progress Workout

Assumed state:

- today's in-progress workout exists

Estimated flow:

| Step | Action | Count |
|---|---|---:|
| 1 | Open app to Today | 0 |
| 2 | Tap in-progress workout row or primary button | 1 |
| 3 | Tap next incomplete set input | 1 |

Estimated taps to next set input:

- 2

Assessment:

- Continuation is good.
- v2 should make Continue the dominant primary action when a workout is in progress.

### Flow C: Complete One Set

Current set row exposes:

- set type toggle
- weight step selector
- weight minus/input/plus
- reps minus/input/plus
- RIR minus/input/plus
- warmup toggle
- hard toggle
- complete button
- copy previous
- delete set
- recent previous-set row
- PR badge

Estimated interactions:

| Scenario | Actions | Count |
|---|---|---:|
| Values already correct | Tap Complete | 1 |
| Copy previous then complete | Copy previous, Complete | 2 |
| Adjust reps only | Reps +/-, Complete | 2+ |
| Adjust weight and reps | Weight +/-, Reps +/-, Complete | 3+ |
| Type all fields | Weight, Reps, RIR, Complete | 4+ |

Assessment:

- Power is high, but density is also high.
- Current row is closer to a compact control panel than a Strong/Hevy-style set table.
- v2 should separate always-visible primary actions from secondary actions.

### Flow D: Add Or Replace Exercise During Workout

Add exercise:

- tap add exercise action
- search/filter in exercise finder
- select exercise
- enter first set

Replace exercise:

- expand exercise
- tap Manage
- tap Replace
- search/filter
- select replacement

Assessment:

- Functional coverage is strong.
- Replace is intentionally tucked away, which is good for accidental edits.
- v2 should keep this power but make the common "add exercise" path faster and easier to find during live logging.

## Strengths To Preserve

- Local-first data and auto-save behavior.
- Workout mode already hides global bottom navigation.
- Today can start planned, running, and free workouts.
- In-progress workouts can be resumed.
- Previous set copy exists.
- Previous workout data is shown near the set row.
- Exercise history can be opened from an exercise card.
- Rest timer exists.
- Add, replace, delete, reorder, memo, and cardio are supported.
- Completed historical workouts can be edited.
- Domain logic already has tests.

## Friction Points

### 1. Today Is Doing Too Much

Today currently combines:

- active routine summary
- today's plan
- plan explanation
- workout kind selector
- routine day selector
- planned exercise chips
- recent routine quick starts
- in-progress workouts
- primary workout button

This is acceptable for v1, but v2 should make Today behave more like a launchpad:

- primary action: continue or start today's workout
- secondary action: change workout type or routine day
- tertiary action: inspect plan details

### 2. Plan And Records Are Split By Planning vs Actuals

The current top-level split is:

- Plan: future plan/calendar
- Records: actuals calendar and stats

For v2, this may not match the user's mental model during training. Strong/Hevy users usually think:

- start workout
- routines
- history
- progress

Recommendation:

- replace `Plan` top-level with `Routines` or `Plan`
- rename `Records` to `History`
- consider moving calendar views under History and Routines rather than making calendar a top-level concept

### 3. Set Row Is Powerful But Busy

Current set row is excellent for feature coverage, but it exposes many controls at once:

- type
- step size
- PR/hard badges
- previous copy strip
- three numeric input groups
- warm/hard/complete/copy/delete actions

Recommendation:

- make the default row look like a table row: set, previous/target, kg, reps, RIR, done
- move warmup/drop/failure/delete into row menu or long-press/tucked actions
- keep plus/minus controls available only when editing a field or in an expanded row
- show previous and target as compact reference text, not a separate full-width action row by default

### 4. Recommendation Has No Data Contract Yet

v1 uses previous records and personal bests as display data, but v2 needs explicit target data:

- target rep range
- preferred weight increment
- progression type
- planned vs suggested vs actual values
- recommendation reason
- accepted/edited recommendation flag

Recommendation:

- introduce recommendation data through domain functions before changing UI heavily
- keep deterministic rules testable and local

### 5. Korean Text Encoding Needs Attention

Some source inspection output shows mojibake for Korean strings in PowerShell. This may be a terminal encoding display issue, but v2 should verify:

- source files are UTF-8
- app renders Korean correctly in browser
- tests do not accidentally lock in mojibake strings

## v2 IA Decision

Decision for v2 exploration:

Do not preserve the current IA as a constraint.

Use the following candidate structure for implementation experiments:

- Today
- Routines
- History
- Insights
- More

Workout mode remains outside the tab bar.

Rationale:

- Today should launch or continue workouts.
- Routines should own workout templates and long-term setup.
- History should own completed workouts, actuals calendar, and exercise history.
- Insights should own stats and recommendations once useful enough.
- More should own library, export/restore, language, install/update, and advanced settings.

## v2 Workout Mode Decision

Decision for v2 exploration:

Keep a focused workout mode, but redesign the exercise card and set row model.

Target pattern:

- workout header: back, title, elapsed/rest, save state, finish
- exercise list: compact cards or table-like groups
- set rows: previous/target/current/done
- secondary controls tucked into menus
- "add exercise" always reachable
- rest timer starts naturally after completing a working set
- next incomplete set receives focus or visual emphasis

## Phase 1 Implementation Candidates

Candidate A: Incremental Set Row Redesign

- keep current WorkoutPage data flow
- replace `WorkoutSetRow` with a more table-like row
- preserve all handlers
- hide lower-priority controls behind a row menu
- add tests for any new row state helpers

Pros:

- lower data risk
- fast to test
- preserves current functionality

Cons:

- WorkoutPage is already large
- may not fix broader workout-mode information density

Candidate B: Extract Workout Logging Components

- split `WorkoutPage.tsx` into focused components
- create `WorkoutHeader`
- create `ExerciseLogCard`
- create `WorkoutSetRow`
- create `WorkoutFooterActions`
- then redesign row/card UX

Pros:

- better v2 foundation
- easier future recommendation UI

Cons:

- more refactor risk before visible UX payoff

Candidate C: Prototype New Workout Mode Behind Flag

- create a new v2 workout surface
- reuse workout db/domain APIs
- route only from a development toggle or query flag
- compare v1 and v2 side by side

Pros:

- avoids breaking v1 flow
- allows bolder Strong/Hevy-style redesign

Cons:

- temporary duplication
- requires careful cleanup later

## Recommended Next Step

Start with Candidate B in a narrow way:

1. Extract presentational workout logging components without changing behavior.
2. Add focused tests around pure helper functions.
3. Redesign the set row after the extraction.
4. Validate on iPhone-sized viewport.

This gives v2 a cleaner foundation while keeping v1 behavior intact during the first refactor.

## Manual QA Checklist For Physical iPhone

Use this checklist to validate the estimated tap counts:

- launch installed PWA
- start today's planned workout
- record first set with values unchanged
- record first set after copying previous values
- record first set after changing reps only
- record first set after changing weight and reps
- complete the first exercise
- add a new exercise during workout
- replace an exercise during workout
- finish workout
- reopen from History and edit one set

Record:

- tap count
- time to first set input
- whether keyboard covers active controls
- whether previous values are visible at the right moment
- whether the next incomplete set is obvious

## Browser Validation Status

Local dev server:

- started successfully at `http://127.0.0.1:5176/`

Automated browser validation:

- in-app browser setup failed in this environment before page interaction
- no screenshot evidence was captured in this pass

Follow-up:

- rerun rendered validation when browser control is available
- validate both desktop and iPhone-sized viewport before Phase 1 UI changes are merged
