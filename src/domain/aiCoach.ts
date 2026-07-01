import type { DeloadRecommendation, StatsView } from './stats';

export const AI_COACH_ENDPOINT_KEY = 'setgo.aiCoach.endpoint';

export type AiCoachAction = 'keep_plan' | 'reduce_volume' | 'increase_recovery' | 'deload' | 'rest';
export type AiCoachConfidence = 'low' | 'medium' | 'high';

export type AiCoachContext = {
  locale: 'ko' | 'en';
  today: string;
  activeRoutineName?: string;
  recommendation?: {
    label: string;
    reason: string;
    source: string;
    confidence: string;
  };
  selectedRoutineDay?: {
    name: string;
    intensityPhase?: string;
  };
  plannedExercises: string[];
  recoveryWarning?: string;
  stats: Pick<StatsView, 'workoutDays' | 'totalVolumeKg' | 'totalSets' | 'hardSets' | 'hardSetRatio' | 'analysisComment' | 'nextWeekSuggestions'> & {
    recovery: Pick<StatsView['recovery'], 'averageRecoveryPercent' | 'readinessStatus'>;
    warnings: string[];
  };
  deloadRecommendation?: Pick<DeloadRecommendation, 'severity' | 'suggestedSetReductionPct' | 'reasons'>;
};

export type AiCoachAdjustment = {
  target: string;
  change: 'keep' | 'reduce_sets' | 'hold_weight' | 'raise_rir' | 'deload' | 'rest';
  reasonCode: string;
};

export type AiCoachWarning = {
  type: 'recovery' | 'volume' | 'hard_sets' | 'consistency' | 'other';
  messageKo: string;
  messageEn?: string;
};

export type AiCoachResponse = {
  action: AiCoachAction;
  confidence: AiCoachConfidence;
  summaryKo: string;
  summaryEn?: string;
  adjustments: AiCoachAdjustment[];
  warnings: AiCoachWarning[];
};

export function loadAiCoachEndpoint(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(AI_COACH_ENDPOINT_KEY) ?? '';
}

export function saveAiCoachEndpoint(endpoint: string): void {
  if (typeof localStorage === 'undefined') return;
  const normalized = endpoint.trim();
  if (normalized) localStorage.setItem(AI_COACH_ENDPOINT_KEY, normalized);
  else localStorage.removeItem(AI_COACH_ENDPOINT_KEY);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseAiCoachResponse(value: unknown): AiCoachResponse {
  if (!isObject(value)) throw new Error('AI coach response was not an object.');

  const action = value.action;
  const confidence = value.confidence;
  const summaryKo = value.summaryKo;
  if (action !== 'keep_plan' && action !== 'reduce_volume' && action !== 'increase_recovery' && action !== 'deload' && action !== 'rest') {
    throw new Error('AI coach response had an invalid action.');
  }
  if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') {
    throw new Error('AI coach response had an invalid confidence.');
  }
  if (typeof summaryKo !== 'string' || summaryKo.trim().length === 0) {
    throw new Error('AI coach response did not include a Korean summary.');
  }

  return {
    action,
    confidence,
    summaryKo,
    summaryEn: typeof value.summaryEn === 'string' ? value.summaryEn : undefined,
    adjustments: Array.isArray(value.adjustments) ? value.adjustments.filter(isObject).map((item) => ({
      target: typeof item.target === 'string' ? item.target : 'today',
      change: item.change === 'reduce_sets' || item.change === 'hold_weight' || item.change === 'raise_rir' || item.change === 'deload' || item.change === 'rest'
        ? item.change
        : 'keep',
      reasonCode: typeof item.reasonCode === 'string' ? item.reasonCode : 'model_note',
    })) : [],
    warnings: Array.isArray(value.warnings) ? value.warnings.filter(isObject).map((item): AiCoachWarning => {
      const type: AiCoachWarning['type'] = item.type === 'recovery' || item.type === 'volume' || item.type === 'hard_sets' || item.type === 'consistency'
        ? item.type
        : 'other';
      return {
        type,
        messageKo: typeof item.messageKo === 'string' ? item.messageKo : '',
        messageEn: typeof item.messageEn === 'string' ? item.messageEn : undefined,
      };
    }).filter((item) => item.messageKo.trim().length > 0) : [],
  };
}

export async function requestAiCoach(endpoint: string, context: AiCoachContext): Promise<AiCoachResponse> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(context),
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) as unknown : undefined;
  if (!response.ok) {
    const message = isObject(parsed) && typeof parsed.error === 'string'
      ? parsed.error
      : `AI coach request failed (${response.status}).`;
    throw new Error(message);
  }

  return parseAiCoachResponse(parsed);
}
