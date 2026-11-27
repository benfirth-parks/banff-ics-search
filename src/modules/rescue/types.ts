// Large rescue mission module: data types.
// Incident-level mission details live on Incident.rescue; per-period plans
// (rope systems, aviation, rescuer safety) live on OpPeriod.rescue so they
// roll forward with the period. Patients and the flight / hazard-zone logs are
// their own synced tables because several people update them at once.
import type { BaseRecord } from '../../db/types';

export interface RescueMission {
  rescueType: string; // pick-list: technical rock, crevasse, ice, swiftwater...
  parties: string; // number of parties / patients reported
  location: string; // site description, elevation, aspect
  coords: string;
  mechanism: string; // what happened
  access: string; // access / egress routes
  reportingParty: string;
  notes: string;
}

export interface RopeSystem {
  name: string;
  type: string; // Lower, Raise, Highline, Guiding line, Rappel/access, Fixed line
  location: string;
  anchors: string;
  mainline: string;
  belay: string;
  ma: string; // mechanical advantage
  rigger: string;
  edge: string;
  attendant: string;
  checkedBy: string;
  status: string; // Planned, Rigged, Checked, In use, Stripped
}

export interface AircraftAssigned {
  callSign: string;
  company: string;
  reg: string;
  type: string;
  pilot: string;
  hfrs: boolean; // human external cargo / HFRS capable
  longline: string;
  status: string;
}

export interface Helispot { name: string; coords: string; elevation: string; notes: string }

export interface HazardRow { hazard: string; present: boolean; mitigation: string }

export interface RescuePeriod {
  // Technical
  techLead: string;
  techPlan: string;
  ropeSystems: RopeSystem[];
  // Aviation / HFRS
  aircraft: AircraftAssigned[];
  helispots: Helispot[];
  aviationMinimums: string;
  lastLight: string;
  hfrsSpotter: string;
  hfrsNotes: string;
  // Medical emphasis
  careLevel: string;
  hospitalPreAlert: string;
  massCasualty: boolean;
  medicalNotes: string;
  // Rescuer safety
  hazards: HazardRow[];
  abortTriggers: string[];
  workRest: string;
  goNoGo: 'go' | 'hold' | 'no-go' | '';
  goNoGoBy: string;
  goNoGoTime: string;
}

export type Triage = 'Red' | 'Yellow' | 'Green' | 'Black' | 'Unknown';
export type PatientStatus = 'reported' | 'located' | 'accessed' | 'packaged' | 'evacuating' | 'transferred' | 'deceased';

export interface Vitals { time: string; loc: string; hr: string; rr: string; bp: string; spo2: string; temp: string; gcs: string; notes: string }

export interface Patient extends BaseRecord {
  label: string; // "P1"
  name: string;
  age: string;
  sex: string;
  triage: Triage;
  status: PatientStatus;
  location: string;
  injuries: string;
  treatment: string;
  packaging: string; // pick-list: Bauman bag, vacuum mattress, litter...
  evacMethod: string; // HFRS, ground lower, carry-out, walk-out, ambulance
  destination: string;
  receivingEms: string;
  transferredAt: string;
  vitals: Vitals[];
  notes: string;
}

/** Flight log or hazard-zone accountability entry, per op period. */
export interface RescueLogEntry extends BaseRecord {
  opPeriodId: string;
  kind: 'flight' | 'zone';
  time: string; // ISO
  // flight
  aircraft?: string;
  mission?: string; // Recon, Insert, Extract, HFRS, Sling load, Medevac
  from?: string;
  to?: string;
  load?: string; // people / weight / patient
  // zone (person entering a hazard zone)
  person?: string;
  zone?: string;
  outAt?: string; // ISO, when they left the zone
  notes: string;
}

export const RESCUE_TYPES = [
  'Technical rock / cliff', 'Crevasse / glacier', 'Steep snow / ice', 'Multi-pitch climbing accident',
  'Swiftwater / canyon', 'Cave / mine', 'Lift / gondola evacuation', 'Aircraft crash', 'Multi-party mountaineering', 'Other',
];
export const ROPE_TYPES = ['Lower', 'Raise', 'Highline', 'Guiding line', 'Rappel / access', 'Fixed line', 'Tensioned line'];
export const ROPE_STATUS = ['Planned', 'Rigged', 'Checked', 'In use', 'Stripped'];
export const FLIGHT_MISSIONS = ['Recon', 'Insert rescuers', 'Extract rescuers', 'HFRS (longline)', 'Sling load', 'Medevac', 'Fuel / reposition'];
export const PACKAGING = ['None (walking)', 'Bauman / evac bag', 'Vacuum mattress + litter', 'Spine board + litter', 'Screamer suit / triangle', 'Horizontal litter (HFRS)'];
export const EVAC_METHODS = ['HFRS / longline', 'Helicopter internal', 'Ground lower', 'Raise to top', 'Carry-out', 'Walk-out', 'Ground ambulance'];
export const TRIAGE: Triage[] = ['Red', 'Yellow', 'Green', 'Black', 'Unknown'];
export const PATIENT_STATUS: PatientStatus[] = ['reported', 'located', 'accessed', 'packaged', 'evacuating', 'transferred', 'deceased'];

export const DEFAULT_HAZARDS: HazardRow[] = [
  'Rockfall / loose rock', 'Avalanche', 'Crevasse / glacier travel', 'Cornice or serac', 'Weather (wind, visibility, cold)',
  'Darkness / last light', 'Helicopter operations (rotor wash, hook-up)', 'Edge / fall exposure', 'Water / swiftwater',
  'Fatigue / long duration', 'Altitude / cold injury',
].map((hazard) => ({ hazard, present: false, mitigation: '' }));

export const DEFAULT_ABORT = [
  'Rockfall or avalanche activity above the work site: pull everyone back to the safe zone.',
  'Weather below aviation minimums: no flights, ground teams hold at a safe location.',
  'No comms with field team for 30 min: Ops initiates a check, no new insertions.',
  'Last light minus 45 min: last HFRS flight or teams bivouac with overnight kit.',
];

export function emptyRescuePeriod(): RescuePeriod {
  return {
    techLead: '', techPlan: '', ropeSystems: [], aircraft: [], helispots: [], aviationMinimums: '', lastLight: '', hfrsSpotter: '', hfrsNotes: '',
    careLevel: '', hospitalPreAlert: '', massCasualty: false, medicalNotes: '',
    hazards: structuredClone(DEFAULT_HAZARDS), abortTriggers: [...DEFAULT_ABORT], workRest: '', goNoGo: '', goNoGoBy: '', goNoGoTime: '',
  };
}

export const emptyMission = (): RescueMission => ({ rescueType: '', parties: '', location: '', coords: '', mechanism: '', access: '', reportingParty: '', notes: '' });
