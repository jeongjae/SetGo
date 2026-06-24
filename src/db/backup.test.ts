import { describe, expect, it } from 'vitest';
import { previewSetGoBackup } from './backup';

describe('backup preview', () => {
  it('summarizes full backup counts before restore', () => {
    const preview = previewSetGoBackup({
      app: 'SetGo',
      version: 1,
      exportedAt: '2026-06-24T12:00:00.000Z',
      data: {
        exercises: [{ id: 'bench' }],
        routines: [{ id: 'routine' }],
        routineExercisePlans: [{ id: 'plan' }, { id: 'plan_2' }],
        workoutSessions: [{ id: 'session' }],
        cardioRecords: [{ id: 'cardio' }],
      },
    });

    expect(preview).toMatchObject({
      kind: 'full',
      sessionCount: 1,
      exerciseCount: 1,
      routineCount: 1,
      routinePlanCount: 2,
      cardioCount: 1,
      issues: [],
    });
  });

  it('summarizes settings backup counts without workout sessions', () => {
    const preview = previewSetGoBackup({
      app: 'SetGo',
      kind: 'settings',
      version: 1,
      exportedAt: '2026-06-24T12:00:00.000Z',
      data: {
        exercises: [{ id: 'bench' }],
        routines: [{ id: 'routine' }],
        routineExercisePlans: [{ id: 'plan' }],
      },
    });

    expect(preview.kind).toBe('settings');
    expect(preview.sessionCount).toBe(0);
    expect(preview.exerciseCount).toBe(1);
  });

  it('reports invalid backups with issues', () => {
    const preview = previewSetGoBackup({ app: 'Other', version: 9 });

    expect(preview.kind).toBe('invalid');
    expect(preview.issues.length).toBeGreaterThan(0);
  });
});
