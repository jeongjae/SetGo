# SetGo Target UI/UX Design And Migration

## Purpose

This document translates the prior UI mockups into one implementable mobile design system and an incremental migration plan for the current React PWA.

The reference mockups establish three strong ideas:

- a dashboard-style Today screen with immediate workout entry
- a calendar screen that combines monthly context with selected-day action
- a workout logger optimized for rapid set entry and visible progress

They also disagree in important ways: Today and Calendar use a bright theme while Workout uses a dark theme; navigation labels and destinations change per screen; and the workout logger keeps global navigation visible even during an active logging task.

## Design Decision

Use one graphite dark theme with high-contrast raised cards and teal/cyan action color.

Why:

- It aligns with the current implementation and lowers migration risk.
- It suits repeated use in a gym without bright-screen glare.
- High contrast and larger type can preserve the readability strengths of the light mockups.

Use two bottom-area modes:

1. Browse mode: persistent global bottom navigation on Today, Calendar, Stats, and Settings.
2. Workout mode: replace global navigation with a workout-specific action bar while logging.

This avoids accidental navigation during a workout while retaining fast access in the rest of the app.

## Target Information Architecture

### Global Navigation

Four destinations are persistent in browse mode:

| Tab | Purpose | Current destination mapping |
|---|---|---|
| Today | Today's plan and resume/start action | `today` |
| Calendar | Monthly records and selected-day action | `calendar` |
| Stats | Training trends and analysis | `stats` |
| Settings | Routine setup, exercise library, export/restore, language and storage | new container around `routineSetup` and `export` |

`Workout` is not a global tab. It is a focused task entered through a primary action.

### Primary Actions

| Context | Primary action |
|---|---|
| Today, no session in progress | Start planned workout or free workout |
| Today, in-progress session | Continue workout |
| Calendar, selected planned date | Start planned workout |
| Calendar, selected in-progress session | Continue workout |
| Workout | Complete workout |

## Target Screens

### Today

- Compact SetGo header with date and storage status.
- Active routine hero card showing today's day, exercise count, and estimated duration.
- Planned exercise preview as a concise list, not a large tag cloud.
- Recent workout summary card.
- One prominent sticky CTA immediately above global navigation: `Start workout` or `Continue workout`.
- Global bottom navigation: Today, Calendar, Stats, Settings.

Changes from current:

- Remove the 2-column five-button action grid.
- Move Calendar, Stats, and Settings access into global navigation.
- Place Export/Restore under Settings.

### Calendar

- Compact header and month navigator.
- Readable month grid with status dots and selected-day emphasis.
- Selected-date detail card scrolls within remaining body area.
- One contextual CTA bar above the global navigation, changing between Start, Continue, or Edit.
- Secondary actions such as Skip or change-plan remain inside selected-date detail.

Changes from current:

- Move the main workout-start/continue action out of the scrollable detail panel.
- Add persistent global navigation.

### Workout Log

- Focused full-height dark screen; no global bottom navigation.
- Header includes back/minimize, routine day, elapsed time, save state, and overflow actions.
- Compact progress summary: exercises complete, sets complete, volume.
- Exercise accordions with one expanded current exercise.
- Set entry rows optimized for thumb entry: weight, reps, RIR and a single completion toggle.
- Avoid a separate `Record` button per row because values already autosave; completion is the meaningful action.
- Rest timer surfaces immediately above the action bar after a set completes.
- Persistent workout action bar: add exercise, skip/end options, large Complete button.

Changes from current:

- Preserve the existing dedicated footer architecture.
- Simplify action hierarchy and align timer placement with footer.

### Stats

- Global bottom navigation visible.
- Header no longer needs a prominent back button.
- Summary KPI strip, trend card, muscle analysis and insights scroll above navigation.
- AI/export action remains a contextual secondary button in content.

### Settings

- A new browse-mode destination replacing direct Settings/Export tiles from Today.
- Top-level actions: Routine, Exercise Library, Weekly Plan, Data export/restore, and direct Language switching.
- Local storage status is disclosed through a header information action instead of a persistent content card.
- Routine editing may open a nested detail surface; global navigation stays visible when practical.

## Component Model

Introduce these presentation components without changing Dexie/domain behavior:

| Component | Responsibility |
|---|---|
| `AppBottomNav` | Browse-mode navigation and active-tab state |
| `ScreenHeader` | Consistent title, optional contextual control |
| `StickyActionBar` | Contextual CTA above global navigation |
| `WorkoutActionBar` | Workout-only footer actions |
| `StatusPill` | Shared planned/in-progress/completed/skipped state treatment |
| `SurfaceCard` | Consistent card contrast, radius and border styling |

## Current-To-Target Gap

| Area | Current state | Target gap |
|---|---|---|
| App shell | Page components own navigation separately | Shell should render browse bottom nav and reserve footer height |
| Today | Bottom 2-column action grid, final orphan tile | Replace with sticky workout CTA plus global nav |
| Calendar | CTA is inside scrollable selected-day panel | Promote contextual CTA to sticky bottom area |
| Workout | Dedicated fixed footer exists | Refine action hierarchy; keep focused mode |
| Stats | Back-to-Today only | Add global navigation |
| Routine Setup | Back-to-Today and internal tabs | Enter via Settings and decide nested footer behavior |
| Export | Back-to-Today only | Move into Settings/Data section or retain nested page with global navigation |

## Migration Plan

### Phase 0: Baseline And Decisions

- Capture current mobile screenshots for Today, Calendar, Workout, Stats and Export.
- Confirm the four browse-mode tabs and whether Routine Setup opens inline under Settings or as a nested route.
- Add focused tests for navigation-state preservation when returning from Workout.

Deliverable: accepted target navigation map and baseline captures.

### Phase 1: App Shell And Browse Navigation

- Extend `AppView` with a `more` browse destination or create a Settings container.
- Add `AppBottomNav` at the app-shell level for non-workout views.
- Reserve safe-area-aware content space so scrollable content never hides behind the nav.
- Route Routine and Export entry through Settings.

Deliverable: Today, Calendar, Stats and Settings are reachable through a stable bottom nav.

### Phase 2: Today Conversion

- Replace the existing five-card action grid with one sticky start/continue CTA.
- Reduce planned-routine card height and present planned exercises as a compact list.
- Preserve existing workout-start behavior and in-progress resume logic.

Deliverable: Today matches the new browse-mode structure.

### Phase 3: Calendar Conversion

- Retain month grid and selected-date data logic.
- Extract the selected date's primary action into `StickyActionBar`.
- Keep edit-plan, skip, and existing-record management in the detail panel.
- Validate that selected date persists across workout entry and return.

Deliverable: a calendar that always exposes the relevant workout action without scrolling.

### Phase 4: Workout Refinement

- Keep the existing focused footer instead of rendering `AppBottomNav`.
- Consolidate set-row completion behavior around the autosaved input model.
- Tune header/progress/timer/action-bar density against iPhone 15 Plus dimensions.
- Preserve cardio workflow, delete confirmations, and workout completion guards.

Deliverable: faster logging workflow consistent with the target mockup.

### Phase 5: Stats And Settings Consolidation

- Apply browse navigation to Stats.
- Build the Settings landing surface.
- Place Routine Setup, Exercise Library, Export/Restore and storage/PWA status under Settings.
- Avoid forcing the user back through Today for section switching.

Deliverable: complete browse-mode information architecture.

### Phase 6: Verification And Release

- Run automated tests and production build after each behavior-changing phase.
- Render-check all target surfaces at iPhone 15 Plus width.
- Perform device UAT for keyboard entry, safe areas, Home Screen relaunch and offline use.
- Update handoff and beta documentation after UI structure is complete.

Deliverable: deployable, verified UI/UX update.

## Recommended Build Order

Start with the shared shell and navigation before detailed visual polish. The current application already contains valuable page functionality, and changing per-page presentation before establishing the bottom-area contract would create avoidable rework.

## Implementation Status - 2026-05-26

Implemented in the current working tree:

- Added browse-mode bottom navigation for Today, Calendar, Stats and Settings.
- Added a Settings hub for Routine Setup and Export/Restore entry.
- Promoted Language to a direct top-level Settings control and removed the duplicate language switch from Routine Setup.
- Moved local storage and backup guidance behind the Settings header information action to keep the primary action list concise.
- Split Routine, Exercise Library and Weekly Plan into peer Settings destinations with save/cancel actions.
- Added four-week weekly-plan ranges, calendar review return flow and historical completed-record editing.
- Replaced Today's five-tile action grid with one persistent workout CTA.
- Moved Calendar's primary start/continue action into a persistent bottom CTA.
- Made Calendar month content and selected-day detail scroll together on shorter viewports while keeping the CTA visible.
- Kept Workout in focused mode without global navigation and clarified the set completion control.
- Changed completion return behavior so a workout started from Today returns to Today, while a Calendar-started workout returns to Calendar.

Verified:

- `npm.cmd test -- --run`
- `npm.cmd run build`
- In-app browser checks for Today, Calendar, Workout, Stats, Settings and nested Routine Setup navigation state.

Remaining release validation:

- iPhone Safari and Home Screen PWA check for keyboard behavior, safe-area spacing, relaunch and offline shell.

