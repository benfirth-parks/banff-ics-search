// Incident, operational period and handover logic.
import { db, uid, nowIso, save, patch, live } from '../db/db';
import type { IncidentType, Incident, OpPeriod, Team, Assignment, Handover, PositionLog, OrgSlot, CommsRow, Subject } from '../db/types';
import { positionTitle, isCustom } from '../data/positions';

export function makeCode() {
  const words = ['BOW', 'ELK', 'PIKA', 'LYNX', 'MARMOT', 'RAVEN', 'CEDAR', 'SPRUCE', 'LARCH', 'SUMMIT'];
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(1000 + Math.random() * 9000)}`;
}

const addHours = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3600_000).toISOString();

export function emptyOpPeriod(incidentId: string, number: number, start: string): OpPeriod {
  return {
    id: uid(), incidentId, updatedAt: nowIso(), number, start, end: addHours(start, 12), status: 'active',
    objectives: [], commandEmphasis: '', situationalAwareness: '', siteSafetyPlanRequired: false,
    siteSafetyPlanLocation: '', weather: '', iapComponents: ['202', '203', '204', '205', '206', '207', '208', 'Map'],
    preparedBy: '', approvedBy: '', actions: [], org: {}, comms: [], commsSpecialInstructions: '',
    aidStations: [], ambulances: [], hospitals: [], medicalProcedures: '', medicalAviation: false,
    safetyMessage: '', safetyPlan: '',
  };
}

export async function createIncident(input: { name: string; number: string; location: string; icName: string; exercise?: boolean; type?: IncidentType }) {
  const id = uid();
  const start = nowIso();
  const op = emptyOpPeriod(id, 1, start);
  // Prefill comms and medical from reference data so the 205/206 are never blank.
  const channels = await db.channels.toArray();
  op.comms = channels.map<CommsRow>((c) => ({
    zone: '', channel: c.channel, func: c.func, name: c.name, assignment: '', rxFreq: c.rxFreq,
    rxTone: c.tone, txFreq: c.txFreq, txTone: c.tone, mode: c.mode, remarks: '',
  }));
  op.hospitals = (await db.hospitals.toArray()).map(({ id: _id, ...h }) => h);
  if (input.icName) op.org.ic = { name: input.icName, since: start };
  const incident: Incident = {
    id, incidentId: id, updatedAt: start, name: input.name, number: input.number, type: input.type ?? 'missing-person',
    code: makeCode(), startedAt: start, location: input.location, caltopoUrl: '', currentOpPeriodId: op.id,
    situationSummary: '', mapNotes: '', exercise: input.exercise,
  };
  await save('incidents', incident);
  await save('opPeriods', op);
  const subject: Subject = {
    id: uid(), incidentId: id, updatedAt: start, name: '', age: '', sex: '', height: '', weight: '', build: '',
    hair: '', clothing: '', footwear: '', equipment: '', medical: '', experience: '', plan: '', lastSeenTime: '',
    lastSeenLocation: '', vehicle: '', contactName: '', notes: '',
  };
  await save('subjects', subject);
  if (input.icName) await logPosition(op, 'ic', input.icName, 'assigned', start);
  return incident;
}

async function logPosition(op: OpPeriod, positionKey: string, name: string, reason: PositionLog['reason'], start = nowIso()) {
  const rec: PositionLog = { id: uid(), incidentId: op.incidentId, updatedAt: start, opPeriodId: op.id, positionKey, name, start, reason };
  await save('positionLog', rec);
}

async function closeOpenStints(incidentId: string, positionKey: string, at: string) {
  const open = live(await db.positionLog.where('incidentId').equals(incidentId).toArray())
    .filter((p) => p.positionKey === positionKey && !p.end);
  for (const p of open) await patch<PositionLog>('positionLog', p.id, { end: at });
}

/** Assign a person to a position from the 203 editor (records history). */
export async function setPosition(op: OpPeriod, key: string, slot: OrgSlot | null) {
  const at = nowIso();
  const current = op.org[key];
  if (current?.name === slot?.name) {
    await patch<OpPeriod>('opPeriods', op.id, { org: { ...op.org, [key]: { ...current, ...slot! } } });
    return;
  }
  await closeOpenStints(op.incidentId, key, at);
  const org = { ...op.org };
  if (slot && slot.name) {
    org[key] = { ...slot, since: at };
    await logPosition(op, key, slot.name, 'assigned', at);
  } else if (isCustom(key) && current) org[key] = { ...current, ...slot, name: '', since: undefined }; // keep the added row
  else delete org[key];
  await patch<OpPeriod>('opPeriods', op.id, { org });
}

/** Remove a position added on the 203. */
export async function removeCustomPosition(op: OpPeriod, key: string) {
  if (!isCustom(key)) return;
  await closeOpenStints(op.incidentId, key, nowIso());
  const org = { ...op.org };
  delete org[key];
  await patch<OpPeriod>('opPeriods', op.id, { org });
}

/**
 * Roll over to the next operational period: copies org, objectives, comms,
 * medical and safety forward, and copies teams (status reset). Incomplete
 * assignments are copied as drafts so Plans can re-task them.
 */
export async function rolloverOpPeriod(incident: Incident, from: OpPeriod, start: string, end: string) {
  const at = nowIso();
  const { id: _id, updatedAt: _u, dirty: _d, ...rest } = from;
  const next: OpPeriod = {
    ...structuredClone(rest), id: uid(), updatedAt: at, number: from.number + 1, start, end, status: 'active',
    actions: [], preparedBy: '', approvedBy: '',
  };
  const org: Record<string, OrgSlot> = {};
  for (const [k, v] of Object.entries(from.org)) org[k] = { ...v, since: start };
  next.org = org;
  await save('opPeriods', next);
  await patch<OpPeriod>('opPeriods', from.id, { status: 'closed' });
  await patch<Incident>('incidents', incident.id, { currentOpPeriodId: next.id });

  // Position history: close previous stints, open new ones for the same people.
  for (const [k, v] of Object.entries(org)) {
    await closeOpenStints(incident.id, k, start);
    await logPosition(next, k, v.name, 'rollover', start);
  }

  const teams = live(await db.teams.where('opPeriodId').equals(from.id).toArray());
  const teamMap = new Map<string, string>();
  for (const t of teams) {
    const nt: Team = { ...structuredClone(t), id: uid(), opPeriodId: next.id, status: 'available', lastCheckIn: undefined };
    teamMap.set(t.id, nt.id);
    await save('teams', nt);
  }
  // Search map: same rings, segments and planned POD; searched-so-far is worked out from debriefs.
  const sm = live(await db.searchMaps.where('opPeriodId').equals(from.id).toArray())[0];
  if (sm) await save('searchMaps', { ...structuredClone(sm), id: uid(), opPeriodId: next.id });

  const asg = live(await db.assignments.where('opPeriodId').equals(from.id).toArray()).filter((a) => a.status !== 'complete');
  for (const a of asg) {
    const na: Assignment = {
      ...structuredClone(a), id: uid(), opPeriodId: next.id, status: 'draft', debrief: undefined,
      teamId: a.teamId ? teamMap.get(a.teamId) : undefined,
    };
    await save('assignments', na);
  }
  return next;
}

/** Per-position shift handover. Updates the org and position history. */
export async function recordHandover(op: OpPeriod, h: Omit<Handover, 'id' | 'incidentId' | 'updatedAt' | 'opPeriodId' | 'time'>) {
  const time = nowIso();
  let briefingSnapshot: string | undefined;
  if (h.isCommandTransfer) briefingSnapshot = JSON.stringify(await build201Snapshot(op.incidentId, op.id));
  const rec: Handover = { ...h, id: uid(), incidentId: op.incidentId, updatedAt: time, opPeriodId: op.id, time, briefingSnapshot };
  await save('handovers', rec);
  await closeOpenStints(op.incidentId, h.positionKey, time);
  await logPosition(op, h.positionKey, h.incoming, h.isCommandTransfer ? 'transfer-of-command' : 'handover', time);
  const prev = op.org[h.positionKey];
  await patch<OpPeriod>('opPeriods', op.id, {
    org: { ...op.org, [h.positionKey]: { ...prev, name: h.incoming, callSign: undefined, since: time } },
  });
  // Log on the 201 actions list so the briefing shows the change.
  await patch<OpPeriod>('opPeriods', op.id, {
    actions: [...op.actions, { time, action: `${positionTitle(h.positionKey, op.org)}: ${h.outgoing || '(vacant)'} handed over to ${h.incoming}` }],
  });
  return rec;
}

export interface Snapshot201 {
  takenAt: string;
  incident: Incident;
  op: OpPeriod;
  teams: Team[];
  assignments: Assignment[];
  resources: { resource: string; identifier: string; ordered: string; eta: string; arrived: boolean; notes: string }[];
}

export async function build201Snapshot(incidentId: string, opId: string): Promise<Snapshot201> {
  return {
    takenAt: nowIso(),
    incident: (await db.incidents.get(incidentId))!,
    op: (await db.opPeriods.get(opId))!,
    teams: live(await db.teams.where('opPeriodId').equals(opId).toArray()),
    assignments: live(await db.assignments.where('opPeriodId').equals(opId).toArray()),
    resources: live(await db.resources.where('incidentId').equals(incidentId).toArray()),
  };
}
