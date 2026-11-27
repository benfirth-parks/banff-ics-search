import { useCtx } from './IncidentLayout';
import { useTable } from '../lib/hooks';
import { patch, save, uid, nowIso } from '../db/db';
import type { Subject } from '../db/types';
import { Text } from '../components/ui';
import { compressPhoto } from '../lib/device';

const FIELDS: [keyof Subject, string, boolean?][] = [
  ['name', 'Name'], ['age', 'Age'], ['sex', 'Sex'], ['height', 'Height'], ['weight', 'Weight'], ['build', 'Build'], ['hair', 'Hair / eyes'],
  ['clothing', 'Clothing (colours, layers)', true], ['footwear', 'Footwear (sole pattern)', true], ['equipment', 'Equipment carried', true],
  ['medical', 'Medical conditions / medications', true], ['experience', 'Outdoor experience / fitness', true], ['plan', 'Intended route / trip plan', true],
  ['lastSeenTime', 'Last seen (date/time)'], ['lastSeenLocation', 'Last seen location (PLS / LKP)'], ['vehicle', 'Vehicle (make, colour, plate)'],
  ['contactName', 'Reporting party / family contact'], ['notes', 'Other notes', true],
];

export function SubjectPage() {
  const { incident } = useCtx();
  const subjects = useTable('subjects', incident.id);
  const s = subjects[0];
  if (!s) return <button onClick={() => save<Subject>('subjects', { id: uid(), incidentId: incident.id, updatedAt: nowIso(), ...Object.fromEntries(FIELDS.map(([k]) => [k, ''])) } as Subject)}>Create subject profile</button>;
  const up = (c: Partial<Subject>) => patch<Subject>('subjects', s.id, c);
  return (
    <section className="card subject">
      <h2>Subject profile</h2>
      <p className="muted">Training data only. Do not enter real personal information in v1.</p>
      <div className="subject-grid">
        <div>
          {s.photo ? <img className="photo" src={s.photo} alt="subject" /> : <div className="photo empty">No photo</div>}
          <label className="button small">Upload photo<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) up({ photo: await compressPhoto(f, 600) }); }} /></label>
        </div>
        <div className="cols2">{FIELDS.map(([k, label, multi]) => (
          <Text key={k} label={label} multiline={multi} rows={2} value={s[k] as string} onCommit={(v) => up({ [k]: v })} className={multi ? 'span2' : ''} />
        ))}</div>
      </div>
    </section>
  );
}
