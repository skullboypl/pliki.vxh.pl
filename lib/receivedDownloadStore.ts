/** Short-lived tokens for same-origin /received-file/ downloads (OPFS via SW). */

const DB_NAME = 'vxh_received_download';
const STORE_NAME = 'tokens';
const DB_VERSION = 1;

export type ReceivedDownloadRecord = {
  token: string;
  opfsEntryName: string;
  fileName: string;
  mime: string;
  size: number;
  expiresAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'token' });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function putReceivedDownloadRecord(record: ReceivedDownloadRecord): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE_NAME).put(record);
    });
  } finally {
    db.close();
  }
}

export async function getReceivedDownloadRecord(token: string): Promise<ReceivedDownloadRecord | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      tx.onerror = () => reject(tx.error);
      const req = tx.objectStore(STORE_NAME).get(token);
      req.onsuccess = () => resolve((req.result as ReceivedDownloadRecord | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
