import { Download, RefreshCw, WifiOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getStoredLocale } from '../i18n/i18n';
import { createAutomaticBackup } from '../storage/autoBackup';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type AppVersion = {
  app?: string;
  builtAt?: string;
  commit?: string;
};

const VERSION_STORAGE_KEY = 'setgo-app-version';

function versionId(version: AppVersion | undefined): string | undefined {
  if (!version?.builtAt && !version?.commit) return undefined;
  return `${version.commit ?? 'unknown'}:${version.builtAt ?? 'unknown'}`;
}

async function fetchLatestAppVersion(): Promise<AppVersion | undefined> {
  const response = await fetch(`${import.meta.env.BASE_URL}app-version.json?ts=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!response.ok) return undefined;
  const version = await response.json() as AppVersion;
  return version.app === 'SetGo' ? version : undefined;
}

export function PwaStatus() {
  const [locale] = useState(() => getStoredLocale());
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | undefined>();
  const [installDismissed, setInstallDismissed] = useState(() => (
    window.localStorage.getItem('setgo-install-dismissed') === 'true'
  ));

  useEffect(() => {
    let cancelled = false;

    async function checkVersion() {
      if (!navigator.onLine) return;

      try {
        const latest = await fetchLatestAppVersion();
        const latestId = versionId(latest);
        if (!latestId || cancelled) return;

        const storedId = window.localStorage.getItem(VERSION_STORAGE_KEY);
        if (!storedId) {
          window.localStorage.setItem(VERSION_STORAGE_KEY, latestId);
          return;
        }

        if (storedId !== latestId) {
          window.dispatchEvent(new CustomEvent('setgo:update-ready'));
        }
      } catch {
        // Version polling is best-effort; service worker update events still run.
      }
    }

    function handleOnline() {
      setIsOnline(true);
      void checkVersion();
    }

    function handleOffline() {
      setIsOnline(false);
    }

    function handleUpdateReady() {
      setUpdateReady(true);
    }

    function handleControllerChanged() {
      window.location.reload();
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleFocus() {
      void checkVersion();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void checkVersion();
      }
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('setgo:update-ready', handleUpdateReady);
    window.addEventListener('setgo:controller-changed', handleControllerChanged);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void checkVersion();

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('setgo:update-ready', handleUpdateReady);
      window.removeEventListener('setgo:controller-changed', handleControllerChanged);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(undefined);
  }

  async function handleUpdate() {
    try {
      await createAutomaticBackup('before-update');
    } catch (error) {
      console.warn('Failed to create SetGo auto backup before update', error);
    }

    const registration = await navigator.serviceWorker?.getRegistration();
    await registration?.update();
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      return;
    }

    try {
      const latest = await fetchLatestAppVersion();
      const latestId = versionId(latest);
      if (latestId) window.localStorage.setItem(VERSION_STORAGE_KEY, latestId);
    } catch {
      // Reload still applies freshly fetched assets when service worker events are missed.
    }
    window.location.reload();
  }

  function dismissInstall() {
    window.localStorage.setItem('setgo-install-dismissed', 'true');
    setInstallDismissed(true);
  }

  if (!updateReady && isOnline && (!installPrompt || installDismissed)) return null;

  return (
    <section className="mx-auto max-w-md px-3.5 pt-3">
      <div className="flex items-center justify-between gap-2.5 rounded-xl border border-black/5 bg-white/90 backdrop-blur-md px-3 py-2.5 text-sm shadow-sm">
        <div className="flex min-w-0 items-center gap-2 text-[#1C1C1E]">
          {!isOnline ? <WifiOff aria-hidden="true" size={17} className="shrink-0 text-amber-500" /> : null}
          {updateReady ? <RefreshCw aria-hidden="true" size={17} className="shrink-0 text-[#2EC4B6]" /> : null}
          {isOnline && !updateReady && installPrompt && !installDismissed ? (
            <Download aria-hidden="true" size={17} className="shrink-0 text-[#2EC4B6]" />
          ) : null}
          <p className="truncate font-semibold">
            {!isOnline
              ? locale === 'ko' ? '오프라인 모드' : 'Offline mode'
              : updateReady
                ? locale === 'ko' ? '업데이트 준비됨' : 'Update ready'
                : locale === 'ko' ? 'SetGo 설치' : 'Install SetGo'}
          </p>
        </div>

        {updateReady ? (
          <button
            type="button"
            onClick={() => void handleUpdate()}
            className="ios-button-primary min-h-9 px-3 text-xs font-bold"
          >
            {locale === 'ko' ? '새로고침' : 'Reload'}
          </button>
        ) : null}

        {isOnline && !updateReady && installPrompt && !installDismissed ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleInstall()}
              className="ios-button-primary min-h-9 px-3 text-xs font-bold"
            >
              {locale === 'ko' ? '설치' : 'Install'}
            </button>
            <button
              type="button"
              onClick={dismissInstall}
              className="ios-button-secondary flex h-9 w-9 items-center justify-center"
              aria-label="Dismiss install prompt"
            >
              <X aria-hidden="true" size={15} />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
