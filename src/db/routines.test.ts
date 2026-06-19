import { describe, expect, it } from 'vitest';
import {
  buildRoutineDuplicateRecords,
  getCyclePlanItemForDate,
  getRoutineDayDisplayName,
  getRoutineTemplateName,
  getRoutineTemplateSummary,
  isRoutineScheduledForDate,
  routineTemplates,
} from './routines';
import type { Routine, RoutineCyclePlanItem, RoutineDay, RoutineExercisePlan, WeeklySchedule } from '../types';

describe('routine templates', () => {
  it('uses Korean release names for template cards', () => {
    expect(routineTemplates.map((template) => getRoutineTemplateName(template, 'ko'))).toEqual([
      '2분할 상체/하체',
      '3분할 가슴/등/하체',
      '3분할 푸시/풀/보충운동',
      '4분할 상체/하체 (강약)',
      '주 3회 입문자 무분할 루틴',
      '전통 5분할 루틴 (가슴/등/하체/어깨/팔)',
    ]);
  });

  it('documents the intended upper and lower muscle groups', () => {
    const twoDay = routineTemplates.find((template) => template.splitType === 'upper_lower_2');
    const fourDay = routineTemplates.find((template) => template.splitType === 'upper_lower_4');

    expect(twoDay ? getRoutineTemplateSummary(twoDay, 'ko') : '').toContain('상체: 가슴 / 등 / 이두 / 삼두');
    expect(twoDay ? getRoutineTemplateSummary(twoDay, 'ko') : '').toContain('하체: 하체 / 어깨');
    expect(fourDay ? getRoutineTemplateSummary(fourDay, 'ko') : '').toContain('유지/회복');
  });

  it('keeps push, pull, and assist semantics separate', () => {
    const template = routineTemplates.find((item) => item.splitType === 'push_pull_assist_3');
    const summary = template ? getRoutineTemplateSummary(template, 'ko') : '';

    expect(summary).toContain('미는 동작');
    expect(summary).toContain('당기는 동작');
    expect(summary).toContain('사용자가 직접 구성');
  });

  it('localizes routine day names without renaming push pull assist', () => {
    expect(getRoutineDayDisplayName({ name: 'Upper' }, 'ko')).toBe('상체');
    expect(getRoutineDayDisplayName({ name: 'Lower' }, 'ko')).toBe('하체');
    expect(getRoutineDayDisplayName({ name: 'Upper A' }, 'ko')).toBe('상체 A');
    expect(getRoutineDayDisplayName({ name: 'Lower B' }, 'ko')).toBe('하체 B');
    expect(getRoutineDayDisplayName({ name: 'Push' }, 'ko')).toBe('Push');
    expect(getRoutineDayDisplayName({ name: 'Pull' }, 'ko')).toBe('Pull');
    expect(getRoutineDayDisplayName({ name: 'Assist' }, 'ko')).toBe('Assist');
  });

  it('documents the new full body and classic 5 splits', () => {
    const fullBody = routineTemplates.find((t) => t.splitType === 'full_body_3');
    const classic5 = routineTemplates.find((t) => t.splitType === 'classic_5');

    expect(fullBody ? getRoutineTemplateSummary(fullBody, 'ko') : '').toContain('전신: 스쿼트');
    expect(classic5 ? getRoutineTemplateSummary(classic5, 'ko') : '').toContain('가슴');
  });

  it('applies weekly plans only inside a saved date range', () => {
    const routine = { startDate: '2026-05-27', endDate: '2026-06-23' };

    expect(isRoutineScheduledForDate(routine, '2026-05-26')).toBe(false);
    expect(isRoutineScheduledForDate(routine, '2026-05-27')).toBe(true);
    expect(isRoutineScheduledForDate(routine, '2026-06-23')).toBe(true);
    expect(isRoutineScheduledForDate(routine, '2026-06-24')).toBe(false);
  });

  it('keeps legacy routines without an end date open-ended until the user saves a range', () => {
    expect(isRoutineScheduledForDate({ startDate: '2026-05-01' }, '2026-07-01')).toBe(true);
  });

  it('repeats routine, rest, and running cycle items by date', () => {
    const routine = { startDate: '2026-05-01' };
    const cycle = [
      { id: 'c1', routineId: 'r1', order: 1, kind: 'routine' as const, routineDayId: 'upper' },
      { id: 'c2', routineId: 'r1', order: 2, kind: 'routine' as const, routineDayId: 'lower' },
      { id: 'c3', routineId: 'r1', order: 3, kind: 'running' as const },
      { id: 'c4', routineId: 'r1', order: 4, kind: 'rest' as const },
    ];

    expect(getCyclePlanItemForDate(routine, cycle, '2026-05-01')?.routineDayId).toBe('upper');
    expect(getCyclePlanItemForDate(routine, cycle, '2026-05-03')?.kind).toBe('running');
    expect(getCyclePlanItemForDate(routine, cycle, '2026-05-04')?.kind).toBe('rest');
    expect(getCyclePlanItemForDate(routine, cycle, '2026-05-05')?.routineDayId).toBe('upper');
  });
});

describe('routine duplication safety', () => {
  const sourceRoutine: Routine = {
    id: 'routine_source',
    name: 'Source Routine',
    splitType: 'upper_lower_2',
    startDate: '2026-06-01',
    isActive: false,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
  const sourceDays: RoutineDay[] = [
    { id: 'day_upper', routineId: 'routine_source', code: 'upper', name: 'Upper', sequence: 1 },
    { id: 'day_lower', routineId: 'routine_source', code: 'lower', name: 'Lower', sequence: 2 },
  ];
  const sourcePlans: RoutineExercisePlan[] = [
    {
      id: 'day_upper_bench_press',
      routineDayId: 'day_upper',
      exerciseId: 'bench_press',
      order: 1,
      plannedSets: 4,
      plannedWeightKg: 82.5,
      plannedReps: 8,
      plannedRir: 1,
      plannedRestSeconds: 120,
    },
    {
      id: 'day_lower_squat',
      routineDayId: 'day_lower',
      exerciseId: 'barbell_squat',
      order: 1,
      plannedSets: 3,
      plannedWeightKg: 100,
      plannedReps: 5,
      plannedRir: 2,
      plannedRestSeconds: 150,
    },
  ];
  const sourceCycleItems: RoutineCyclePlanItem[] = [
    { id: 'cycle_1', routineId: 'routine_source', order: 1, kind: 'routine', routineDayId: 'day_upper' },
    { id: 'cycle_2', routineId: 'routine_source', order: 2, kind: 'running' },
    { id: 'cycle_3', routineId: 'routine_source', order: 3, kind: 'routine', routineDayId: 'day_lower' },
  ];
  const sourceWeeklySchedules: WeeklySchedule[] = [
    { id: 'weekday_1', routineId: 'routine_source', weekday: 1, routineDayId: 'day_upper', isRestDay: false },
    { id: 'weekday_2', routineId: 'routine_source', weekday: 2, isRestDay: true },
  ];

  it('rewrites copied routine children to the new routine and day ids', () => {
    const duplicate = buildRoutineDuplicateRecords(
      sourceRoutine,
      sourceDays,
      sourcePlans,
      sourceCycleItems,
      sourceWeeklySchedules,
      'routine_copy_1',
      '2026-06-19T00:00:00.000Z',
      'Strength Copy',
    );

    expect(duplicate.routine).toMatchObject({
      id: 'routine_copy_1',
      name: 'Strength Copy',
      isActive: true,
      createdAt: '2026-06-19T00:00:00.000Z',
      updatedAt: '2026-06-19T00:00:00.000Z',
    });
    expect(duplicate.days.map((day) => [day.id, day.routineId])).toEqual([
      ['routine_copy_1_upper', 'routine_copy_1'],
      ['routine_copy_1_lower', 'routine_copy_1'],
    ]);
    expect(duplicate.plans.map((plan) => [plan.id, plan.routineDayId, plan.exerciseId])).toEqual([
      ['routine_copy_1_upper_bench_press_1', 'routine_copy_1_upper', 'bench_press'],
      ['routine_copy_1_lower_barbell_squat_1', 'routine_copy_1_lower', 'barbell_squat'],
    ]);
    expect(duplicate.cycleItems.map((item) => [item.id, item.routineId, item.routineDayId])).toEqual([
      ['routine_copy_1_cycle_1', 'routine_copy_1', 'routine_copy_1_upper'],
      ['routine_copy_1_cycle_2', 'routine_copy_1', undefined],
      ['routine_copy_1_cycle_3', 'routine_copy_1', 'routine_copy_1_lower'],
    ]);
    expect(duplicate.weeklySchedules.map((schedule) => [schedule.id, schedule.routineId, schedule.routineDayId])).toEqual([
      ['routine_copy_1_weekday_1', 'routine_copy_1', 'routine_copy_1_upper'],
      ['routine_copy_1_weekday_2', 'routine_copy_1', undefined],
    ]);
  });

  it('falls back to a copy name without mutating planned set details', () => {
    const duplicate = buildRoutineDuplicateRecords(
      sourceRoutine,
      sourceDays,
      sourcePlans,
      sourceCycleItems,
      sourceWeeklySchedules,
      'routine_copy_2',
      '2026-06-19T00:00:00.000Z',
      '   ',
    );

    expect(duplicate.routine.name).toBe('Source Routine Copy');
    expect(duplicate.plans[0]).toMatchObject({
      plannedSets: 4,
      plannedWeightKg: 82.5,
      plannedReps: 8,
      plannedRir: 1,
      plannedRestSeconds: 120,
    });
  });
});
