import { describe, expect, it } from 'vitest';
import { parseAiCoachResponse } from './aiCoach';

describe('AI coach response parsing', () => {
  it('accepts a valid structured coach response', () => {
    expect(parseAiCoachResponse({
      action: 'keep_plan',
      confidence: 'medium',
      summaryKo: '오늘 계획은 그대로 진행하세요.',
      adjustments: [
        { target: 'bench_press', change: 'hold_weight', reasonCode: 'stable_progress' },
      ],
      warnings: [
        { type: 'recovery', messageKo: '가슴 회복도를 확인하세요.' },
      ],
    })).toMatchObject({
      action: 'keep_plan',
      confidence: 'medium',
      summaryKo: '오늘 계획은 그대로 진행하세요.',
      adjustments: [{ target: 'bench_press', change: 'hold_weight' }],
      warnings: [{ type: 'recovery' }],
    });
  });

  it('rejects responses without a Korean summary', () => {
    expect(() => parseAiCoachResponse({
      action: 'keep_plan',
      confidence: 'medium',
      adjustments: [],
      warnings: [],
    })).toThrow('Korean summary');
  });

  it('normalizes unknown nested warning and adjustment values conservatively', () => {
    expect(parseAiCoachResponse({
      action: 'reduce_volume',
      confidence: 'low',
      summaryKo: '볼륨을 조금 줄이세요.',
      adjustments: [
        { target: 123, change: 'increase_weight', reasonCode: 456 },
      ],
      warnings: [
        { type: 'strange', messageKo: '누적 피로를 확인하세요.' },
      ],
    })).toMatchObject({
      adjustments: [{ target: 'today', change: 'keep', reasonCode: 'model_note' }],
      warnings: [{ type: 'other', messageKo: '누적 피로를 확인하세요.' }],
    });
  });
});
