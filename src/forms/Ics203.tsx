import { useLiveQuery } from 'dexie-react-hooks';
import { FormFrame, Box, Text, Select } from '../components/ui';
import { db, patch, uid } from '../db/db';
import { orgPositions, SECTIONS, SECTION_CHIEF, isCustom, defaultTeamLead } from '../data/positions';
import { setPosition, removeCustomPosition } from '../lib/ops';
import { opLabel, useTable } from '../lib/hooks';
import type { OpPeriod, Team } from '../db/types';
import type { FormProps } from './common';

export function StaffDatalist() {
  const staff = useLiveQuery(() => db.staff.toArray()) ?? [];
  return <datalist id="staff-names">{staff.map((s) => <option key={s.id} value={s.name}>{s.callSign} · {s.agency}</option>)}</datalist>;
}

export function Ics203({ incident, op, update }: FormProps) {
  const staff = useLiveQuery(() => db.staff.toArray()) ?? [];
  const teams = useTable('teams', incident.id, op.id);
  const positions = orgPositions(op.org);
  const setName = (key: string, name: string) => {
    const s = staff.find((x) => x.name === name);
    const keep = isCustom(key) ? { title: op.org[key]?.title, section: op.org[key]?.section, reportsTo: op.org[key]?.reportsTo } : {};
    void setPosition(op, key, name ? { ...keep, name, callSign: s?.callSign ?? '', agency: s?.agency ?? '', contact: s?.phone ?? '' } : isCustom(key) ? { ...keep, name: '' } : null);
  };
  const setField = (key: string, field: 'callSign' | 'agency' | 'contact' | 'title' | 'reportsTo', v: string) =>
    op.org[key] && update({ org: { ...op.org, [key]: { ...op.org[key], [field]: v } } });
  const addPerson = (section: string) =>
    update({ org: { ...op.org, [`x-${uid()}`]: { name: '', title: '', section, reportsTo: SECTION_CHIEF[section] } } } as Partial<OpPeriod>);
  const leadOptions = (self?: string) => positions.filter((p) => p.key !== self)
    .map((p) => ({ value: p.key, label: `${p.title}${op.org[p.key]?.name ? ` (${op.org[p.key].name})` : ''}` }));
  const titleOf = (key?: string) => positions.find((p) => p.key === key)?.title ?? '—';
  const upTeam = (t: Team, c: Partial<Team>) => patch<Team>('teams', t.id, c);

  return (
    <FormFrame num="203" title="Organization Assignment List" incidentName={incident.name} opLabel={opLabel(op)}
      footer={<Text label="Prepared by (Resources Unit Leader)" value={op.preparedBy} onCommit={(v) => update({ preparedBy: v })} />}>
      <StaffDatalist />
      <p className="muted no-print">Type or pick a name from the staff list. Changing a name records position history; use Handovers for a formal shift change. Use "Add person" for anyone not in the standard list (assistants, division supervisors, specialists).</p>
      <div className="cols2">
        {SECTIONS.map((sec) => (
          <Box key={sec} title={sec}>
            <table className="grid compact">
              <thead><tr><th>Position</th><th>Name</th><th>Call sign</th><th>Agency</th><th>Reports to</th></tr></thead>
              <tbody>{positions.filter((p) => p.section === sec).map((p) => (
                <tr key={p.key}>
                  <td>{isCustom(p.key)
                    ? <span className="row nowrap"><Text value={op.org[p.key]?.title} onCommit={(v) => setField(p.key, 'title', v)} placeholder="Position title" />
                        <button className="link no-print" title="Remove this row" onClick={() => void removeCustomPosition(op, p.key)}>✕</button></span>
                    : p.title}</td>
                  <td className="name-cell"><Text list="staff-names" value={op.org[p.key]?.name} onCommit={(v) => setName(p.key, v)} /></td>
                  <td><Text value={op.org[p.key]?.callSign} onCommit={(v) => setField(p.key, 'callSign', v)} /></td>
                  <td><Text value={op.org[p.key]?.agency} onCommit={(v) => setField(p.key, 'agency', v)} /></td>
                  <td>{isCustom(p.key)
                    ? <Select value={p.parent ?? ''} options={leadOptions(p.key)} onChange={(v) => setField(p.key, 'reportsTo', v)} />
                    : <span className="muted">{p.parent ? titleOf(p.parent) : '—'}</span>}</td>
                </tr>
              ))}</tbody>
            </table>
            <button className="small no-print" onClick={() => addPerson(sec)}>+ Add person to {sec}</button>
          </Box>
        ))}
      </div>
      <Box title="Operations: strike teams">
        {teams.length === 0
          ? <p className="muted">No teams this period. Add them on Teams &amp; assignments.</p>
          : (
            <table className="grid compact">
              <thead><tr><th>Strike team</th><th>Kind</th><th>Leader</th><th>Call sign</th><th>Members</th><th>Reports to</th></tr></thead>
              <tbody>{teams.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td><td>{t.type}</td><td>{t.leader || '—'}</td><td>{t.leaderCallSign || '—'}</td>
                  <td>{t.members.length ? t.members.join(', ') : '—'}</td>
                  <td><Select value={t.reportsTo || defaultTeamLead(op.org)} options={leadOptions()} onChange={(v) => upTeam(t, { reportsTo: v })} /></td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </Box>
    </FormFrame>
  );
}
