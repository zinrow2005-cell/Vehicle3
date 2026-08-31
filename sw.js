'use strict';

const APP_VERSION = '5.6.7';
const CACHE_NAME = `vehicle-hub-${APP_VERSION}`;
const scopeUrl = path => new URL(path, self.registration.scope).href;
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './auth-sync.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './version.json'
].map(scopeUrl);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('vehicle-hub-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => caches.match(request)));
    return;
  }
  // Critical UI/input assets use network-first so iPad PWA cannot keep an older
  // keyboard fix alive after a deployment. Query-string cache busting is supported.
  if (/\/(?:styles\.css|app\.js|auth-sync\.js)$/.test(url.pathname)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response && response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
        return response;
      } catch {
        return (await caches.match(request)) || Response.error();
      }
    })());
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(scopeUrl('./index.html'), response.clone());
        return response;
      } catch {
        return (await caches.match(scopeUrl('./index.html'))) || (await caches.match(scopeUrl('./')));
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) {
      event.waitUntil(fetch(request).then(async response => {
        if (response && response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
      }).catch(() => {}));
      return cached;
    }
    try {
      const response = await fetch(request);
      if (response && response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('VehicleHubAutomation', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('state')) db.createObjectStore('state', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readRecord(key) {
  const db = await openDb();
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}

async function writeRecord(record) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const due = new Date(`${dateString}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((due - now) / 86400000);
}

async function runPeriodicReminderCheck() {
  const snapshot = await readRecord('snapshot');
  if (!snapshot?.enabled || !snapshot?.notifications || !Array.isArray(snapshot.alerts)) return;
  const urgent = snapshot.alerts.filter(item => {
    const days = daysUntil(item.targetDate);
    return item.level === 'overdue' || item.level === 'urgent' || (days !== null && days <= 7);
  });
  if (!urgent.length) return;
  const dateKey = localDateKey();
  const notificationState = await readRecord('notification-state');
  if (notificationState?.dateKey === dateKey) return;
  const body = urgent.slice(0, 4).map(item => `${item.vehicleName}｜${item.title}｜${item.dueText}`).join('\n') + (urgent.length > 4 ? `\n另有 ${urgent.length - 4} 項` : '');
  await self.registration.showNotification(`車輛提醒：${urgent.length} 項需注意`, {
    body,
    tag: `vehicle-hub-periodic-${dateKey}`,
    renotify: false,
    icon: scopeUrl('./icon.svg'),
    badge: scopeUrl('./icon.svg'),
    data: { url: scopeUrl('./index.html#automation') }
  });
  await writeRecord({ key: 'notification-state', dateKey, sentAt: new Date().toISOString() });
}

self.addEventListener('periodicsync', event => {
  if (event.tag === 'vehicle-reminder-check') event.waitUntil(runPeriodicReminderCheck());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'RUN_REMINDER_CHECK') event.waitUntil(runPeriodicReminderCheck());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || scopeUrl('./index.html#automation');
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
