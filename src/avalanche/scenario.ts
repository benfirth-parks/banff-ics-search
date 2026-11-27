// Fictional large-avalanche tabletop exercise. People, phone numbers and
// events are made up; the location is a real Banff-area ski touring zone.
// The avalanche time is set 20 minutes before the exercise is loaded so the
// burial timers are live from the start.
import { db, save, patch, uid, nowIso } from '../db/db';
import { createIncident, setPosition } from '../lib/ops';
import type { Incident, OpPeriod, Team } from '../db/types';
import { ensureSite } from './hooks';
import { blankParty, type AvySite, type AvyParty, type AvyArea } from './types';

export const AVY_SCENARIOS = [{ key: 'avy-bow-summit', title: 'Large avalanche, multiple burials, Bow Summit area (ski touring party)' }];

const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();

export async function loadAvalancheExercise(): Promise<Incident> {
  const inc = await createIncident({
    name: 'EXERCISE Avalanche, multiple burials, Bow Summit area', number: 'EX-2026-AV1', location: 'Bow Summit area, Icefields Parkway, Banff NP',
    icName: 'Avery Lindqvist', exercise: true, type: 'avalanche',
  });
  await patch<Incident>('incidents', inc.id, {
    caltopoUrl: 'https://caltopo.com/map.html#ll=51.716,-116.49&z=14',
    situationSummary:
      'EXERCISE. 11:40 a size 2.5 persistent slab avalanche released on a NE-facing treeline slope west of Bow Summit, ' +
      'catching a guided-style party of 6 ski tourers (fictional) and possibly a second party of 2 seen skinning below. ' +
      'Reporting party (P1, not caught) called by InReach at 11:46. Two partly buried skiers dug out by companions. ' +
      'At least 2 remain completely buried; one may have no transceiver. Overhead: adjacent loaded start zone has not released.',
    mapNotes: 'Debris approx. 250 m long x 80 m wide, up to 3 m deep at toe. Staging/helispot: Bow Summit parking lot. Safe zone: treed ridge skier-left of debris.',
  });
  const op = (await db.opPeriods.get((await db.incidents.get(inc.id))!.currentOpPeriodId!))!;
  const people: [string, string, string][] = [
    ['ops', 'Morgan Tremblay', 'Rescue 3'], ['safety', 'Jordan Okafor', 'Rescue 2'], ['air-ops', 'Riley Chen', 'Rescue 5'],
    ['medical-unit', 'Sasha Novak', 'Medic 1'], ['plans', 'Harper Singh', 'Rescue 10'],
  ];
  let cur: OpPeriod = op;
  for (const [k, name, cs] of people) { await setPosition(cur, k, { name, callSign: cs, agency: '' }); cur = (await db.opPeriods.get(op.id))!; }
  await patch<OpPeriod>('opPeriods', op.id, {
    end: new Date(Date.now() + 6 * 3600_000).toISOString(),
    objectives: [
      'Provide for the safety of all rescuers: avalanche guard posted before anyone goes onto the debris.',
      'Locate and extricate all buried parties as fast as possible (transceiver, RECCO, dog, probe lines).',
      'Triage, treat and evacuate patients to the right hospital by air.',
      'Account for every member of both parties, including the unconfirmed second party.',
    ],
    commandEmphasis: 'Speed with safety. Max 8 rescuers on debris; everyone else at the safe zone. Transceivers to SEARCH or OFF only when told.',
    situationalAwareness: 'Avalanche danger Considerable at treeline and alpine. Adjacent start zone skier-right is loaded and has not released.',
    weather: 'Overcast, -8 °C, winds SW 25 km/h, light snow. Flying conditions marginal after 15:00.',
    safetyMessage: '• Overhead avalanche hazard: guard on the ridge, 3 long whistle blasts = evacuate skier-left to the trees.\n• Transceivers: all rescuers on TRANSMIT except searchers ordered to SEARCH.\n• Helicopter ops: approach from downhill, secure loose gear.\n• Cold: rotate shovellers every few minutes, keep spare layers at the safe zone.',
    medicalProcedures: 'Medical station at the safe zone. Buried >35 min with clear airway: treat as hypothermic, horizontal, gentle handling. Red patients fly first.',
    actions: [
      { time: '11:40', action: 'Avalanche released (witness estimate).' },
      { time: '11:46', action: 'InReach SOS received from reporting party (P1). Banff Dispatch notified Visitor Safety.' },
      { time: '11:52', action: 'Rescue 5 (heli) and VS team paged. Dog team requested from Lake Louise.' },
    ],
  });
  const teamDefs: [string, string, string, string, string[]][] = [
    ['Hasty 1', 'Hasty', 'Taylor Brennan', 'Rescue 7', ['Kai Morin', 'Dana Holt']],
    ['Probe 1', 'Probe line', 'Quinn Delacroix', 'Rescue 8', ['Robin Ashe', 'Ellis Park', 'Noor Haddad', 'Sky Lafleur']],
    ['Dog 1', 'Dog', 'Alexis Dube', 'K9 1', ['Avalanche dog "Juno"']],
  ];
  const teams: Team[] = teamDefs.map(([name, type, leader, cs, members]) => ({
    id: uid(), incidentId: inc.id, opPeriodId: op.id, updatedAt: nowIso(), name, type, leader, leaderCallSign: cs, members, contact: '', status: 'in-field',
  }));
  for (const t of teams) await save('teams', t);

  const site = await ensureSite(inc.id);
  const done = new Set(['alarm', 'hazard', 'witness']);
  await patch<AvySite>('avySites', site.id, {
    avalancheTime: ago(20), reportedTime: ago(14), reportedBy: 'P1 via InReach (fictional "Jess Marlow")', path: 'NE treeline slope west of Bow Summit',
    coords: '51.7160, -116.4900', size: 'D2.5', avyType: 'Persistent slab', trigger: 'Skier (involved party)', aspect: 'NE', elevation: '2250 m',
    debrisLength: '250', debrisWidth: '80', debrisDepth: '3', partiesReported: '6 in party + possibly 2 others',
    witnessLastSeen: 'P3 and P4 last seen mid-slope near the lone larch, skier-right of the flow line. P5 last seen near top of path. Second party (2) seen skinning near toe 10 min before.',
    dangerAlp: '3 Considerable', dangerTl: '3 Considerable', dangerBtl: '2 Moderate', overheadLevel: 'moderate',
    overheadHazard: 'Adjacent start zone skier-right is wind loaded and has not released. Hang-fire at the crown on skier-left.',
    escapeRoutes: 'Skier-left across to the treed ridge.', safeZone: 'Treed ridge skier-left / staging at Bow Summit lot', maxOnDebris: '8',
    checklist: site.checklist.map((c) => (done.has(c.key) ? { ...c, done: true, time: ago(12) } : c)),
  });
  const areaDefs: Pick<AvyArea, 'name' | 'priority' | 'method' | 'teamId' | 'description'>[] = [
    { name: 'Area A', priority: 'high', method: 'Transceiver signal search', teamId: teams[0]!.id, description: 'Below lone larch, skier-right of flow line (LSP of P3, P4)' },
    { name: 'Area B', priority: 'high', method: 'Dog', teamId: teams[2]!.id, description: 'Toe of debris and terrain trap in gully, 80 x 40 m' },
    { name: 'Area C', priority: 'medium', method: 'Probe line (coarse)', teamId: teams[1]!.id, description: 'Flow line below P5 last-seen point' },
  ];
  const areas: AvyArea[] = areaDefs.map((a) => ({ id: uid(), incidentId: inc.id, updatedAt: nowIso(), teamText: '', status: 'not-started' as const, coverage: '', notes: '', ...a }));
  for (const a of areas) await save('avyAreas', a);
  const p = (n: number, c: Partial<AvyParty>): AvyParty => ({ ...blankParty(inc.id, uid(), nowIso(), `P${n}`), ...c });
  const parties = [
    p(1, { name: 'Jess Marlow (FICTIONAL)', description: 'Party leader, not caught, reporting party', transceiver: 'yes', status: 'accounted-safe' }),
    p(2, { name: 'Omar Reyes (FICTIONAL)', description: 'Red jacket', transceiver: 'yes', status: 'extricated', locatedAt: ago(16), extricatedAt: ago(12), locatedHow: 'Visual / surface clue', locatedBy: 'Companions', burialDepth: '40', airway: 'clear', triage: 'yellow', condition: 'Partly buried, head out. Suspected L tib/fib fracture. Alert, cold.' }),
    p(3, { name: 'Lena Fischer (FICTIONAL)', description: 'Blue jacket, orange pack', transceiver: 'yes', status: 'unaccounted', lastSeen: 'Mid-slope near lone larch', areaId: areas[0]!.id }),
    p(4, { name: 'Theo Grant (FICTIONAL)', description: 'Black shell, splitboard', transceiver: 'yes', status: 'unaccounted', lastSeen: 'Mid-slope near lone larch', areaId: areas[0]!.id }),
    p(5, { name: 'Mia Santos (FICTIONAL)', description: 'Green jacket. Party says transceiver may have been left off.', transceiver: 'unknown', status: 'unaccounted', lastSeen: 'Near top of path', areaId: areas[2]!.id }),
    p(6, { name: '', description: 'Second party (2 people) seen skinning near toe. Not confirmed caught.', status: 'unaccounted', areaId: areas[1]!.id }),
    p(7, { name: 'Ben Ito (FICTIONAL)', description: 'Partly buried to chest, dug out by companions', transceiver: 'yes', status: 'extricated', extricatedAt: ago(15), burialDepth: '20', airway: 'clear', triage: 'green', condition: 'Shoulder pain, walking.' }),
  ];
  for (const x of parties) await save('avyParties', x);
  return (await db.incidents.get(inc.id))!;
}
