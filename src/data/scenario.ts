// Scripted tabletop exercise: lost hiker. Everything here is fictional.
// The exercise controller's script (injects and timings) is in docs/tabletop-scenario.md.
import { db, save, patch, uid, nowIso, live } from '../db/db';
import { createIncident, setPosition } from '../lib/ops';
import type { Incident, OpPeriod, Subject, Team, Assignment } from '../db/types';

export async function loadExercise(): Promise<Incident> {
  const inc = await createIncident({
    name: 'EXERCISE Overdue hiker, Cory Pass', number: 'EX-2026-001', location: 'Cory Pass / Edith Pass loop, Banff NP', icName: 'Avery Lindqvist', exercise: true,
  });
  await patch<Incident>('incidents', inc.id, {
    caltopoUrl: 'https://caltopo.com/map.html#ll=51.205,-115.66&z=14',
    situationSummary:
      'EXERCISE. Solo hiker (fictional subject "Alex Marchetti", 34) reported overdue by partner at 21:30. ' +
      'Planned the Cory Pass / Edith Pass loop, departed Fireside picnic area trailhead approx. 09:00. ' +
      'Last text message 14:12 from near Cory Pass: "at the pass, windy, heading down the other side". ' +
      'Vehicle (blue hatchback) confirmed at trailhead by Warden 7 at 22:15. Overnight low forecast -4 °C, light snow above 2000 m.\n' +
      'Health and safety: steep scree and loose rock on Cory Pass descent, early-season snow on north aspects, wildlife (bear) activity in Edith Pass.',
    mapNotes: 'PLS: Fireside trailhead. LKP: Cory Pass (approx. 2350 m). ICP: Fireside picnic area. Staging: same. Helispot: Banff heliport.',
  });
  const op = (await db.opPeriods.get((await db.incidents.get(inc.id))!.currentOpPeriodId!))!;
  const people: [string, string, string][] = [
    ['ops', 'Morgan Tremblay', 'Rescue 3'], ['plans', 'Harper Singh', 'Rescue 10'], ['safety', 'Jordan Okafor', 'Rescue 2'],
    ['logistics', 'Casey Beaulieu', 'Dispatch'], ['ground-branch', 'Taylor Brennan', 'Bow SAR 1'], ['tech-spec', 'Jordan Okafor', 'Rescue 2'],
  ];
  let cur: OpPeriod = op;
  for (const [k, name, cs] of people) {
    await setPosition(cur, k, { name, callSign: cs, agency: '' });
    cur = (await db.opPeriods.get(op.id))!;
  }
  await patch<OpPeriod>('opPeriods', op.id, {
    objectives: [
      'Provide for the safety of all responders and the public.',
      'Confine the search area by 01:00: staff Fireside trailhead and the Edith Pass / Forty Mile junction.',
      'Hasty search the Cory Pass loop trail and the Gargoyle Valley descent before first light.',
      'Locate the subject as quickly as possible.',
      'Keep the reporting party informed through the Liaison Officer.',
    ],
    commandEmphasis: 'Night operations: no team enters steep scree or snow-covered terrain in the dark. Pairs minimum.',
    situationalAwareness: 'Snow line near 2000 m. Avalanche danger Low (early season). Bear activity reported near Edith Pass last week.',
    weather: 'Overnight -4 °C at pass, winds W 30 km/h, light snow after 03:00. Sunrise 07:58.',
    safetyMessage: '• Cold exposure: dress in layers, monitor team members for hypothermia, carry an emergency shelter.\n• Wildlife: carry bear spray, travel in groups, make noise in thick cover.\n• Steep terrain: do not enter technical terrain without a technical rescue team.',
    medicalProcedures: 'Any responder injury: notify Command on Ch 1, Medic 1 responds from ICP. Subject found: assess, keep warm, request evacuation through Ops. Heli evacuation at first light only.',
    ambulances: [{ service: 'Alberta EMS Banff (sample)', location: 'Banff', contact: '403-555-0401', level: 'ALS' }],
    aidStations: [{ name: 'ICP medical', location: 'Fireside picnic area', contact: 'Medic 1 / Ch 1', paramedics: true }],
    actions: [
      { time: '21:30', action: 'Overdue report received by Banff Dispatch.' },
      { time: '22:15', action: 'Warden 7 confirmed subject vehicle at Fireside trailhead.' },
      { time: '22:40', action: 'IC established at Fireside picnic area; call-out of VSPC and Bow Valley SAR.' },
    ],
  });
  const t = (name: string, type: string, leader: string, cs: string, members: string[]): Team => ({
    id: uid(), incidentId: inc.id, opPeriodId: op.id, updatedAt: nowIso(), name, type, leader, leaderCallSign: cs, members, contact: '', status: 'available',
  });
  const teams = [
    t('Team 1', 'Hasty', 'Taylor Brennan', 'Bow SAR 1', ['Drew Kowalski']),
    t('Team 2', 'Hasty', 'Morgan Tremblay', 'Rescue 3', ['Sam Whitehorse']),
    t('Team 3', 'Containment', 'Riley Nakamura', 'Warden 7', []),
  ];
  for (const x of teams) await save('teams', x);
  const a = (n: string, team: Team, segment: string, work: string, ch: string): Assignment => ({
    id: uid(), incidentId: inc.id, opPeriodId: op.id, updatedAt: nowIso(), number: n, teamId: team.id, branch: 'Ground', division: 'A',
    segment, caltopoRef: '', work, specialInstructions: 'Call subject\'s name and whistle every 5 min. Check in every 30 min.', commsChannel: ch, status: 'assigned',
  });
  await save('assignments', a('1', teams[0], 'Cory Pass trail, trailhead to pass', 'Hasty search of the trail to Cory Pass. Check side trails and the viewpoint. Turn around at the pass if snow-covered; report conditions.', '2 SAR TAC 1'));
  await save('assignments', a('2', teams[1], 'Edith Pass trail, reverse direction', 'Hasty search of the Edith Pass trail from Fireside toward the Gargoyle Valley junction. Look for tracks leaving the trail.', '3 SAR TAC 2'));
  await save('assignments', a('3', teams[2], 'Trailhead containment', 'Staff Fireside trailhead. Log everyone entering/leaving. Keep vehicle under observation.', '1 PARKS COMMAND'));
  for (const x of teams) await patch<Team>('teams', x.id, { status: 'assigned' });

  const subject = live(await db.subjects.where('incidentId').equals(inc.id).toArray())[0];
  await patch<Subject>('subjects', subject.id, {
    name: 'Alex Marchetti (FICTIONAL)', age: '34', sex: 'M', height: '180 cm', weight: '75 kg', build: 'Slim', hair: 'Brown / brown',
    clothing: 'Red shell jacket, black softshell pants, grey toque', footwear: 'Brown trail runners (lugged sole, size 10)',
    equipment: 'Small daypack, 1 L water, phone (low battery), no headlamp, no overnight gear', medical: 'None known. Mild asthma (inhaler).',
    experience: 'Regular day hiker, new to the Rockies (moved from Toronto 6 months ago).', plan: 'Cory Pass / Edith Pass loop, clockwise, planned to be back by 17:00.',
    lastSeenTime: 'Last text 14:12 today', lastSeenLocation: 'Cory Pass (LKP)', vehicle: 'Blue hatchback, plate EXR-001 (fictional)', contactName: 'Partner "Sam" (fictional), 403-555-0999',
  });
  return (await db.incidents.get(inc.id))!;
}
