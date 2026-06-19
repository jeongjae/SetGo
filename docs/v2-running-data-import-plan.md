# SetGo v2 Running And Data Import Plan

## Goal

Phase 5 should let strength training and running coexist without making Today or Workout mode confusing.

The immediate goal is not a full Apple Health integration. The immediate goal is a clean product and data boundary:

- manual running records stay lightweight
- planned running can appear as today's workout type
- imported activities can be represented without damaging local workout history
- SetGo can later add a native bridge or file import without rewriting workout records

## Current State

Implemented:

- workout sessions support `entryKind: running`
- Today can recommend running as a workout type
- Workout mode can create and edit draft cardio records
- completed running records are counted in workout summaries
- strength and cardio records share a workout session date and status

Known gaps:

- no structured running target exists yet
- no imported activity provenance exists yet
- manual cardio records do not distinguish planned versus imported
- no duplicate detection exists for imported workouts
- Apple Health / Watch import requires a separate technical decision

## Data Model Direction

Add import-friendly fields without making manual logging heavier:

- `CardioRecord.source`: `manual | imported`
- `CardioRecord.externalId`: stable source activity id when available
- `CardioRecord.sourceName`: readable source label such as Apple Health, Garmin, Strava, CSV
- `CardioRecord.importedAt`: timestamp for imported records
- `CardioRecord.durationSeconds`: explicit duration, so imported records do not depend only on start/end parsing
- `CardioRecord.activityType`: `running | walking | cycling | elliptical | other`

Add planned running targets separately from actual records:

- target distance
- target duration
- target pace range
- target effort or RPE
- optional note

## Import Strategy

Use this order:

1. Manual running improvements
2. File-based import proof of concept
3. Native bridge decision
4. Apple Health / Watch integration if the native path is justified

File import should support a narrow, testable path first:

- CSV or JSON activity export
- one activity per row/object
- date, type, distance, duration, start time
- duplicate detection by source and external id, or by date/time/type/distance fallback

## UX Direction

Today:

- show running as a first-class recommended workout type
- do not mix running targets into strength exercise cards
- keep the primary action as Start or Continue

Workout mode:

- running-only sessions should open a compact cardio-first layout
- mixed sessions should keep cardio below strength unless the workout was started as running
- imported activities should be clearly read-only by default, with an edit option

History:

- imported activities should be searchable and removable
- source/provenance should be visible in details
- duplicate warnings should be shown during import, not after records are written

## Acceptance Criteria

- manual running records can be logged without routine setup
- planned running can start from Today without strength exercise noise
- imported activity records can be stored with provenance
- duplicate imported activities are skipped or presented for review
- strength recommendations ignore imported running unless a recovery/load rule explicitly uses it
