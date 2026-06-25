// Device-level helpers for rest-timer feedback within PWA constraints.
// All helpers degrade gracefully when a capability is unavailable (e.g. iOS Safari).

const NOTIFY_PREF_KEY = 'setgo.restTimerNotify';

export type RestNotifyPermission = NotificationPermission | 'unsupported';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): RestNotifyPermission {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export function loadRestNotifyPref(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(NOTIFY_PREF_KEY) === 'true' && notificationPermission() === 'granted';
}

export function saveRestNotifyPref(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(NOTIFY_PREF_KEY, enabled ? 'true' : 'false');
}

export async function requestRestNotifyPermission(): Promise<RestNotifyPermission> {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

// Fire a notification only when the tab is hidden; the on-screen timer covers the foreground case.
export function notifyRestComplete(title: string, body: string): void {
  if (notificationPermission() !== 'granted') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;

  const fallback = () => {
    try {
      // eslint-disable-next-line no-new
      new Notification(title, { body, tag: 'setgo-rest-timer' });
    } catch {
      // ignore failures
    }
  };

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration()
      .then((registration) => {
        if (registration) {
          const baseUrl = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.BASE_URL : '/';
          registration.showNotification(title, {
            body,
            tag: 'setgo-rest-timer',
            icon: `${baseUrl}icon.svg`,
            vibrate: [200, 100, 200],
          } as any).catch(() => {
            fallback();
          });
        } else {
          fallback();
        }
      })
      .catch(() => {
        fallback();
      });
  } else {
    fallback();
  }
}

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
}

// --- Screen Wake Lock --------------------------------------------------------
// Re-acquires the lock when the tab returns to the foreground, since the browser
// releases it automatically whenever the page is hidden.

type WakeLockSentinelLike = { release: () => Promise<void>; released: boolean };
type WakeLockApi = { request: (type: 'screen') => Promise<WakeLockSentinelLike> };

function wakeLockApi(): WakeLockApi | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
}

export function isWakeLockSupported(): boolean {
  return Boolean(wakeLockApi());
}

let wakeLock: WakeLockSentinelLike | null = null;
let wantWakeLock = false;
let listenerAttached = false;

async function acquireWakeLock(): Promise<void> {
  const api = wakeLockApi();
  if (!api || !wantWakeLock || (wakeLock && !wakeLock.released)) return;
  try {
    wakeLock = await api.request('screen');
  } catch {
    wakeLock = null;
  }
}

function handleVisibilityChange(): void {
  if (wantWakeLock && typeof document !== 'undefined' && document.visibilityState === 'visible') {
    void acquireWakeLock();
  }
}

export function enableWakeLock(): void {
  if (!isWakeLockSupported()) return;
  wantWakeLock = true;
  if (!listenerAttached && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    listenerAttached = true;
  }
  void acquireWakeLock();
}

export async function disableWakeLock(): Promise<void> {
  wantWakeLock = false;
  if (listenerAttached && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    listenerAttached = false;
  }
  const current = wakeLock;
  wakeLock = null;
  if (current && !current.released) {
    try {
      await current.release();
    } catch {
      // ignore release failures
    }
  }
}
