# SetGo Mobile Beta Release

## Release Candidate

SetGo mobile beta is prepared as a local-first PWA release candidate.

## Verification Completed

- `npm run build`
- `npm run test -- --run`
- `npm ls tailwindcss`
- Browser render smoke check for Today shell and primary actions
- Browser render smoke check for Settings, Weekly Plan, Exercise Library, and Calendar labels
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
4. Go to `설정`.
5. Confirm `루틴 / 운동 / 주간 계획` tabs.
6. Pick or reset a routine template.
7. Confirm Today shows the planned routine and planned exercises.
8. Start or continue a workout.
9. Edit set weight/reps/RIR and confirm save feedback.
10. Complete or skip the workout.
11. Confirm Calendar status.
12. Export Markdown and download a JSON backup.
13. Turn off network and relaunch to confirm the PWA shell opens.

## Known Beta Risks

- All workout data is local to the browser profile.
- Clearing Safari website data removes SetGo data.
- JSON restore replaces all current local data after confirmation.
- Physical iPhone safe-area, keyboard, and Home Screen behavior still need final device confirmation.
