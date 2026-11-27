import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, live, save, uid, nowIso, patch } from '../db/db';
import { blankSite, blankParty, type AvySite, type AvyParty, type AvyArea } from './types';

export function useAvy(incidentId: string | undefined) {
  const site = useLiveQuery(async () => (incidentId ? live(await db.avySites.where('incidentId').equals(incidentId).toArray()).sort((a, b) => a.id.localeCompare(b.id))[0] ?? null : null), [incidentId]);
  const parties = live(useLiveQuery(() => (incidentId ? db.avyParties.where('incidentId').equals(incidentId).toArray() : []), [incidentId]))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const areas = live(useLiveQuery(() => (incidentId ? db.avyAreas.where('incidentId').equals(incidentId).toArray() : []), [incidentId]))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  // Make sure every avalanche incident has its site record.
  useEffect(() => { if (incidentId && site === null) void ensureSite(incidentId); }, [incidentId, site]);
  return { site: site ?? undefined, parties, areas };
}

export async function ensureSite(incidentId: string): Promise<AvySite> {
  const existing = live(await db.avySites.where('incidentId').equals(incidentId).toArray())[0];
  if (existing) return existing;
  return save('avySites', blankSite(incidentId, uid(), nowIso()));
}

export const patchSite = (id: string, c: Partial<AvySite>) => patch<AvySite>('avySites', id, c);
export const patchParty = (id: string, c: Partial<AvyParty>) => patch<AvyParty>('avyParties', id, c);
export const patchArea = (id: string, c: Partial<AvyArea>) => patch<AvyArea>('avyAreas', id, c);

export async function addParty(incidentId: string, existing: AvyParty[]) {
  const n = existing.reduce((m, p) => Math.max(m, Number(p.label.replace(/\D/g, '')) || 0), 0) + 1;
  return save('avyParties', blankParty(incidentId, uid(), nowIso(), `P${n}`));
}

export async function addArea(incidentId: string, existing: AvyArea[]) {
  const letter = String.fromCharCode(65 + (existing.length % 26));
  const a: AvyArea = {
    id: uid(), incidentId, updatedAt: nowIso(), name: `Area ${letter}`, priority: 'medium', method: 'Transceiver signal search',
    teamText: '', status: 'not-started', coverage: '', description: '', notes: '',
  };
  return save('avyAreas', a);
}

/** Re-render every `ms` so burial timers count up. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(t); }, [ms]);
  return now;
}

export const minsLabel = (m: number | null) => (m == null ? '—' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`);
