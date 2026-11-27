import Dexie, { type Table } from 'dexie';
import type {
  Incident, OpPeriod, Team, Assignment, CheckIn, Clue, Subject, PositionLog, Handover,
  ResourceRow, SearchMapRec, PickList, StaffMember, RadioChannel, AircraftCompany, TableName, BaseRecord,
} from './types';
import type { Hospital } from './types';
import type { Patient, RescueLogEntry } from '../modules/rescue/types';
import type { AvControlRec } from '../modules/avcontrol/model';

export interface Meta { key: string; value: string }

class IcsDb extends Dexie {
  incidents!: Table<Incident, string>;
  opPeriods!: Table<OpPeriod, string>;
  teams!: Table<Team, string>;
  assignments!: Table<Assignment, string>;
  checkIns!: Table<CheckIn, string>;
  clues!: Table<Clue, string>;
  subjects!: Table<Subject, string>;
  positionLog!: Table<PositionLog, string>;
  handovers!: Table<Handover, string>;
  resources!: Table<ResourceRow, string>;
  searchMaps!: Table<SearchMapRec, string>;
  avControl!: Table<AvControlRec, string>;
  pickLists!: Table<PickList, string>;
  staff!: Table<StaffMember, string>;
  channels!: Table<RadioChannel, string>;
  hospitals!: Table<Hospital & { id: string }, string>;
  aircraft!: Table<AircraftCompany, string>;
  meta!: Table<Meta, string>;
  patients!: Table<Patient, string>;
  rescueLog!: Table<RescueLogEntry, string>;

  constructor() {
    super('banff-ics-search');
    const synced = 'id, incidentId, updatedAt, dirty';
    this.version(1).stores({
      incidents: 'id, code, updatedAt, dirty',
      opPeriods: synced + ', number',
      teams: synced + ', opPeriodId',
      assignments: synced + ', opPeriodId, teamId',
      checkIns: synced + ', teamId, time',
      clues: synced + ', number',
      subjects: synced,
      positionLog: synced + ', positionKey, opPeriodId',
      handovers: synced + ', opPeriodId, time',
      resources: synced,
      pickLists: 'id',
      staff: 'id, name',
      channels: 'id',
      hospitals: 'id',
      aircraft: 'id',
      meta: 'key',
    });
    this.version(2).stores({ searchMaps: synced + ', opPeriodId' });
    // Avalanche control module (one record per op period).
    this.version(3).stores({ avControl: synced + ', opPeriodId' });
    // Large rescue module.
    this.version(4).stores({ patients: synced, rescueLog: synced + ', opPeriodId' });
  }
}

export const db = new IcsDb();

export const uid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

/** Save a synced record: stamps updatedAt and marks it dirty for the sync layer. */
export async function save<T extends BaseRecord>(table: TableName, rec: T): Promise<T> {
  const r = { ...rec, updatedAt: nowIso(), dirty: 1 as const };
  await (db[table] as unknown as Table<T, string>).put(r);
  return r;
}

export async function patch<T extends BaseRecord>(table: TableName, id: string, changes: Partial<T>) {
  await (db[table] as unknown as Table<T, string>).update(id, {
    ...changes, updatedAt: nowIso(), dirty: 1,
  } as never);
}

export async function softDelete(table: TableName, id: string) {
  await patch(table, id, { deleted: true });
}

export const live = <T extends BaseRecord>(rows: T[] | undefined) =>
  (rows ?? []).filter((r) => !r.deleted);
