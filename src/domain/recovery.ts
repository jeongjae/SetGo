export const recoveryMuscleGroups = [
  'chest',
  'back',
  'legs',
  'shoulder',
  'biceps',
  'triceps',
  'core',
  'cardio',
] as const;

export type RecoveryMuscleGroup = typeof recoveryMuscleGroups[number];
export type RecoveryStatus = 'ready' | 'moderate' | 'fatigued';

export type RecoveryLoadInput = {
  date: string;
  completedAt?: string;
  muscleGroups: RecoveryMuscleGroup[];
  load: number;
  isHard?: boolean;
  isWarmup?: boolean;
  isPr?: boolean;
};

export type RecoveryGroupStat = {
  group: RecoveryMuscleGroup;
  rawLoad: number;
  adjustedLoad: number;
  decayedLoad: number;
  fatigueScore: number;
  recoveryPercent: number;
  status: RecoveryStatus;
  lastTrainedAt?: string;
};

export type RecoverySnapshot = {
  generatedAt: string;
  averageRecoveryPercent: number;
  readinessStatus: RecoveryStatus;
  groups: RecoveryGroupStat[];
  mostFatiguedGroups: RecoveryGroupStat[];
  bestRecoveredGroups: RecoveryGroupStat[];
  recommendation: string;
};

export type RecoveryOptions = {
  asOf?: Date;
  dailyDecay?: number;
  groupCapacity?: Partial<Record<RecoveryMuscleGroup, number>>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAILY_DECAY = 0.4;

const defaultGroupCapacity: Record<RecoveryMuscleGroup, number> = {
  chest: 3600,
  back: 4600,
  legs: 7200,
  shoulder: 2600,
  biceps: 1800,
  triceps: 1800,
  core: 1600,
  cardio: 5200,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseCompletedAt(input: RecoveryLoadInput): Date {
  const source = input.completedAt ?? `${input.date}T12:00:00`;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return new Date(`${input.date}T12:00:00`);
  return parsed;
}

function loadMultiplier(input: RecoveryLoadInput): number {
  const warmupMultiplier = input.isWarmup ? 0.25 : 1;
  const hardMultiplier = input.isHard ? 1.25 : 1;
  const prMultiplier = input.isPr ? 1.15 : 1;
  return warmupMultiplier * hardMultiplier * prMultiplier;
}

function statusForRecovery(recoveryPercent: number): RecoveryStatus {
  if (recoveryPercent >= 75) return 'ready';
  if (recoveryPercent >= 50) return 'moderate';
  return 'fatigued';
}

export function calculateDecayedLoad(
  load: number,
  completedAt: Date,
  asOf: Date,
  dailyDecay = DEFAULT_DAILY_DECAY,
): number {
  const daysElapsed = Math.max(0, (asOf.getTime() - completedAt.getTime()) / DAY_MS);
  const retention = clamp(1 - dailyDecay, 0.05, 0.95);
  return load * Math.pow(retention, daysElapsed);
}

export function buildRecoverySnapshot(inputs: RecoveryLoadInput[], options: RecoveryOptions = {}): RecoverySnapshot {
  const asOf = options.asOf ?? new Date();
  const dailyDecay = options.dailyDecay ?? DEFAULT_DAILY_DECAY;
  const capacity = { ...defaultGroupCapacity, ...options.groupCapacity };
  const byGroup = new Map<RecoveryMuscleGroup, RecoveryGroupStat>(
    recoveryMuscleGroups.map((group) => [group, {
      group,
      rawLoad: 0,
      adjustedLoad: 0,
      decayedLoad: 0,
      fatigueScore: 0,
      recoveryPercent: 100,
      status: 'ready',
    }]),
  );

  inputs.forEach((input) => {
    if (!Number.isFinite(input.load) || input.load <= 0) return;
    const groups = Array.from(new Set(input.muscleGroups)).filter((group) => byGroup.has(group));
    if (groups.length === 0) return;

    const completedAt = parseCompletedAt(input);
    const sharedRawLoad = input.load / groups.length;
    const sharedAdjustedLoad = sharedRawLoad * loadMultiplier(input);
    const decayedLoad = calculateDecayedLoad(sharedAdjustedLoad, completedAt, asOf, dailyDecay);

    groups.forEach((group) => {
      const stat = byGroup.get(group);
      if (!stat) return;
      stat.rawLoad += sharedRawLoad;
      stat.adjustedLoad += sharedAdjustedLoad;
      stat.decayedLoad += decayedLoad;
      if (!stat.lastTrainedAt || completedAt.getTime() > new Date(stat.lastTrainedAt).getTime()) {
        stat.lastTrainedAt = completedAt.toISOString();
      }
    });
  });

  const groups = recoveryMuscleGroups.map((group) => {
    const stat = byGroup.get(group);
    if (!stat) throw new Error(`Missing recovery group ${group}`);
    const fatigueScore = clamp((stat.decayedLoad / capacity[group]) * 100, 0, 100);
    const recoveryPercent = Math.round(100 - fatigueScore);
    return {
      ...stat,
      fatigueScore: Math.round(fatigueScore),
      recoveryPercent,
      status: statusForRecovery(recoveryPercent),
    };
  });

  const activeGroups = groups.filter((group) => group.adjustedLoad > 0);
  const averageRecoveryPercent = activeGroups.length > 0
    ? Math.round(activeGroups.reduce((sum, group) => sum + group.recoveryPercent, 0) / activeGroups.length)
    : 100;
  const readinessStatus = statusForRecovery(averageRecoveryPercent);
  const mostFatiguedGroups = activeGroups
    .slice()
    .sort((a, b) => a.recoveryPercent - b.recoveryPercent || b.decayedLoad - a.decayedLoad)
    .slice(0, 3);
  const bestRecoveredGroups = groups
    .slice()
    .sort((a, b) => b.recoveryPercent - a.recoveryPercent || a.adjustedLoad - b.adjustedLoad)
    .slice(0, 3);
  const recommendation = mostFatiguedGroups.length > 0 && mostFatiguedGroups[0].recoveryPercent < 60
    ? `Prioritize recovery for ${mostFatiguedGroups.slice(0, 2).map((group) => group.group).join(', ')}.`
    : 'Recovery is ready enough to hold or progress planned work.';

  return {
    generatedAt: asOf.toISOString(),
    averageRecoveryPercent,
    readinessStatus,
    groups,
    mostFatiguedGroups,
    bestRecoveredGroups,
    recommendation,
  };
}
