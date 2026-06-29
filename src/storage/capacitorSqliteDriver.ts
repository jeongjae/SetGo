import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { SETGO_NATIVE_SCHEMA_VERSION } from './nativeSchema';
import type { NativeSqliteDriver, NativeSqliteQueryResult, NativeSqliteRow } from './nativeSqliteRepository';

export type CapacitorSqliteDriverOptions = {
  database?: string;
  version?: number;
  encrypted?: boolean;
  mode?: string;
  readonly?: boolean;
};

const defaultOptions: Required<CapacitorSqliteDriverOptions> = {
  database: 'setgo',
  version: SETGO_NATIVE_SCHEMA_VERSION,
  encrypted: false,
  mode: 'no-encryption',
  readonly: false,
};

export async function createCapacitorSqliteDriver(
  options: CapacitorSqliteDriverOptions = {},
): Promise<NativeSqliteDriver> {
  const resolved = { ...defaultOptions, ...options };
  const connection = new SQLiteConnection(CapacitorSQLite);
  const consistency = await connection.checkConnectionsConsistency();
  let database: SQLiteDBConnection;

  if (consistency.result) {
    const existing = await connection.isConnection(resolved.database, resolved.readonly);
    database = existing.result
      ? await connection.retrieveConnection(resolved.database, resolved.readonly)
      : await connection.createConnection(
        resolved.database,
        resolved.encrypted,
        resolved.mode,
        resolved.version,
        resolved.readonly,
      );
  } else {
    await connection.closeAllConnections();
    database = await connection.createConnection(
      resolved.database,
      resolved.encrypted,
      resolved.mode,
      resolved.version,
      resolved.readonly,
    );
  }

  const open = await database.isDBOpen();
  if (!open.result) {
    await database.open();
  }

  return {
    async run(sql, params = []) {
      await database.run(sql, params, false);
    },

    async query<T extends NativeSqliteRow = NativeSqliteRow>(
      sql: string,
      params: unknown[] = [],
    ): Promise<NativeSqliteQueryResult<T>> {
      const result = await database.query(sql, params);
      return { values: (result.values ?? []) as T[] };
    },

    async transaction<T>(work: () => Promise<T>): Promise<T> {
      await database.beginTransaction();
      try {
        const result = await work();
        await database.commitTransaction();
        return result;
      } catch (error) {
        await database.rollbackTransaction();
        throw error;
      }
    },
  };
}
