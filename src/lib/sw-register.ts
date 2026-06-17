/**
 * Service Worker Registration & Management
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;

      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            console.log('New version available! Refresh to update.');
          }
        });
      }
    });

    console.log('Service Worker registered successfully');
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

export async function unregisterServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.ready;
  for (const registration of await navigator.serviceWorker.getRegistrations()) {
    await registration.unregister();
  }
}

export function requestUpdate(): void {
  navigator.serviceWorker.ready.then((registration) => {
    if (registration.waiting) {
      registration.waiting.postMessage('skipWaiting');
    }
  });
}
