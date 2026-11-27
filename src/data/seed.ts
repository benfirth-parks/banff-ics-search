// SAMPLE reference data. All names, call signs, phone numbers and frequencies
// are invented for training. Verify real contacts before any live use.
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

export async function seedReferenceData() {
  if ((await db.meta.get('seeded'))?.value === '1') return;
  await db.transaction('rw', [db.pickLists, db.staff, db.channels, db.hospitals, db.aircraft, db.meta], async () => {
    for (const [id, items] of Object.entries(DEFAULT_PICKLISTS)) await db.pickLists.put({ id, items });
    await db.staff.bulkPut([
      { id: 's1', name: 'Avery Lindqvist', callSign: 'Rescue 1', agency: 'Parks Canada VSPC', quals: ['ICS 300', 'Heli sling', 'ACMG'], phone: '403-555-0101' },
      { id: 's2', name: 'Jordan Okafor', callSign: 'Rescue 2', agency: 'Parks Canada VSPC', quals: ['ICS 200', 'Search Manager', 'EMR'], phone: '403-555-0102' },
      { id: 's3', name: 'Morgan Tremblay', callSign: 'Rescue 3', agency: 'Parks Canada VSPC', quals: ['ICS 300', 'Swiftwater', 'Avalanche L2'], phone: '403-555-0103' },
      { id: 's4', name: 'Riley Nakamura', callSign: 'Warden 7', agency: 'Parks Canada LE', quals: ['ICS 200', 'Investigation'], phone: '403-555-0104' },
      { id: 's5', name: 'Casey Beaulieu', callSign: 'Dispatch', agency: 'Banff Dispatch', quals: ['ICS 100', 'Radio'], phone: '403-555-0105' },
      { id: 's6', name: 'Sam Whitehorse', callSign: 'Rescue 6', agency: 'Parks Canada VSPC', quals: ['ICS 200', 'Dog handler'], phone: '403-555-0106' },
      { id: 's7', name: 'Taylor Brennan', callSign: 'Bow SAR 1', agency: 'Bow Valley SAR (volunteer)', quals: ['GSAR Team Leader', 'Standard First Aid'], phone: '403-555-0107' },
      { id: 's8', name: 'Drew Kowalski', callSign: 'Bow SAR 2', agency: 'Bow Valley SAR (volunteer)', quals: ['GSAR Searcher', 'Wilderness First Responder'], phone: '403-555-0108' },
      { id: 's9', name: 'Quinn Delacroix', callSign: 'Medic 1', agency: 'Alberta EMS', quals: ['Paramedic (ACP)'], phone: '403-555-0109' },
      { id: 's10', name: 'Harper Singh', callSign: 'Rescue 10', agency: 'Parks Canada VSPC', quals: ['ICS 300', 'Planning Section'], phone: '403-555-0110' },
    ]);
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
