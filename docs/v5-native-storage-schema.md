# SetGo v5 Native Storage Schema

## Purpose

This document defines the first native storage contract for SetGo v5.

The contract mirrors the current Dexie backup snapshot so that:

- existing PWA JSON backups can migrate into the native app;
- native app updates can preserve SQLite data without manual restore;
- future coaching features can rely on stable workout, set, cardio, and recommendation history.

The executable schema contract lives in `src/storage/nativeSchema.ts`.
The repository adapter spike lives in `src/storage/nativeSqliteRepository.ts`.

## Version

- Native schema version: `1`
- Source data model: current SetGo backup snapshot plus Dexie v8 indexes
- Storage target: SQLite-compatible tables behind the SetGo repository adapter

Schema changes must increment the version and include migration tests.

## Encoding Rules

| Domain type | Native storage |
|---|---|
| string / enum | `TEXT` |
| number | `INTEGER` or `REAL` |
| boolean | `INTEGER` (`0` or `1`) |
| date / datetime | ISO-like `TEXT` matching current app values |
| array / object | JSON serialized into `TEXT` |
| optional field | nullable column |

The app code should deserialize rows back into the existing TypeScript domain types at the repository boundary.

## Table Mapping

| Backup snapshot key | Native table |
|---|---|
| `exercises` | `exercises` |
| `routines` | `routines` |
| `routineDays` | `routine_days` |
| `weeklySchedules` | `weekly_schedules` |
| `routineCyclePlanItems` | `routine_cycle_plan_items` |
| `calendarPlanOverrides` | `calendar_plan_overrides` |
| `routineExercisePlans` | `routine_exercise_plans` |
| `workoutSessions` | `workout_sessions` |
| `workoutExercises` | `workout_exercises` |
| `workoutSets` | `workout_sets` |
| `cardioRecords` | `cardio_records` |

## JSON Columns

The first native schema intentionally keeps only high-variance payloads as JSON:

- `exercises.stageTags`
- `exercises.categoryTags`
- `workout_sessions.recommendationSnapshot`

This keeps migration simple while preserving v4/v5 recommendation evidence.

## Index Policy

Version 1 carries forward Dexie v8 lookup paths for:

- active routines and routine dates;
- routine day and weekly schedule resolution;
- calendar overrides and cycle plan resolution;
- workout session lookup by date/routine/status;
- workout exercise and set lookup by parent IDs;
- cardio lookup by session/environment/order.

It also adds native-only cardio import indexes:

- `source + externalId` for imported workout duplicate detection;
- `startedAt` for manual/imported activity matching;
- `activityType` for future HealthKit-style filtering.

## Migration Rules

1. Import must validate all required IDs before writing.
2. Import must preview counts per snapshot key.
3. Import must write all tables in one transaction.
4. Import must convert booleans to `0`/`1` and JSON fields to strings at the repository boundary.
5. Import must preserve recommendation snapshots on completed workouts.
6. Import must treat missing legacy `routineCyclePlanItems` and `calendarPlanOverrides` arrays as empty arrays.
7. Import must report, not silently discard, incompatible rows.

## Next Implementation Step

Bind the SQLite adapter spike to an actual Capacitor/iOS SQLite driver:

- execute `createNativeSchemaSql()` through the native driver;
- insert and read one routine, one workout session, one workout exercise, one set, and one cardio record through `createNativeSqliteDataRepository()`;
- verify the record survives app relaunch in the native shell.

The current spike already verifies SQL generation, backup snapshot writes, backup snapshot reads, JSON serialization, boolean serialization, and settings-only replace behavior using a fake SQLite driver.
