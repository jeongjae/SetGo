import { ChevronLeft, Copy, Download, Info, Upload } from 'lucide-react';
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
      write: (data: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

type SaveFileOptions = {
  preferPicker?: boolean;
};

async function saveTextFile(
  contents: string,
  filename: string,
  mimeType: string,
  options: SaveFileOptions = {},
): Promise<'picked' | 'downloaded'> {
  const picker = window as SavePickerWindow;
  const preferPicker = options.preferPicker ?? true;
  const pickerMimeType = mimeType.split(';', 1)[0];

  if (preferPicker && picker.showSaveFilePicker) {
    try {
      const handle = await picker.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: filename.endsWith('.csv') ? 'CSV file' : 'JSON file',
          accept: { [pickerMimeType]: [filename.endsWith('.csv') ? '.csv' : '.json'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(contents);
      await writable.close();
      return 'picked';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'downloaded';
    }
  }

  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Keep the blob available until the browser has consumed the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
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
  const [showPersistenceInfo, setShowPersistenceInfo] = useState(false);

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
    const json = JSON.stringify(backup, null, 2);
    const filename = `setgo-backup-${backup.exportedAt.replace(/[:.]/g, '-').slice(0, 19)}.json`;
    const saveMode = await saveTextFile(json, filename, 'application/json');
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
    const json = JSON.stringify(backup, null, 2);
    const filename = `setgo-settings-${backup.exportedAt.replace(/[:.]/g, '-').slice(0, 19)}.json`;
    const saveMode = await saveTextFile(json, filename, 'application/json');
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
    const contents = `${bom}${csv}`;
    const filename = `setgo-exercises-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.csv`;
    const saveMode = await saveTextFile(contents, filename, 'text/csv;charset=utf-8');
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
      window.setTimeout(() => {
        window.location.reload();
      }, 1000);
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
    <section className="viewport-locked mx-auto flex max-w-md flex-col gap-2.5 overflow-hidden px-3.5 pb-3.5 pt-3 text-slate-100">
      <header className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-650 bg-slate-750 text-slate-100 shadow-md transition-all hover:bg-slate-650 active:scale-95"
          aria-label={locale === 'ko' ? '설정으로 돌아가기' : 'Back to Settings'}
        >
          <ChevronLeft aria-hidden="true" size={20} />
        </button>
        <div>
          <p className="text-xs font-black uppercase text-cyan-300">{t(locale, 'settings')}</p>
          <h1 className="text-xl font-black text-slate-100">{t(locale, 'export')}</h1>
        </div>
      </header>

      {/* 내부 콘텐츠 스크롤 영역 */}
      <div className="inner-scroll min-h-0 space-y-2.5 pr-0.5">
        <section className="space-y-3 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-2xl">
          <div>
            <p className="text-xs font-black uppercase text-slate-200">{t(locale, 'workoutSession')}</p>
            <h2 className="mt-1 text-base font-black text-slate-100">
              {summary ? `${summary.session.date} / ${workoutStatusLabel(locale, summary.session.status)}` : locale === 'ko' ? '저장된 운동이 없습니다' : 'No workout saved yet'}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300 font-semibold">
              {summary
                ? `${exerciseCountLabel(locale, summary.exerciseCount)} / ${summary.session.totalStrengthVolumeKg.toLocaleString()} kg`
                : locale === 'ko' ? '운동을 완료하면 내보낼 기록이 생성됩니다.' : 'Complete a workout to generate an export.'}
            </p>
          </div>

          {summaries.length > 0 ? (
            <div className="space-y-3 pt-3.5 border-t border-slate-700/60">
              <label htmlFor="export-session-select" className="block text-xs font-extrabold text-slate-100">
                {locale === 'ko' ? '기록 선택' : 'Select Session'}
              </label>
              <select
                id="export-session-select"
                aria-label="Export workout session"
                value={summary?.session.id ?? ''}
                onChange={(event) => void handleSelectSummary(event.target.value)}
                className="min-h-10 w-full cursor-pointer rounded-xl border border-slate-650 bg-slate-850 px-3 text-sm font-bold text-slate-100 outline-none transition-all focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              >
                {summaries.map((item) => {
                  const routineDayName = getRoutineDayDisplayName(item.routineDay, locale) ?? t(locale, 'freeWorkout');
                  return (
                    <option key={item.session.id} value={item.session.id} className="bg-slate-900 text-slate-200">
                      {item.session.date} / {routineDayName} / {workoutStatusLabel(locale, item.session.status)} / {exerciseCountLabel(locale, item.exerciseCount)}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs font-semibold leading-relaxed text-slate-100">
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
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 px-4 text-sm font-black uppercase text-slate-955 shadow-lg shadow-cyan-400/20 transition-all duration-200 hover:from-cyan-300 hover:to-cyan-400 disabled:border disabled:border-slate-750 disabled:bg-slate-900 disabled:text-slate-500 disabled:shadow-none active:scale-95"
        >
          <Copy aria-hidden="true" size={16} />
          <span>{copyStatus === 'copied' ? t(locale, 'copied') : t(locale, 'copy')}</span>
        </button>

        <section className="space-y-3 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-2xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase text-slate-200">{t(locale, 'localData')}</p>
            <div className="flex items-center gap-1.5">
              {isPersisted ? (
                <span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-black text-emerald-300">
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  <span>Persistent</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/15 px-2 py-0.5 text-[11px] font-black text-amber-300">
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                  <span>Best-effort</span>
                </span>
              )}
              <button
                type="button"
                aria-label={locale === 'ko' ? '저장 방식 안내' : 'Storage information'}
                aria-expanded={showPersistenceInfo}
                onClick={() => setShowPersistenceInfo((current) => !current)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-650 bg-slate-850 text-cyan-300"
              >
                <Info aria-hidden="true" size={14} />
              </button>
            </div>
          </div>
          <h2 className="text-base font-black text-slate-100">{t(locale, 'backupRestore')}</h2>
          <p className="text-sm font-semibold leading-relaxed text-slate-100">
            {backupSummary ?? (
              locale === 'ko'
                ? '전체 JSON 백업에는 운동 기록, 루틴, 운동 라이브러리, 주간계획, 날짜별 계획이 모두 포함됩니다.'
                : t(locale, 'localDataNote')
            )}
          </p>
          {showPersistenceInfo && (
            <p className="rounded-xl border border-amber-800 bg-amber-950/25 px-3 py-2.5 text-xs font-bold leading-relaxed text-amber-100">
              {isPersisted
                ? locale === 'ko'
                  ? '이 기기에서는 지속 저장소가 허용되었습니다. 중요한 기록은 별도 JSON 백업도 보관하세요.'
                  : 'Persistent storage is enabled on this device. Keep a JSON backup for important records as well.'
                : locale === 'ko'
                  ? '모바일 기기에서 홈 화면에 추가해 설치하면 브라우저 저장소 유지 가능성이 높아집니다. 중요한 기록은 JSON 백업으로 보관하세요.'
                  : 'Installing to your home screen can improve storage persistence. Keep important records in a JSON backup.'}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => void handleBackup()}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-muted px-3 text-xs font-black text-primary transition-all duration-200 hover:bg-accent-soft active:scale-95"
            >
              <Download aria-hidden="true" size={15} />
              <span>{backupStatus === 'downloaded' ? t(locale, 'downloaded') : t(locale, 'backupJson')}</span>
            </button>
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-muted px-3 text-xs font-black text-primary transition-all duration-200 hover:bg-accent-soft active:scale-95">
              <Upload aria-hidden="true" size={15} />
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

        <section className="space-y-3 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-2xl">
          <div>
            <p className="text-xs font-black uppercase text-slate-200">
              {locale === 'ko' ? '설정 데이터' : 'Settings Data'}
            </p>
            <h2 className="mt-1 text-base font-black text-slate-100">
              {locale === 'ko' ? '루틴 / 운동 / 주간계획 백업' : 'Routine / Exercise / Weekly Plan Backup'}
            </h2>
          </div>
          <p className="text-sm font-semibold leading-relaxed text-slate-100">
            {settingsBackupStatus ?? (
              locale === 'ko'
                ? '운동 기록은 제외하고 설정에서 저장한 루틴, 루틴별 운동 구성, 운동 라이브러리, 주간계획, 날짜별 계획만 JSON으로 저장합니다.'
                : 'Export only settings: routines, routine exercise plans, exercise library, weekly plan, and date overrides. Workout logs are not included.'
            )}
          </p>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => void handleSettingsBackup()}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-muted px-3 text-xs font-black text-primary transition-all duration-200 hover:bg-accent-soft active:scale-95"
            >
              <Download aria-hidden="true" size={15} />
              <span>{locale === 'ko' ? '설정 저장' : 'Export Settings'}</span>
            </button>
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-muted px-3 text-xs font-black text-primary transition-all duration-200 hover:bg-accent-soft active:scale-95">
              <Upload aria-hidden="true" size={15} />
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

        <section className="space-y-3 rounded-2xl border border-slate-650 bg-slate-750/90 p-3.5 shadow-2xl">
          <div>
            <p className="text-xs font-black uppercase text-slate-200">
              {locale === 'ko' ? '운동 라이브러리' : 'Exercise Library'}
            </p>
            <h2 className="mt-1 text-base font-black text-slate-100">
              {locale === 'ko' ? 'CSV 일괄 수정' : 'Bulk CSV Edit'}
            </h2>
          </div>
          <p className="text-sm font-semibold leading-relaxed text-slate-100">
            {exerciseCsvStatus ?? (
              locale === 'ko'
                ? 'CSV를 내려받아 한글명, 영문명, 분류, 설명을 수정한 뒤 다시 가져오세요. categoryTags와 stageTags는 | 로 여러 값을 입력할 수 있습니다.'
                : 'Export the CSV, edit names, tags, and descriptions, then import it back. Use | for multiple categoryTags or stageTags.'
            )}
          </p>
          {exerciseCsvIssues.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-rose-800 bg-rose-950/25 px-4 py-3">
              <p className="text-sm font-black text-rose-200">
                {locale === 'ko' ? '가져오기 전 수정할 항목' : 'Items to fix before import'}
              </p>
              <ul className="grid gap-1 text-xs font-bold leading-relaxed text-rose-100">
                {exerciseCsvIssues.slice(0, 8).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              {exerciseCsvIssues.length > 8 ? (
                <p className="text-xs font-black text-rose-200">
                  {locale === 'ko'
                    ? `${exerciseCsvIssues.length - 8}개 항목이 더 있습니다.`
                    : `${exerciseCsvIssues.length - 8} more issues.`}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => void handleExerciseCsvExport()}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 px-3 text-xs font-bold text-slate-200 active:scale-95 transition-all duration-200"
            >
              <Download aria-hidden="true" size={15} />
              <span>{locale === 'ko' ? 'CSV 내보내기' : 'Export CSV'}</span>
            </button>
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 px-3 text-xs font-bold text-slate-200 active:scale-95 transition-all duration-200">
              <Upload aria-hidden="true" size={15} />
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

        <pre className="min-h-72 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-900 border border-slate-750 p-4 text-xs leading-relaxed font-semibold text-slate-200 shadow-inner">
          {markdown || t(locale, 'noMarkdown')}
        </pre>
      </div>
    </section>
  );
}
