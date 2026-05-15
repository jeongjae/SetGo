# SetGo

SetGo is a local-first workout logging PWA for strength training and manual cardio logging.

## Mobile Beta Scope

- Target device: iPhone Safari / Home Screen PWA
- Storage: local IndexedDB through Dexie
- Backend: none
- Authentication: none
- Network dependency after install: none for the app shell

## Beta Features

| Area | Feature |
|---|---|
| Today | Today's routine, planned exercises, last workout, quick actions |
| Exercise library | Korean/English names, descriptions, multi-category tags |
| Routine | 2-day, 3-day, push/pull/assist, and 4-day templates |
| Schedule | Weekly plan plus date-specific calendar overrides |
| Workout log | Set-level weight, reps, RIR, completion, notes, previous-set copy |
| Cardio | Manual indoor/outdoor cardio entries |
| Stats | Recent 30-day volume and top exercises |
| Export | Korean/English Markdown export and JSON backup/restore |
| PWA | Manifest, service worker, offline shell, install/update status |

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

## Test

```bash
npm run test -- --run
```

## Build

```bash
npm run build
```

## Mobile Beta Checklist

1. Run `npm run build`.
2. Run `npm run test -- --run`.
3. Open the Vite URL in desktop browser and confirm Today loads.
4. From Today, open Settings and confirm `루틴 / 운동 / 주간 계획` tabs.
5. Start or continue a workout, edit a set, and confirm local save feedback.
6. Complete or skip a workout and confirm Calendar status.
7. Export Markdown and create a JSON backup.
8. Open the app on iPhone Safari using the local network URL.
9. Add SetGo to Home Screen.
10. Relaunch from Home Screen and confirm layout, keyboard input, and offline shell.

## Out Of Beta

- Cloud sync
- Authentication
- Apple Watch / HealthKit import
- Native iOS wrapper
