import type { Scene } from '../core/scene/types';
import { readDraft } from './draft';
export interface RecentFigure {
  id: string;
  name: string;
  scene: Scene;
  updated: number;
  thumbnail?: string;
}
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('lsngrace-library', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('figures', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  }));
}
async function request<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('figures', mode);
    const result = action(transaction.objectStore('figures'));
    transaction.oncomplete = () => resolve(result.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? Error('Histórico local indisponível.'));
  });
}
export async function recentFigures(): Promise<RecentFigure[]> {
  const records = await request<RecentFigure[]>('readonly', (store) => store.getAll());
  return records
    .filter((record) => readDraft(JSON.stringify({ scene: record.scene, name: record.name })))
    .sort((a, b) => b.updated - a.updated);
}
export function saveRecent(figure: RecentFigure) {
  return request('readwrite', (store) => store.put(figure));
}
export function deleteRecent(id: string) {
  return request('readwrite', (store) => store.delete(id));
}
