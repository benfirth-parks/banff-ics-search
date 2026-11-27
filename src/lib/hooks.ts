import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db, live, patch } from '../db/db';
import type { Table } from 'dexie';
import type { OpPeriod, Incident, Team, Assignment, CheckIn, Clue, Handover, PositionLog, ResourceRow, Subject, SearchMapRec } from '../db/types';
import type { Patient, RescueLogEntry } from '../modules/rescue/types';
import { subscribeSync, type SyncState } from './sync';
import { fmt } from '../components/ui';
import type { AvControlRec } from '../modules/avcontrol/model';

export function useIncident(id: string | undefined) {
  return useLiveQuery(() => (id ? db.incidents.get(id) : undefined), [id]);
}

export function useOpPeriods(incidentId: string | undefined) {
  return live(useLiveQuery(() => (incidentId ? db.opPeriods.where('incidentId').equals(incidentId).sortBy('number') : []), [incidentId]));
}

/** The op period being viewed: an explicit selection, else the incident's current one. */
export function useOp(incident: Incident | undefined, selectedId?: string) {
  const id = selectedId || incident?.currentOpPeriodId;
  const op = useLiveQuery(() => (id ? db.opPeriods.get(id) : undefined), [id]);
  const update = (changes: Partial<OpPeriod>) => op && patch<OpPeriod>('opPeriods', op.id, changes);
  return { op, update };
}

interface RowTypes {
  teams: Team; assignments: Assignment; checkIns: CheckIn; clues: Clue; handovers: Handover;
  positionLog: PositionLog; resources: ResourceRow; subjects: Subject; searchMaps: SearchMapRec;
  patients: Patient; rescueLog: RescueLogEntry;
  avControl: AvControlRec;
}

export function useTable<K extends keyof RowTypes>(table: K, incidentId: string | undefined, opPeriodId?: string): RowTypes[K][] {
  const rows = useLiveQuery(async () => {
    if (!incidentId) return [];
    const all = (await (db[table] as unknown as Table<RowTypes[K], string>).where('incidentId').equals(incidentId).toArray()) as (RowTypes[K] & { opPeriodId?: string })[];
    return opPeriodId ? all.filter((r) => r.opPeriodId === opPeriodId) : all;
  }, [table, incidentId, opPeriodId]);
  const out = live(rows);
  if (table === 'teams') (out as unknown as Team[]).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return out;
}

export function usePickList(id: string) {
  return useLiveQuery(() => db.pickLists.get(id), [id])?.items ?? [];
}

export function useSyncState() {
  const [s, setS] = useState<SyncState>({ status: 'local-only', pending: 0 });
  useEffect(() => subscribeSync(setS), []);
  return s;
}

export const opLabel = (op?: OpPeriod) => (op ? `#${op.number}  ${fmt(op.start)} to ${fmt(op.end)}` : '');
