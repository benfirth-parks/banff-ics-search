// Reference data. The staff list is the real Banff VS team (see STAFF below);
// radio channels, hospitals and aircraft are SAMPLE data invented for training.
// Verify real contacts before any live use.
import type { StaffMember } from '../db/types';
import { db } from '../db/db';

export const DEFAULT_PICKLISTS: Record<string, string[]> = {
  objectives: [
    'Provide for the safety of all responders and the public.',
    'Locate the subject as quickly as possible.',
    'Confine the search area by staffing trailheads and key junctions.',
    'Conduct hasty searches of high-probability trails and attractants.',
    'Establish and maintain communications with all field teams.',
    'Provide medical care and evacuate the subject once located.',
    'Keep the subject\'s family informed through the Liaison Officer.',
    'Document all clues and search coverage for the next operational period.',
  ],
  safetyMessages: [
    'Avalanche terrain: carry beacon, probe and shovel; check the current avalanche bulletin before entering.',
    'Wildlife: carry bear spray, travel in groups, make noise in thick cover.',
    'Cold exposure: dress in layers, monitor team members for hypothermia, carry an emergency shelter.',
    'Helicopter operations: approach only on pilot signal, from the front, no loose items.',
    'Steep terrain: do not enter technical terrain without a technical rescue team.',
    'Water hazards: do not cross swift water; report and route around.',
    'Check in on schedule. Missed check-in triggers a welfare call after 15 minutes.',
  ],
  teamTypes: [
    'Hasty', 'Grid (ground)', 'Containment', 'Dog team', 'Helicopter (HFRS)',
    'Technical rescue', 'Avalanche', 'Medical', 'Drone (RPAS)', 'Investigation',
  ],
  checkInStatus: ['On assignment, all OK', 'Arrived at segment', 'Departing segment', 'Clue found', 'Need assistance', 'Returning to base'],
};

/**
 * Banff Visitor Safety staff (2027 VS schedule) and the avalanche callout list
 * ("Avy callout list 2026-2027", Staff & Codes tab), the same sources the winter
 * morning meeting app uses. Names and call signs only; no phone numbers.
 */
const VS = 'Parks Canada Visitor Safety (Banff / LLYK)';
export const STAFF: StaffMember[] = [
  ['Lisa Paulson', ''], ['Aaron Beardmore', ''], ['Steve Holeczi', ''], ['Conrad Janzen', ''], ['Ian Jackson', ''],
  ['Alex Lawson', ''], ['Ben Firth', ''], ['Adam Greenberg', ''], ['Tim Haggarty', ''], ['Morgen Funston', ''],
].map(([name, callSign], i) => ({ id: `vs${i + 1}`, name: name!, callSign: callSign!, agency: VS, quals: ['Visitor Safety'], phone: '' }))
  .concat([
    ['Mike Grande', 'B23', 'East'], ['Dan Rafla', '', 'East'], ['Spencer Bieri', '', 'East'], ['Ryan Burlingame', 'F2', 'East'],
    ['Eric Dumochel Ricou', 'B99', 'East'], ['Sasha Yasinski', 'D17', 'West'],
  ].map(([name, callSign, district], i) => ({
    id: `co${i + 1}`, name: name!, callSign: callSign!, agency: `Parks Canada, ${district} district`, quals: ['Avalanche callout list'], phone: '',
  })));
const STAFF_VERSION = '2';
const SAMPLE_STAFF_IDS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'];

/** Swap the old made-up staff list for the VS team on devices seeded before it changed. Staff added by hand are kept. */
async function updateStaff() {
  if ((await db.meta.get('staffVersion'))?.value === STAFF_VERSION) return;
  await db.transaction('rw', [db.staff, db.meta], async () => {
    await db.staff.bulkDelete(SAMPLE_STAFF_IDS);
    await db.staff.bulkPut(STAFF);
    await db.meta.put({ key: 'staffVersion', value: STAFF_VERSION });
  });
}

export async function seedReferenceData() {
  if ((await db.meta.get('seeded'))?.value === '1') return updateStaff();
  await db.transaction('rw', [db.pickLists, db.staff, db.channels, db.hospitals, db.aircraft, db.meta], async () => {
    for (const [id, items] of Object.entries(DEFAULT_PICKLISTS)) await db.pickLists.put({ id, items });
    await db.staff.bulkPut(STAFF);
    await db.meta.put({ key: 'staffVersion', value: STAFF_VERSION });
    await db.channels.bulkPut([
      { id: 'c1', channel: '1', name: 'PARKS COMMAND', func: 'Command', rxFreq: '166.0000', txFreq: '166.0000', tone: '100.0', mode: 'A' },
      { id: 'c2', channel: '2', name: 'SAR TAC 1', func: 'Tactical', rxFreq: '166.2500', txFreq: '166.2500', tone: '100.0', mode: 'A' },
      { id: 'c3', channel: '3', name: 'SAR TAC 2', func: 'Tactical', rxFreq: '166.5000', txFreq: '166.5000', tone: '100.0', mode: 'A' },
      { id: 'c4', channel: '4', name: 'AIR-GROUND', func: 'Air to ground', rxFreq: '122.9500', txFreq: '122.9500', tone: '', mode: 'A (AM)' },
      { id: 'c5', channel: '5', name: 'BANFF REPEATER', func: 'Logistics', rxFreq: '167.1000', txFreq: '172.1000', tone: '110.9', mode: 'A' },
    ]);
    await db.hospitals.bulkPut([
      { id: 'h1', name: 'Banff Mineral Springs Hospital (SAMPLE)', address: 'Banff, AB', latLon: '51.18, -115.57', contact: '403-555-0201', airTime: '5 min', groundTime: '10 min', trauma: 'Rural', burn: false, helipad: true },
      { id: 'h2', name: 'Canmore General Hospital (SAMPLE)', address: 'Canmore, AB', latLon: '51.09, -115.36', contact: '403-555-0202', airTime: '10 min', groundTime: '25 min', trauma: 'Rural', burn: false, helipad: true },
      { id: 'h3', name: 'Foothills Medical Centre (SAMPLE)', address: 'Calgary, AB', latLon: '51.06, -114.13', contact: '403-555-0203', airTime: '35 min', groundTime: '1 h 30 min', trauma: 'Level 1', burn: true, helipad: true },
    ]);
    await db.aircraft.bulkPut([
      { id: 'a1', name: 'Cascade Rotor Ltd. (sample)', base: 'Canmore heliport', phone: '403-555-0301', aircraft: 'AS350 B3, Bell 407', capabilities: 'HFRS longline, night vision, FLIR' },
      { id: 'a2', name: 'Bow Corridor Helicopters (sample)', base: 'Banff', phone: '403-555-0302', aircraft: 'AS350 B2', capabilities: 'Recon, crew transport, sling' },
      { id: 'a3', name: 'STARS Air Ambulance (sample contact)', base: 'Calgary', phone: '403-555-0303', aircraft: 'H145', capabilities: 'Medevac, hoist not available' },
    ]);
    await db.meta.put({ key: 'seeded', value: '1' });
  });
}

export async function pickList(id: string) {
  return (await db.pickLists.get(id))?.items ?? DEFAULT_PICKLISTS[id] ?? [];
}
