# SetGo Mobile Beta Release

## Release Candidate

SetGo mobile beta is prepared as a local-first PWA release candidate for the v3 app structure.

## Verification Completed

- `npm run build`
- `npm run test -- --run`
- `npm ls tailwindcss`
- Browser render smoke check for Today shell and primary actions
- Browser render smoke check for Today, Routines, History, Insights, More, Workout, and Export surfaces
- Routine template localization and muscle-group regression tests
- Static check for removed stale previous-summary error path
- README and MVP status updated for beta testers

## Verified Versions

- Tailwind CSS: `3.4.17`
- Service worker cache: `setgo-shell-v7`

## Beta Tester Flow

1. Open SetGo in iPhone Safari using the local network dev URL or hosted beta URL.
2. Add to Home Screen.
3. Open from Home Screen.
4. Confirm the bottom navigation shows `Today / Routines / History / Insights / More`.
5. Confirm Today shows the recommended action and any in-progress workout.
6. Open Routines, select or activate a routine, and confirm routine days and exercise plans are reachable.
7. Start or continue a workout.
8. Edit set weight/reps/RIR, toggle warmup/Hard, copy previous values, and confirm save feedback.
9. Complete or skip the workout.
10. Confirm the session is visible in History.
11. Confirm Insights renders trends and exercise performance.
12. Open More, export Markdown, download a JSON backup, and review local-data guidance.
13. Turn off network and relaunch to confirm the PWA shell opens.

## Known Beta Risks

- All workout data is local to the browser profile.
- Clearing Safari website data removes SetGo data.
- JSON restore replaces all current local data after confirmation.
- Physical iPhone safe-area, keyboard, and Home Screen behavior still need final device confirmation.
