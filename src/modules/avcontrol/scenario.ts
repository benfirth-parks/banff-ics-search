// Tabletop exercise for the avalanche control module. Everything is fictional:
// people, call signs, aircraft registration and events. Path and target names
// are SAMPLES for training, not the real Parks Canada avalanche atlas.
import { db, save, patch, uid, nowIso } from '../../db/db';
import { createIncident, setPosition } from '../../lib/ops';
import type { Incident, OpPeriod, Team, Assignment } from '../../db/types';
import { emptyAvControl, blankTarget, type Closure, type Target } from './model';

export const AVC_SCENARIO = { key: 'avc-93n', title: 'Avalanche control, Hwy 93N after a storm (heli control, closures)' };

const closure = (location: string, guard: string, callSign: string, kind = 'Road'): Closure =>
  ({ id: uid(), location, kind, guard, callSign, status: 'planned', notes: '' });
const target = (path: string, tgt: string, method: string, charges: string, chargeSize: string): Target =>
  ({ ...blankTarget(), path, target: tgt, method, charges, chargeSize });

export async function loadAvControlExercise(): Promise<Incident> {
  const inc = await createIncident({
    name: 'EXERCISE Avalanche control, Hwy 93N', number: 'EX-2026-AC1', location: 'Icefields Parkway (Hwy 93N), Lake Louise to Bow Summit',
    icName: 'Robin Castellano', exercise: true, type: 'avalanche-control',
  });
  await patch<Incident>('incidents', inc.id, {
    caltopoUrl: 'https://caltopo.com/map.html#ll=51.60,-116.37&z=11',
    situationSummary:
      'EXERCISE. 45 cm of new snow in 36 h with strong SW winds. Natural avalanches size 2 to 2.5 observed overnight on two paths above Hwy 93N; ' +
      'one deposit 0.5 m deep reached the road at the sample path "Hector Gully". Highway closed by Dispatch at 06:30 pending control. ' +
      'Plan: helicopter control of six sample targets on four paths, then debris clearing and reopening by 13:00.\n' +
      'Health and safety: explosives handling, helicopter operations, guards at closure gates in traffic, avalanche terrain below targets.',
    mapNotes: 'ICP: Lake Louise compound. Helibase: Lake Louise helipad. Explosives magazine: LL compound (sample). Closure gates: Hwy 93N at Hwy 1 junction, and at Bow Summit.',
  });
  const op = (await db.opPeriods.get((await db.incidents.get(inc.id))!.currentOpPeriodId!))!;
  const people: [string, string, string, string?, string?][] = [
    ['ops', 'Sam Kowalczyk', 'Rescue 3'], ['safety', 'Devon Achterberg', 'Rescue 2'], ['plans', 'Quinn Delorme', 'Rescue 10'],
    ['air-ops', 'Riley Fontaine', 'Heli Manager'],
    ['x-blaster', 'Jesse Nakamura', 'Blaster 1', 'Blaster in charge', 'ops'],
    ['x-closures', 'Kai Morrison', 'Closure 1', 'Closure Group Supervisor', 'ops'],
  ];
  let cur: OpPeriod = op;
  for (const [k, name, cs, title, reportsTo] of people) {
    await setPosition(cur, k, { name, callSign: cs, agency: '', ...(title ? { title, section: 'Operations', reportsTo } : {}) });
    cur = (await db.opPeriods.get(op.id))!;
  }
  await patch<OpPeriod>('opPeriods', op.id, {
    objectives: [
      'Provide for the safety of all responders and the public.',
      'Close Hwy 93N between the Hwy 1 junction and Bow Summit and confirm the closed section is empty by 08:30.',
      'Control the six planned targets by helicopter and record every result.',
      'Account for every charge issued; clear any misfire before anyone enters the runout.',
      'Clear debris and reopen the highway by 13:00, or brief the next period if control is not complete.',
    ],
    commandEmphasis: 'No shot until every closure is confirmed and the closed section is swept. A misfire keeps its path closed.',
    situationalAwareness: 'Avalanche danger High alpine, Considerable treeline. Natural activity size 2 to 2.5 overnight. Visibility improving after 08:00.',
    weather: 'Clearing from the west by 08:00, ceilings 2500 m, winds SW 20 km/h easing, -9 °C at 1800 m.',
    safetyMessage:
      '• Explosives: only the Blaster in charge handles and arms charges; no radio transmissions within 15 m of electric detonators.\n' +
      '• Helicopter: approach on pilot signal only; no loose items at the helipad.\n' +
      '• Closure guards: park clear of runouts, high-visibility vests, never let traffic through without Command\'s all clear.\n' +
      '• Misfire: wait the required time, report to Command, path stays closed until cleared.',
    medicalProcedures: 'Responder injury: notify Command on Ch 1. Heli available for evacuation; Lake Louise ambulance on standby.',
    actions: [
      { time: '06:30', action: 'Hwy 93N closed by Dispatch after deposit on road at Hector Gully (sample).' },
      { time: '07:00', action: 'Avalanche control planning meeting at Lake Louise compound.' },
    ],
  });
  const team = (name: string, type: string, leader: string, cs: string, members: string[]): Team =>
    ({ id: uid(), incidentId: inc.id, opPeriodId: op.id, updatedAt: nowIso(), name, type, leader, leaderCallSign: cs, members, contact: '', status: 'assigned', reportsTo: 'ops' });
  const teams = [
    team('Heli control', 'Avalanche', 'Jesse Nakamura', 'Blaster 1', ['Alexis Bergeron (helper)', 'Pilot (sample)']),
    team('Closure South', 'Containment', 'Kai Morrison', 'Closure 1', ['Jamie Ostrowski']),
    team('Closure North', 'Containment', 'Parker Whitehorse', 'Closure 2', ['Drew Lafleur']),
  ];
  for (const t of teams) await save('teams', t);
  const asg: [number, string, string][] = [
    [0, 'Targets HG-1 to BS-1', 'Helicopter avalanche control of the six planned targets in the order on the shot log. Report each shot and result to Command.'],
    [1, 'Hwy 93N at Hwy 1 junction', 'Hold the south closure gate. Sweep north to km 12 with Closure North before control. Report closed and swept.'],
    [2, 'Hwy 93N at Bow Summit', 'Hold the north closure gate. Sweep south to km 12. Report closed and swept.'],
  ];
  let n = 0;
  for (const [ti, segment, work] of asg) {
    const a: Assignment = {
      id: uid(), incidentId: inc.id, opPeriodId: op.id, updatedAt: nowIso(), number: String(++n), teamId: teams[ti]!.id, branch: 'Avalanche control',
      division: '', segment, caltopoRef: '', work, specialInstructions: 'Ch 1 Command. Hold position until Command gives the all clear.', commsChannel: 'Ch 1', status: 'assigned',
    };
    await save('assignments', a);
  }
  const rec = emptyAvControl(inc.id, op.id);
  Object.assign(rec, {
    area: 'Hwy 93N, Hwy 1 junction to Bow Summit (km 0 to 40)',
    hazard: { alpine: 'High', treeline: 'Considerable', below: 'Moderate' },
    problems: 'Storm slab on all aspects above 1900 m; wind slab on N to E lee features.',
    objective: 'Reduce the hazard to the highway from the four sample paths so it can reopen today.',
    aircraft: 'Bell 407 C-FXMP (sample)', blaster: 'Jesse Nakamura',
    explosives: { magazine: 'Lake Louise magazine (sample)', issued: '', returned: '', checkedBy: '' },
    closures: [
      closure('Hwy 93N at Hwy 1 junction (km 0)', 'Closure South', 'Closure 1'),
      closure('Hwy 93N at Bow Summit (km 40)', 'Closure North', 'Closure 2'),
      closure('Mosquito Creek trailhead and campground', 'Closure North', 'Closure 2', 'Trail'),
    ],
    targets: [
      target('Hector Gully (sample)', 'HG-1', 'Helicopter bomb', '1', '5 kg ANFO + cast booster'),
      target('Hector Gully (sample)', 'HG-2', 'Helicopter bomb', '1', '5 kg ANFO + cast booster'),
      target('Crowfoot Slide (sample)', 'CF-1', 'Helicopter bomb', '2', '5 kg ANFO + cast booster'),
      target('Waterfowl Chutes (sample)', 'WF-1', 'Helicopter bomb', '1', '5 kg ANFO + cast booster'),
      target('Waterfowl Chutes (sample)', 'WF-2', 'Hand charge', '1', '2 kg emulsion'),
      target('Bow Summit North (sample)', 'BS-1', 'Helicopter bomb', '1', '5 kg ANFO + cast booster'),
    ],
  });
  await save('avControl', rec);
  return (await db.incidents.get(inc.id))!;
}
