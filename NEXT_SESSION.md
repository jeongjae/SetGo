# SetGo Next Session Handoff

## Current State

- Project path: `C:\Users\NB-24021500\Projects\SetGo\setgo-starter`
- App: Vite React TypeScript PWA, local-first, Dexie/IndexedDB only.
- GitHub repo: `https://github.com/jeongjae/SetGo.git`
- Latest pushed commit: `0da4236 Lock mobile layout to vertical scroll`
- Development URL used in Codex browser: `http://127.0.0.1:5173/`
- Deployment target: GitHub Pages.

## Important Rules

- Keep Tailwind on v3.4.17. Do not migrate to Tailwind v4 yet.
- Do not add a backend.
- Do not add authentication.
- Keep data local-first with IndexedDB through Dexie.
- Do not commit local export/backup artifacts unless explicitly requested.

## Current Git Status Notes

The app source is clean after the latest push. These local files are intentionally untracked user/export artifacts:

- `setgo-backup-2026-05-19T06-58-52.json`
- `setgo-exercises-2026-05-19T06-25-38.csv`
- `setgo-settings-2026-05-19T06-25-23.json`

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

## Verification Already Done

Latest checks before handoff:

```powershell
npm.cmd test -- --run
npm.cmd run build
```

Both passed after the latest source changes.

Browser checks were also done for:

- Today page load.
- Workout journal entry.
- Add exercise search.
- Search for `Shoulder`, confirming shoulder-related exercises appear.

## Suggested Next Development Order

1. Continue P2 polishing around workout logging usability.
2. Review iPhone PWA behavior after GitHub Pages deploy:
   - horizontal movement should be reduced or gone.
   - if still present, inspect individual wide elements such as tables, `<pre>`, SVG charts, or chip rows.
3. Improve past workout edit/add flow from Calendar.
4. Complete Stats i18n for all labels and AI comment text.
5. Decide how AI comments should work long term:
   - current version is local deterministic summary only.
   - mobile works offline because it does not call an API.
   - future improvement can add optional user-triggered external AI export/prompt flow.
6. Add stronger regression coverage for:
   - routine exercise edits propagating to new workouts.
   - existing in-progress workouts not being unexpectedly overwritten.
   - CSV import validation.
   - calendar selected-date workout creation/editing.

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
The latest pushed commit is `0da4236`.
Keep Tailwind v3, no backend/auth, local-first Dexie only.
Do not commit the untracked backup/CSV files.
Proceed with the next P2 polishing item and verify with tests/build/browser.
