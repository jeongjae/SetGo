import { describe, expect, it } from 'vitest';
import { getRoutineDayDisplayName, getRoutineTemplateName, getRoutineTemplateSummary, isRoutineScheduledForDate, routineTemplates } from './routines';

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
});
