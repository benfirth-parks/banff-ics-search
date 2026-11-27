// Avalanche control module: data model and the rules that decide when a
// control mission can reopen. One AvControlRec per operational period.
import type { BaseRecord } from '../../db/types';
import { db, live, save, uid, nowIso } from '../../db/db';

export type ClosureStatus = 'planned' | 'closed' | 'swept' | 'reopened';
export interface Closure {
  id: string;
  location: string; // e.g. "Hwy 93N gate at km 2"
  kind: string; // Road, Trail, Area, Ski area boundary
  guard: string; // person or team holding it
  callSign: string;
  status: ClosureStatus;
  closedAt?: string;
  sweptAt?: string;
  reopenedAt?: string;
  notes: string;
}

/** planned → fired | misfire | skipped; misfire → misfire-cleared once the charge is destroyed or recovered. */
export type ShotStatus = 'planned' | 'fired' | 'misfire' | 'misfire-cleared' | 'skipped';
export interface Target {
  id: string;
  path: string; // avalanche path name
  target: string; // target / shot point id
  method: string;
  charges: string; // number of charges on this target
  chargeSize: string; // e.g. "5 kg ANFO + booster"
  status: ShotStatus;
  firedAt?: string;
  result: string; // No result, Sluff, Slab, Cornice fall...
  size: string; // Canadian size 1-5
  runout: string; // where the debris stopped
  depositDepth: string; // m on the road
  notes: string;
}

export interface AvControlRec extends BaseRecord {
  opPeriodId: string;
  area: string;
  hazard: { alpine: string; treeline: string; below: string };
  problems: string;
  objective: string;
  aircraft: string;
  blaster: string; // Blaster in charge
  goNoGo: Record<string, boolean>;
  goDecision?: { at: string; by: string };
  explosives: { magazine: string; issued: string; returned: string; checkedBy: string };
  closures: Closure[];
  targets: Target[];
  cleanup: string; // debris clearing, plow, sweep notes
  roadClear?: boolean; // runouts inspected, debris cleared after control
  allClear?: { at: string; by: string };
}

export const HAZARD = ['', 'Low', 'Moderate', 'Considerable', 'High', 'Extreme'];
export const METHODS = ['Helicopter bomb', 'Hand charge', 'Avalauncher', 'Remote system (RACS)', 'Cornice charge'];
/** Canadian (OGRS) trigger codes for explosive control. */
export const TRIGGER: Record<string, string> = {
  'Helicopter bomb': 'Xh', 'Hand charge': 'Xe', Avalauncher: 'Xl', 'Remote system (RACS)': 'Xr', 'Cornice charge': 'Xc',
};
export const RESULTS = ['', 'No result', 'Sluff (loose)', 'Slab', 'Cornice fall', 'Cracking only'];
export const SIZES = ['', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];
export const RUNOUTS = ['', 'Stopped in track', 'Stopped above road', 'Reached ditch', 'Reached road', 'Crossed road'];
export const CLOSURE_KINDS = ['Road', 'Trail', 'Area', 'Ski area boundary', 'Rail'];

export const GO_NO_GO: [key: string, label: string][] = [
  ['bulletin', 'Avalanche bulletin, weather and visibility reviewed'],
  ['notified', 'Dispatch, RCMP and highway contractor notified of closure times'],
  ['closures', 'All closures in place and confirmed by radio'],
  ['swept', 'Closed area swept: no vehicles or people inside'],
  ['explosives', 'Explosives count checked with the Blaster in charge'],
  ['heli', 'Helicopter safety and loading briefing done'],
  ['comms', 'Radio check with every guard, the helicopter and the ICP'],
  ['misfire', 'Misfire procedure briefed'],
];

export const n = (s: string | undefined) => { const v = parseFloat(s ?? ''); return Number.isFinite(v) ? v : 0; };

export interface Status {
  phase: 'Planning' | 'Closing' | 'Ready (go)' | 'Control in progress' | 'Clean-up' | 'Reopened';
  closed: number; total: number; done: number; targets: number; misfires: number;
  used: number; outstanding: number; balance: number; blockers: string[];
}

/** Explosives balance and the checks that must pass before the all clear. */
export function status(r: AvControlRec): Status {
  const t = r.targets;
  const done = t.filter((x) => x.status !== 'planned').length;
  const misfires = t.filter((x) => x.status === 'misfire').length;
  const used = t.filter((x) => x.status === 'fired' || x.status === 'misfire-cleared').reduce((s, x) => s + n(x.charges || '1'), 0);
  const outstanding = t.filter((x) => x.status === 'misfire').reduce((s, x) => s + n(x.charges || '1'), 0);
  const balance = n(r.explosives.issued) - used - outstanding - n(r.explosives.returned);
  const cl = r.closures;
  const closed = cl.filter((c) => c.status !== 'planned').length;
  const blockers: string[] = [];
  if (t.some((x) => x.status === 'planned')) blockers.push(`${t.filter((x) => x.status === 'planned').length} target(s) not yet shot or skipped`);
  if (misfires) blockers.push(`${misfires} misfire(s) not cleared`);
  if (r.explosives.issued && balance !== 0) blockers.push(`Explosives do not balance (${balance > 0 ? balance + ' unaccounted' : -balance + ' over'})`);
  if (!r.explosives.issued) blockers.push('Charges issued not recorded');
  if (!r.roadClear) blockers.push('Road and runouts not yet inspected and cleared of debris');
  const go = Boolean(r.goDecision);
  const phase: Status['phase'] = r.allClear ? 'Reopened'
    : done > 0 && done === t.length ? 'Clean-up'
    : done > 0 ? 'Control in progress'
    : go ? 'Ready (go)'
    : closed > 0 ? 'Closing' : 'Planning';
  return { phase, closed, total: cl.length, done, targets: t.length, misfires, used, outstanding, balance, blockers };
}

export const blankClosure = (): Closure => ({ id: uid(), location: '', kind: 'Road', guard: '', callSign: '', status: 'planned', notes: '' });
export const blankTarget = (): Target => ({
  id: uid(), path: '', target: '', method: 'Helicopter bomb', charges: '1', chargeSize: '', status: 'planned',
  result: '', size: '', runout: '', depositDepth: '', notes: '',
});

export function emptyAvControl(incidentId: string, opPeriodId: string): AvControlRec {
  return {
    id: uid(), incidentId, opPeriodId, updatedAt: nowIso(), area: '', hazard: { alpine: '', treeline: '', below: '' },
    problems: '', objective: '', aircraft: '', blaster: '', goNoGo: {}, explosives: { magazine: '', issued: '', returned: '', checkedBy: '' },
    closures: [], targets: [], cleanup: '',
  };
}

/** New period's record: plan and closures carry over; targets not yet done (and uncleared misfires) carry over. */
export async function startFromPrevious(incidentId: string, opPeriodId: string) {
  const all = live(await db.avControl.where('incidentId').equals(incidentId).toArray()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const prev = all.find((r) => r.opPeriodId !== opPeriodId);
  const rec = emptyAvControl(incidentId, opPeriodId);
  if (prev) {
    Object.assign(rec, {
      area: prev.area, hazard: { ...prev.hazard }, problems: prev.problems, objective: prev.objective, aircraft: prev.aircraft, blaster: prev.blaster,
      closures: prev.allClear ? [] : prev.closures.map((c) => ({ ...c })),
      targets: prev.targets.filter((t) => t.status === 'planned' || t.status === 'misfire').map((t) => ({ ...t, id: uid() })),
    });
  }
  return save('avControl', rec);
}
