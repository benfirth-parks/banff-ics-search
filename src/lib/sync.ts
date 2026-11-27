// Local-first sync. All edits land in IndexedDB first (works offline); when
// Supabase is configured and the device is online, dirty rows are pushed and
// remote changes pulled. Conflicts: last write (by updatedAt) wins per record.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Table } from 'dexie';
import { db } from '../db/db';
import { SYNC_TABLES, type BaseRecord, type TableName } from '../db/types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const syncEnabled = Boolean(url && key);
const sb: SupabaseClient | null = syncEnabled ? createClient(url!, key!) : null;

export type SyncState = { status: 'local-only' | 'offline' | 'syncing' | 'synced' | 'error'; lastSync?: string; pending: number; error?: string };
let state: SyncState = { status: syncEnabled ? 'offline' : 'local-only', pending: 0 };
const listeners = new Set<(s: SyncState) => void>();
const emit = (s: Partial<SyncState>) => { state = { ...state, ...s }; listeners.forEach((l) => l(state)); };
export const subscribeSync = (l: (s: SyncState) => void) => { listeners.add(l); l(state); return () => { listeners.delete(l); }; };

const tbl = (t: TableName) => db[t] as unknown as Table<BaseRecord, string>;

async function countPending(incidentId: string) {
  let n = 0;
  for (const t of SYNC_TABLES) n += await tbl(t).where('dirty').equals(1).filter((r) => r.incidentId === incidentId).count();
  return n;
}

/** Look up an incident by shared code on the server. Returns its id or null. */
export async function joinRemote(code: string): Promise<string | null> {
  if (!sb) return null;
  const { data, error } = await sb.rpc('ics_join', { p_code: code });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function syncNow(incidentId: string, code: string) {
  if (!sb) { emit({ status: 'local-only', pending: await countPending(incidentId) }); return; }
  if (!navigator.onLine) { emit({ status: 'offline', pending: await countPending(incidentId) }); return; }
  emit({ status: 'syncing' });
  try {
    // Push
    const rows: { tbl: TableName; data: BaseRecord }[] = [];
    for (const t of SYNC_TABLES) {
      const dirty = await tbl(t).where('dirty').equals(1).filter((r) => r.incidentId === incidentId).toArray();
      // incidents first so the server registers the code before other rows.
      for (const r of dirty) { const { dirty: _d, ...data } = r; rows.push({ tbl: t, data: data as BaseRecord }); }
    }
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await sb.rpc('ics_push', { p_code: code, p_rows: chunk });
      if (error) throw error;
      for (const r of chunk) {
        // Clear dirty only if not edited again since we read it.
        const cur = await tbl(r.tbl).get(r.data.id);
        if (cur && cur.updatedAt === r.data.updatedAt) await tbl(r.tbl).update(r.data.id, { dirty: 0 } as never);
      }
    }
    // Pull
    const cursorKey = `cursor:${incidentId}`;
    let since = (await db.meta.get(cursorKey))?.value ?? null;
    for (;;) {
      const { data, error } = await sb.rpc('ics_pull', { p_code: code, p_since: since });
      if (error) throw error;
      const list = (data ?? []) as { tbl: TableName; data: BaseRecord; server_ts: string }[];
      for (const r of list) {
        if (!SYNC_TABLES.includes(r.tbl)) continue;
        const local = await tbl(r.tbl).get(r.data.id);
        if (local?.dirty && local.updatedAt > r.data.updatedAt) continue;
        await tbl(r.tbl).put({ ...r.data, dirty: 0 });
      }
      if (list.length) { since = list[list.length - 1].server_ts; await db.meta.put({ key: cursorKey, value: since }); }
      if (list.length < 2000) break;
    }
    emit({ status: 'synced', lastSync: new Date().toISOString(), pending: await countPending(incidentId), error: undefined });
  } catch (e) {
    emit({ status: 'error', error: (e as Error).message, pending: await countPending(incidentId) });
  }
}

let timer: number | undefined;
export function startSync(incidentId: string, code: string) {
  stopSync();
  const run = () => void syncNow(incidentId, code);
  run();
  timer = window.setInterval(run, 15_000);
  window.addEventListener('online', run);
  (startSync as { run?: () => void }).run = run;
}
export function stopSync() {
  if (timer) window.clearInterval(timer);
  const run = (startSync as { run?: () => void }).run;
  if (run) window.removeEventListener('online', run);
}
