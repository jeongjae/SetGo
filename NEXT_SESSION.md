# SetGo Next Session Handoff

## Current State

- Project path: `C:\Users\NB-24021500\Projects\SetGo\setgo-starter`
- App: Vite React TypeScript PWA, local-first, Dexie/IndexedDB only.
- GitHub repo: `https://github.com/jeongjae/SetGo.git`
- Current branch: `main`
- Latest pushed commit before this handoff update: `3fe9b8d Improve previous value contrast`
- Latest deploy verification: GitHub Actions run `27587634861` completed with `success`.
- Local development URL used in the last UAT: `http://127.0.0.1:5173/`
- Deployment target: GitHub Pages.

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

The recent Hevy-benchmarking work has delivered the first major round of improvements:

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

Approximate goal completion: 70%.

SetGo now has a usable MVP-level workout logging and routine flow. The remaining work is not just more features; it is mostly information architecture, management UX, and commercial-app polish.

The next strategic direction is to move from 5 bottom tabs to 4:

```text
오늘 / 계획 / 기록 / 더보기
```

Rationale:

- `오늘`: daily action hub.
- `계획`: future schedule and routine planning.
- `기록`: past performance, actuals, stats, and history.
- `더보기`: management tools such as routines, exercise library, backup/export, language.

This replaces the current scattered feeling of `오늘 / 계획 / 실적 / 통계 / 설정`.

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

3. Start with Phase 4, not Phase 6.

The 4-tab structure is the foundation. Do not spend the next session improving old `실적 / 통계 / 설정` navigation before the information architecture is changed.

4. Suggested first implementation slice:

- Update navigation model/types in `src/app/App.tsx`.
- Rename the Settings-facing screen to More at the navigation level.
- Add a new `Records` view that initially wraps or reuses existing Actuals/Stats content.
- Keep old page components if that reduces risk; first change the user-facing structure.
- Run tests/build.
- Verify bottom nav in the in-app browser.

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
Latest source work completed the Hevy-style quick logging/routine quick-start improvements and deployed `3fe9b8d`.
The next goal is Phase 4: convert bottom navigation to `오늘 / 계획 / 기록 / 더보기`.
Keep Tailwind v3, no backend/auth, local-first Dexie only.
Do not commit or delete local backup/settings JSON artifacts.
Start by changing the app information architecture, then run tests/build and verify in the in-app browser.
