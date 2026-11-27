import { useState } from 'react';
import type { Assignment, Debrief, Team } from '../db/types';
import { patch, nowIso } from '../db/db';

const FIELDS: [keyof Debrief, string][] = [
  ['areaCovered', 'Area actually searched (and how)'],
  ['coverageEstimate', 'Coverage estimate (e.g. thorough / partial / hasty)'],
  ['notSearched', 'Areas not searched and why'],
  ['hazards', 'Hazards found'],
  ['cluesSummary', 'Clues found (see clue log)'],
  ['suggestions', 'Suggestions for the next team'],
];

/** Assignment debrief, usable from the field or the command post. */
export function DebriefForm({ a, team, by, onDone }: { a: Assignment; team?: Team; by: string; onDone?: () => void }) {
  const [d, setD] = useState<Debrief>(a.debrief ?? { completedAt: '', areaCovered: '', coverageEstimate: '', hazards: '', cluesSummary: '', notSearched: '', suggestions: '', by });
  const submit = async () => {
    await patch<Assignment>('assignments', a.id, { debrief: { ...d, by: d.by || by, completedAt: nowIso() }, status: 'complete' });
    if (team) await patch<Team>('teams', team.id, { status: 'available' });
    onDone?.();
  };
  return (
    <div className="debrief">
      {FIELDS.map(([k, label]) => (
        <label key={k} className="field"><span>{label}</span><textarea rows={2} value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} /></label>
      ))}
      <label className="field"><span>Debriefed by</span><input value={d.by} onChange={(e) => setD({ ...d, by: e.target.value })} /></label>
      <button className="primary" onClick={submit}>Save debrief and mark assignment complete</button>
    </div>
  );
}
