# SetGo v5 Native Intelligent Coach Roadmap

## Goal

SetGo v5 moves from a local-first iPhone PWA to a native-first iPhone workout coach.

The v5 objective is:

> Make SetGo trustworthy enough for long-term workout records by removing the need to restore data after PWA updates, then use the native app foundation to build a more intelligent, explainable training coach.

This is a product-scope change from the earlier PWA-first roadmap. The current React PWA remains the working app and migration source, but v5 treats iPhone native persistence as the next foundation.

## Why This Change

The PWA version proved the workout model, logging flow, local recovery engine, progressive overload logic, CSV/JSON portability, and mobile UI direction. It also exposed a trust issue:

- When app shell updates or browser storage behavior changes, the user may need to restore local data.
- A workout log is a memory system. If the user worries that app updates can disrupt data, the product cannot feel complete.
- Native iOS unlocks a clearer storage model, App Store/TestFlight distribution, HealthKit exploration, stronger background/timer behavior, haptics, and later Watch options.

The next milestone should therefore prioritize durable local storage before adding large new coaching features.

## Benchmark Refresh

### Strong

Strong remains the logging-speed benchmark. It emphasizes fast workout logging, saved routines, Apple Watch support, advanced stats, PRs, 1RM/volume graphs, warm-up and plate tools, notes, and CSV export.

SetGo should borrow:

- One-tap start/continue flow.
- Compact native-feeling set rows.
- Trustworthy long-term stats and export.
- Apple Watch as a later capture surface.

SetGo should avoid:

- Cloud sync as a hard dependency.
- Native complexity that slows down set entry.

### Hevy

Hevy is the modern routine/logging benchmark. It combines routines, custom exercises, history, progress charts, Apple Watch logging, and social/community patterns.

SetGo should borrow:

- Routine management polish.
- Exercise history and trend readability.
- Optional Watch logging mental model.
- Clear import/export trust signals.

SetGo should avoid:

- Making social sharing a core product dependency.
- Account-first onboarding before the app has earned trust.

### Fitbod

Fitbod is the adaptive coaching benchmark. Its value is not merely recording workouts, but adapting suggestions based on goals, recovery, strength history, equipment, and training state.

SetGo should borrow:

- Daily adaptive workout recommendation.
- Recovery-aware muscle balancing.
- Goal-aware progression.
- Simple explanations for why a workout or load is recommended.

SetGo should avoid:

- Opaque automation that overrides the user's routine.
- "AI" labels without user-visible evidence or control.

### Apple Fitness / Health / Watch

Apple's ecosystem is the native integration benchmark. HealthKit and WorkoutKit are native app surfaces, not PWA surfaces.

SetGo should borrow:

- HealthKit read path for running/walking/cycling workouts.
- Optional write path for completed SetGo workout summaries.
- Later Apple Watch capture for active workout logging.

SetGo should avoid:

- Blocking v5 on Watch support.
- Importing noisy Health data before SetGo has a stable native data model.

### Reference Links

- Strong App Store: https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577
- Hevy App Store: https://apps.apple.com/us/app/hevy-gym-tracker-workout-log/id1458862350
- Fitbod official site: https://fitbod.me/
- Apple HealthKit documentation: https://developer.apple.com/documentation/healthkit
- Apple WorkoutKit documentation: https://developer.apple.com/documentation/workoutkit
- Capacitor storage guidance: https://capacitorjs.com/docs/guides/storage
- Capacitor Preferences: https://capacitorjs.com/docs/apis/preferences

## Product Principles

1. **Trust before intelligence.**
   Durable records, predictable updates, and verified migration come before larger coaching features.

2. **Native-first, local-first.**
   v5 should feel like an iPhone app, but should not require an account or cloud backend.

3. **Explainable recommendations.**
   Every recommendation should answer: "Why this workout, why this load, why now?"

4. **User remains in control.**
   SetGo can recommend, prefill, and warn, but the user can accept, edit, ignore, or undo.

5. **The React app is an asset.**
   The existing UI/domain logic should be reused where practical. Native migration should not become a full rewrite unless a spike proves the wrapper path fails.

## Recommended Technical Direction

### Phase 0 Decision

Recommended default:

- Capacitor iOS wrapper around the current React/Vite app.
- Native SQLite storage for workout, routine, set, exercise, cardio, recommendation, and stats-source records.
- Capacitor Preferences or iOS UserDefaults-equivalent storage only for lightweight settings.
- Keep existing TypeScript domain logic and add a storage adapter layer.

Rejected as first step:

- Full SwiftUI rewrite: too expensive before the storage and coaching model is finalized.
- Backend-first sync: solves some backup concerns, but adds authentication, privacy, and operational scope that SetGo has intentionally avoided.
- Staying PWA-only: does not solve the user's update/restore trust problem strongly enough.

## Data Architecture Target

### Current

```text
React UI -> Dexie repositories -> IndexedDB
```

### v5 Target

```text
React UI / domain logic
  -> storage repository interface
      -> Dexie adapter for migration/dev compatibility
      -> Native SQLite adapter for iOS app
  -> backup/export service
```

### Requirements

- App updates must preserve native SQLite data without manual restore.
- Schema migrations must be versioned, reversible where practical, and tested with realistic backups.
- Existing JSON backup files must import into native storage.
- Import must preview record counts and validation errors before writing.
- Restore should no longer be part of normal update flow.
- Export remains available for ownership and emergency portability.

### Storage Contract

The v5 native storage contract is now defined in:

- `src/storage/nativeSchema.ts`
- `src/storage/nativeSqliteRepository.ts`
- `src/storage/capacitorSqliteDriver.ts`
- `src/storage/nativeMigration.ts`
- `src/storage/nativeMigrationFixture.ts`
- `docs/v5-native-storage-schema.md`
- `docs/v5-ios-native-setup.md`

This contract maps the current backup snapshot to SQLite-ready native tables, adds a plugin-agnostic SQLite repository adapter, binds the selected Capacitor SQLite plugin to that adapter, and preserves recommendation/cardio data needed by the intelligent coach roadmap. Native migration preview/import validation now checks record counts, relationship integrity, duplicate imported cardio warnings, and representative fixture import without committing private workout data.

## Migration Strategy

### One-Time PWA To Native Migration

1. User creates a v5 migration backup from the current PWA.
2. Native SetGo opens the backup file.
3. App validates:
   - schema version
   - workouts
   - routine days
   - exercise plans
   - sets
   - cardio records
   - settings
   - duplicate imported activities
4. App shows a preview:
   - record counts
   - skipped duplicates
   - incompatible rows
   - estimated DB size
5. User confirms import.
6. Native SQLite is populated in a single transaction.
7. App writes a local migration receipt.

### Success Criteria

- A real backup can be imported once and used after an app relaunch.
- Updating the native app does not require restore.
- Import failures are visible and actionable.
- The user can export again from native app after migration.

## Intelligent Coach v5

v4 already includes local recovery, 1RM estimates, progressive overload suggestions, cardio export/import, and auto deload recommendation. v5 should turn these pieces into a coherent coach.

### Coach Surfaces

1. **Today Coach**
   - One primary recommendation.
   - One fallback option.
   - "Why this?" explanation.
   - Recovery warning only when it changes the decision.

2. **Workout Coach**
   - Per-exercise target load/reps/sets.
   - Warm-up generator.
   - Failure/low-RIR handling.
   - Live adjustment after missed reps or unexpectedly easy sets.

3. **Weekly Coach**
   - Muscle-group volume balance.
   - Hard-set ratio.
   - Readiness trend.
   - Next-week volume changes.
   - Deload recommendation with accept/decline.

4. **Goal Coach**
   - User selects focus: strength, hypertrophy, recomposition, cardio base, or specific lift.
   - Recommendations adjust volume, intensity, and exercise priority.

### Coach Engine Requirements

- Deterministic local rules first.
- Recommendation snapshots saved with completed workouts.
- Each recommendation has structured reason codes.
- The UI renders reasons through i18n, not hard-coded strings.
- The system tracks whether the user accepted, edited, ignored, or reversed a recommendation.
- Future LLM integration, if added, must be optional and never required for core logging.

### Suggested New Domain Concepts

```ts
type TrainingGoal =
  | 'hypertrophy'
  | 'strength'
  | 'maintenance'
  | 'recomposition'
  | 'cardio_base'
  | 'focus_lift';

type ReadinessScore = {
  score: number;
  status: 'ready' | 'caution' | 'fatigued';
  drivers: Array<'recovery' | 'volume_spike' | 'hard_set_ratio' | 'streak' | 'sleep_placeholder' | 'cardio_load'>;
};

type CoachRecommendation = {
  id: string;
  createdAt: string;
  targetDate: string;
  kind: 'workout' | 'exercise_target' | 'weekly_adjustment' | 'deload' | 'rest';
  confidence: 'low' | 'medium' | 'high';
  reasonCodes: string[];
  userDecision?: 'accepted' | 'edited' | 'ignored' | 'dismissed';
};
```

## Development Roadmap

### Phase 1. Native Foundation

Goal: create a native iPhone app shell that can run SetGo and preserve data across app updates.

Deliverables:

- Capacitor iOS app scaffold.
- iOS build documented.
- native app icon/splash.
- storage repository interface.
- SQLite spike with one or two tables.
- proof that app relaunch preserves data.

Exit criteria:

- Native app runs on iOS simulator or device.
- A sample workout record is written to native storage and survives relaunch.
- PWA build still works during transition.

### Phase 2. Storage Migration

Goal: move SetGo data from Dexie/IndexedDB to native SQLite behind an adapter.

Deliverables:

- SQLite schema for core records.
- repository adapter parity for workouts, routines, exercises, sets, cardio.
- JSON backup import into SQLite.
- migration preview UI.
- migration test fixtures.

Exit criteria:

- Existing PWA backup imports into native app.
- Native app can perform Today -> workout -> complete -> Insights with SQLite-backed data.
- Update/relaunch does not require restore.

### Phase 3. Native Trust Layer

Goal: make data safety visible and boring.

Deliverables:

- Data Health screen.
- local DB version display.
- last backup/export status.
- manual export to Files.
- import validation report.
- backup reminder only when useful, not alarming.

Exit criteria:

- User can verify that records exist and export them.
- Import errors are precise.
- No normal app update flow asks the user to restore data.

### Phase 4. Intelligent Coach v1

Goal: make SetGo feel meaningfully smarter without making it opaque.

Deliverables:

- Readiness Score.
- structured recommendation reasons.
- Today Coach card with primary/fallback recommendation.
- focus lift or training goal setting.
- weekly adjustment recommendations.
- recommendation decision tracking.

Exit criteria:

- Each recommendation has a visible reason.
- User can accept, edit, or ignore.
- Completed workouts store the recommendation snapshot.
- Unit tests cover readiness and recommendation rules.

### Phase 5. Apple Ecosystem Spike

Goal: decide whether HealthKit/Watch integration should enter v5 or v6.

Deliverables:

- HealthKit read spike for running/walking/cycling workouts.
- mapping from Health workout to `CardioRecord`.
- permission UX notes.
- duplicate detection against imported activity records.
- optional write summary feasibility note.

Exit criteria:

- Clear decision: include HealthKit import in v5, defer to v6, or reject.
- No HealthKit work blocks the native storage migration.

### Phase 6. TestFlight Beta

Goal: ship the native app to a small real-device beta.

Deliverables:

- TestFlight setup.
- migration guide from PWA.
- real-device checklist.
- crash/logging policy without collecting workout details.
- release notes.

Exit criteria:

- Real iPhone install works.
- Migration is verified on at least one real backup.
- App update keeps native data.

## Risks

| Risk | Mitigation |
|---|---|
| Capacitor plugin complexity | Spike SQLite and file import before large refactor |
| Data migration errors | Build fixtures from exported backups and validate counts before write |
| Two storage systems during transition | Repository interface and explicit adapter selection |
| Native app scope creep | Keep HealthKit/Watch as spikes after storage foundation |
| Coaching over-automation | Always show reasons and allow edit/ignore |
| App Store/TestFlight friction | Treat TestFlight as Phase 6, not Phase 1 |

## Immediate Next Actions

1. Done: add a storage repository interface around the current Dexie access points.
2. Done: define the v5 SQLite schema from current Dexie tables and backup JSON shape.
3. Done: choose and bind the native storage plugin after the plugin-agnostic SQLite adapter spike.
4. Done: create a non-personal migration fixture that represents an exported backup without committing private data.
5. In progress: implement native shell proof on macOS/Xcode: create, relaunch, verify durable record. Windows-side regression coverage now simulates first-run and relaunch-like second-run native durability checks through the repository contract.
6. Design the Readiness Score rule set after storage stability is proven.

## Current Development Mode

As of 2026-06-30, continue with a PWA-first, native-compatible parallel track:

- Build and polish the PWA first because it is the fastest product surface and shares most code with the Capacitor iOS app.
- Keep every PWA change compatible with native by running local tests/build and confirming GitHub `iOS Native Check` after push.
- When changing data models, backup JSON, `src/db/*`, `src/storage/*`, or shared types, update native schema/migration tests in the same work.
- Do not split SetGo into separate PWA and iOS product logic unless the code is truly platform-specific.
- Apple Developer enrollment is pending; real iPhone/TestFlight validation resumes after Apple signing access is available.

## Not In Scope Until Foundation Is Proven

- Apple Watch app.
- Full SwiftUI rewrite.
- Cloud sync.
- Account system.
- Server-side AI coaching.
- Paid subscription architecture.
