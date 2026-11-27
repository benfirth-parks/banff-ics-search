// Large rescue mission tabletop exercise. Everything is fictional: people,
// phone numbers and events. Places are real so the plan makes sense.
import { db, save, patch, uid, nowIso } from '../../db/db';
import { createIncident, setPosition } from '../../lib/ops';
import type { Incident, OpPeriod, Team, Assignment } from '../../db/types';
import { emptyRescuePeriod, type Patient, type RescuePeriod, type RescueMission } from './types';

export const RESCUE_SCENARIOS = [
  { key: 'rescue-victoria', title: 'Multi-party climbing accident, Mount Victoria (2-day HFRS rescue)' },
];

// Log times are relative to when the exercise is loaded, so the board looks live.
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

export async function loadRescueExercise(): Promise<Incident> {
  const inc = await createIncident({
    name: 'EXERCISE Climbing accident, Mount Victoria south ridge', number: 'EX-2026-R01', location: 'Mount Victoria / Abbot Pass, Lake Louise',
    icName: 'Riley Vandermeer', exercise: true, type: 'large-rescue',
  });
  const mission: RescueMission = {
    rescueType: 'Multi-party mountaineering', parties: '1 party of 4: 2 injured, 2 stranded uninjured',
    location: 'South ridge of Mount Victoria, approx. 3150 m, and a ledge 60 m below the ridge on the east (Lake Louise) face',
    coords: '51.3790, -116.2905', reportingParty: 'InReach SOS from party member 15:42, relayed by GEOS to Banff Dispatch',
    mechanism: 'EXERCISE. Rope team of two slipped on verglas while traversing the ridge and fell approx. 60 m onto a ledge on the east face. ' +
      'Second rope team (2) stopped on the ridge above, uninjured, cold, no bivouac gear.',
    access: 'Air only for the ledge. Ridge reachable on foot from Abbot Pass (4-5 h, rockfall in the Death Trap: not for rescue use). ' +
      'Staging: Lake Louise Visitor Safety compound helipad.',
    notes: 'Forecast: cloud building after 18:00, ridge winds rising to 50 km/h overnight. Good window tomorrow 07:00-12:00.',
  };
  await patch<Incident>('incidents', inc.id, {
    rescue: mission,
    caltopoUrl: 'https://caltopo.com/map.html#ll=51.379,-116.29&z=14',
    situationSummary: 'EXERCISE. 4 climbers on Mount Victoria south ridge. Two fell to a ledge on the east face (P1 serious, P2 moderate). ' +
      'Two stranded uninjured on the ridge (P3, P4). Recon flight complete 16:40. HFRS insertion of 2 rescuers + ACP to the ledge under way. ' +
      'Weather window closing around 18:30: P3/P4 may have to be supported overnight and flown off in the morning (operational period 2).',
    mapNotes: 'Site: ledge below south ridge, 3090 m. Ridge party: 3150 m. ICP and helibase: Lake Louise compound. Staging spot: Abbot Hut helipad (emergency only).',
  });
  const op = (await db.opPeriods.get((await db.incidents.get(inc.id))!.currentOpPeriodId!))!;
  let cur: OpPeriod = op;
  for (const [k, name, cs] of [
    ['ops', 'Quinn Arsenault', 'Rescue 3'], ['safety', 'Devon Achterberg', 'Rescue 2'], ['plans', 'Sam Kowalczyk', 'Rescue 10'],
    ['air-ops', 'Noor Halvorsen', 'Air Ops'], ['helibase', 'Elliot Park', 'Helibase'], ['medical-unit', 'Dr. Priya Raman', 'Medic 1'],
    ['logistics', 'Jamie Leclerc', 'Dispatch'], ['liaison', 'Rowan Fitzgerald', 'Liaison'],
  ] as const) {
    await setPosition(cur, k, { name, callSign: cs, agency: '' });
    cur = (await db.opPeriods.get(op.id))!;
  }
  const r: RescuePeriod = {
    ...emptyRescuePeriod(),
    techLead: 'Quinn Arsenault',
    techPlan: '1. HFRS insert Rescuers A1, A2 and ACP to the ledge (two flights).\n2. Build anchors on the ledge, package P1 in vacuum mattress + horizontal litter; P2 in screamer suit.\n' +
      '3. HFRS extraction P1 with attendant direct to Lake Louise helipad; STARS meets there.\n4. P2 flown second with attendant.\n' +
      '5. Ridge party (P3, P4): if time allows, HFRS off before last light. Otherwise sling a bivouac kit and radio, and fly them off at first light (op period 2).\n' +
      'Contingency: if weather closes with rescuers on the ledge, they stay with P1/P2 (overnight kits carried on every insert).',
    ropeSystems: [
      { name: 'Ledge anchor', type: 'Fixed line', location: 'Ledge, 3090 m', anchors: '3-piece rock anchor, equalized', mainline: '11 mm static 30 m', belay: 'n/a', ma: '', rigger: 'Rescuer A1', edge: '', attendant: '', checkedBy: 'Rescuer A2', status: 'Checked' },
      { name: 'Litter tie-in', type: 'Rappel / access', location: 'Ledge', anchors: 'Ledge anchor', mainline: 'Short rope', belay: '', ma: '', rigger: 'Rescuer A2', edge: '', attendant: 'Rescuer A1', checkedBy: '', status: 'Rigged' },
    ],
    aircraft: [
      { callSign: 'HFRS 1', company: 'Cascade Rotor Ltd. (sample)', reg: 'C-FXRA', type: 'AS350 B3', pilot: 'Kit Morrow', hfrs: true, longline: '45 m', status: 'On task' },
      { callSign: 'Heli 2', company: 'Bow Corridor Helicopters (sample)', reg: 'C-GBWX', type: 'AS350 B2', pilot: 'Ari Desjardins', hfrs: false, longline: '', status: 'Standby at helibase' },
      { callSign: 'STARS 7', company: 'STARS Air Ambulance (sample contact)', reg: '', type: 'H145', pilot: '', hfrs: false, longline: '', status: 'En route to Lake Louise, ETA 17:45' },
    ],
    helispots: [
      { name: 'Lake Louise compound', coords: '51.4255, -116.1770', elevation: '1530 m', notes: 'Helibase and ICP. STARS transfer point.' },
      { name: 'Staging bench', coords: '51.4010, -116.2530', elevation: '2050 m', notes: 'Rescuer hook-up / unhook point under the face. Snow, rotor wash.' },
    ],
    aviationMinimums: 'Ceiling above 3300 m at the ridge, wind under 40 km/h at site, visibility 5 km',
    lastLight: '18:35 (last HFRS lift off the face by 18:00)',
    hfrsSpotter: 'Rescuer A2 (on ledge) / Ops at staging bench',
    hfrsNotes: 'Spotter talks the pilot in on Air-Ground Ch 4. Rigging checked by two people before every lift. Litter carries a tag line.',
    careLevel: 'ACP with the ledge team; flight physician with STARS at the helipad',
    hospitalPreAlert: 'Medical Unit pre-alerts Foothills trauma via STARS dispatch at P1 lift-off',
    massCasualty: true,
    medicalNotes: 'P1 goes to Foothills (Level 1) by STARS. P2 to Banff Mineral Springs by ground ambulance unless condition worsens. P3/P4 assessed at the compound.',
    goNoGo: 'go', goNoGoBy: 'IC Riley Vandermeer + Safety', goNoGoTime: nowIso(),
  };
  r.hazards = r.hazards.map((h) => {
    const m: Record<string, string> = {
      'Rockfall / loose rock': 'Helmets on. No one below the ledge. Rescuers clipped to the anchor at all times.',
      'Weather (wind, visibility, cold)': 'Air Ops checks site wind before each lift. Overnight kits on every insert.',
      'Darkness / last light': 'Last lift off the face by 18:00. Ridge party resupplied if not flown off.',
      'Helicopter operations (rotor wash, hook-up)': 'Hook-up only by trained HFRS rescuers. Loose gear secured at the staging bench.',
      'Edge / fall exposure': 'Everyone on the ledge tied in. Ledge anchor checked by a second rescuer.',
      'Altitude / cold injury': 'Rotate rescuers on the ledge every 2 h if possible. Hot drinks and spare layers in kits.',
    };
    return m[h.hazard] ? { ...h, present: true, mitigation: m[h.hazard] } : h;
  });
  await patch<OpPeriod>('opPeriods', op.id, {
    rescue: r,
    objectives: [
      'Provide for the safety of all responders, the patients and the public.',
      'Insert HFRS rescuers and ACP to the ledge and stabilize P1 and P2 by 17:30.',
      'Extract P1 by HFRS to Lake Louise and hand over to STARS by 18:00.',
      'Extract P2 by HFRS before last light, or support on the ledge overnight.',
      'Support the ridge party (P3, P4) overnight if they cannot be flown off, and extract them at first light.',
    ],
    commandEmphasis: 'Rescuer safety first: no lifts outside weather minimums or after 18:00. Plan for an overnight on the ridge.',
    situationalAwareness: 'Cloud building from the west after 18:00. Recent verglas on the ridge. Rockfall on the east face in the afternoon sun.',
    weather: 'Ridge: -6 °C, W wind 30 km/h rising to 50 overnight. Cloud base dropping to 3000 m after 19:00. Clearing by 07:00.',
    safetyMessage: '• HFRS: only trained rescuers hook up; two-person rigging check before every lift.\n• Rockfall: helmets on, nobody below the ledge.\n• Weather and last light: last lift off the face by 18:00.\n• Cold: overnight kits carried on every insert.',
    medicalProcedures: 'Responder injury on the face: ledge ACP treats, Air Ops prioritizes HFRS extraction. Patients: P1 to Foothills by STARS, P2 to Banff by ambulance.',
    medicalAviation: true,
    ambulances: [{ service: 'Alberta EMS Lake Louise (sample)', location: 'Lake Louise', contact: '403-555-0411', level: 'ALS' }],
    aidStations: [{ name: 'Compound helipad', location: 'Lake Louise VS compound', contact: 'Medic 1 / Ch 1', paramedics: true }],
    actions: [
      ['15:42', 'InReach SOS received by Banff Dispatch via GEOS.'],
      ['15:55', 'IC assigned; HFRS 1 and rescuers called out.'],
      ['16:20', 'HFRS 1 airborne from Canmore with rescuers.'],
      ['16:40', 'Recon flight complete: 2 on ledge, 2 on ridge. Both parties waving.'],
      ['16:55', 'Go decision for HFRS insertion. STARS requested.'],
    ].map(([time, action]) => ({ time: time!, action: action! })),
  });
  const patients: [string, Patient['triage'], Patient['status'], string, string, string, string, string, string][] = [
    ['Taylor Brooks', 'Red', 'accessed', 'Ledge, 3090 m', 'Fall 60 m. Head injury (GCS 13), suspected left femur fracture, possible spinal injury.', 'C-collar, traction splint, warming, O₂.', 'Vacuum mattress + litter', 'HFRS / longline', 'Foothills Medical Centre (SAMPLE)'],
    ['Jordan Lemieux', 'Yellow', 'accessed', 'Ledge, 3090 m', 'Fall 60 m. Right wrist and ankle injuries, mild hypothermia.', 'Splinted, dry layers, hot drink.', 'Screamer suit / triangle', 'HFRS / longline', 'Banff Mineral Springs Hospital (SAMPLE)'],
    ['Casey Moreau', 'Green', 'located', 'South ridge, 3150 m', 'Uninjured, cold. No bivouac gear.', '', 'None (walking)', 'HFRS / longline', ''],
    ['Alexis Huang', 'Green', 'located', 'South ridge, 3150 m', 'Uninjured, cold, anxious.', '', 'None (walking)', 'HFRS / longline', ''],
  ];
  let n = 0;
  for (const [name, triage, status, location, injuries, treatment, packaging, evacMethod, destination] of patients) {
    n++;
    await save<Patient>('patients', {
      id: uid(), incidentId: inc.id, updatedAt: nowIso(), label: `P${n}`, name, age: String(26 + n * 3), sex: '', triage, status, location, injuries, treatment,
      packaging, evacMethod, destination, receivingEms: n === 1 ? 'STARS 7' : '', transferredAt: '', notes: '',
      vitals: n === 1 ? [{ time: '17:10', loc: 'V', hr: '112', rr: '24', bp: '104/68', spo2: '91', temp: '35.4', gcs: '13', notes: 'Responds to voice' }] :
        n === 2 ? [{ time: '17:12', loc: 'A', hr: '96', rr: '18', bp: '128/80', spo2: '95', temp: '35.9', gcs: '15', notes: '' }] : [],
    });
  }
  for (const [time, aircraft, mission, from, to, load] of [
    [ago(40), 'HFRS 1', 'Recon', 'Lake Louise compound', 'Mount Victoria south ridge', 'Pilot + Ops'],
    [ago(10), 'HFRS 1', 'HFRS (longline)', 'Staging bench', 'Ledge', 'Rescuers A1, A2'],
    [ago(2), 'HFRS 1', 'HFRS (longline)', 'Staging bench', 'Ledge', 'ACP + medical kit'],
  ] as const) {
    await save('rescueLog', { id: uid(), incidentId: inc.id, opPeriodId: op.id, updatedAt: nowIso(), kind: 'flight', time, aircraft, mission, from, to, load, notes: '' });
  }
  for (const [person, t] of [['Rescuer A1', ago(10)], ['Rescuer A2', ago(10)], ['ACP Morgan Ruiz', ago(2)]] as const) {
    await save('rescueLog', { id: uid(), incidentId: inc.id, opPeriodId: op.id, updatedAt: nowIso(), kind: 'zone', time: t, person, zone: 'East face ledge', notes: '' });
  }
  const teams: Team[] = [
    ['HFRS Team A', 'HFRS', 'Rescuer A1', 'Rescue A', ['Rescuer A2', 'ACP Morgan Ruiz']],
    ['HFRS Team B', 'HFRS', 'Rescuer B1', 'Rescue B', ['Rescuer B2']],
    ['Helibase crew', 'Support', 'Elliot Park', 'Helibase', ['Fuel / hook-up']],
  ].map(([name, type, leader, cs, members]) => ({
    id: uid(), incidentId: inc.id, opPeriodId: op.id, updatedAt: nowIso(), name: name as string, type: type as string, leader: leader as string,
    leaderCallSign: cs as string, members: members as string[], contact: '', status: 'in-field' as const, lastCheckIn: nowIso(),
  }));
  teams[1]!.status = 'available';
  for (const t of teams) await save('teams', t);
  const asg: [number, string, string][] = [
    [0, 'East face ledge', 'Access P1/P2 by HFRS. Stabilize, package and prepare for HFRS extraction. Overnight kits carried.'],
    [1, 'South ridge', 'Standby to HFRS the ridge party (P3, P4) off, or sling bivouac kit and radio if past 18:00.'],
  ];
  let k = 0;
  for (const [ti, segment, work] of asg) {
    const a: Assignment = {
      id: uid(), incidentId: inc.id, opPeriodId: op.id, updatedAt: nowIso(), number: `R${++k}`, teamId: teams[ti]!.id, branch: 'Air Ops', division: 'Face',
      segment, caltopoRef: '', work, specialInstructions: 'Air-Ground Ch 4 with HFRS 1. Check in with Ops every 15 min.', commsChannel: '4', status: ti === 0 ? 'in-field' : 'assigned',
    };
    await save('assignments', a);
  }
  return (await db.incidents.get(inc.id))!;
}
