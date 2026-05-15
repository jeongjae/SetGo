import { ChevronLeft, Copy, Download, Upload } from 'lucide-react';
import { type ChangeEvent, useEffect, useState } from 'react';
import { createBackup, restoreBackup } from '../db/backup';
import { createExerciseCsv, importExerciseCsv } from '../db/exerciseCsv';
import {
  getRecentWorkoutSummaries,
  getWorkoutCardioRecords,
  getWorkoutExerciseLogs,
  type WorkoutSummary,
} from '../db/workouts';
import { getStoredLocale, t } from '../i18n/i18n';
import { formatWorkoutMarkdown } from '../utils/markdown';

type ExportPageProps = {
  onBack: () => void;
};

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

  async function loadSummaries(selectedSessionId?: string) {
    const recentSummaries = await getRecentWorkoutSummaries(20);
    const selectedSummary = recentSummaries.find((item) => item.session.id === selectedSessionId) ?? recentSummaries[0];
    setSummaries(recentSummaries);
    await loadMarkdown(selectedSummary);
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
      routineName: selectedSummary.routineName,
      routineDayName: selectedSummary.routineDay?.name,
      exercises,
      cardioRecords,
      locale,
    }));
  }

  useEffect(() => {
    async function load() {
      await loadSummaries();
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
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `setgo-backup-${backup.exportedAt.replace(/[:.]/g, '-').slice(0, 19)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setBackupSummary(
      locale === 'ko'
        ? `${backup.data.workoutSessions.length}개 세션, ${backup.data.exercises.length}개 운동, ${backup.data.routineExercisePlans.length}개 루틴 계획을 내보냈습니다.`
        : `${backup.data.workoutSessions.length} sessions, ${backup.data.exercises.length} exercises, ${backup.data.routineExercisePlans.length} routine plans exported.`,
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
    } catch (error) {
      console.error('Failed to restore SetGo backup', error);
      setRestoreStatus('failed');
      window.setTimeout(() => setRestoreStatus('idle'), 1600);
    } finally {
      event.target.value = '';
    }
  }

  async function handleExerciseCsvExport() {
    const csv = await createExerciseCsv();
    const bom = '\uFEFF';
    const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `setgo-exercises-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setExerciseCsvStatus(locale === 'ko' ? '운동 라이브러리 CSV를 내보냈습니다.' : 'Exercise library CSV exported.');
    window.setTimeout(() => setExerciseCsvStatus(undefined), 1600);
  }

  async function handleExerciseCsvImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedCount = await importExerciseCsv(await file.text());
      setExerciseCsvStatus(
        locale === 'ko'
          ? `${importedCount}개의 운동을 갱신했습니다.`
          : `${importedCount} exercises updated.`,
      );
      window.setTimeout(() => setExerciseCsvStatus(undefined), 1800);
    } catch (error) {
      console.error('Failed to import exercise CSV', error);
      setExerciseCsvStatus(locale === 'ko' ? 'CSV 가져오기에 실패했습니다.' : 'CSV import failed.');
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
          <h1 className="text-2xl font-bold text-white">{t(locale, 'markdownWorkoutLog')}</h1>
        </div>
      </header>

      <section className="rounded-lg bg-slate-900 p-5 shadow">
        <p className="text-sm font-medium text-slate-400">{t(locale, 'workoutSession')}</p>
        <h2 className="mt-1 text-xl font-semibold text-white">
          {summary ? `${summary.session.date} / ${summary.session.status}` : locale === 'ko' ? '저장된 운동이 없습니다' : 'No workout saved yet'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {summary
            ? `${summary.exerciseCount} exercises / ${summary.session.totalStrengthVolumeKg.toLocaleString()} kg`
            : locale === 'ko' ? '운동을 완료하면 내보낼 기록이 생성됩니다.' : 'Complete a workout to generate an export.'}
        </p>
        {summaries.length > 0 ? (
          <select
            aria-label="Export workout session"
            value={summary?.session.id ?? ''}
            onChange={(event) => void handleSelectSummary(event.target.value)}
            className="mt-4 min-h-11 w-full rounded-md bg-slate-800 px-3 text-sm text-white"
          >
            {summaries.map((item) => (
              <option key={item.session.id} value={item.session.id}>
                {item.session.date} / {item.session.status} / {item.routineDay?.name ?? 'Free'}
              </option>
            ))}
          </select>
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
        <p className="text-sm font-medium text-slate-400">{t(locale, 'localData')}</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{t(locale, 'backupRestore')}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{backupSummary ?? t(locale, 'localDataNote')}</p>
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
