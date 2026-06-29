import type { SetGoDataRepository, SetGoDataSnapshot, SetGoSettingsDataSnapshot } from './setgoDataRepository';
import { createNativeSchemaSql, SETGO_NATIVE_TABLES, type NativeTable } from './nativeSchema';

export type NativeSqliteRow = Record<string, unknown>;

export type NativeSqliteQueryResult<T extends NativeSqliteRow = NativeSqliteRow> = {
  values?: T[];
};

export type NativeSqliteDriver = {
  run(sql: string, params?: unknown[]): Promise<void>;
  query<T extends NativeSqliteRow = NativeSqliteRow>(sql: string, params?: unknown[]): Promise<NativeSqliteQueryResult<T>>;
  transaction<T>(work: () => Promise<T>): Promise<T>;
};

type SnapshotKey = keyof SetGoDataSnapshot;

const settingsSnapshotKeys: SnapshotKey[] = [
  'exercises',
  'routines',
  'routineDays',
  'weeklySchedules',
  'routineCyclePlanItems',
  'calendarPlanOverrides',
  'routineExercisePlans',
];

const booleanColumnsByTable: Record<string, Set<string>> = {
  exercises: new Set(['isDefault', 'isActive']),
  routines: new Set(['isActive']),
  weekly_schedules: new Set(['isRestDay']),
  calendar_plan_overrides: new Set(['isRestDay']),
  workout_sessions: new Set(['autoSkipped', 'isDemo']),
  workout_sets: new Set(['isCompleted', 'isWarmup', 'isHard']),
  cardio_records: new Set(['isDraft']),
};

const tableBySnapshotKey = new Map<SnapshotKey, NativeTable>(
  SETGO_NATIVE_TABLES.map((table) => [table.snapshotKey as SnapshotKey, table]),
);

const tableByName = new Map(SETGO_NATIVE_TABLES.map((table) => [table.name, table]));

const quote = (identifier: string) => `"${identifier}"`;

export async function initializeNativeSqliteSchema(driver: NativeSqliteDriver): Promise<void> {
  for (const sql of createNativeSchemaSql()) {
    await driver.run(sql);
  }
}

export function createNativeSqliteDataRepository(driver: NativeSqliteDriver): SetGoDataRepository {
  return {
    async readBackupData() {
      return readSnapshot(driver, SETGO_NATIVE_TABLES.map((table) => table.snapshotKey as SnapshotKey)) as Promise<SetGoDataSnapshot>;
    },

    async readSettingsBackupData() {
      return readSnapshot(driver, settingsSnapshotKeys) as Promise<SetGoSettingsDataSnapshot>;
    },

    async readExercisePreservationContext() {
      const snapshot = await readSnapshot(driver, ['exercises', 'workoutExercises']);
      return {
        exercises: snapshot.exercises ?? [],
        workoutExercises: snapshot.workoutExercises ?? [],
      };
    },

    async replaceBackupData(data) {
      await replaceSnapshot(driver, data, SETGO_NATIVE_TABLES.map((table) => table.snapshotKey as SnapshotKey));
    },

    async replaceSettingsData(data) {
      await replaceSnapshot(driver, data, settingsSnapshotKeys);
    },
  };
}

async function readSnapshot(driver: NativeSqliteDriver, keys: SnapshotKey[]): Promise<Partial<SetGoDataSnapshot>> {
  const entries = await Promise.all(keys.map(async (key) => {
    const table = requireTableForKey(key);
    const columns = table.columns.map((column) => quote(column.name)).join(', ');
    const result = await driver.query(`SELECT ${columns} FROM ${quote(table.name)};`);
    return [key, (result.values ?? []).map((row) => deserializeRow(table, row))];
  }));

  return Object.fromEntries(entries) as Partial<SetGoDataSnapshot>;
}

async function replaceSnapshot(
  driver: NativeSqliteDriver,
  data: Partial<SetGoDataSnapshot>,
  keys: SnapshotKey[],
): Promise<void> {
  await driver.transaction(async () => {
    for (const key of keys.slice().reverse()) {
      await driver.run(`DELETE FROM ${quote(requireTableForKey(key).name)};`);
    }

    for (const key of keys) {
      const table = requireTableForKey(key);
      const records = data[key] ?? [];
      for (const record of records as NativeSqliteRow[]) {
        await insertRecord(driver, table, record);
      }
    }
  });
}

async function insertRecord(driver: NativeSqliteDriver, table: NativeTable, record: NativeSqliteRow): Promise<void> {
  const columnNames = table.columns.map((column) => column.name);
  const placeholders = columnNames.map(() => '?').join(', ');
  const columns = columnNames.map(quote).join(', ');
  const values = table.columns.map((column) => serializeValue(table, column.name, record[column.name]));

  await driver.run(
    `INSERT OR REPLACE INTO ${quote(table.name)} (${columns}) VALUES (${placeholders});`,
    values,
  );
}

function requireTableForKey(key: SnapshotKey): NativeTable {
  const table = tableBySnapshotKey.get(key);
  if (!table) throw new Error(`No native table is mapped for snapshot key ${key}.`);
  return table;
}

function serializeValue(table: NativeTable, columnName: string, value: unknown): unknown {
  if (value === undefined) return null;
  if (table.columns.find((column) => column.name === columnName)?.type === 'json') {
    return value === null ? null : JSON.stringify(value);
  }
  if (booleanColumnsByTable[table.name]?.has(columnName)) {
    return value === null ? null : value ? 1 : 0;
  }
  return value;
}

function deserializeRow(table: NativeTable, row: NativeSqliteRow): NativeSqliteRow {
  const output: NativeSqliteRow = {};

  for (const column of table.columns) {
    const value = row[column.name];
    if (value === null || value === undefined) {
      if (!column.nullable) output[column.name] = value;
      continue;
    }

    if (column.type === 'json') {
      output[column.name] = typeof value === 'string' ? JSON.parse(value) : value;
      continue;
    }

    if (booleanColumnsByTable[table.name]?.has(column.name)) {
      output[column.name] = Boolean(value);
      continue;
    }

    output[column.name] = value;
  }

  return output;
}

export function getNativeTableForSnapshotKey(key: SnapshotKey): NativeTable {
  return requireTableForKey(key);
}

export function getNativeTableByName(name: string): NativeTable | undefined {
  return tableByName.get(name);
}
