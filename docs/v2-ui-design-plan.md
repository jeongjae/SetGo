# SetGo v2 UI Design Plan

This document defines the intended v2 UI direction before full implementation.

Design contract:

- Follow Apple HIG strictly.
- Optimize for iPhone Safari / Home Screen PWA.
- Keep workout logging faster than planning, browsing, or analysis.
- Prefer standard iOS mental models over decorative web-app patterns.

Related documents:

- `docs/v2-development-plan.md`
- `docs/v2-phase0-baseline-audit.md`
- `docs/v2-apple-hig-design-rules.md`

## Global App Structure

Target tabs:

- Today
- Routines
- History
- Insights
- More

Workout mode is not a tab. It is a focused full-screen task.

```text
┌─────────────────────────┐
│ Today                   │
│                         │
│ [Primary daily action]  │
│ [Secondary context]     │
│                         │
├─────────────────────────┤
│ Today Routines History  │
│ Insights More           │
└─────────────────────────┘
```

## 1. Today

Purpose:

- start or continue the right workout quickly
- show the minimum useful context for today's decision
- avoid turning into a dashboard

Primary state:

```text
┌─────────────────────────┐
│ SetGo             Today │
│ Fri, Jun 19             │
│                         │
│ Continue Upper A        │
│ 2 / 5 exercises done    │
│ 38:12 elapsed           │
│ [ Continue Workout    ] │
│                         │
│ Today's Plan            │
│ Upper A                 │
│ Bench, Row, Press...    │
│                         │
│ Recent Starts           │
│ [Upper A] [Lower B]     │
└─────────────────────────┘
```

HIG rules:

- one visually dominant primary button
- secondary choices below the primary action
- no large explanation text
- no management controls unless directly needed

Implementation notes:

- If in-progress workout exists, `Continue Workout` becomes primary.
- If no workout exists, `Start Workout` becomes primary.
- Routine day override should be a compact selector, not a large planning UI.

## 2. Workout Mode

Purpose:

- record sets with minimum friction
- keep user focused during training
- surface previous/target values at the exact moment of entry

Target layout:

```text
┌─────────────────────────┐
│ < Upper A        42:18  │
│ Saved       3/5 ex 9/16 │
├─────────────────────────┤
│ Bench Press          ⋯  │
│ Last 60kg x 10 RIR2     │
│ ┌─────────────────────┐ │
│ │Set Prev/Target kg reps RIR ✓│
│ │1   60x10      62.5  8  2  ●│
│ │2   60x10      62.5  8  2  ○│
│ │3   57.5x9     60    9  1  ○│
│ └─────────────────────┘ │
│ [+ Set]                 │
│                         │
│ Lat Pulldown         ⋯  │
│ ...                     │
├─────────────────────────┤
│ + Exercise [ Complete ] │
└─────────────────────────┘
```

HIG rules:

- 44px minimum touch targets for primary actions
- stable row height
- no horizontal scroll
- destructive and rare controls tucked away
- completion feedback immediate and reversible

Set row design:

- default row columns: set, previous/target, kg, reps, RIR, done
- tap kg/reps/RIR to edit inline
- row menu contains delete, warmup, drop, failure, copy, notes
- copy previous can be a visible icon only when previous data exists
- suggested values use subtle tint and short reason on tap

Footer:

- primary action: Complete
- secondary action: Add Exercise
- skip is secondary/destructive-adjacent and visually quieter

## 3. Routines

Purpose:

- manage workout templates without polluting active logging
- make quick start obvious
- set rep ranges and progression preferences for v2 recommendations

Target layout:

```text
┌─────────────────────────┐
│ Routines             +  │
│                         │
│ Active Routine          │
│ Upper / Lower 4-day     │
│ [ Start ] [ Edit ]      │
│                         │
│ Routine Days            │
│ Upper A      5 exercises│
│ Lower A      5 exercises│
│ Upper B      4 exercises│
│ Lower B      5 exercises│
│                         │
│ Templates               │
│ 2-day  3-day  4-day     │
└─────────────────────────┘
```

Routine day edit:

```text
┌─────────────────────────┐
│ < Upper A            ⋯  │
│                         │
│ Bench Press             │
│ 4 sets · 6-10 reps      │
│ Rest 120s · +2.5kg step │
│                         │
│ Row                     │
│ 3 sets · 8-12 reps      │
│                         │
│ [ Add Exercise ]        │
└─────────────────────────┘
```

HIG rules:

- use drill-in editing rather than huge all-in-one forms
- keep routine list scannable
- use native-looking rows for exercise plans
- reserve filled buttons for Start/Save

## 4. History

Purpose:

- browse completed workouts
- edit past records
- inspect exercise-level history

Target layout:

```text
┌─────────────────────────┐
│ History                 │
│ [Calendar] [List]       │
│                         │
│ June 2026               │
│ M T W T F S S           │
│ · ● · ● · · ●           │
│                         │
│ Jun 19 · Upper A        │
│ 5 exercises · 16 sets   │
│ 12,480kg · 2 PRs        │
│ [ Edit Workout ]        │
└─────────────────────────┘
```

Exercise history:

```text
┌─────────────────────────┐
│ < Bench Press           │
│ Best 82.5kg · 1RM 101kg │
│                         │
│ Recent Sets             │
│ Jun 19  62.5 x 8 RIR2   │
│ Jun 16  60.0 x 10 RIR2  │
│ Jun 12  60.0 x 9 RIR1   │
│                         │
│ Trend                   │
│ Volume +8% / 4 weeks    │
└─────────────────────────┘
```

HIG rules:

- use segmented controls for calendar/list mode
- make edit actions clear but not dominant
- keep historical records readable as lists before charts

## 5. Insights

Purpose:

- answer what changed and what to adjust
- support future recommendation trust
- stay concise enough to read after a workout

Target layout:

```text
┌─────────────────────────┐
│ Insights                │
│                         │
│ Training Read           │
│ Good                    │
│ This week is stable.    │
│                         │
│ 8-week Load             │
│ ▂▃▄▅▆▅▇█                │
│                         │
│ Muscle Balance          │
│ Chest     10 / 8-14     │
│ Back      7 / 10-16     │
│ Legs      12 / 10-16    │
│                         │
│ Next Actions            │
│ Add back volume.        │
└─────────────────────────┘
```

HIG rules:

- avoid dense dashboard cards
- prefer clear readouts and short actions
- charts must answer a specific question
- recommendation text must be explainable

## 6. More

Purpose:

- hold lower-frequency management tools
- avoid cluttering Today and Workout Mode

Target layout:

```text
┌─────────────────────────┐
│ More                    │
│                         │
│ Exercise Library     >  │
│ Backup & Restore     >  │
│ Export Markdown      >  │
│ Language             >  │
│ Install / Update     >  │
│ About SetGo          >  │
└─────────────────────────┘
```

HIG rules:

- use simple grouped lists
- no decorative panels
- destructive import/restore actions require confirmation

## 7. Recommendation UI

Recommendation should enter the UI in this order:

1. suggested set targets inside Workout Mode
2. exercise-level next target in History
3. routine-day recommendation on Today
4. full daily workout recommendation

Suggested set target example:

```text
Bench Press
Last 60kg x 10 RIR2
Suggested 62.5kg x 8
Reason: last 2 sessions reached top range
```

Rules:

- suggestions are editable defaults, not commands
- reasons are short and attached to values
- edited recommendations are stored for future tuning

## Implementation Order

1. Finish component extraction:
   - `WorkoutHeader`
   - `WorkoutFooterActions`
   - `ExerciseLogCard`
   - `WorkoutSetRow`
2. Redesign `WorkoutSetRow` to table-like HIG layout.
3. Simplify Today primary action area.
4. Move IA toward Today / Routines / History / Insights / More.
5. Add smart default target model.
6. Add recommendation UI on top of real logged data.

## Test Expectations

Before merging each visible UI change:

- run unit tests
- run production build
- test iPhone-sized viewport
- verify no horizontal overflow
- verify keyboard does not cover active set input
- verify all primary controls are at least 44px high
- verify Korean and English labels fit
- test Today -> Workout -> complete set -> finish workout
