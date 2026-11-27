// Core data model. Every synced record shares BaseRecord so the sync layer can
// treat all tables the same way (last-write-wins on updatedAt, soft delete).

export interface BaseRecord {
  id: string;
  incidentId: string;
  updatedAt: string; // ISO
  deleted?: boolean;
  dirty?: 0 | 1; // 1 = changed locally, not yet pushed
}

/** Incident types. v1 only supports missing-person, but the field exists so
 * other types (avalanche, technical rescue, wildfire support) can be added. */
export type IncidentType = 'missing-person' | 'large-rescue';

export interface Incident extends BaseRecord {
  name: string;
  number: string;
  type: IncidentType;
  code: string; // shared sign-in code
  startedAt: string;
  location: string;
  caltopoUrl: string;
  currentOpPeriodId?: string;
  // ICS 201 parts that belong to the incident, not a period
  situationSummary: string;
  mapNotes: string;
  exercise?: boolean;
  /** Large rescue mission module (type 'large-rescue'). */
  rescue?: import('../modules/rescue/types').RescueMission;
}

export interface OrgSlot {
  name: string;
  callSign?: string;
  agency?: string;
  contact?: string;
  since?: string;
  /** Added positions only (keys starting "x-"): title, 203 section and who they report to. */
  title?: string;
  section?: string;
  reportsTo?: string;
}

export interface CommsRow {
  zone: string;
  channel: string;
  func: string;
  name: string;
  assignment: string;
  rxFreq: string;
  rxTone: string;
  txFreq: string;
  txTone: string;
  mode: string;
  remarks: string;
}

export interface AidStation { name: string; location: string; contact: string; paramedics: boolean }
export interface Ambulance { service: string; location: string; contact: string; level: string }
export interface Hospital {
  name: string; address: string; latLon: string; contact: string;
  airTime: string; groundTime: string; trauma: string; burn: boolean; helipad: boolean;
}

export interface OpPeriod extends BaseRecord {
  number: number;
  start: string;
  end: string;
  status: 'planning' | 'active' | 'closed';
  // ICS 202
  objectives: string[];
  commandEmphasis: string;
  situationalAwareness: string;
  siteSafetyPlanRequired: boolean;
  siteSafetyPlanLocation: string;
  weather: string;
  iapComponents: string[];
  preparedBy: string;
  approvedBy: string;
  // ICS 201 (per period)
  actions: { time: string; action: string }[];
  // ICS 203 / 207: position key -> person
  org: Record<string, OrgSlot>;
  // ICS 205
  comms: CommsRow[];
  commsSpecialInstructions: string;
  // ICS 206
  aidStations: AidStation[];
  ambulances: Ambulance[];
  hospitals: Hospital[];
  medicalProcedures: string;
  medicalAviation: boolean;
  // ICS 208
  safetyMessage: string;
  safetyPlan: string;
  /** Large rescue mission module: per-period technical, aviation, medical and safety plan. */
  rescue?: import('../modules/rescue/types').RescuePeriod;
}

export interface Team extends BaseRecord {
  opPeriodId: string;
  name: string; // e.g. "Team 1" / "Alpha"
  type: string; // pick-list: Hasty, Grid, Dog, Heli...
  leader: string;
  leaderCallSign: string;
  members: string[];
  contact: string;
  status: 'available' | 'assigned' | 'in-field' | 'returning' | 'out-of-service';
  lastCheckIn?: string;
  /** Position key the strike team reports to (defaults to Ground Branch, else Operations). */
  reportsTo?: string;
}

export interface Assignment extends BaseRecord {
  opPeriodId: string;
  number: string;
  teamId?: string;
  branch: string;
  division: string;
  segment: string;
  caltopoRef: string;
  work: string;
  specialInstructions: string;
  commsChannel: string;
  status: 'draft' | 'assigned' | 'in-field' | 'complete';
  debrief?: Debrief;
}

export interface Debrief {
  completedAt: string;
  areaCovered: string;
  coverageEstimate: string;
  hazards: string;
  cluesSummary: string;
  notSearched: string;
  suggestions: string;
  by: string;
  /** Team's estimate of achieved POD for a responsive subject, 0-100. */
  podAchieved?: string;
}

export interface CheckIn extends BaseRecord {
  teamId: string;
  assignmentId?: string;
  time: string;
  status: string;
  message: string;
  lat?: number;
  lon?: number;
  by: string;
}

export interface Clue extends BaseRecord {
  number: number;
  teamId?: string;
  assignmentId?: string;
  time: string;
  description: string;
  lat?: number;
  lon?: number;
  photo?: string; // compressed data URL
  foundBy: string;
  action: string;
}

export interface Subject extends BaseRecord {
  name: string;
  age: string;
  sex: string;
  height: string;
  weight: string;
  build: string;
  hair: string;
  clothing: string;
  footwear: string;
  equipment: string;
  medical: string;
  experience: string;
  plan: string;
  lastSeenTime: string;
  lastSeenLocation: string;
  vehicle: string;
  contactName: string;
  photo?: string;
  notes: string;
  // Search planning inputs (feed the Search map)
  planningCoord?: string; // as typed: decimal degrees, DMS or UTM
  planningPointKind?: 'IPP' | 'LKP' | 'PLS';
  travelBearing?: string; // degrees true, blank if unknown
  category?: string; // Lost Person Behavior category
  terrain?: string;
}

/** Search map settings for one operational period (rings, segments, planned POD). */
export interface SearchMapRec extends BaseRecord {
  opPeriodId: string;
  settings: {
    manual: boolean;
    rings: { percent: string; value: string }[];
    ringSource: string;
    dispersion: { percent: string; value: string }[];
    dispersionSource: string;
    sectors: string;
    segRings: string[];
    trailWidth: string;
    trailPiece: string;
    trailRings: string[];
  };
  trails?: { name: string; lines: { lng: number; lat: number }[][]; skipped: number };
  pod: unknown; // PodState from the search map UI
  table?: unknown; // custom behaviour table, if one was loaded
}

/** One stint of a person in a position. Open stints have no `end`. */
export interface PositionLog extends BaseRecord {
  opPeriodId: string;
  positionKey: string;
  name: string;
  start: string;
  end?: string;
  reason: 'assigned' | 'rollover' | 'handover' | 'transfer-of-command';
}

export interface Handover extends BaseRecord {
  opPeriodId: string;
  positionKey: string;
  outgoing: string;
  incoming: string;
  time: string;
  summary: string;
  openTasks: { text: string; done: boolean }[];
  isCommandTransfer: boolean;
  briefingSnapshot?: string; // printable 201 snapshot (JSON) for transfer of command
}

export interface ResourceRow extends BaseRecord {
  // ICS 201 resource summary
  resource: string;
  identifier: string;
  ordered: string;
  eta: string;
  arrived: boolean;
  notes: string;
}

export type TableName =
  | 'incidents' | 'opPeriods' | 'teams' | 'assignments' | 'checkIns' | 'clues'
  | 'subjects' | 'positionLog' | 'handovers' | 'resources' | 'searchMaps'
  | 'patients' | 'rescueLog';

export const SYNC_TABLES: TableName[] = [
  'incidents', 'opPeriods', 'teams', 'assignments', 'checkIns', 'clues',
  'subjects', 'positionLog', 'handovers', 'resources', 'searchMaps',
  'patients', 'rescueLog',
];

// Local-only reference data (editable on each device; seeded with samples).
export interface PickList { id: string; items: string[] }
export interface StaffMember { id: string; name: string; callSign: string; agency: string; quals: string[]; phone: string }
export interface RadioChannel { id: string; channel: string; name: string; rxFreq: string; txFreq: string; tone: string; mode: string; func: string }
export interface AircraftCompany { id: string; name: string; base: string; phone: string; aircraft: string; capabilities: string }
