import Dexie, { type Table } from 'dexie';
import { createBackup, restoreBackup, type SetGoBackup } from '../db/backup';
import { dexieSetGoDataRepository, type SetGoDataSnapshot } from './setgoDataRepository';

const AUTO_BACKUP_DB = 'setgo_auto_backups';
const LATEST_BACKUP_ID = 'latest';
const LAST_BACKUP_AT_KEY = 'setgo-auto-backup-last-at';
const DEFAULT_MIN_INTERVAL_MS = 5 * 60 * 1000;

export type AutoBackupReason = 'startup' | 'periodic' | 'visibility-hidden' | 'before-update';

export type AutoBackupRecord = {
  id: string;
  createdAt: string;
  reason: AutoBackupReason;
  backup: SetGoBackup;
  summary: {
    exercises: number;
    routines: number;
    workoutSessions: number;
    workoutSets: number;
    cardioRecords: number;
  };
};

class SetGoAutoBackupDatabase extends Dexie {
  backups!: Table<AutoBackupRecord, string>;

  constructor() {
    super(AUTO_BACKUP_DB);
    this.version(1).stores({
      backups: 'id, createdAt, reason',
    });
  }
}

const autoBackupDb = new SetGoAutoBackupDatabase();

export function snapshotHasUserData(snapshot: SetGoDataSnapshot): boolean {
  return snapshot.routines.length > 0
    || snapshot.routineDays.length > 0
    || snapshot.routineExercisePlans.length > 0
    || snapshot.workoutSessions.length > 0
    || snapshot.workoutExercises.length > 0
    || snapshot.workoutSets.length > 0
    || snapshot.cardioRecords.length > 0
    || snapshot.exercises.some((exercise) => exercise.isDefault !== true);
}

function backupSummary(backup: SetGoBackup): AutoBackupRecord['summary'] {
  return {
    exercises: backup.data.exercises.length,
    routines: backup.data.routines.length,
    workoutSessions: backup.data.workoutSessions.length,
    workoutSets: backup.data.workoutSets.length,
    cardioRecords: backup.data.cardioRecords.length,
  };
}

function readLastBackupAt(): number {
  if (typeof localStorage === 'undefined') return 0;
  return Number(localStorage.getItem(LAST_BACKUP_AT_KEY) ?? 0) || 0;
}

function writeLastBackupAt(timestamp: number) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LAST_BACKUP_AT_KEY, String(timestamp));
}

export async function getLatestAutoBackup(): Promise<AutoBackupRecord | undefined> {
  return autoBackupDb.backups.get(LATEST_BACKUP_ID);
}

export async function createAutomaticBackup(reason: AutoBackupReason): Promise<AutoBackupRecord | undefined> {
  const backup = await createBackup(dexieSetGoDataRepository);
  if (!snapshotHasUserData(backup.data)) return undefined;

  const record: AutoBackupRecord = {
    id: LATEST_BACKUP_ID,
    createdAt: backup.exportedAt,
    reason,
    backup,
    summary: backupSummary(backup),
  };

  await autoBackupDb.backups.put(record);
  writeLastBackupAt(Date.now());
  return record;
}

export async function createAutomaticBackupIfDue(
  reason: AutoBackupReason,
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
): Promise<AutoBackupRecord | undefined> {
  const lastBackupAt = readLastBackupAt();
  if (Date.now() - lastBackupAt < minIntervalMs) return undefined;
  return createAutomaticBackup(reason);
}

export async function restoreLatestAutoBackup(): Promise<AutoBackupRecord | undefined> {
  const latest = await getLatestAutoBackup();
  if (!latest || !snapshotHasUserData(latest.backup.data)) return undefined;

  await restoreBackup(latest.backup, dexieSetGoDataRepository);
  return latest;
}

export type AutoBackupStartupResult =
  | { status: 'restored'; backup: AutoBackupRecord }
  | { status: 'backed-up'; backup?: AutoBackupRecord }
  | { status: 'empty' };

export async function ensureAutoBackupOnStartup(): Promise<AutoBackupStartupResult> {
  const currentSnapshot = await dexieSetGoDataRepository.readBackupData();
  if (!snapshotHasUserData(currentSnapshot)) {
    const restored = await restoreLatestAutoBackup();
    return restored ? { status: 'restored', backup: restored } : { status: 'empty' };
  }

  const backup = await createAutomaticBackupIfDue('startup');
  return { status: 'backed-up', backup };
}
