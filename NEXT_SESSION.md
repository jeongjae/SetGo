# SetGo Next Session Handoff

## Current State

- Project path: `C:\Users\NB-24021500\Projects\SetGo\setgo-starter`
- App: Vite React TypeScript PWA, local-first, Dexie/IndexedDB only.
- GitHub repo: `https://github.com/jeongjae/SetGo.git`
- Current branch: `main`
- Latest pushed commit: `5c84064 Restore CSV save picker`
- Latest deployed verification URL: `https://jeongjae.github.io/SetGo/?verify=5c84064`
- Local development URL currently in use: `http://localhost:5174/`
- Deployment target: GitHub Pages.

## Hard Rules

- Keep Tailwind on v3.4.17. Do not migrate to Tailwind v4 yet.
- Do not add a backend.
- Do not add authentication.
- Keep data local-first with IndexedDB through Dexie.
- Do not commit local export/backup artifacts unless explicitly requested.
- Use `apply_patch` for manual file edits.

## Current Git Status Notes

Source is clean relative to `origin/main` except this handoff file if it has not been committed.

These local files are intentionally untracked user/export artifacts. Leave them alone unless the user explicitly asks to use or remove them:

- `setgo-backup-2026-05-20T08-30-04.json`
- `setgo-backup-2026-05-20T08-54-52.json`
- `setgo-backup-2026-05-22T07-11-39.json`
- `setgo-exercises-2026-05-20T08-57-35.csv`
- `setgo-exercises-2026-05-21T10-43-35.csv`
- `setgo-exercises-2026-05-22T07-12-01.csv`
- `setgo-exercises-2026-05-28T02-48-00.csv`
- `setgo-exercises-2026-05-28T03-29-38.csv`
- `setgo-settings-2026-05-20T08-57-27.json`
- `setgo-settings-2026-05-22T07-11-56.json`
- `setgo-settings-2026-05-28T03-26-30.json`

## Recent Completed Work

- Implemented mockup-aligned bottom navigation across Today, Calendar, Stats, and Settings.
- Split Settings into shallow entries for Routine, Exercise, Weekly Plan, Language, and Export/Import.
- Reworked Routine management around saved routines, creation, draft editing, Save/Cancel, and active routine selection.
- Reworked Exercise Library toward search/edit and add flows.
- Added weekly plan date range and Calendar review flow.
- Added Calendar historical workout edit mode so completed records can keep completed status while changing assignment, exercises, sets, and cardio.
- Fixed weekly plan Calendar review visibility.
- Condensed the Statistics page into a shorter summary/details structure.
- Fixed CSV export 0-byte path twice:
  - `768e38e`: delayed `Blob URL` revocation and added CSV serialization tests.
  - `3accb36`: temporarily forced CSV through download fallback.
  - `5c84064`: restored CSV save picker while writing CSV contents as text instead of a `Blob`.

## Current Export/Import Status

Latest intended behavior on `?verify=5c84064`:

- Full JSON backup: uses save picker when available, writes JSON text.
- Settings JSON backup: uses save picker when available, writes JSON text.
- CSV export: uses save picker when available, writes CSV text with UTF-8 BOM.
- CSV fallback: if save picker is unavailable or cancelled, uses `<a download>` and delayed `URL.revokeObjectURL`.
- Full JSON restore: file input accepts `application/json`.
- Settings JSON restore: file input accepts `application/json`.
- CSV import: file input accepts `.csv,text/csv`.
- Markdown copy: uses browser clipboard.

Important browser automation limitation:

- Codex in-app browser does not support actual file downloads, native save dialogs, or virtual clipboard reads.
- Therefore, file size and save-picker UI must be verified manually in a normal browser/PWA.
- The latest user-facing issue before handoff: user noticed CSV save folder popup missing on `?verify=3accb36`; fixed and deployed as `?verify=5c84064`.

## Verification Already Done

Latest checks passed:

```powershell
npm.cmd test -- --run
npm.cmd run build
```

Current test count: 51 passing.

Latest GitHub Actions deploy:

- Run: `26552649800`
- Commit: `5c84064`
- Conclusion: success

Browser checks done on latest deploy:

- `https://jeongjae.github.io/SetGo/?verify=5c84064` loads.
- Settings screen opens.
- Export/Import screen opens.
- CSV export button is visible.

Browser checks done on previous deploy `?verify=3accb36`:

- Export/Import screen opened.
- Full backup, settings backup, and CSV export buttons clicked without page crash.
- Success messages appeared for the export buttons.
- Restore/import input `accept` attributes were confirmed.

## Known Follow-Up / Manual UAT Needed

1. In a normal browser, not Codex in-app browser, open:

   `https://jeongjae.github.io/SetGo/?verify=5c84064`

2. Go to Settings -> Export/Import -> CSV export.

3. Confirm:

   - Native save-location popup appears.
   - Saved CSV file is not 0 bytes.
   - CSV opens with headers:
     `id,nameKo,nameEn,categoryTags,stageTags,description,icon,isActive`
   - Korean text is readable in Excel/Numbers/Sheets.

4. Test other export/import paths manually:

   - Full JSON backup creates a non-empty JSON.
   - Settings JSON backup creates a non-empty JSON.
   - Full JSON restore asks for confirmation and restores data.
   - Settings restore asks for confirmation and does not delete existing workout logs.
   - CSV import updates exercise fields and shows validation issues for bad rows.
   - Markdown copy works in the installed PWA and mobile Safari/Chrome.

## Useful Commands

```powershell
cd C:\Users\NB-24021500\Projects\SetGo\setgo-starter
npm.cmd run dev
npm.cmd test -- --run
npm.cmd run build
git status --short --branch
git log --oneline --decorate -6
```

## Suggested Opening Prompt For New Session

Continue SetGo development from `C:\Users\NB-24021500\Projects\SetGo\setgo-starter`.
Read `AGENTS.md`, `README.md`, and `NEXT_SESSION.md` first.
Latest deployed commit is `5c84064` at `https://jeongjae.github.io/SetGo/?verify=5c84064`.
Keep Tailwind v3, no backend/auth, local-first Dexie only.
Do not commit or delete untracked backup/CSV artifacts.
Start by manually verifying the Export/Import save-picker and file-size behavior in a normal browser/PWA, then continue with the next UI/UX issue the user reports.
