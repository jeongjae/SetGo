export const SETGO_NATIVE_SCHEMA_VERSION = 2;

export type NativeColumnType = 'text' | 'integer' | 'real' | 'json';

export type NativeColumn = {
  name: string;
  type: NativeColumnType;
  primaryKey?: boolean;
  nullable?: boolean;
  defaultValue?: string | number | boolean;
};

export type NativeIndex = {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
};

export type NativeTable = {
  name: string;
  snapshotKey: string;
  columns: NativeColumn[];
  indexes: NativeIndex[];
};

const idColumn: NativeColumn = { name: 'id', type: 'text', primaryKey: true };

const text = (name: string, nullable = false): NativeColumn => ({ name, type: 'text', nullable });
const integer = (name: string, nullable = false): NativeColumn => ({ name, type: 'integer', nullable });
const real = (name: string, nullable = false): NativeColumn => ({ name, type: 'real', nullable });
const json = (name: string, nullable = false): NativeColumn => ({ name, type: 'json', nullable });

const indexes = (table: string, columns: string[]): NativeIndex[] => columns.map((column) => ({
  name: `idx_${table}_${column}`,
  table,
  columns: [column],
}));

export const SETGO_NATIVE_TABLES: NativeTable[] = [
  {
    name: 'exercises',
    snapshotKey: 'exercises',
    columns: [
      idColumn,
      text('nameKo'),
      text('nameEn', true),
      text('stage'),
      json('stageTags', true),
      text('category'),
      json('categoryTags', true),
      text('description', true),
      text('defaultEmoji'),
      real('preferredWeightIncrementKg', true),
      integer('isDefault'),
      integer('isActive'),
      text('createdAt'),
      text('updatedAt'),
    ],
    indexes: indexes('exercises', ['category', 'stage', 'isDefault', 'isActive']),
  },
  {
    name: 'routines',
    snapshotKey: 'routines',
    columns: [
      idColumn,
      text('name'),
      text('splitType'),
      text('startDate'),
      text('endDate', true),
      integer('isActive'),
      text('createdAt'),
      text('updatedAt'),
    ],
    indexes: indexes('routines', ['splitType', 'isActive', 'startDate']),
  },
  {
    name: 'routine_days',
    snapshotKey: 'routineDays',
    columns: [
      idColumn,
      text('routineId'),
      text('code'),
      text('name'),
      integer('sequence'),
      text('family', true),
      text('intensityPhase', true),
    ],
    indexes: indexes('routine_days', ['routineId', 'sequence', 'family', 'intensityPhase']),
  },
  {
    name: 'weekly_schedules',
    snapshotKey: 'weeklySchedules',
    columns: [
      idColumn,
      text('routineId'),
      integer('weekday'),
      text('routineDayId', true),
      integer('isRestDay'),
    ],
    indexes: indexes('weekly_schedules', ['routineId', 'weekday', 'routineDayId']),
  },
  {
    name: 'routine_cycle_plan_items',
    snapshotKey: 'routineCyclePlanItems',
    columns: [
      idColumn,
      text('routineId'),
      integer('order'),
      text('kind'),
      text('routineDayId', true),
    ],
    indexes: indexes('routine_cycle_plan_items', ['routineId', 'order', 'routineDayId', 'kind']),
  },
  {
    name: 'calendar_plan_overrides',
    snapshotKey: 'calendarPlanOverrides',
    columns: [
      idColumn,
      text('date'),
      text('routineId'),
      text('kind', true),
      text('routineDayId', true),
      integer('isRestDay'),
      text('createdAt'),
      text('updatedAt'),
    ],
    indexes: indexes('calendar_plan_overrides', ['date', 'routineId', 'routineDayId', 'kind']),
  },
  {
    name: 'routine_exercise_plans',
    snapshotKey: 'routineExercisePlans',
    columns: [
      idColumn,
      text('routineDayId'),
      text('exerciseId'),
      integer('order'),
      real('plannedWeightKg', true),
      integer('plannedReps', true),
      integer('plannedSets', true),
      real('plannedRir', true),
      integer('plannedRestSeconds', true),
      integer('targetRepMin', true),
      integer('targetRepMax', true),
      text('progressionStyle', true),
      real('preferredWeightIncrementKg', true),
      text('note', true),
    ],
    indexes: indexes('routine_exercise_plans', ['routineDayId', 'exerciseId', 'order']),
  },
  {
    name: 'workout_sessions',
    snapshotKey: 'workoutSessions',
    columns: [
      idColumn,
      text('date'),
      text('startedAt', true),
      text('endedAt', true),
      text('timeBand'),
      text('routineId', true),
      text('routineDayId', true),
      text('cyclePlanItemId', true),
      text('entryKind', true),
      json('recommendationSnapshot', true),
      text('status'),
      real('totalStrengthVolumeKg'),
      text('memo', true),
      integer('autoSkipped', true),
      text('skipReason', true),
      integer('isDemo', true),
      text('createdAt'),
      text('updatedAt'),
    ],
    indexes: indexes('workout_sessions', ['date', 'routineId', 'routineDayId', 'cyclePlanItemId', 'status']),
  },
  {
    name: 'workout_exercises',
    snapshotKey: 'workoutExercises',
    columns: [
      idColumn,
      text('sessionId'),
      text('exerciseId'),
      integer('order'),
      text('status'),
      real('totalVolumeKg'),
      text('previousWorkoutExerciseId', true),
      integer('restSeconds', true),
      text('memo', true),
    ],
    indexes: indexes('workout_exercises', ['sessionId', 'exerciseId', 'order', 'status']),
  },
  {
    name: 'workout_sets',
    snapshotKey: 'workoutSets',
    columns: [
      idColumn,
      text('workoutExerciseId'),
      integer('setNo'),
      real('weightKg'),
      integer('reps'),
      real('estimatedOneRmKg', true),
      real('rir', true),
      integer('isCompleted'),
      integer('isWarmup', true),
      integer('isHard', true),
      text('type', true),
      text('intensityTechnique', true),
    ],
    indexes: indexes('workout_sets', ['workoutExerciseId', 'setNo', 'intensityTechnique']),
  },
  {
    name: 'cardio_records',
    snapshotKey: 'cardioRecords',
    columns: [
      idColumn,
      text('sessionId'),
      integer('order', true),
      integer('isDraft', true),
      text('source', true),
      text('sourceName', true),
      text('externalId', true),
      text('importedAt', true),
      text('activityType', true),
      text('environment'),
      text('machineType', true),
      text('location', true),
      text('startedAt'),
      text('endedAt'),
      integer('durationSeconds', true),
      real('distanceKm', true),
      real('averageSpeedKmh', true),
      real('inclinePercent', true),
      real('speedKmh', true),
      real('inclinePct', true),
      text('memo', true),
    ],
    indexes: [
      ...indexes('cardio_records', ['sessionId', 'environment', 'order']),
      { name: 'idx_cardio_records_source_externalId', table: 'cardio_records', columns: ['source', 'externalId'] },
      { name: 'idx_cardio_records_startedAt', table: 'cardio_records', columns: ['startedAt'] },
      { name: 'idx_cardio_records_activityType', table: 'cardio_records', columns: ['activityType'] },
    ],
  },
];

export const SETGO_NATIVE_SNAPSHOT_KEYS = SETGO_NATIVE_TABLES.map((table) => table.snapshotKey);

const sqlType = (type: NativeColumnType) => {
  if (type === 'integer') return 'INTEGER';
  if (type === 'real') return 'REAL';
  return 'TEXT';
};

const sqlDefaultValue = (value: string | number | boolean) => {
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return String(value);
  return `'${value.replace(/'/g, "''")}'`;
};

export function createTableSql(table: NativeTable): string {
  const columns = table.columns.map((column) => {
    const constraints = [
      `"${column.name}" ${sqlType(column.type)}`,
      column.primaryKey ? 'PRIMARY KEY' : undefined,
      column.nullable || column.primaryKey ? undefined : 'NOT NULL',
      column.defaultValue !== undefined ? `DEFAULT ${sqlDefaultValue(column.defaultValue)}` : undefined,
    ].filter(Boolean);

    return `  ${constraints.join(' ')}`;
  });

  return `CREATE TABLE IF NOT EXISTS "${table.name}" (\n${columns.join(',\n')}\n);`;
}

export function createIndexSql(index: NativeIndex): string {
  const unique = index.unique ? 'UNIQUE ' : '';
  const columns = index.columns.map((column) => `"${column}"`).join(', ');
  return `CREATE ${unique}INDEX IF NOT EXISTS "${index.name}" ON "${index.table}" (${columns});`;
}

export function createNativeSchemaSql(): string[] {
  return SETGO_NATIVE_TABLES.flatMap((table) => [
    createTableSql(table),
    ...table.indexes.map(createIndexSql),
  ]);
}

export function nativeTableNames(): string[] {
  return SETGO_NATIVE_TABLES.map((table) => table.name);
}

export function nativeSchemaSummary(): Record<string, { snapshotKey: string; columns: string[]; indexes: string[] }> {
  return Object.fromEntries(SETGO_NATIVE_TABLES.map((table) => [
    table.name,
    {
      snapshotKey: table.snapshotKey,
      columns: table.columns.map((column) => column.name),
      indexes: table.indexes.map((index) => index.name),
    },
  ]));
}
