import { Link } from 'react-router-dom';
import { useCtx } from './IncidentLayout';
import { useTable } from '../lib/hooks';
import { fmt, fmtTime } from '../components/ui';
import { positionTitle } from '../data/positions';
import { AvyOverviewCard } from '../avalanche/AvyOverviewCard';
import { AvControlSummary } from '../modules/avcontrol/AvControlSummary';

export function Overview() {
  const { incident, op } = useCtx();
  const teams = useTable('teams', incident.id, op.id);
  const asg = useTable('assignments', incident.id, op.id);
  const clues = useTable('clues', incident.id);
  const checkIns = useTable('checkIns', incident.id).sort((a, b) => b.time.localeCompare(a.time)).slice(0, 8);
  const subject = useTable('subjects', incident.id)[0];
  const handovers = useTable('handovers', incident.id).sort((a, b) => b.time.localeCompare(a.time)).slice(0, 5);
  const count = (s: string) => asg.filter((a) => a.status === s).length;
  const ends = new Date(op.end).getTime() - Date.now();
  return (
    <div className="overview">
      <div className="stats">
        <div className="stat"><b>{op.number}</b><span>Op period · ends {fmt(op.end)}{ends < 2 * 3600_000 && ends > 0 ? ' (soon)' : ''}</span></div>
        <div className="stat"><b>{teams.length}</b><span>Teams</span></div>
        <div className="stat"><b>{count('in-field')}/{asg.length}</b><span>Assignments in field</span></div>
        {incident.type !== 'avalanche-control' && <div className="stat"><b>{clues.length}</b><span>Clues</span></div>}
      </div>
      <div className="cols2">
        <section className="card">
          {incident.type === 'avalanche' ? <AvyOverviewCard incidentId={incident.id} /> : incident.type === 'avalanche-control' ? <AvControlSummary incidentId={incident.id} opPeriodId={op.id} /> : <>
          <h3>Subject</h3>
          {subject?.name ? <p><b>{subject.name}</b>, {subject.age} · Last seen {subject.lastSeenTime} at {subject.lastSeenLocation}</p> : <p className="muted">No subject profile yet.</p>}
          <Link to="subject">Open subject profile</Link>
          </>}
          <h3>Objectives</h3>
          {op.objectives.length ? <ol>{op.objectives.map((o, i) => <li key={i}>{o}</li>)}</ol> : <p className="muted">None yet. <Link to="forms/202">Add on ICS 202</Link></p>}
          <h3>Map</h3>
          {incident.caltopoUrl ? <a href={incident.caltopoUrl} target="_blank" rel="noreferrer">Open CalTopo map ↗</a> : <p className="muted">No CalTopo link yet (set on ICS 201).</p>}
        </section>
        <section className="card">
          <h3>Team status</h3>
          <table className="grid compact"><thead><tr><th>Team</th><th>Status</th><th>Last check-in</th></tr></thead>
            <tbody>{teams.map((t) => {
              const stale = t.status === 'in-field' && t.lastCheckIn && Date.now() - new Date(t.lastCheckIn).getTime() > 60 * 60_000;
              return <tr key={t.id} className={stale ? 'warn' : ''}><td>{t.name}</td><td>{t.status}</td><td>{fmtTime(t.lastCheckIn) || '—'}{stale ? ' ⚠ overdue' : ''}</td></tr>;
            })}</tbody>
          </table>
          <h3>Recent check-ins</h3>
          <ul className="feed">{checkIns.map((c) => <li key={c.id}><b>{fmtTime(c.time)}</b> {teams.find((t) => t.id === c.teamId)?.name ?? 'Team'}: {c.status}{c.message && ` · ${c.message}`}</li>)}</ul>
          <h3>Recent handovers</h3>
          <ul className="feed">{handovers.map((h) => <li key={h.id}><b>{fmtTime(h.time)}</b> {positionTitle(h.positionKey, op.org)}: {h.outgoing} → {h.incoming}</li>)}</ul>
        </section>
      </div>
    </div>
  );
}
