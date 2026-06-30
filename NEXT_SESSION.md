# SetGo Next Session Handoff

## Current State

- Project path: `C:\Users\NB-24021500\Projects\SetGo\setgo-starter`
- App: Vite React TypeScript PWA, local-first. Current native track uses Capacitor iOS plus a native SQLite repository/migration path.
- GitHub repo: `https://github.com/jeongjae/SetGo.git`
- Current branch: `main` (synced with `origin/main`)
- Latest pushed commit at the 2026-06-30 native/PWA handoff: `52d3462 ci: create ios build log directory`
- Phases 4 through 9 are complete and pushed (see Recently Completed Work).
- Deploy verification: pushing to `main` triggers GitHub Pages and `iOS Native Check`. Confirm both on the repo Actions page (the `gh` CLI is not available in the current shell).
- Local development URL used in the last UAT: `http://127.0.0.1:5173/`
- Deployment target: GitHub Pages.
- Health at handoff: `npm.cmd run test -- --run`, `npm.cmd run build`, `npm.cmd run test:e2e`, and `npm.cmd run test:viewport` pass. GitHub `Deploy SetGo` and `iOS Native Check` were green after `52d3462`.

## 2026-06-30 Operating Direction

The user has requested Korean responses going forward.

Use a PWA-first, native-compatible parallel development model:

```text
PWA = main product surface for fast feature and UX iteration
Native = same React app wrapped by Capacitor, continuously verified for iOS build/storage/migration compatibility
```

Recommended sequence for future work:

1. Improve PWA features and UX first.
2. Run local checks: `npm.cmd run test -- --run`, `npm.cmd run build`, `npm.cmd run test:e2e`, `npm.cmd run test:viewport`.
3. Push to `main`.
4. Confirm GitHub `Deploy SetGo` is green.
5. Confirm GitHub `iOS Native Check` is green.
6. If a change touches data model, backup format, `src/db/*`, `src/storage/*`, or shared types, also strengthen native migration/schema tests.

Treat PWA and native as one shared codebase, not two separate products. Do not fork product logic into iOS-only code unless the feature is genuinely platform-specific, such as signing, native SQLite, file import, HealthKit, notifications, or iOS permissions.

Apple Developer account enrollment is pending and may take 2-3 days. Until it is approved, keep native development focused on CI-verifiable work from Windows. Real iPhone install/TestFlight still needs Apple signing through a cloud/borrowed Mac or later CI signing setup.

The latest real user backup validation:

- File: `C:\Users\NB-24021500\Documents\카카오톡 받은 파일\setgo-backup-2026-06-30T01-19-38.json`
- Valid SetGo v1 full backup.
- Native import allowed.
- Errors: 0.
- Warnings: 0.
- Counts: 62 exercises, 5 routines, 17 routine days, 104 routine exercise plans, 33 workout sessions, 135 workout exercises, 421 workout sets, 17 cardio records.
- Date range: 2026-05-14 to 2026-06-29.

Current cloud Mac recommendation for first signing/TestFlight upload:

1. MacinCloud Dedicated Server Plan as first choice for beginner-friendly remote Mac + Xcode.
2. Scaleway Mac mini M2/M4 as cheaper but more technical option.
3. Avoid AWS EC2 Mac for first upload because it is more complex and has a 24-hour minimum allocation.

## Hard Rules

- Keep Tailwind on v3. Do not migrate to Tailwind v4.
- Do not add a backend.
- Do not add authentication.
- Keep data local-first with IndexedDB through Dexie.
- Do not commit local export/backup artifacts unless explicitly requested.
- Use `apply_patch` for manual file edits.
- If the work touches UI, verify in the in-app browser after implementation.

## Current Git Status Notes

At handoff time, source should be clean except this handoff file if it has not been committed.

Known local backup/settings artifacts are unrelated to the app source. Leave them alone unless the user explicitly asks to use, restore, remove, or commit them:

- Deleted in working tree: `setgo-settings-2026-05-28T03-37-11.json`
- Untracked: `setgo-backup-2026-05-28T03-37-05.json`
- Untracked: `setgo-backup-2026-06-02T05-15-51.json`
- Untracked: `setgo-settings-2026-06-02T05-15-31.json`

## Important Environment Note

Codex in-app browser control previously failed with:

```text
CreateProcessAsUserW failed: 5
```

Root cause found: the Codex `cua_node` runtime directory did not grant read/execute permission to `JASON\CodexSandboxUsers`.

Applied fix:

```powershell
icacls "C:\Users\NB-24021500\AppData\Local\OpenAI\Codex\runtimes\cua_node\789504f803e82e2b" /grant "JASON\CodexSandboxUsers:(OI)(CI)RX" /T
```

If a future Codex update downloads a new `cua_node` runtime folder, the same permission issue may recur. Apply the same `CodexSandboxUsers` read/execute grant to the new runtime folder.

## Recently Completed Work

### Phases 4-9 (4-tab IA rework through workout logging polish) — DONE and pushed

The 4-tab information-architecture rework and the follow-on phases are all committed and pushed:

- `a4d50c1` Phase 4/5: rework bottom navigation to the 4-tab model (`오늘 / 계획 / 기록 / 더보기`) and integrate records/stats pages
- `eb12fc7` Phase 6: routine deletion, copy renaming UX, warning banner, routine summaries
- `ac09485` Phase 7: plan calendar UX (past/today/future distinction, simplified chip assignment, records/routines navigation)
- `dd8ac38` Phase 8: exercise history lookup, PR badges, 5-session volume trend
- `295b78f` Phase 9: workout logging colors, input focus behavior, scroll/focus stability on set add

This supersedes the earlier "start with Phase 4" guidance below — Phase 4 is no longer the next step.

### Earlier Hevy-benchmarking round

The earlier Hevy-benchmarking work delivered the first major round of improvements:

- Fast workout logging
  - Previous set chips
  - Copy previous set
  - Copy all previous sets
  - Per-set previous value apply button
  - Faster weight/reps/RIR editing
  - Better complete/completed state distinction
  - Exercise-level rest timer
  - Session summary before finishing
  - Save routine from workout
- Routine and schedule management
  - Planned rest seconds in routines
  - Duplicate active routine
  - Recent routine quick starts on Today
  - Calendar selected-date add flow for Free, Run, and Routine workouts
- UI contrast fixes from UAT
  - Stats next-week plan contrast
  - Finish summary contrast
  - Complete button state contrast
  - Previous set chip contrast
  - Previous value apply contrast
- UAT and deployment
  - `npm.cmd run test -- --run`: 80 tests passed
  - `npm.cmd run build`: passed
  - In-app browser UAT: passed after permission fix
  - Latest deployment: success

## Current Product Assessment

Approximate goal completion: ~85%.

The 4-tab IA (`오늘 / 계획 / 기록 / 더보기`) is now in place and the workout-logging / routine / records flows are built out through Phase 9. The remaining work is mostly QA hardening, release-loop safety, and commercial-app polish rather than net-new features.

The bottom navigation is the now-shipped 4-tab model:

```text
오늘 / 계획 / 기록 / 더보기
```

- `오늘`: daily action hub.
- `계획`: future schedule and routine planning.
- `기록`: past performance, actuals, stats, and history.
- `더보기`: management tools such as routines, exercise library, backup/export, language.

## Next Development Plan

### Phase 4: Bottom Navigation 4-Tab Rework

Goal: make `오늘 / 계획 / 기록 / 더보기` the new app skeleton.

Tasks:

- Replace bottom navigation labels and routes with `오늘 / 계획 / 기록 / 더보기`.
- Merge existing `실적` and `통계` entry points into `기록`.
- Rename/reposition existing `설정` as `더보기`.
- Move management entries into `더보기`:
  - 루틴
  - 운동 라이브러리
  - 운동 사이클 계획
  - 내보내기/가져오기
  - 언어
- In `기록`, provide entry points for:
  - 실적 캘린더
  - 선택 주간 요약
  - 선택 날짜 기록
  - 통계/분석
  - 운동별 히스토리
- Re-check back behavior from subpages.
- Update locale strings and icons.

Success criteria:

- Bottom nav has exactly 4 items.
- Daily workflow fits naturally in `오늘 / 계획 / 기록`.
- Admin/management workflow sits under `더보기`.
- Existing functionality remains reachable.

### Phase 5: Records Tab Integration

Goal: combine actuals and stats into one coherent `기록` tab.

Tasks:

- Start with existing Actuals calendar as the top-level record view.
- Add compact stats/analysis sections below or in segmented subviews.
- Keep selected-date workout records visible and editable.
- Add a clear "운동 추가" flow for missing records.
- Remove or hide the old separate Stats bottom tab.
- Decide whether `기록` uses sections, segmented control, or collapsible panels.

Success criteria:

- Past workout lookup, edit/delete, weekly summary, and stats all live in `기록`.
- The user no longer has to guess between `실적` and `통계`.

### Phase 6: Routine Management Completion

Goal: make `더보기 > 루틴` complete enough for real use.

Tasks:

- Add routine copy deletion.
- Improve routine rename UX.
- Add active/archived/deleted state, or at minimum safe delete.
- Add delete confirmation.
- Show routine summary:
  - routine day count
  - total exercise count
  - schedule/cycle summary
- After duplicating, make "editing copied routine" state obvious.

Success criteria:

- User can create, duplicate, rename, edit, activate, and remove a routine without leaving the app.

### Phase 7: Plan Calendar UX Strengthening

Goal: keep `계획` focused on future planning.

Tasks:

- Better visual distinction for past/today/future dates.
- Make future plan changes more obvious.
- Keep past record creation tied naturally to `기록`.
- Simplify assignment for routine/run/rest/free.
- Add weekly plan/cycle summary.
- Clarify button states when routine is unavailable.

Success criteria:

- `계획` answers "what will I do next?" and does not feel like a mixed actuals screen.

### Phase 8: Exercise History and PR

Goal: show progress while logging.

Tasks:

- Add exercise-specific history view.
- Show recent sessions for the exercise.
- Show best weight, best volume, estimated 1RM.
- Show recent 5-session trend.
- Add PR badge/highlight.
- Link from workout logging rows to exercise history.

Success criteria:

- While logging, user can quickly answer "am I improving compared with last time?"

### Phase 9: Workout Logging Polish

Goal: bring workout entry closer to Hevy's speed and clarity.

Tasks:

- Finalize colors for `준비`, `Hard`, `완료`, `완료됨`.
- Clarify copy previous values vs copy previous set chips.
- Improve focus movement after edits.
- Stabilize scroll after set add/delete.
- Re-check bottom fixed action area.
- UAT at roughly 390px mobile width.

Success criteria:

- One-hand workout logging feels fast, readable, and hard to mis-tap.

### Phase 10: QA and Release Loop

Goal: make future changes safer.

Tasks:

- Add tests for 4-tab routing/navigation.
- Add tests for routine duplicate/delete.
- Add tests for calendar add flows.
- Add tests around records/stats integration.
- Keep browser UAT checklist updated.
- Decide how to treat local backup/settings JSON artifacts.

Success criteria:

- Development -> tests -> browser UAT -> deploy can repeat cleanly.

## Recommended Next Session Opening Steps

1. Read:

```powershell
Get-Content -Raw AGENTS.md
Get-Content -Raw NEXT_SESSION.md
git status --short --branch
git log --oneline --decorate -5
```

2. Confirm local app:

```powershell
cd C:\Users\NB-24021500\Projects\SetGo\setgo-starter
npm.cmd run dev
```

Use `http://127.0.0.1:5173/` if available. If the port is occupied, inspect the current server before starting a second one.

3. Start with Phase 10 (QA and Release Loop). Phases 4-9 are already done and pushed.

The information architecture and feature build-out are in place. The next priority is making future changes safe to ship.

4. Suggested next focus:

- Phase 10: add tests for 4-tab routing/navigation, routine duplicate/delete, calendar add flows, and records/stats integration.
- Bundle size: `index-*.js` is ~576 kB (gzip ~163 kB), over Vite's 500 kB warning. Consider `import()` code-splitting for the heavier screens (records/stats, exercise history).
- Keep the browser UAT checklist current and decide how to treat the local backup/settings JSON artifacts.
- Run tests/build and verify in the in-app browser after each slice.

## Useful Commands

```powershell
cd C:\Users\NB-24021500\Projects\SetGo\setgo-starter
npm.cmd run dev
npm.cmd run test -- --run
npm.cmd run build
git status --short --branch
git log --oneline --decorate -5
```

## Suggested Opening Prompt For New Session

Continue SetGo development from `C:\Users\NB-24021500\Projects\SetGo\setgo-starter`.
Read `AGENTS.md`, `README.md`, and `NEXT_SESSION.md` first.
Latest source work completed Phases 4-9 (4-tab IA, routine management, plan calendar UX, exercise history/PR, workout logging polish) and pushed `295b78f`.
The next goal is Phase 10: QA and release-loop hardening (navigation/routine/calendar tests), plus bundle code-splitting.
Keep Tailwind v3, no backend/auth, local-first Dexie only.
Do not commit or delete local backup/settings JSON artifacts.
Run tests/build and verify in the in-app browser after each slice.
