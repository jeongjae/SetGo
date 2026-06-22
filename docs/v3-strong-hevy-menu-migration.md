# SetGo v3 Strong/Hevy Menu Migration Plan

## Purpose

SetGo v3 moves the app shell from the older `Today / Plan / Records / More` structure to a Strong/Hevy-style workout tracker structure.

The canonical v3 bottom navigation is:

```text
Today / Routines / History / Insights / More
```

Workout mode remains a focused task flow and is not a bottom-navigation tab.

## Why This Change

The current app already has strong workout logging mechanics, but the surrounding information architecture still feels like a planning/admin app:

- routine management is buried under More
- statistics are nested inside Records
- the top-level Plan tab overemphasizes calendar planning
- Today still carries too many routine-selection responsibilities

Strong and Hevy make the main product model clear: start today, manage routines, review history, inspect progress, and change settings only when needed.

## Target Information Architecture

| Tab | Primary job | Existing implementation source |
|---|---|---|
| Today | Start or continue today's workout | `TodayPage` |
| Routines | Manage routine templates, routine days, planned sets, cycle schedule | `RoutineSetupPage` |
| History | Browse completed workouts, calendar records, edit past sessions | `ActualsPage` |
| Insights | PRs, volume trends, muscle load, recovery and next-week guidance | `StatsPage` |
| More | Exercise library, backup/restore, language, storage/PWA settings | `MorePage`, `ExportPage` |

## Routing Rules

- `workout` is never a tab. It is entered from Today, Routines, or History.
- Historical workout edits return to `history`.
- Workouts started from Today return to `today`.
- Routine setup subareas can remain nested during migration, but the Routines tab is the main entry point.
- Legacy calendar planning can remain temporarily reachable from Routines while the plan/calendar responsibility is redistributed.

## Migration Phases

### Phase 1: Canonical App Shell

- Document this v3 IA as the source of truth.
- Replace bottom navigation with `today / routines / history / insights / more`.
- Route History directly to workout records.
- Route Insights directly to analytics.
- Promote Routines to a first-class tab.
- Keep existing page internals mostly intact to reduce migration risk.

Acceptance:

- Bottom nav shows five Strong/Hevy-style destinations.
- Routines is not visually subordinate to More.
- History and Insights are separate top-level destinations.
- Workout mode still hides the global bottom nav.

### Phase 2: Routines Tab Cleanup

- Make RoutineSetupPage behave like a top-level Routines screen.
- Add internal segmented navigation for Routine / Exercise Library / Cycle Plan if needed.
- Remove routine and weekly-plan management rows from More once equivalent access exists inside Routines.
- Keep exercise library available from More only if it feels like global settings.

Acceptance:

- A user can create, edit, reorder, and start routines without visiting More.
- Routines feels like a workout product surface, not a settings form.

### Phase 3: History Tab Cleanup

- Remove the old Records wrapper pattern from primary navigation.
- Keep completed and draft sessions easy to find.
- Support calendar and list modes inside History.
- Keep past workout edit entry clear.

Acceptance:

- History answers "what did I do and when?"
- Analysis is no longer mixed into the History browsing flow.

### Phase 4: Insights Tab Expansion

- Turn StatsPage into the v3 Insights surface.
- Add stronger PR, 1RM, volume, muscle-load, and recovery presentation.
- Add recovery-aware warnings and next-workout guidance.

Acceptance:

- Insights answers "am I improving, what is lagging, and what should I adjust?"

### Phase 5: Today Simplification

- Reduce Today to the next action: recommendation, continue, start, and recent quick starts.
- Move planning controls and routine editing into Routines.
- Keep free workout and running entry easy without letting mode selection dominate the screen.

Acceptance:

- Launch-to-first-set remains the main optimization metric.
- Today no longer feels like a routine setup or planning screen.

### Phase 6: More Cleanup

- Keep More for settings, data, language, PWA/storage, backup/restore, and advanced utilities.
- Remove first-class workout creation and planning responsibilities.

Acceptance:

- A user does not need More to perform normal workout tracking.

## First Implementation Step

The first development step is the canonical app shell:

```text
today -> TodayPage
routines -> RoutineSetupPage
history -> ActualsPage
insights -> StatsPage
more -> MorePage
workout -> WorkoutPage
```

This preserves existing behavior while making the product model visible immediately.
