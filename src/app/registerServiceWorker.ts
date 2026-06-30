export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  if (!import.meta.env.PROD) {
    window.addEventListener('load', () => {
      void Promise.all([
        navigator.serviceWorker.getRegistrations().then((registrations) => (
          Promise.all(registrations.map((registration) => registration.unregister()))
        )),
        'caches' in window
          ? caches.keys().then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))))
          : Promise.resolve([]),
      ]).then(() => {
        if (navigator.serviceWorker.controller && sessionStorage.getItem('setgo-dev-sw-cleared') !== 'true') {
          sessionStorage.setItem('setgo-dev-sw-cleared', 'true');
          window.location.reload();
        }
      });
    });
    return;
  }

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    }).then((registration) => {
      void registration.update();

      const checkForUpdate = () => {
        if (document.visibilityState === 'visible') {
          void registration.update();
        }
      };

      document.addEventListener('visibilitychange', checkForUpdate);
      window.addEventListener('focus', checkForUpdate);

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('setgo:update-ready'));
          }
        });
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.dispatchEvent(new CustomEvent('setgo:controller-changed'));
    });
  });
}
