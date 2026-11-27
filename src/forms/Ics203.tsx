import { useLiveQuery } from 'dexie-react-hooks';
import { FormFrame, Box, Text } from '../components/ui';
import { db } from '../db/db';
import { POSITIONS, SECTIONS } from '../data/positions';
import { setPosition } from '../lib/ops';
import { opLabel } from '../lib/hooks';
import type { FormProps } from './common';

export function StaffDatalist() {
  const staff = useLiveQuery(() => db.staff.toArray()) ?? [];
  return <datalist id="staff-names">{staff.map((s) => <option key={s.id} value={s.name}>{s.callSign} · {s.agency}</option>)}</datalist>;
}

export function Ics203({ incident, op, update }: FormProps) {
  const staff = useLiveQuery(() => db.staff.toArray()) ?? [];
  const setName = (key: string, name: string) => {
    const s = staff.find((x) => x.name === name);
    void setPosition(op, key, name ? { name, callSign: s?.callSign ?? '', agency: s?.agency ?? '', contact: s?.phone ?? '' } : null);
  };
  const setField = (key: string, field: 'callSign' | 'agency' | 'contact', v: string) =>
    op.org[key] && update({ org: { ...op.org, [key]: { ...op.org[key], [field]: v } } });
  return (
    <FormFrame num="203" title="Organization Assignment List" incidentName={incident.name} opLabel={opLabel(op)}
      footer={<Text label="Prepared by (Resources Unit Leader)" value={op.preparedBy} onCommit={(v) => update({ preparedBy: v })} />}>
      <StaffDatalist />
      <p className="muted no-print">Type or pick a name from the staff list. Changing a name records position history; use Handovers for a formal shift change.</p>
      <div className="cols2">
        {SECTIONS.map((sec) => (
          <Box key={sec} title={sec}>
            <table className="grid compact">
              <thead><tr><th>Position</th><th>Name</th><th>Call sign</th><th>Agency</th></tr></thead>
              <tbody>{POSITIONS.filter((p) => p.section === sec).map((p) => (
                <tr key={p.key}>
                  <td>{p.title}</td>
                  <td><Text list="staff-names" value={op.org[p.key]?.name} onCommit={(v) => setName(p.key, v)} /></td>
                  <td><Text value={op.org[p.key]?.callSign} onCommit={(v) => setField(p.key, 'callSign', v)} /></td>
                  <td><Text value={op.org[p.key]?.agency} onCommit={(v) => setField(p.key, 'agency', v)} /></td>
                </tr>
              ))}</tbody>
            </table>
          </Box>
        ))}
      </div>
    </FormFrame>
  );
}
