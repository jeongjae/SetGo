import { Download, RefreshCw, WifiOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getStoredLocale } from '../i18n/i18n';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function PwaStatus() {
  const [locale] = useState(() => getStoredLocale());
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | undefined>();
  const [installDismissed, setInstallDismissed] = useState(() => (
    window.localStorage.getItem('setgo-install-dismissed') === 'true'
  ));

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
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

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('setgo:update-ready', handleUpdateReady);
    window.addEventListener('setgo:controller-changed', handleControllerChanged);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('setgo:update-ready', handleUpdateReady);
      window.removeEventListener('setgo:controller-changed', handleControllerChanged);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(undefined);
  }

  async function handleUpdate() {
    const registration = await navigator.serviceWorker?.getRegistration();
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
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
