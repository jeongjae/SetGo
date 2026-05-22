# SetGo Next Session Handoff

## Current State

- Project path: `C:\Users\NB-24021500\Projects\SetGo\setgo-starter`
- App: Vite React TypeScript PWA, local-first, Dexie/IndexedDB only.
- GitHub repo: `https://github.com/jeongjae/SetGo.git`
- Latest pushed commit before the local cleanup pass: `cdda6d8`
- Latest local commits:
  - `2233044 Confirm deleting logged cardio`
  - `e2b9aee Confirm deleting logged workout sets`
  - `b478a8e Confirm deleting logged exercises`
  - `8938d12 Reveal added workout exercise`
  - `c7a85a3 Fix workout exercise progress count`
  - `7293e6c Polish mobile workout UI shell`
- Development URL used in Codex browser: `http://localhost:5174/`
- Deployment target: GitHub Pages.

## Important Rules

- Keep Tailwind on v3.4.17. Do not migrate to Tailwind v4 yet.
- Do not add a backend.
- Do not add authentication.
- Keep data local-first with IndexedDB through Dexie.
- Do not commit local export/backup artifacts unless explicitly requested.

## Current Git Status Notes

The app source cleanup pass is committed locally. These local files are intentionally untracked user/export artifacts:

- `setgo-backup-2026-05-20T08-30-04.json`
- `setgo-backup-2026-05-20T08-54-52.json`
- `setgo-backup-2026-05-22T07-11-39.json`
- `setgo-exercises-2026-05-20T08-57-35.csv`
- `setgo-exercises-2026-05-21T10-43-35.csv`
- `setgo-exercises-2026-05-22T07-12-01.csv`
- `setgo-settings-2026-05-20T08-57-27.json`
- `setgo-settings-2026-05-22T07-11-56.json`

Leave them alone unless the user asks to use or remove them.

## Recent Completed Work

- Fixed mobile horizontal shake by locking app-level horizontal overflow in `src/styles.css`.
- Added shared exercise finder component:
  - `src/components/ExerciseFinder.tsx`
  - Used in workout add/replace and routine setup add flows.
- CSV exercise import validation errors are now shown persistently on the export/restore page.
- Workout start from Today routine selection was fixed.
- Calendar now preserves selected date after opening/editing a workout.
- Workout stats page was expanded with KPI, charts, muscle analysis, performance table, warnings, and local rule-based AI comment.
- Export/restore includes workout logs and settings data paths.
- A follow-up viewport polish pass is keeping page headers/actions fixed while the page body scrolls inside the PWA shell.
- External font loading was removed so the app shell remains network-independent after install.
- Tailwind now registers the intermediate slate/accent shades and spacing tokens used by the premium mobile UI pass.
- Backdated Calendar workout records now show their date in the workout header instead of a misleading multi-day live timer.
- Stats trend, warning, target-range, and local analysis summary text now use i18n message templates.
- Workout regressions now cover first backdated Calendar session creation and routine-plan values seeding into new workout logs.
- Exercise CSV import validation now has direct coverage for missing columns and aggregated row-level issues.
- Calendar start/edit button arguments now have direct regression coverage for selected-date workouts.
- Workout start selection now has direct coverage for resuming in-progress records versus creating explicit new Calendar records.
- Workout rest timer surfaces now use the same remaining-time countdown formatting.
- Cardio-only workout sessions can be completed once at least one cardio record exists.
- Strength workouts now require at least one completed set before the workout completion action unlocks.
- Workout header exercise progress now counts only exercises whose sets are all complete.
- Newly added workout exercises open immediately and scroll into view for logging.
- Deleting logged workout exercises, sets, or cardio entries now asks for confirmation while empty placeholders still delete quickly.

## Verification Already Done

Latest checks before handoff:

```powershell
npm.cmd test -- --run
npm.cmd run build
```

Both passed again during the May 22 desktop UAT and readability-density UI pass.

Browser checks were also done for:

- May 22 desktop UAT:
  - Today loads after a fresh browser reload.
  - Routine Setup opens and exposes the `루틴`, `운동`, and `주간 계획` tabs.
  - Calendar skip status was round-tripped on the May 21 in-progress session and restored with `스킵 취소`.
  - A temporary bench press exercise was added to the May 21 free workout, a `42.5 kg x 8 @ RIR 2` set was logged, save-time feedback and the rest timer appeared, and the temporary exercise was removed again.
  - A follow-up empty-workout check confirmed that a placeholder strength exercise alone no longer unlocks workout completion; logging a set unlocks it.
  - Markdown export copied to the clipboard and full JSON backup reported a browser download start.
  - Stats empty state still renders when there are no completed workout records.
- May 22 readability-density UI pass:
  - Today and Workout were checked at mobile width after brightening the graphite palette, enlarging input labels, and tightening card spacing.
  - Workout set entry, exercise addition finder, and fixed footer were checked with visible set rows.
  - Calendar, empty Stats, Export, Routine Setup routine tab, exercise library tab, and weekly plan tab were checked in the in-app browser.
- Today page load and fixed-shell height metrics.
- Routine Setup body scrolling inside the fixed header shell.
- Calendar date detail scrolling inside the fixed month view.
- Workout entry from Calendar, add-exercise finder, fixed workout footer, rest countdown render, cardio-only completion enable/cleanup, added-exercise reveal/cleanup, and empty set/exercise delete cleanup.
- Stats empty state and Export long-content scrolling.

## Suggested Next Development Order

1. Continue P2 polishing around workout logging usability.
2. Run the remaining real-device UAT on iPhone Safari / Home Screen after GitHub Pages deploy:
   - horizontal movement should be reduced or gone.
   - if still present, inspect individual wide elements such as tables, `<pre>`, SVG charts, or chip rows.
   - verify keyboard entry, Add to Home Screen relaunch, and offline shell from the installed PWA.
3. Decide how AI comments should work long term:
   - current version is local deterministic summary only.
   - mobile works offline because it does not call an API.
   - future improvement can add optional user-triggered external AI export/prompt flow.
4. Continue expanding regression coverage when a P2 polish item touches a shared workout or import path.

## Useful Commands

```powershell
cd C:\Users\NB-24021500\Projects\SetGo\setgo-starter
npm.cmd run dev
npm.cmd test -- --run
npm.cmd run build
git status --short
git log --oneline -5
```

## Suggested Opening Prompt For New Session

Continue SetGo development from `C:\Users\NB-24021500\Projects\SetGo\setgo-starter`.
Read `AGENTS.md`, `README.md`, and `NEXT_SESSION.md` first.
The latest local commit is `2233044`.
Keep Tailwind v3, no backend/auth, local-first Dexie only.
Do not commit the untracked backup/CSV files.
Proceed with the next P2 polishing item and verify with tests/build/browser.
