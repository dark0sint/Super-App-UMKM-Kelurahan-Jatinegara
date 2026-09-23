// Modul kecil untuk mendukung "Mode Offline": menyimpan aksi (penjualan, catatan keuangan,
// pergerakan stok) ke IndexedDB saat tidak ada internet, lalu mengirim semuanya sekaligus
// ke /api/sync/batch begitu koneksi kembali. Juga menyimpan salinan produk terakhir agar
// kasir tetap bisa dipakai tanpa sinyal.

const OfflineDB = (() => {
  const DB_NAME = 'umkm-jatinegara-offline';
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'client_uuid' });
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function uuid() {
    return 'off-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  async function queueAction(entity, payload) {
    const db = await open();
    const client_uuid = uuid();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite');
      tx.objectStore('queue').put({ client_uuid, entity, payload, created_at: new Date().toISOString(), status: 'pending' });
      tx.oncomplete = () => resolve(client_uuid);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getQueue() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readonly');
      const req = tx.objectStore('queue').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function removeFromQueue(client_uuid) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite');
      tx.objectStore('queue').delete(client_uuid);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function setCache(key, value) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readwrite');
      tx.objectStore('cache').put({ key, value, saved_at: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getCache(key) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readonly');
      const req = tx.objectStore('cache').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  // Kirim seluruh antrean ke server. Dipanggil otomatis saat event 'online' dan secara berkala.
  async function trySync(apiBase, token, onResult) {
    if (!navigator.onLine) return { synced: 0, pending: (await getQueue()).length };
    const queue = await getQueue();
    if (queue.length === 0) return { synced: 0, pending: 0 };

    try {
      const res = await fetch(`${apiBase}/api/sync/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: queue.map(q => ({ entity: q.entity, client_uuid: q.client_uuid, payload: q.payload })) }),
      });
      if (!res.ok) throw new Error('Sinkron gagal, akan dicoba lagi nanti.');
      const data = await res.json();
      let synced = 0;
      for (const r of data.results) {
        if (r.status === 'ok' || r.status === 'duplicate') {
          await removeFromQueue(r.client_uuid);
          synced++;
        }
      }
      if (onResult) onResult(data.results);
      return { synced, pending: (await getQueue()).length };
    } catch (e) {
      return { synced: 0, pending: queue.length, error: e.message };
    }
  }

  async function queueCount() {
    return (await getQueue()).length;
  }

  return { queueAction, getQueue, removeFromQueue, setCache, getCache, trySync, queueCount };
})();
