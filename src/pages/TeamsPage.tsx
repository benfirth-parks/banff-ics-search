import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCtx } from './IncidentLayout';
import { useTable, usePickList } from '../lib/hooks';
import { save, patch, uid, nowIso, softDelete } from '../db/db';
import type { Team, Assignment } from '../db/types';
import { Text, Select, fmtTime, fmt } from '../components/ui';
import { StaffDatalist } from '../forms/Ics203';
import { DebriefForm } from '../components/DebriefForm';
import { newAssignment } from '../forms/Ics204';
import { latLon } from '../lib/device';

const STATUSES: Team['status'][] = ['available', 'assigned', 'in-field', 'returning', 'out-of-service'];

export function TeamsPage() {
  const { incident, op } = useCtx();
  const teams = useTable('teams', incident.id, op.id);
  const asg = useTable('assignments', incident.id, op.id);
  const checkIns = useTable('checkIns', incident.id).sort((a, b) => b.time.localeCompare(a.time));
  const types = usePickList('teamTypes');
  const [debriefId, setDebriefId] = useState('');
  const upT = (t: Team, c: Partial<Team>) => patch<Team>('teams', t.id, c);
  const addTeam = () => save<Team>('teams', {
    id: uid(), incidentId: incident.id, opPeriodId: op.id, updatedAt: nowIso(), name: `Team ${teams.length + 1}`,
    type: types[0] ?? 'Hasty', leader: '', leaderCallSign: '', members: [], contact: '', status: 'available',
  });

  return (
    <div>
      <StaffDatalist />
      <section className="card">
        <div className="row"><h2>Teams · op period {op.number}</h2><button onClick={addTeam}>+ Team</button></div>
        <div className="table-wrap"><table className="grid">
          <thead><tr><th>Name</th><th>Type</th><th>Leader</th><th>Call sign</th><th>Members (comma separated)</th><th>Contact</th><th>Status</th><th>Last check-in</th><th /></tr></thead>
          <tbody>{teams.map((t) => (
            <tr key={t.id}>
              <td><Text value={t.name} onCommit={(v) => upT(t, { name: v })} /></td>
              <td><Select value={t.type} options={types.includes(t.type) ? types : [t.type, ...types]} onChange={(v) => upT(t, { type: v })} /></td>
              <td><Text list="staff-names" value={t.leader} onCommit={(v) => upT(t, { leader: v })} /></td>
              <td><Text value={t.leaderCallSign} onCommit={(v) => upT(t, { leaderCallSign: v })} /></td>
              <td><Text value={t.members.join(', ')} onCommit={(v) => upT(t, { members: v.split(',').map((s) => s.trim()).filter(Boolean) })} /></td>
              <td><Text value={t.contact} onCommit={(v) => upT(t, { contact: v })} /></td>
              <td><Select value={t.status} options={STATUSES} onChange={(v) => upT(t, { status: v as Team['status'] })} /></td>
              <td>{fmtTime(t.lastCheckIn) || '—'}</td>
              <td><button className="link danger" onClick={() => confirm(`Remove ${t.name}?`) && softDelete('teams', t.id)}>✕</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </section>

      <section className="card">
        <div className="row"><h2>Assignments</h2>
          <button onClick={() => save('assignments', newAssignment(incident.id, op.id, asg.length + 1))}>+ Assignment</button>
          <Link to={`/i/${incident.id}/forms/204`}>Edit full ICS 204s</Link></div>
        <table className="grid compact"><thead><tr><th>#</th><th>Segment</th><th>Team</th><th>Status</th><th>Debrief</th></tr></thead>
          <tbody>{asg.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })).map((a) => {
            const team = teams.find((t) => t.id === a.teamId);
            return (
              <tr key={a.id}>
                <td>{a.number}</td><td>{a.segment}</td>
                <td><Select value={a.teamId ?? ''} blank="—" options={teams.map((t) => ({ value: t.id, label: t.name }))}
                  onChange={(v) => patch<Assignment>('assignments', a.id, { teamId: v || undefined, status: v && a.status === 'draft' ? 'assigned' : a.status })} /></td>
                <td><Select value={a.status} options={['draft', 'assigned', 'in-field', 'complete']} onChange={(v) => patch<Assignment>('assignments', a.id, { status: v as Assignment['status'] })} /></td>
                <td>{a.debrief ? <span title={a.debrief.areaCovered}>✓ {fmt(a.debrief.completedAt)} ({a.debrief.coverageEstimate})</span>
                  : <button className="small" onClick={() => setDebriefId(debriefId === a.id ? '' : a.id)}>Debrief</button>}</td>
              </tr>
            );
          })}</tbody>
        </table>
        {debriefId && (() => { const a = asg.find((x) => x.id === debriefId)!; return a && (
          <div className="card inset"><h3>Debrief · assignment {a.number}</h3>
            <DebriefForm a={a} team={teams.find((t) => t.id === a.teamId)} by={op.org.plans?.name ?? ''} onDone={() => setDebriefId('')} /></div>
        ); })()}
        {asg.filter((a) => a.debrief).map((a) => (
          <details key={a.id} className="debrief-view"><summary>Debrief {a.number}: {a.segment} ({a.debrief!.coverageEstimate})</summary>
            <dl>{Object.entries(a.debrief!).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{k === 'completedAt' ? fmt(v) : v}</dd></div>)}</dl>
          </details>
        ))}
      </section>

      <section className="card">
        <h2>Check-in log</h2>
        <table className="grid compact"><thead><tr><th>Time</th><th>Team</th><th>Status</th><th>Message</th><th>Position</th><th>By</th></tr></thead>
          <tbody>{checkIns.map((c) => (
            <tr key={c.id}><td>{fmtTime(c.time)}</td><td>{teams.find((t) => t.id === c.teamId)?.name ?? '(previous period)'}</td><td>{c.status}</td><td>{c.message}</td><td>{latLon(c.lat, c.lon)}</td><td>{c.by}</td></tr>
          ))}</tbody>
        </table>
      </section>
    </div>
  );
}
