// Tabletop exercises. Everything here is fictional: people, phone numbers,
// plates and events. Places are real Banff-area trails so the map makes sense;
// coordinates are approximate.
// The exercise controller's script (injects and timings) for the Cory Pass
// scenario is in docs/tabletop-scenario.md; the others come with a briefing only.
import { db, save, patch, uid, nowIso, live } from '../db/db';
import { createIncident, setPosition } from '../lib/ops';
import { DEFAULT_SETTINGS } from '../searchmap/defaults';
import type { Incident, OpPeriod, Subject, Team, Assignment, Ambulance, AidStation } from '../db/types';

type Planning = Pick<Subject, 'planningCoord' | 'planningPointKind' | 'travelBearing' | 'category' | 'terrain'>;
type SubjectInfo = Omit<Subject, keyof import('../db/types').BaseRecord | keyof Planning | 'notes' | 'photo'>;

export interface Scenario {
  key: string;
  title: string; // shown in the picker
  name: string;
  number: string;
  location: string;
  ic: string;
  caltopo: string; // "lat,lng&z=zoom"
  situation: string;
  mapNotes: string;
  people: [position: string, name: string, callSign: string][];
  objectives: string[];
  commandEmphasis: string;
  situationalAwareness: string;
  weather: string;
  safetyMessage?: string;
  medicalProcedures?: string;
  ambulance?: Ambulance;
  aidStation?: AidStation;
  actions: [time: string, action: string][];
  teams: [name: string, type: string, leader: string, callSign: string, members: string[]][];
  /** team index, segment, work, comms channel */
  assignments: [team: number, segment: string, work: string, channel: string][];
  subject: SubjectInfo;
  planning: Planning;
}

const SAFETY_DEFAULT =
  '• Cold exposure: dress in layers, monitor team members for hypothermia, carry an emergency shelter.\n' +
  '• Wildlife: carry bear spray, travel in groups, make noise in thick cover.\n' +
  '• Steep terrain: do not enter technical terrain without a technical rescue team.';
const MEDICAL_DEFAULT =
  'Any responder injury: notify Command on Ch 1, Medic 1 responds from ICP. Subject found: assess, keep warm, request evacuation through Ops. Heli evacuation in daylight only.';
const AMBULANCE_DEFAULT: Ambulance = { service: 'Alberta EMS Banff (sample)', location: 'Banff', contact: '403-555-0401', level: 'ALS' };
const SPECIAL = 'Call subject\'s name and whistle every 5 min. Check in every 30 min.';

export const SCENARIOS: Scenario[] = [
  {
    key: 'cory-pass', title: 'Overdue hiker, Cory Pass (night start, with controller script)',
    name: 'EXERCISE Overdue hiker, Cory Pass', number: 'EX-2026-001', location: 'Cory Pass / Edith Pass loop, Banff NP', ic: 'Avery Lindqvist',
    caltopo: '51.205,-115.66&z=14',
    situation:
      'EXERCISE. Solo hiker (fictional subject "Alex Marchetti", 34) reported overdue by partner at 21:30. ' +
      'Planned the Cory Pass / Edith Pass loop, departed Fireside picnic area trailhead approx. 09:00. ' +
      'Last text message 14:12 from near Cory Pass: "at the pass, windy, heading down the other side". ' +
      'Vehicle (blue hatchback) confirmed at trailhead by Warden 7 at 22:15. Overnight low forecast -4 °C, light snow above 2000 m.\n' +
      'Health and safety: steep scree and loose rock on Cory Pass descent, early-season snow on north aspects, wildlife (bear) activity in Edith Pass.',
    mapNotes: 'PLS: Fireside trailhead. LKP: Cory Pass (approx. 2350 m). ICP: Fireside picnic area. Staging: same. Helispot: Banff heliport.',
    people: [
      ['ops', 'Morgan Tremblay', 'Rescue 3'], ['plans', 'Harper Singh', 'Rescue 10'], ['safety', 'Jordan Okafor', 'Rescue 2'],
      ['logistics', 'Casey Beaulieu', 'Dispatch'], ['ground-branch', 'Taylor Brennan', 'Bow SAR 1'], ['tech-spec', 'Jordan Okafor', 'Rescue 2'],
    ],
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
    medicalProcedures: 'Any responder injury: notify Command on Ch 1, Medic 1 responds from ICP. Subject found: assess, keep warm, request evacuation through Ops. Heli evacuation at first light only.',
    aidStation: { name: 'ICP medical', location: 'Fireside picnic area', contact: 'Medic 1 / Ch 1', paramedics: true },
    actions: [
      ['21:30', 'Overdue report received by Banff Dispatch.'],
      ['22:15', 'Warden 7 confirmed subject vehicle at Fireside trailhead.'],
      ['22:40', 'IC established at Fireside picnic area; call-out of VSPC and Bow Valley SAR.'],
    ],
    teams: [
      ['Team 1', 'Hasty', 'Riley Chen', 'Bow SAR 11', ['Sam Patel', 'Drew Kowalski']],
      ['Team 2', 'Hasty', 'Jesse Fournier', 'Bow SAR 12', ['Kai Nakamura', 'Robin Ellis']],
      ['Team 3', 'Containment', 'Parker Wong', 'Warden 7', ['Quinn Dubois']],
    ],
    assignments: [
      [0, 'Cory Pass trail, trailhead to pass', 'Hasty search of the trail to Cory Pass. Check side trails and the viewpoint. Turn around at the pass if snow-covered; report conditions.', '2 SAR TAC 1'],
      [1, 'Edith Pass trail, reverse direction', 'Hasty search of the Edith Pass trail from Fireside toward the Gargoyle Valley junction. Look for tracks leaving the trail.', '3 SAR TAC 2'],
      [2, 'Trailhead containment', 'Staff Fireside trailhead. Log everyone entering/leaving. Keep vehicle under observation.', '1 PARKS COMMAND'],
    ],
    subject: {
      name: 'Alex Marchetti (FICTIONAL)', age: '34', sex: 'M', height: '180 cm', weight: '75 kg', build: 'Slim', hair: 'Brown / brown',
      clothing: 'Red shell jacket, black softshell pants, grey toque', footwear: 'Brown trail runners (lugged sole, size 10)',
      equipment: 'Small daypack, 1 L water, phone (low battery), no headlamp, no overnight gear', medical: 'None known. Mild asthma (inhaler).',
      experience: 'Regular day hiker, new to the Rockies (moved from Toronto 6 months ago).', plan: 'Cory Pass / Edith Pass loop, clockwise, planned to be back by 17:00.',
      lastSeenTime: 'Last text 14:12 today', lastSeenLocation: 'Cory Pass (LKP)', vehicle: 'Blue hatchback, plate EXR-001 (fictional)', contactName: 'Partner "Sam" (fictional), 403-555-0999',
    },
    planning: { planningCoord: '51.2155, -115.6640', planningPointKind: 'LKP', travelBearing: '320', category: 'hiker', terrain: 'temperate mountainous' },
  },
  {
    key: 'goat-creek', title: 'Overdue mountain biker, Goat Creek / Spray River',
    name: 'EXERCISE Overdue mountain biker, Goat Creek', number: 'EX-2026-002', location: 'Goat Creek trail to Banff via Spray River, Banff NP', ic: 'Dana Whitfield',
    caltopo: '51.12,-115.52&z=13',
    situation:
      'EXERCISE. Mountain biker (fictional subject "Priya Raman", 41) did not meet her shuttle partner at the Bow Falls trailhead at 16:00. ' +
      'Started Goat Creek trailhead (Canmore side) at 12:30 riding the 19 km one-way to Banff. A hiker reports seeing a rider matching the description at the Spray River bridge at about 14:00. ' +
      'Phone goes straight to voicemail.\nHealth and safety: Spray River high and cold, washouts reported on the west side trail, dusk at 17:10.',
    mapNotes: 'PLS: Goat Creek trailhead. LKP: Spray River bridge (sighting 14:00). ICP: Bow Falls parking. Staging: Goat Creek trailhead for Canmore-side teams.',
    people: [
      ['ops', 'Lee Moreau', 'Rescue 3'], ['plans', 'Sasha Grant', 'Rescue 10'], ['safety', 'Rowan Hughes', 'Rescue 2'],
      ['logistics', 'Emerson Clarke', 'Dispatch'], ['ground-branch', 'Blair Nguyen', 'Bow SAR 1'],
    ],
    objectives: [
      'Provide for the safety of all responders and the public.',
      'Ride the full Goat Creek / Spray River route from both ends before dark.',
      'Check the river banks at the Spray River bridge and the washout sections.',
      'Locate the subject as quickly as possible.',
    ],
    commandEmphasis: 'Bike teams in pairs. No one enters the Spray River. Report washouts to Safety.',
    situationalAwareness: 'Trail is shared with hikers. Spray River high after rain. Cell coverage only near both trailheads.',
    weather: 'Overcast, 6 °C falling to -1 °C overnight. Light rain until 18:00. Sunset 16:45.',
    actions: [
      ['16:20', 'Shuttle partner called Banff Dispatch to report the subject overdue.'],
      ['16:45', 'Warden 4 confirmed subject\'s car at Goat Creek trailhead.'],
      ['17:00', 'IC established at Bow Falls parking; Bow Valley SAR bike team paged.'],
    ],
    teams: [
      ['Bike 1', 'Hasty (bike)', 'Morgan Liu', 'Bow SAR 21', ['Jamie Stewart']],
      ['Bike 2', 'Hasty (bike)', 'Avery Patel', 'Bow SAR 22', ['Cameron Roy']],
      ['Team 3', 'Hasty', 'Reese Martin', 'Bow SAR 13', ['Hayden Cho', 'Skyler Brooks']],
    ],
    assignments: [
      [0, 'Goat Creek trail, Canmore trailhead to Spray bridge', 'Ride from Goat Creek trailhead toward Banff. Check every washout and side trail. Look for tire tracks leaving the trail.', '2 SAR TAC 1'],
      [1, 'Spray River trail, Banff end to Spray bridge', 'Ride from the Bow Falls end south to the Spray River bridge and meet Bike 1.', '3 SAR TAC 2'],
      [2, 'Spray River bridge and banks', 'Foot search of 500 m of river bank both directions from the bridge. Stay out of the water.', '3 SAR TAC 2'],
    ],
    subject: {
      name: 'Priya Raman (FICTIONAL)', age: '41', sex: 'F', height: '165 cm', weight: '60 kg', build: 'Athletic', hair: 'Black / brown',
      clothing: 'Teal cycling jacket, black shorts over leggings, white helmet', footwear: 'Black flat-pedal bike shoes',
      equipment: 'Grey hardtail bike, hydration pack, small pump, phone', medical: 'Type 1 diabetic, carries insulin and glucose gels.',
      experience: 'Experienced mountain biker, first time on this route.', plan: 'Ride Goat Creek trailhead to Banff one-way, meet partner at Bow Falls at 16:00.',
      lastSeenTime: 'Sighting 14:00 today', lastSeenLocation: 'Spray River bridge (LKP)', vehicle: 'Silver SUV, plate EXR-002 (fictional)', contactName: 'Friend "Jo" (fictional), 403-555-0102',
    },
    planning: { planningCoord: '51.1010, -115.5030', planningPointKind: 'LKP', travelBearing: '330', category: 'mountain biker', terrain: 'temperate mountainous' },
  },
  {
    key: 'aylmer', title: 'Overdue trail runner, Aylmer Lookout',
    name: 'EXERCISE Overdue trail runner, Aylmer Lookout', number: 'EX-2026-003', location: 'Lake Minnewanka shore trail to Aylmer Lookout, Banff NP', ic: 'Kendall Ross',
    caltopo: '51.27,-115.43&z=13',
    situation:
      'EXERCISE. Trail runner (fictional subject "Marcus Leblanc", 28) left Lake Minnewanka day use at 07:00 for an out-and-back run to Aylmer Lookout (about 23 km). ' +
      'He uploaded a photo from the lookout at 10:40. Roommate reported him overdue at 15:00 when he missed his shift. ' +
      'Area has a seasonal group-access restriction for bears.\nHealth and safety: grizzly activity on the shore trail, exposed cliffs at the lookout.',
    mapNotes: 'PLS: Minnewanka day use. LKP: Aylmer Lookout (photo 10:40). ICP: Minnewanka day use. Boat access to campground LM8 possible.',
    people: [
      ['ops', 'Charlie Bergeron', 'Rescue 3'], ['plans', 'Elliot Park', 'Rescue 10'], ['safety', 'Finley Adams', 'Rescue 2'],
      ['logistics', 'Marley Owens', 'Dispatch'], ['air-ops', 'Toby Lachance', 'Heli Ops'],
    ],
    objectives: [
      'Provide for the safety of all responders and the public.',
      'Search the shore trail and the Aylmer Pass junction before dark.',
      'Run a heli recce of the lookout cliffs and the pass while daylight allows.',
      'Locate the subject as quickly as possible.',
    ],
    commandEmphasis: 'Teams of four minimum on the shore trail (bear restriction). Bear spray on every member.',
    situationalAwareness: 'Grizzly sow with cubs reported near LM8 two days ago. Boat available from the Minnewanka dock.',
    weather: 'Clear, 12 °C, winds light. Sunset 20:10. Overnight 2 °C.',
    actions: [
      ['15:00', 'Roommate reported subject overdue to Banff Dispatch.'],
      ['15:30', 'Subject\'s last photo (Aylmer Lookout, 10:40) confirmed from social media.'],
      ['15:50', 'IC established at Minnewanka day use; heli requested for recce.'],
    ],
    teams: [
      ['Team 1', 'Hasty', 'Sydney Kaur', 'Bow SAR 11', ['Remy Gagnon', 'Ari Lambert', 'Dakota Fox']],
      ['Boat 1', 'Boat', 'Logan Pierce', 'Warden 9', ['Shay Moreno']],
      ['Heli 1', 'Heli recce', 'Pilot (sample)', 'HR 1', ['Toby Lachance']],
    ],
    assignments: [
      [0, 'Shore trail, day use to Aylmer junction', 'Hasty search of the shore trail. Check the LM8 campground and the junction signs.', '2 SAR TAC 1'],
      [1, 'Shoreline by boat', 'Boat search of the north shoreline from the dock to LM8. Drop Team 1 resupply at LM8.', '1 PARKS COMMAND'],
      [2, 'Aylmer Lookout and pass recce', 'Heli recce of the lookout cliffs, the Aylmer Pass trail and the pass. Report any person or tracks.', '4 AIR-GROUND'],
    ],
    subject: {
      name: 'Marcus Leblanc (FICTIONAL)', age: '28', sex: 'M', height: '175 cm', weight: '68 kg', build: 'Lean', hair: 'Blond / blue',
      clothing: 'Orange running shirt, black tights, light wind shell', footwear: 'Yellow trail runners',
      equipment: 'Running vest, 1 L water, gels, phone, no bear spray', medical: 'None known.',
      experience: 'Ultra trail runner, knows the area well.', plan: 'Out and back to Aylmer Lookout, maybe on to Aylmer Pass if feeling good.',
      lastSeenTime: 'Photo 10:40 today', lastSeenLocation: 'Aylmer Lookout (LKP)', vehicle: 'Red pickup, plate EXR-003 (fictional)', contactName: 'Roommate "Nico" (fictional), 403-555-0103',
    },
    planning: { planningCoord: '51.2900, -115.4060', planningPointKind: 'LKP', travelBearing: '20', category: 'runner', terrain: 'temperate mountainous' },
  },
  {
    key: 'cascade', title: 'Stranded scrambler, Cascade Mountain',
    name: 'EXERCISE Overdue scrambler, Cascade Mountain', number: 'EX-2026-004', location: 'Cascade Mountain scramble route, Banff NP', ic: 'Robin Castillo',
    caltopo: '51.22,-115.57&z=14',
    situation:
      'EXERCISE. Scrambler (fictional subject "Hannah Weiss", 23) texted her sister at 13:30 from the false summit of Cascade Mountain, saying she was cold and the route was icy. ' +
      'No contact since. Reported overdue at 19:00. Car at the Mt Norquay ski area parking.\n' +
      'Health and safety: icy slabs and loose rock above the amphitheatre, rockfall in the descent gully, cold overnight.',
    mapNotes: 'PLS: Mt Norquay parking. LKP: Cascade false summit (approx. 2800 m). ICP: Mt Norquay day lodge. Helispot: Norquay parking.',
    people: [
      ['ops', 'Jules Ferreira', 'Rescue 3'], ['plans', 'Noor Haddad', 'Rescue 10'], ['safety', 'Wren Sullivan', 'Rescue 2'],
      ['logistics', 'Kit Delgado', 'Dispatch'], ['tech-spec', 'Ash Yamamoto', 'Rescue 5'],
    ],
    objectives: [
      'Provide for the safety of all responders and the public.',
      'Establish voice or phone contact with the subject.',
      'Hasty search the approach trail and the amphitheatre tonight; technical team on standby.',
      'Plan a heli-sling or technical extraction at first light if the subject is located high on the route.',
    ],
    commandEmphasis: 'No night travel above the amphitheatre. Technical terrain is for the technical team only.',
    situationalAwareness: 'Fresh snow above 2400 m. Rockfall in the descent gully in afternoon warming.',
    weather: 'Clear and cold, -8 °C at summit overnight, NW 40 km/h. Sunrise 07:40.',
    actions: [
      ['19:00', 'Sister reported subject overdue to Banff Dispatch.'],
      ['19:20', 'Subject\'s car confirmed at Norquay parking.'],
      ['19:45', 'IC established at Norquay day lodge; Visitor Safety technical team paged.'],
    ],
    teams: [
      ['Team 1', 'Hasty', 'Quinn Archer', 'Bow SAR 11', ['Jordan Pike', 'Taylor Wu']],
      ['Tech 1', 'Technical', 'Ash Yamamoto', 'Rescue 5', ['Sam Rivers', 'Lee Kowal']],
    ],
    assignments: [
      [0, 'Approach trail to amphitheatre', 'Hasty search of the approach trail from the ski area to the amphitheatre. Call and use light signals toward the false summit.', '2 SAR TAC 1'],
      [1, 'Standby at ICP', 'Prepare for a first-light technical extraction from the false summit area.', '1 PARKS COMMAND'],
    ],
    subject: {
      name: 'Hannah Weiss (FICTIONAL)', age: '23', sex: 'F', height: '170 cm', weight: '62 kg', build: 'Medium', hair: 'Red / green',
      clothing: 'Purple down jacket, grey hiking pants, black helmet', footwear: 'Leather hiking boots',
      equipment: 'Daypack, microspikes, headlamp, 0.5 L water, phone at 20%', medical: 'None known.',
      experience: 'Some scrambling experience in the Kananaskis, first time on Cascade.', plan: 'Cascade Mountain via the standard scramble route, back by 17:00.',
      lastSeenTime: 'Text 13:30 today', lastSeenLocation: 'Cascade false summit (LKP)', vehicle: 'Green hatchback, plate EXR-004 (fictional)', contactName: 'Sister "Leah" (fictional), 403-555-0104',
    },
    planning: { planningCoord: '51.2235, -115.5760', planningPointKind: 'LKP', travelBearing: '', category: 'climber', terrain: 'temperate mountainous' },
  },
  {
    key: 'tunnel-mtn', title: 'Missing person with dementia, Tunnel Mountain',
    name: 'EXERCISE Missing person with dementia, Tunnel Mountain', number: 'EX-2026-005', location: 'Tunnel Mountain campground and Hoodoos trail, Banff NP', ic: 'Shawn McKay',
    caltopo: '51.19,-115.54&z=14',
    situation:
      'EXERCISE. Man with dementia (fictional subject "Walter Kim", 79) walked away from the family RV at Tunnel Mountain Village II campground between 06:30 and 07:15. ' +
      'Family searched the loops for an hour before calling. He walks daily and sometimes talks about "going home to the farm".\n' +
      'Health and safety: Hoodoos viewpoint cliffs, Bow River banks, traffic on Tunnel Mountain Road.',
    mapNotes: 'PLS: campsite H-41, Tunnel Mountain Village II. ICP: campground kiosk. Staging: overflow lot.',
    people: [
      ['ops', 'Pat Ouellette', 'Rescue 3'], ['plans', 'Morgan Ahn', 'Rescue 10'], ['safety', 'Rory Bell', 'Rescue 2'],
      ['logistics', 'Devon Laurent', 'Dispatch'], ['liaison', 'Cory Stone', 'Liaison'],
    ],
    objectives: [
      'Provide for the safety of all responders and the public.',
      'Search the campground loops, washrooms and vehicles with campground staff.',
      'Hasty search the Hoodoos trail and the Bow River bank downstream of the campground.',
      'Locate the subject as quickly as possible; he may not respond to his name.',
      'Support the family through the Liaison Officer.',
    ],
    commandEmphasis: 'Subject may hide or not answer. Check culverts, dense brush and any shelter. Watch for traffic.',
    situationalAwareness: 'Campground at 80% capacity. RCMP notified. Bow River is fast and cold.',
    weather: 'Sunny, 4 °C rising to 14 °C. Overnight 0 °C.',
    actions: [
      ['08:20', 'Family reported subject missing to campground staff, who called Banff Dispatch.'],
      ['08:35', 'RCMP and Parks Law Enforcement notified.'],
      ['08:50', 'IC established at the campground kiosk.'],
    ],
    teams: [
      ['Team 1', 'Hasty', 'Ellis Grant', 'Bow SAR 11', ['Mika Torres', 'Jaden Shaw']],
      ['Team 2', 'Hasty', 'Bailey Ford', 'Bow SAR 12', ['Lane Kerr']],
      ['Team 3', 'Containment', 'Campground staff', 'Camp 1', ['Warden 6']],
    ],
    assignments: [
      [0, 'Hoodoos trail, campground to viewpoint', 'Hasty search of the Hoodoos trail. Check under the boardwalk and below the viewpoint.', '2 SAR TAC 1'],
      [1, 'Bow River bank downstream', 'Search 1 km of the river bank downstream of the campground. Stay back from the water.', '3 SAR TAC 2'],
      [2, 'Campground loops and exits', 'Check every loop, washroom and open vehicle. Staff the campground exits and ask departing campers.', '1 PARKS COMMAND'],
    ],
    subject: {
      name: 'Walter Kim (FICTIONAL)', age: '79', sex: 'M', height: '172 cm', weight: '70 kg', build: 'Slight', hair: 'Grey / brown',
      clothing: 'Tan cardigan, plaid shirt, navy pants, flat cap', footwear: 'Brown slippers (left a pair of shoes at the RV)',
      equipment: 'None. No phone.', medical: 'Moderate dementia, heart medication due at noon.',
      experience: 'Walks daily at home on a farm in Saskatchewan.', plan: 'None. Wandered from the RV.',
      lastSeenTime: 'Between 06:30 and 07:15 today', lastSeenLocation: 'Campsite H-41 (PLS)', vehicle: 'Family RV at site H-41', contactName: 'Daughter "Grace" (fictional), 403-555-0105',
    },
    planning: { planningCoord: '51.1900, -115.5300', planningPointKind: 'PLS', travelBearing: '', category: 'dementia', terrain: 'temperate mountainous' },
  },
  {
    key: 'johnston', title: 'Despondent person, Johnston Canyon',
    name: 'EXERCISE Despondent person, Johnston Canyon', number: 'EX-2026-006', location: 'Johnston Canyon and Ink Pots, Banff NP', ic: 'Terry Laforge',
    caltopo: '51.25,-115.83&z=14',
    situation:
      'EXERCISE. RCMP report a despondent adult (fictional subject "Jamie Novak", 45) who left a note at home in Calgary. ' +
      'Vehicle found at Johnston Canyon parking by a Parks patrol at 18:30. Bank records show a card used at the canyon cafe at 12:10.\n' +
      'Health and safety: canyon catwalks and cliffs, fast water below the falls, subject may avoid searchers.',
    mapNotes: 'PLS: Johnston Canyon parking. ICP: Johnston Canyon lodge parking. RCMP liaison at ICP.',
    people: [
      ['ops', 'Hunter Blais', 'Rescue 3'], ['plans', 'Peyton Diaz', 'Rescue 10'], ['safety', 'Sage Mercer', 'Rescue 2'],
      ['logistics', 'Alexis Roy', 'Dispatch'], ['liaison', 'RCMP liaison (sample)', 'RCMP'],
    ],
    objectives: [
      'Provide for the safety of all responders and the public.',
      'Search the canyon trail, catwalks and both falls tonight.',
      'Search the Ink Pots trail and meadows at first light.',
      'Coordinate with RCMP on approach and family contact.',
    ],
    commandEmphasis: 'Approach calmly, identify yourself, do not crowd the subject. Report sightings before approaching.',
    situationalAwareness: 'Canyon trail is busy until dusk. Catwalks are icy in the morning. RCMP lead on the investigation.',
    weather: 'Overcast, 3 °C, overnight -3 °C. Light snow possible.',
    actions: [
      ['17:45', 'RCMP Calgary requested assistance locating subject; vehicle plate circulated.'],
      ['18:30', 'Parks patrol found subject vehicle at Johnston Canyon parking.'],
      ['18:50', 'IC established at the lodge parking with RCMP.'],
    ],
    teams: [
      ['Team 1', 'Hasty', 'Kerry Holt', 'Bow SAR 11', ['Indy Rao', 'Jo Becker']],
      ['Team 2', 'Hasty', 'Max Duval', 'Bow SAR 12', ['Tate Lowe']],
    ],
    assignments: [
      [0, 'Canyon trail to Lower and Upper Falls', 'Hasty search of the canyon trail and catwalks to the Upper Falls. Check viewpoints and below the rails with lights.', '2 SAR TAC 1'],
      [1, 'Moose Meadows trail and parking area', 'Search the Moose Meadows connector and the treed area around the parking and lodge.', '3 SAR TAC 2'],
    ],
    subject: {
      name: 'Jamie Novak (FICTIONAL)', age: '45', sex: 'M', height: '183 cm', weight: '90 kg', build: 'Heavy', hair: 'Dark brown, beard / brown',
      clothing: 'Black puffy jacket, jeans, Flames ball cap', footwear: 'White running shoes',
      equipment: 'Unknown. Phone turned off since 11:00.', medical: 'Depression. Prescription medication left at home.',
      experience: 'Not an outdoors person. Visited the canyon as a child.', plan: 'Unknown.',
      lastSeenTime: 'Card used 12:10 today', lastSeenLocation: 'Johnston Canyon cafe (PLS)', vehicle: 'Black sedan, plate EXR-006 (fictional)', contactName: 'RCMP file contact (fictional), 403-555-0106',
    },
    planning: { planningCoord: '51.2450, -115.8390', planningPointKind: 'PLS', travelBearing: '', category: 'despondent', terrain: 'temperate mountainous' },
  },
  {
    key: 'temple', title: 'Overdue mountaineers, Mount Temple',
    name: 'EXERCISE Overdue mountaineers, Mount Temple', number: 'EX-2026-007', location: 'Mount Temple from Moraine Lake road, Lake Louise, Banff NP', ic: 'Glen Archambault',
    caltopo: '51.34,-116.19&z=13',
    situation:
      'EXERCISE. Party of two (fictional subjects led by "Oliver Brandt", 37) left Moraine Lake at 05:00 to climb Mount Temple via the SW ridge. ' +
      'Inreach message at 12:15 from near the summit: "Summit soon. All OK." No further messages. Reported overdue at 20:30.\n' +
      'Health and safety: high altitude, crevasse-free but steep scree and cliffs, rockfall in the Sentinel Pass area.',
    mapNotes: 'PLS: Moraine Lake parking. LKP: Inreach point near summit (approx. 3500 m). ICP: Moraine Lake parking. Helispot: Lake Louise compound.',
    people: [
      ['ops', 'Reid Thomson', 'Rescue 3'], ['plans', 'Mae Gallagher', 'Rescue 10'], ['safety', 'Lou Vachon', 'Rescue 2'],
      ['logistics', 'Ira Bennett', 'Dispatch'], ['air-ops', 'Kim Rasmussen', 'Heli Ops'], ['tech-spec', 'Sol Ivanov', 'Rescue 5'],
    ],
    objectives: [
      'Provide for the safety of all responders and the public.',
      'Get a position from the Inreach provider and the subjects\' phones.',
      'Ground search the Larch Valley and Sentinel Pass trail tonight.',
      'Heli recce of the SW ridge and descent at first light; technical team ready to sling.',
    ],
    commandEmphasis: 'No responders above Sentinel Pass at night. Heli ops only in daylight with Safety sign-off.',
    situationalAwareness: 'Moraine Lake road open to buses only. Snow above 3000 m. Wind on summit ridge.',
    weather: 'Clear, summit -10 °C overnight, SW 50 km/h. Sunrise 07:30.',
    actions: [
      ['20:30', 'Partner of a subject reported the party overdue to Lake Louise Dispatch.'],
      ['21:00', 'Inreach provider contacted for message history.'],
      ['21:20', 'IC established at Moraine Lake parking; technical team paged.'],
    ],
    teams: [
      ['Team 1', 'Hasty', 'Brook Henderson', 'LL SAR 11', ['Casey Lin', 'Tyler Moss']],
      ['Tech 1', 'Technical', 'Sol Ivanov', 'Rescue 5', ['Kris Dahl', 'Andy Okoro']],
      ['Heli 1', 'Heli recce', 'Pilot (sample)', 'HR 1', ['Kim Rasmussen']],
    ],
    assignments: [
      [0, 'Larch Valley to Sentinel Pass', 'Hasty search of the trail to Sentinel Pass. Watch the scree below the SW ridge with lights.', '2 SAR TAC 1'],
      [1, 'Standby at ICP', 'Prepare for a first-light heli-sling from the SW ridge.', '1 PARKS COMMAND'],
      [2, 'SW ridge recce (first light)', 'Recce of the SW ridge, summit and descent line. Report any person, gear or tracks.', '4 AIR-GROUND'],
    ],
    subject: {
      name: 'Oliver Brandt (FICTIONAL) and partner', age: '37 / 35', sex: 'M / F', height: '185 cm / 168 cm', weight: '82 kg / 58 kg', build: 'Fit', hair: 'Brown / blond',
      clothing: 'Yellow and blue hardshells, black pants, helmets', footwear: 'Mountaineering boots',
      equipment: 'Inreach, 30 m rope, crampons, headlamps, light bivy', medical: 'None known.',
      experience: 'Experienced mountaineers from Europe, first trip to the Rockies.', plan: 'Mount Temple SW ridge, descend the same way, back by 16:00.',
      lastSeenTime: 'Inreach 12:15 today', lastSeenLocation: 'Near Mount Temple summit (LKP)', vehicle: 'White rental van, plate EXR-007 (fictional)', contactName: 'Partner "Lena" (fictional), 403-555-0107',
    },
    planning: { planningCoord: '51.3500, -116.2060', planningPointKind: 'LKP', travelBearing: '200', category: 'climber (mountaineer)', terrain: 'temperate mountainous' },
  },
  {
    key: 'six-glaciers', title: 'Overdue hiker, Plain of Six Glaciers',
    name: 'EXERCISE Overdue hiker, Plain of Six Glaciers', number: 'EX-2026-008', location: 'Lake Louise to Plain of Six Glaciers, Banff NP', ic: 'Maria Okonkwo',
    caltopo: '51.40,-116.25&z=14',
    situation:
      'EXERCISE. Solo hiker (fictional subject "Ethan Moore", 52) left his tour group at the Plain of Six Glaciers teahouse at 13:00 to "go a bit further" toward the Victoria Glacier viewpoint. ' +
      'He did not return to the tour bus at 16:30.\nHealth and safety: moraine edges, icefall and rockfall from Mount Victoria, crowds on the lakeshore.',
    mapNotes: 'PLS: Plain of Six Glaciers teahouse. ICP: Lake Louise lakeshore warden cabin. Staging: Chateau parking.',
    people: [
      ['ops', 'Nico Fraser', 'Rescue 3'], ['plans', 'Bea Lindgren', 'Rescue 10'], ['safety', 'Hal Pruitt', 'Rescue 2'],
      ['logistics', 'Ren Matsuda', 'Dispatch'], ['liaison', 'Tour company rep (sample)', 'Liaison'],
    ],
    objectives: [
      'Provide for the safety of all responders and the public.',
      'Hasty search the trail to the Victoria Glacier viewpoint and the moraine crest.',
      'Check the Lake Agnes and Highline connector trails.',
      'Locate the subject as quickly as possible.',
    ],
    commandEmphasis: 'No travel on the glacier or below the icefall. Stay on the moraine crest trail.',
    situationalAwareness: 'Busy trail until dusk. Teahouse staff available for interviews.',
    weather: 'Partly cloudy, 8 °C, overnight -2 °C. Sunset 19:30.',
    actions: [
      ['16:45', 'Tour driver reported subject missing to Lake Louise Dispatch.'],
      ['17:05', 'Teahouse staff confirmed subject left heading west at about 13:00.'],
      ['17:20', 'IC established at the lakeshore warden cabin.'],
    ],
    teams: [
      ['Team 1', 'Hasty', 'Tess Romero', 'LL SAR 11', ['Cal Hughes', 'Ola Nilsen']],
      ['Team 2', 'Hasty', 'Vic Barros', 'LL SAR 12', ['Remy Lam']],
    ],
    assignments: [
      [0, 'Teahouse to Victoria Glacier viewpoint', 'Hasty search from the teahouse to the end of the trail. Scan the moraine slopes with binoculars.', '2 SAR TAC 1'],
      [1, 'Highline trail to Lake Agnes', 'Hasty search of the Highline connector to Lake Agnes and back down the main trail.', '3 SAR TAC 2'],
    ],
    subject: {
      name: 'Ethan Moore (FICTIONAL)', age: '52', sex: 'M', height: '178 cm', weight: '95 kg', build: 'Heavy', hair: 'Bald, grey beard / blue',
      clothing: 'Light blue rain jacket, khaki pants, white sun hat', footwear: 'Casual sneakers',
      equipment: 'Camera, bottle of water, phone with no roaming plan', medical: 'High blood pressure.',
      experience: 'Casual walker, visiting from the UK.', plan: 'Walk a bit beyond the teahouse and return to the bus by 16:30.',
      lastSeenTime: '13:00 today', lastSeenLocation: 'Plain of Six Glaciers teahouse (PLS)', vehicle: 'Tour bus', contactName: 'Tour guide "Ana" (fictional), 403-555-0108',
    },
    planning: { planningCoord: '51.3930, -116.2620', planningPointKind: 'PLS', travelBearing: '250', category: 'hiker', terrain: 'temperate mountainous' },
  },
  {
    key: 'two-jack', title: 'Missing youth with intellectual disability, Two Jack Lake',
    name: 'EXERCISE Missing youth, Two Jack Lake', number: 'EX-2026-009', location: 'Two Jack Lakeside campground, Banff NP', ic: 'Corey Halvorsen',
    caltopo: '51.23,-115.50&z=14',
    situation:
      'EXERCISE. Young adult with an intellectual disability (fictional subject "Tyler Grant", 19) left his group\'s campsite at Two Jack Lakeside during free time around 15:00. ' +
      'Group leaders searched for 45 minutes. He likes water and trains, and may follow the road or the lakeshore.\n' +
      'Health and safety: lakeshore and cold water, traffic on Minnewanka Loop road, wildlife.',
    mapNotes: 'PLS: group site, Two Jack Lakeside. ICP: campground entrance. Staging: Two Jack Main overflow.',
    people: [
      ['ops', 'Jordan Fiset', 'Rescue 3'], ['plans', 'Ayla Mendes', 'Rescue 10'], ['safety', 'Rudy Kahn', 'Rescue 2'],
      ['logistics', 'Fran Pelletier', 'Dispatch'], ['liaison', 'Group leader (sample)', 'Liaison'],
    ],
    objectives: [
      'Provide for the safety of all responders and the public.',
      'Search the lakeshore of Two Jack Lake and the campground first.',
      'Confine the Minnewanka Loop road at both ends.',
      'Locate the subject as quickly as possible; he may be frightened of strangers.',
    ],
    commandEmphasis: 'Use the subject\'s name and mention his group leader. Avoid uniforms crowding him. Two people approach.',
    situationalAwareness: 'Campground full. Group leaders on site. Road traffic heavy until 18:00.',
    weather: 'Sunny, 15 °C, overnight 3 °C. Sunset 20:00.',
    actions: [
      ['15:45', 'Group leader reported subject missing to campground staff.'],
      ['16:00', 'Banff Dispatch notified; RCMP advised.'],
      ['16:15', 'IC established at the campground entrance.'],
    ],
    teams: [
      ['Team 1', 'Hasty', 'Kai Morrison', 'Bow SAR 11', ['Lou Brandt', 'Mia Saito']],
      ['Team 2', 'Hasty', 'Ari Novak', 'Bow SAR 12', ['Gus Ferraro']],
      ['Team 3', 'Containment', 'Parks patrol', 'Warden 3', ['Warden 8']],
    ],
    assignments: [
      [0, 'Two Jack Lake shoreline', 'Walk the full lakeshore from the campground. Check boats, docks and the outlet.', '2 SAR TAC 1'],
      [1, 'Campground and Two Jack Main', 'Search both campgrounds, washrooms and play areas. Ask campers.', '3 SAR TAC 2'],
      [2, 'Minnewanka Loop road containment', 'Stop at both ends of the loop road. Check walkers and ask drivers.', '1 PARKS COMMAND'],
    ],
    subject: {
      name: 'Tyler Grant (FICTIONAL)', age: '19', sex: 'M', height: '170 cm', weight: '65 kg', build: 'Medium', hair: 'Brown, short / brown',
      clothing: 'Bright green hoodie, grey sweatpants, red ball cap', footwear: 'Black sneakers',
      equipment: 'None. No phone.', medical: 'Intellectual disability, non-verbal when stressed. No medication.',
      experience: 'Little outdoors experience. Loves water and trains.', plan: 'None.',
      lastSeenTime: 'About 15:00 today', lastSeenLocation: 'Group site, Two Jack Lakeside (PLS)', vehicle: 'Group van', contactName: 'Group leader "Robin" (fictional), 403-555-0109',
    },
    planning: { planningCoord: '51.2330, -115.4990', planningPointKind: 'PLS', travelBearing: '', category: 'intellectual disability', terrain: 'temperate mountainous' },
  },
  {
    key: 'castle', title: 'Missing person with mental illness, Castle Junction',
    name: 'EXERCISE Missing person, Castle Junction', number: 'EX-2026-010', location: 'Castle Junction and Bow Valley Parkway, Banff NP', ic: 'Avery Lindqvist',
    caltopo: '51.27,-115.92&z=13',
    situation:
      'EXERCISE. Adult with schizophrenia (fictional subject "Sam Okafor", 31) got out of a family member\'s car at Castle Junction at 10:30 after an argument and walked into the trees toward Castle Mountain. ' +
      'Family drove the parkway for two hours before calling. He has not taken medication for a week.\n' +
      'Health and safety: Bow Valley Parkway traffic, river crossings, cliffs on Castle Mountain lower slopes.',
    mapNotes: 'PLS: Castle Junction pull-out. ICP: Castle Mountain hostel parking (sample). Staging: Castle Junction.',
    people: [
      ['ops', 'Morgan Tremblay', 'Rescue 3'], ['plans', 'Harper Singh', 'Rescue 10'], ['safety', 'Jordan Okafor', 'Rescue 2'],
      ['logistics', 'Casey Beaulieu', 'Dispatch'], ['liaison', 'RCMP liaison (sample)', 'RCMP'],
    ],
    objectives: [
      'Provide for the safety of all responders and the public.',
      'Hasty search the Rockbound Lake trail and the lower slopes of Castle Mountain.',
      'Patrol the Bow Valley Parkway between Castle and Johnston Canyon.',
      'Locate the subject as quickly as possible; coordinate any approach with RCMP.',
    ],
    commandEmphasis: 'Subject may be unpredictable. Observe and report; approach only with RCMP present.',
    situationalAwareness: 'Bow Valley Parkway has a wildlife night closure from 20:00. RCMP on scene.',
    weather: 'Showers, 7 °C, overnight 0 °C. Sunset 19:50.',
    actions: [
      ['12:40', 'Family reported subject missing to RCMP, who called Banff Dispatch.'],
      ['13:00', 'Parks patrol checked the Castle Junction area.'],
      ['13:20', 'IC established at Castle Junction with RCMP.'],
    ],
    teams: [
      ['Team 1', 'Hasty', 'Riley Chen', 'Bow SAR 11', ['Sam Patel', 'Drew Kowalski']],
      ['Team 2', 'Hasty', 'Jesse Fournier', 'Bow SAR 12', ['Kai Nakamura']],
      ['Patrol 1', 'Road patrol', 'Parker Wong', 'Warden 7', ['RCMP member (sample)']],
    ],
    assignments: [
      [0, 'Rockbound Lake trail to Tower Lake', 'Hasty search of the Rockbound Lake trail. Look for tracks leaving the trail toward the cliffs.', '2 SAR TAC 1'],
      [1, 'Castle Junction to the Bow River', 'Search the trees and river bank between Castle Junction and the Bow River bridge.', '3 SAR TAC 2'],
      [2, 'Bow Valley Parkway patrol', 'Drive the parkway between Castle Junction and Johnston Canyon. Check pull-outs and picnic areas.', '1 PARKS COMMAND'],
    ],
    subject: {
      name: 'Sam Okafor (FICTIONAL)', age: '31', sex: 'M', height: '188 cm', weight: '80 kg', build: 'Tall, slim', hair: 'Black, short / brown',
      clothing: 'Grey hoodie, black track pants, no jacket', footwear: 'Slip-on canvas shoes',
      equipment: 'None. Phone left in the car.', medical: 'Schizophrenia, off medication for a week.',
      experience: 'Grew up in Calgary, some hiking as a teen.', plan: 'None. Walked off after an argument.',
      lastSeenTime: '10:30 today', lastSeenLocation: 'Castle Junction pull-out (PLS)', vehicle: 'Family car (left the scene)', contactName: 'Brother "Ike" (fictional), 403-555-0110',
    },
    planning: { planningCoord: '51.2660, -115.9180', planningPointKind: 'PLS', travelBearing: '40', category: 'mental illness', terrain: 'temperate mountainous' },
  },
];

/** Search planning inputs for the Cory Pass subject (used to fill exercises made before the Search map existed). */
export const EXERCISE_PLANNING = SCENARIOS[0]!.planning;

export async function loadExercise(key: string = SCENARIOS[0]!.key): Promise<Incident> {
  const sc = SCENARIOS.find((s) => s.key === key) ?? SCENARIOS[0]!;
  const inc = await createIncident({ name: sc.name, number: sc.number, location: sc.location, icName: sc.ic, exercise: true });
  await patch<Incident>('incidents', inc.id, {
    caltopoUrl: `https://caltopo.com/map.html#ll=${sc.caltopo}`, situationSummary: sc.situation, mapNotes: sc.mapNotes,
  });
  const op = (await db.opPeriods.get((await db.incidents.get(inc.id))!.currentOpPeriodId!))!;
  let cur: OpPeriod = op;
  for (const [k, name, cs] of sc.people) {
    await setPosition(cur, k, { name, callSign: cs, agency: '' });
    cur = (await db.opPeriods.get(op.id))!;
  }
  await patch<OpPeriod>('opPeriods', op.id, {
    objectives: sc.objectives, commandEmphasis: sc.commandEmphasis, situationalAwareness: sc.situationalAwareness, weather: sc.weather,
    safetyMessage: sc.safetyMessage ?? SAFETY_DEFAULT, medicalProcedures: sc.medicalProcedures ?? MEDICAL_DEFAULT,
    ambulances: [sc.ambulance ?? AMBULANCE_DEFAULT],
    aidStations: [sc.aidStation ?? { name: 'ICP medical', location: 'ICP', contact: 'Medic 1 / Ch 1', paramedics: true }],
    actions: sc.actions.map(([time, action]) => ({ time, action })),
  });
  const teams: Team[] = sc.teams.map(([name, type, leader, cs, members]) => ({
    id: uid(), incidentId: inc.id, opPeriodId: op.id, updatedAt: nowIso(), name, type, leader, leaderCallSign: cs, members, contact: '', status: 'assigned',
  }));
  for (const x of teams) await save('teams', x);
  let n = 0;
  for (const [ti, segment, work, ch] of sc.assignments) {
    const a: Assignment = {
      id: uid(), incidentId: inc.id, opPeriodId: op.id, updatedAt: nowIso(), number: String(++n), teamId: teams[ti]!.id, branch: 'Ground', division: 'A',
      segment, caltopoRef: '', work, specialInstructions: SPECIAL, commsChannel: ch, status: 'assigned',
    };
    await save('assignments', a);
  }
  const subject = live(await db.subjects.where('incidentId').equals(inc.id).toArray())[0]!;
  await patch<Subject>('subjects', subject.id, { ...sc.subject, ...sc.planning });
  // Search map for op period 1, built from the subject's planning inputs.
  await save('searchMaps', { id: uid(), incidentId: inc.id, opPeriodId: op.id, updatedAt: nowIso(), settings: DEFAULT_SETTINGS, pod: undefined });
  return (await db.incidents.get(inc.id))!;
}
