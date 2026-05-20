import { ChevronLeft, Copy, Download, Upload } from 'lucide-react';
import { type ChangeEvent, useEffect, useState } from 'react';
import { createBackup, createSettingsBackup, restoreBackup, restoreSettingsBackup } from '../db/backup';
import { createExerciseCsv, ExerciseCsvImportError, importExerciseCsv } from '../db/exerciseCsv';
import { isStoragePersisted } from '../db/db';
import {
  getRecentWorkoutSummaries,
  getWorkoutCardioRecords,
  getWorkoutExerciseLogs,
  type WorkoutSummary,
} from '../db/workouts';
import { getRoutineDayDisplayName } from '../db/routines';
import { exerciseCountLabel, getStoredLocale, routineNameLabel, t, workoutStatusLabel } from '../i18n/i18n';
import { formatWorkoutMarkdown } from '../utils/markdown';

type ExportPageProps = {
  onBack: () => void;
};

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (blob: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

async function saveFile(blob: Blob, filename: string, mimeType: string): Promise<'picked' | 'downloaded'> {
  const picker = window as SavePickerWindow;

  if (picker.showSaveFilePicker) {
    try {
      const handle = await picker.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: filename.endsWith('.csv') ? 'CSV file' : 'JSON file',
          accept: { [mimeType]: [filename.endsWith('.csv') ? '.csv' : '.json'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'picked';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'downloaded';
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}

function savedMessage(locale: 'ko' | 'en', filename: string, mode: 'picked' | 'downloaded'): string {
  if (mode === 'picked') {
    return locale === 'ko' ? `${filename} 파일을 선택한 위치에 저장했습니다.` : `${filename} saved to the selected location.`;
  }

  return locale === 'ko'
    ? `${filename} 파일 다운로드를 시작했습니다. 저장 위치는 브라우저/Safari 다운로드 설정을 따릅니다.`
    : `${filename} download started. The save location follows your browser or Safari download settings.`;
}

export function ExportPage({ onBack }: ExportPageProps) {
  const [summaries, setSummaries] = useState<WorkoutSummary[]>([]);
  const [summary, setSummary] = useState<WorkoutSummary | undefined>();
  const [markdown, setMarkdown] = useState('');
  const [locale] = useState(() => getStoredLocale());
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [backupStatus, setBackupStatus] = useState<'idle' | 'downloaded'>('idle');
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'restored' | 'cancelled' | 'failed'>('idle');
  const [backupSummary, setBackupSummary] = useState<string | undefined>();
  const [exerciseCsvStatus, setExerciseCsvStatus] = useState<string | undefined>();
  const [exerciseCsvIssues, setExerciseCsvIssues] = useState<string[]>([]);
  const [settingsBackupStatus, setSettingsBackupStatus] = useState<string | undefined>();
  const [isPersisted, setIsPersisted] = useState(false);

  async function loadSummaries(selectedSessionId?: string) {
    const recentSummaries = await getRecentWorkoutSummaries(20);
    const selectedSummary = recentSummaries.find((item) => item.session.id === sessionIdForImport(item, selectedSessionId))
      ?? recentSummaries.find((item) => item.session.status === 'completed')
      ?? recentSummaries.find((item) => item.session.status === 'in_progress')
      ?? recentSummaries[0];
    setSummaries(recentSummaries);
    await loadMarkdown(selectedSummary);
  }

  function sessionIdForImport(item: WorkoutSummary, selectedSessionId?: string) {
    return selectedSessionId;
  }

  async function loadMarkdown(selectedSummary: WorkoutSummary | undefined) {
    setSummary(selectedSummary);

    if (!selectedSummary) {
      setMarkdown('');
      return;
    }

    const [exercises, cardioRecords] = await Promise.all([
      getWorkoutExerciseLogs(selectedSummary.session.id),
      getWorkoutCardioRecords(selectedSummary.session.id),
    ]);
    setMarkdown(formatWorkoutMarkdown({
      session: selectedSummary.session,
      routineName: routineNameLabel(locale, selectedSummary.routineName),
      routineDayName: getRoutineDayDisplayName(selectedSummary.routineDay, locale),
      exercises,
      cardioRecords,
      locale,
    }));
  }

  useEffect(() => {
    async function load() {
      await loadSummaries();
      const persisted = await isStoragePersisted();
      setIsPersisted(persisted);
    }

    void load();
  }, []);

  async function handleSelectSummary(sessionId: string) {
    await loadMarkdown(summaries.find((item) => item.session.id === sessionId));
  }

  async function handleCopy() {
    if (!markdown) return;

    await navigator.clipboard.writeText(markdown);
    setCopyStatus('copied');
    window.setTimeout(() => setCopyStatus('idle'), 1200);
  }

  async function handleBackup() {
    const backup = await createBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const filename = `setgo-backup-${backup.exportedAt.replace(/[:.]/g, '-').slice(0, 19)}.json`;
    const saveMode = await saveFile(blob, filename, 'application/json');
    setBackupSummary(
      locale === 'ko'
        ? `${backup.data.workoutSessions.length}개 세션, ${backup.data.exercises.length}개 운동, ${backup.data.routineExercisePlans.length}개 루틴 계획을 내보냈습니다. ${savedMessage(locale, filename, saveMode)}`
        : `${backup.data.workoutSessions.length} sessions, ${backup.data.exercises.length} exercises, ${backup.data.routineExercisePlans.length} routine plans exported. ${savedMessage(locale, filename, saveMode)}`,
    );
    setBackupStatus('downloaded');
    window.setTimeout(() => setBackupStatus('idle'), 1200);
  }

  async function handleRestore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsedBackup = JSON.parse(await file.text());
      const sessionCount = parsedBackup?.data?.workoutSessions?.length ?? 0;
      const exerciseCount = parsedBackup?.data?.exercises?.length ?? 0;
      const shouldRestore = window.confirm(
        locale === 'ko'
          ? `SetGo 백업을 복원할까요?\n\n현재 로컬 데이터가 ${file.name}의 ${sessionCount}개 세션, ${exerciseCount}개 운동으로 교체됩니다.`
          : `Restore this SetGo backup?\n\nThis replaces current local data with ${sessionCount} sessions and ${exerciseCount} exercises from ${file.name}.`,
      );

      if (!shouldRestore) {
        setRestoreStatus('cancelled');
        window.setTimeout(() => setRestoreStatus('idle'), 1200);
        return;
      }

      await restoreBackup(parsedBackup);
      await loadSummaries();
      setBackupSummary(locale === 'ko' ? '선택한 JSON 백업에서 로컬 데이터를 복원했습니다.' : 'Local data was restored from the selected JSON backup.');
      setRestoreStatus('restored');
      window.setTimeout(() => setRestoreStatus('idle'), 1200);
      window.setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Failed to restore SetGo backup', error);
      setRestoreStatus('failed');
      window.setTimeout(() => setRestoreStatus('idle'), 1600);
    } finally {
      event.target.value = '';
    }
  }

  async function handleSettingsBackup() {
    const backup = await createSettingsBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const filename = `setgo-settings-${backup.exportedAt.replace(/[:.]/g, '-').slice(0, 19)}.json`;
    const saveMode = await saveFile(blob, filename, 'application/json');
    setSettingsBackupStatus(
      locale === 'ko'
        ? `${backup.data.routines.length}개 루틴, ${backup.data.exercises.length}개 운동, ${backup.data.weeklySchedules.length}개 주간계획을 저장했습니다. ${savedMessage(locale, filename, saveMode)}`
        : `${backup.data.routines.length} routines, ${backup.data.exercises.length} exercises, ${backup.data.weeklySchedules.length} weekly schedule rows exported. ${savedMessage(locale, filename, saveMode)}`,
    );
    window.setTimeout(() => setSettingsBackupStatus(undefined), 1800);
  }

  async function handleSettingsRestore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsedBackup = JSON.parse(await file.text());
      const routineCount = parsedBackup?.data?.routines?.length ?? 0;
      const exerciseCount = parsedBackup?.data?.exercises?.length ?? 0;
      const shouldRestore = window.confirm(
        locale === 'ko'
          ? `SetGo 설정 백업을 복원할까요?\n\n현재 루틴, 운동 라이브러리, 주간계획이 ${file.name}의 ${routineCount}개 루틴과 ${exerciseCount}개 운동으로 교체됩니다. 운동 기록은 유지됩니다.`
          : `Restore SetGo settings?\n\nCurrent routines, exercise library, and weekly plan will be replaced with ${routineCount} routines and ${exerciseCount} exercises from ${file.name}. Workout logs stay untouched.`,
      );

      if (!shouldRestore) {
        setSettingsBackupStatus(locale === 'ko' ? '설정 복원을 취소했습니다.' : 'Settings restore cancelled.');
        window.setTimeout(() => setSettingsBackupStatus(undefined), 1600);
        return;
      }

      await restoreSettingsBackup(parsedBackup);
      setSettingsBackupStatus(locale === 'ko' ? '설정 백업을 복원했습니다.' : 'Settings backup restored.');
      window.setTimeout(() => setSettingsBackupStatus(undefined), 1800);
      window.setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Failed to restore SetGo settings backup', error);
      setSettingsBackupStatus(locale === 'ko' ? '설정 백업 복원에 실패했습니다.' : 'Settings restore failed.');
      window.setTimeout(() => setSettingsBackupStatus(undefined), 1800);
    } finally {
      event.target.value = '';
    }
  }

  async function handleExerciseCsvExport() {
    const csv = await createExerciseCsv();
    const bom = '\uFEFF';
    const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8' });
    const filename = `setgo-exercises-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.csv`;
    const saveMode = await saveFile(blob, filename, 'text/csv');
    setExerciseCsvIssues([]);
    setExerciseCsvStatus(
      locale === 'ko'
        ? `운동 라이브러리 CSV를 내보냈습니다. ${savedMessage(locale, filename, saveMode)}`
        : `Exercise library CSV exported. ${savedMessage(locale, filename, saveMode)}`,
    );
    window.setTimeout(() => setExerciseCsvStatus(undefined), 1600);
  }

  async function handleExerciseCsvImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedCount = await importExerciseCsv(await file.text());
      setExerciseCsvIssues([]);
      setExerciseCsvStatus(
        locale === 'ko'
          ? `${importedCount}개의 운동을 갱신했습니다.`
          : `${importedCount} exercises updated.`,
      );
      window.setTimeout(() => setExerciseCsvStatus(undefined), 1800);
    } catch (error) {
      console.error('Failed to import exercise CSV', error);
      if (error instanceof ExerciseCsvImportError) {
        setExerciseCsvIssues(error.issues);
        setExerciseCsvStatus(
          locale === 'ko'
            ? `CSV 검증 실패: ${error.issues.slice(0, 3).join(' / ')}`
            : `CSV validation failed: ${error.issues.slice(0, 3).join(' / ')}`,
        );
      } else {
        setExerciseCsvStatus(locale === 'ko' ? 'CSV 가져오기에 실패했습니다.' : 'CSV import failed.');
      }
      window.setTimeout(() => setExerciseCsvStatus(undefined), 1800);
    } finally {
      event.target.value = '';
    }
  }

  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-slate-100"
          aria-label="Back to Today"
        >
          <ChevronLeft aria-hidden="true" size={22} />
        </button>
        <div>
          <p className="text-sm font-medium text-cyan-300">{t(locale, 'export')}</p>
          <h1 className="text-2xl font-bold text-white">{t(locale, 'export')}</h1>
        </div>
      </header>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <p className="text-sm font-medium text-slate-400">{t(locale, 'workoutSession')}</p>
        <h2 className="mt-1 text-xl font-semibold text-white">
          {summary ? `${summary.session.date} / ${workoutStatusLabel(locale, summary.session.status)}` : locale === 'ko' ? '저장된 운동이 없습니다' : 'No workout saved yet'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {summary
            ? `${exerciseCountLabel(locale, summary.exerciseCount)} / ${summary.session.totalStrengthVolumeKg.toLocaleString()} kg`
            : locale === 'ko' ? '운동을 완료하면 내보낼 기록이 생성됩니다.' : 'Complete a workout to generate an export.'}
        </p>
        {summaries.length > 0 ? (
          <div className="mt-4">
            <select
              aria-label="Export workout session"
              value={summary?.session.id ?? ''}
              onChange={(event) => void handleSelectSummary(event.target.value)}
              className="min-h-11 w-full rounded-md bg-slate-800 px-3 text-sm text-white"
            >
              {summaries.map((item) => {
                const routineDayName = getRoutineDayDisplayName(item.routineDay, locale) ?? t(locale, 'freeWorkout');
                return (
                  <option key={item.session.id} value={item.session.id}>
                    {item.session.date} / {routineDayName} / {workoutStatusLabel(locale, item.session.status)} / {exerciseCountLabel(locale, item.exerciseCount)}
                  </option>
                );
              })}
            </select>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {locale === 'ko'
                ? '완료 기록을 우선 선택합니다. 진행 중인 기록은 운동일지에서 완료 후 내보내는 것을 권장합니다.'
                : 'Completed records are selected first. For in-progress sessions, finish the workout before exporting when possible.'}
            </p>
          </div>
        ) : null}
      </section>

      <button
        type="button"
        onClick={() => void handleCopy()}
        disabled={!markdown}
        className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 text-sm font-semibold text-slate-950 disabled:bg-slate-800 disabled:text-slate-500"
      >
        <Copy aria-hidden="true" size={18} />
        <span>{copyStatus === 'copied' ? t(locale, 'copied') : t(locale, 'copy')}</span>
      </button>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-400">{t(locale, 'localData')}</p>
          {isPersisted ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-400/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span>Persistent 🟢</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-amber-400/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
              </span>
              <span>Best-effort 🟡</span>
            </span>
          )}
        </div>
        <h2 className="mt-1 text-lg font-semibold text-white">{t(locale, 'backupRestore')}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {backupSummary ?? (
            locale === 'ko'
              ? '전체 JSON 백업에는 운동 기록, 루틴, 운동 라이브러리, 주간계획, 날짜별 계획이 모두 포함됩니다.'
              : t(locale, 'localDataNote')
          )}
        </p>
        {!isPersisted && (
          <p className="mt-2 text-xs leading-5 text-amber-300 bg-amber-400/5 border border-amber-400/10 rounded-md p-2">
            {locale === 'ko'
              ? '💡 모바일 기기의 Safari/Chrome에서 "홈 화면에 추가"하여 PWA로 설치하면, 브라우저가 데이터를 임의로 지우지 않는 [영구 안심 보존(Persistent)] 권한을 자동으로 획득할 수 있습니다.'
              : '💡 Add this app to your "Home Screen" (PWA) to automatically gain [Persistent Storage] status, ensuring the browser never auto-deletes your logs.'}
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void handleBackup()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-slate-100"
          >
            <Download aria-hidden="true" size={16} />
            <span>{backupStatus === 'downloaded' ? t(locale, 'downloaded') : t(locale, 'backupJson')}</span>
          </button>
          <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-slate-100">
            <Upload aria-hidden="true" size={16} />
            <span>
              {restoreStatus === 'restored'
                ? t(locale, 'restored')
                : restoreStatus === 'cancelled'
                ? t(locale, 'restoreCancelled')
                : restoreStatus === 'failed'
                ? t(locale, 'restoreFailed')
                : t(locale, 'restoreJson')}
            </span>
            <input
              aria-label="Restore SetGo JSON backup"
              type="file"
              accept="application/json"
              onChange={(event) => void handleRestore(event)}
              className="sr-only"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <p className="text-sm font-medium text-slate-400">
          {locale === 'ko' ? '설정 데이터' : 'Settings Data'}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          {locale === 'ko' ? '루틴 / 운동 / 주간계획 백업' : 'Routine / Exercise / Weekly Plan Backup'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {settingsBackupStatus ?? (
            locale === 'ko'
              ? '운동 기록은 제외하고 설정에서 저장한 루틴, 루틴별 운동 구성, 운동 라이브러리, 주간계획, 날짜별 계획만 JSON으로 저장합니다.'
              : 'Export only settings: routines, routine exercise plans, exercise library, weekly plan, and date overrides. Workout logs are not included.'
          )}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void handleSettingsBackup()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-slate-100"
          >
            <Download aria-hidden="true" size={16} />
            <span>{locale === 'ko' ? '설정 저장' : 'Export Settings'}</span>
          </button>
          <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-slate-100">
            <Upload aria-hidden="true" size={16} />
            <span>{locale === 'ko' ? '설정 복원' : 'Restore Settings'}</span>
            <input
              aria-label="Restore SetGo settings JSON backup"
              type="file"
              accept="application/json"
              onChange={(event) => void handleSettingsRestore(event)}
              className="sr-only"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <p className="text-sm font-medium text-slate-400">
          {locale === 'ko' ? '운동 라이브러리' : 'Exercise Library'}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          {locale === 'ko' ? 'CSV 일괄 수정' : 'Bulk CSV Edit'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {exerciseCsvStatus ?? (
            locale === 'ko'
              ? 'CSV를 내려받아 한글명, 영문명, 분류, 설명을 수정한 뒤 다시 가져오세요. categoryTags와 stageTags는 | 로 여러 값을 입력할 수 있습니다.'
              : 'Export the CSV, edit names, tags, and descriptions, then import it back. Use | for multiple categoryTags or stageTags.'
          )}
        </p>
        {exerciseCsvIssues.length > 0 ? (
          <div className="mt-3 rounded-md bg-red-950/50 px-3 py-3">
            <p className="text-xs font-bold text-red-100">
              {locale === 'ko' ? '가져오기 전 수정할 항목' : 'Items to fix before import'}
            </p>
            <ul className="mt-2 grid gap-1 text-xs leading-5 text-red-100">
              {exerciseCsvIssues.slice(0, 8).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
            {exerciseCsvIssues.length > 8 ? (
              <p className="mt-2 text-xs text-red-200">
                {locale === 'ko'
                  ? `${exerciseCsvIssues.length - 8}개 항목이 더 있습니다.`
                  : `${exerciseCsvIssues.length - 8} more issues.`}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void handleExerciseCsvExport()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-slate-100"
          >
            <Download aria-hidden="true" size={16} />
            <span>{locale === 'ko' ? 'CSV 내보내기' : 'Export CSV'}</span>
          </button>
          <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-slate-100">
            <Upload aria-hidden="true" size={16} />
            <span>{locale === 'ko' ? 'CSV 가져오기' : 'Import CSV'}</span>
            <input
              aria-label="Import exercise library CSV"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void handleExerciseCsvImport(event)}
              className="sr-only"
            />
          </label>
        </div>
      </section>

      <pre className="min-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-sm leading-6 text-slate-100 shadow">
        {markdown || t(locale, 'noMarkdown')}
      </pre>
    </section>
  );
}
