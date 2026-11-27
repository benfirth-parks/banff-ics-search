// Fill blank Search map inputs on the Subject profile from what the rest of the
// incident already says, so a map starts from the forms instead of empty.
import type { Incident, Subject } from '../db/types';
import { parseCoordinate } from './packages/geospatial/src/coords.ts';
import { EXERCISE_PLANNING } from '../data/scenario';

const blank = (v?: string) => v == null || v.trim() === '';

const CATEGORY_WORDS: [RegExp, string][] = [
  [/dementia|alzheimer/i, 'dementia'],
  [/despondent|suicid/i, 'despondent'],
  [/mountaineer/i, 'climber (mountaineer)'],
  [/climb/i, 'climber'],
  [/mountain bik|biker|cycling/i, 'mountain biker'],
  [/trail run|runner|running/i, 'runner'],
  [/hik|backpack|walk/i, 'hiker'],
];

export function planningPrefill(incident: Incident, s: Subject): Partial<Subject> {
  const out: Partial<Subject> = {};
  if (blank(s.planningCoord)) {
    const found = [s.lastSeenLocation, incident.location].find((t) => t && parseCoordinate(t).ok);
    if (found) out.planningCoord = found;
    else if (incident.exercise) Object.assign(out, EXERCISE_PLANNING);
  }
  if (!s.planningPointKind && !out.planningPointKind) {
    const m = /\b(IPP|LKP|PLS)\b/i.exec(s.lastSeenLocation);
    if (m) out.planningPointKind = m[1]!.toUpperCase() as Subject['planningPointKind'];
  }
  if (blank(s.category) && !out.category) {
    const text = [s.experience, s.plan, s.notes, s.equipment].join(' ');
    const hit = CATEGORY_WORDS.find(([re]) => re.test(text));
    if (hit) out.category = hit[1];
  }
  if (blank(s.terrain) && !out.terrain) out.terrain = 'temperate mountainous';
  // Never overwrite something already entered.
  for (const k of Object.keys(out) as (keyof Subject)[]) if (!blank(s[k] as string | undefined)) delete out[k];
  return out;
}
