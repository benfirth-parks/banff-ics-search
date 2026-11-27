// Large avalanche incident module: data types. Stored in their own synced
// tables (avySites, avyParties, avyAreas) so the core search model is untouched.
import type { BaseRecord } from '../db/types';

export interface AvyChecklistItem { key: string; text: string; done: boolean; time?: string; by?: string }
export interface RescuerOnDebris { name: string; team: string; inAt: string; outAt?: string }

/** One record per incident: the avalanche itself, the site hazard and rescue phases. */
export interface AvySite extends BaseRecord {
  avalancheTime: string; // ISO, when the slide happened (drives burial timers)
  reportedTime: string;
  reportedBy: string;
  path: string; // avalanche path / location name
  coords: string;
  size: string; // D1-D5
  avyType: string; // slab, loose, cornice...
  trigger: string;
  aspect: string;
  elevation: string;
  debrisLength: string;
  debrisWidth: string;
  debrisDepth: string;
  partiesReported: string; // reported number involved, as told
  witnessLastSeen: string; // last-seen points, as told by witnesses
  // Hazard / rescuer safety
  dangerAlp: string; dangerTl: string; dangerBtl: string;
  overheadHazard: string; // assessment of hang-fire / adjacent paths
  overheadLevel: 'unknown' | 'low' | 'moderate' | 'high';
  guardName: string;
  guardPosition: string;
  guardChannel: string;
  alarmSignal: string;
  escapeRoutes: string;
  safeZone: string;
  controlDone: string; // explosives / control on adjacent paths
  maxOnDebris: string; // limit of rescuers exposed at once
  onDebris: RescuerOnDebris[];
  checklist: AvyChecklistItem[];
  notes: string;
}

export type PartyStatus =
  | 'unaccounted' | 'searching' | 'located-buried' | 'extricating' | 'extricated'
  | 'located-surface' | 'self-rescued' | 'accounted-safe' | 'deceased';

export type Triage = '' | 'red' | 'yellow' | 'green' | 'black';

/** An involved party: each person caught, buried or still unaccounted for. */
export interface AvyParty extends BaseRecord {
  label: string; // P1, P2...
  name: string;
  description: string; // clothing, gear, group
  lastSeen: string;
  transceiver: 'yes' | 'no' | 'unknown';
  recco: boolean;
  status: PartyStatus;
  areaId?: string;
  locatedBy: string;
  locatedAt?: string; // ISO
  locatedHow: string; // transceiver, probe line, dog, visual, RECCO...
  locationNote: string; // coords / marker flag
  burialDepth: string; // cm
  headUphill?: boolean;
  extricatedAt?: string; // ISO
  airway: '' | 'clear' | 'obstructed' | 'air-pocket' | 'unknown';
  triage: Triage;
  condition: string; // LOC, injuries, core temp, treatment
  medic: string;
  transport: string; // heli, sled, ground
  destination: string;
  departedAt?: string; // ISO, left site
  notes: string;
}

export type AreaMethod = 'Transceiver signal search' | 'RECCO' | 'Dog' | 'Spot probe' | 'Probe line (coarse)' | 'Probe line (fine)' | 'Visual / surface clue' | 'Strategic shovelling';

/** A search area on the debris: who is searching it, how, and how far along. */
export interface AvyArea extends BaseRecord {
  name: string; // Area A, toe, likely burial zone...
  priority: 'high' | 'medium' | 'low';
  method: string;
  teamId?: string;
  teamText: string;
  status: 'not-started' | 'in-progress' | 'complete' | 'suspended';
  coverage: string; // percent
  description: string;
  notes: string;
}

export const STATUS_LABEL: Record<PartyStatus, string> = {
  unaccounted: 'Unaccounted for', searching: 'Being searched for', 'located-buried': 'Located, buried',
  extricating: 'Being dug out', extricated: 'Extricated', 'located-surface': 'Found on surface',
  'self-rescued': 'Self-rescued', 'accounted-safe': 'Accounted for (not buried)', deceased: 'Deceased',
};
/** Still under the snow or not yet found: the people the rescue is racing for. */
export const STILL_MISSING: PartyStatus[] = ['unaccounted', 'searching', 'located-buried', 'extricating'];

export const TRIAGE_LABEL: Record<Exclude<Triage, ''>, string> = {
  red: 'Red: immediate', yellow: 'Yellow: delayed', green: 'Green: minor', black: 'Black: deceased / expectant',
};

export const AREA_METHODS: AreaMethod[] = [
  'Transceiver signal search', 'RECCO', 'Dog', 'Spot probe', 'Probe line (coarse)', 'Probe line (fine)', 'Visual / surface clue', 'Strategic shovelling',
];

export const DEFAULT_CHECKLIST: [key: string, text: string][] = [
  ['alarm', 'Alarm raised, avalanche dispatch and resources requested'],
  ['hazard', 'Site hazard assessed (overhead hazard, adjacent paths, hang-fire)'],
  ['guard', 'Avalanche guard / spotter posted with radio and alarm signal'],
  ['escape', 'Escape routes and safe zone briefed to all rescuers'],
  ['witness', 'Witnesses interviewed: number involved, last-seen points'],
  ['lsp', 'Last-seen points and flow line marked on debris'],
  ['transceiver', 'Transceiver signal search of debris (all rescuers to search or off)'],
  ['surface', 'Surface search for clues (equipment, limbs), clues flagged'],
  ['recco', 'RECCO search'],
  ['dog', 'Avalanche dog teams deployed'],
  ['spot', 'Spot probing of likely burial areas'],
  ['probe', 'Probe lines organised on remaining likely areas'],
  ['medical', 'Medical / patient care station set up, hypothermia kit ready'],
  ['transport', 'Patient transport arranged (heli / ground) and hospital notified'],
  ['account', 'All involved parties accounted for'],
  ['demob', 'Debris cleared of rescuers, accountability check of all rescuers'],
];

export const blankSite = (incidentId: string, id: string, now: string): AvySite => ({
  id, incidentId, updatedAt: now, avalancheTime: '', reportedTime: '', reportedBy: '', path: '', coords: '', size: '', avyType: '', trigger: '',
  aspect: '', elevation: '', debrisLength: '', debrisWidth: '', debrisDepth: '', partiesReported: '', witnessLastSeen: '',
  dangerAlp: '', dangerTl: '', dangerBtl: '', overheadHazard: '', overheadLevel: 'unknown', guardName: '', guardPosition: '', guardChannel: '',
  alarmSignal: '3 long whistle blasts + "AVALANCHE" on radio', escapeRoutes: '', safeZone: '', controlDone: '', maxOnDebris: '', onDebris: [],
  checklist: DEFAULT_CHECKLIST.map(([key, text]) => ({ key, text, done: false })), notes: '',
});

export const blankParty = (incidentId: string, id: string, now: string, label: string): AvyParty => ({
  id, incidentId, updatedAt: now, label, name: '', description: '', lastSeen: '', transceiver: 'unknown', recco: false, status: 'unaccounted',
  locatedBy: '', locatedHow: '', locationNote: '', burialDepth: '', airway: '', triage: '', condition: '', medic: '', transport: '', destination: '', notes: '',
});

/** Burial time in minutes: from the avalanche to extrication (or now if still buried). */
export function burialMinutes(site: AvySite | undefined, p: AvyParty, now = Date.now()): number | null {
  if (!site?.avalancheTime) return null;
  if (!['unaccounted', 'searching', 'located-buried', 'extricating', 'extricated', 'deceased'].includes(p.status)) return null;
  const end = p.extricatedAt ? new Date(p.extricatedAt).getTime() : (STILL_MISSING.includes(p.status) ? now : null);
  if (end == null) return null;
  return Math.max(0, Math.round((end - new Date(site.avalancheTime).getTime()) / 60000));
}

/** Survival phase for a complete burial (after Brugger/Haegeli survival curve). Guidance only. */
export function burialPhase(min: number): { label: string; cls: string } {
  if (min <= 18) return { label: 'Survival phase (≤18 min)', cls: 'ph-ok' };
  if (min <= 35) return { label: 'Asphyxia phase (18–35 min)', cls: 'ph-warn' };
  if (min <= 90) return { label: 'Latent phase (35–90 min): air pocket matters', cls: 'ph-bad' };
  return { label: '>90 min: hypothermia risk, handle gently', cls: 'ph-bad' };
}
