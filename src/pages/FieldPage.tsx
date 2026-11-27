import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useIncident, useOp, useTable, usePickList } from '../lib/hooks';
import { useIncidentSync } from './IncidentLayout';
import { save, patch, uid, nowIso } from '../db/db';
import type { CheckIn, Team, Assignment } from '../db/types';
import { getPosition, latLon } from '../lib/device';
import { fmtTime } from '../components/ui';
import { SyncBadge } from '../components/SyncBadge';
import { syncEnabled } from '../lib/sync';
import { ClueForm } from '../components/ClueForm';
import { DebriefForm } from '../components/DebriefForm';
import { AvyFieldPanel } from '../avalanche/AvyFieldPanel';

const read = (k: string) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function FieldPage() {
  const { incidentId } = useParams();
  const incident = useIncident(incidentId);
  const { op } = useOp(incident);
  useIncidentSync(incident);
  const teams = useTable('teams', incidentId, op?.id);
  const assignments = useTable('assignments', incidentId, op?.id);
  const checkIns = useTable('checkIns', incidentId);
  const subject = useTable('subjects', incidentId)[0];
  const statuses = usePickList('checkInStatus');
  const [teamId, setTeamIdState] = useState(() => read(`field-team:${incidentId}`));
  const [me, setMeState] = useState(() => read('field-name'));
  const [panel, setPanel] = useState<'' | 'clue' | 'debrief' | 'subject'>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const setTeamId = (v: string) => { setTeamIdState(v); write(`field-team:${incidentId}`, v); };
  const setMe = (v: string) => { setMeState(v); write('field-name', v); };

  if (!incident || !op) return <div className="pad">Loading… If this is your first time, join while online. <Link to="/">Home</Link></div>;
  const team = teams.find((t) => t.id === teamId);
  const a = assignments.find((x) => x.teamId === teamId && x.status !== 'complete') ?? assignments.find((x) => x.teamId === teamId);
  const myCheckIns = checkIns.filter((c) => c.teamId === teamId).sort((x, y) => y.time.localeCompare(x.time)).slice(0, 5);

  const checkIn = async (status: string) => {
    if (!team) return;
    setBusy(status);
    const pos = await getPosition(8000);
    const time = nowIso();
    await save<CheckIn>('checkIns', { id: uid(), incidentId: incident.id, updatedAt: time, teamId: team.id, assignmentId: a?.id, time, status, message: note, lat: pos?.lat, lon: pos?.lon, by: me });
    const teamStatus: Team['status'] = /returning/i.test(status) ? 'returning' : 'in-field';
    await patch<Team>('teams', team.id, { lastCheckIn: time, status: teamStatus });
    if (a && a.status === 'assigned') await patch<Assignment>('assignments', a.id, { status: 'in-field' });
    setNote(''); setBusy('');
  };

  return (
    <div className="field-app">
      <header className="field-head">
        <Link to="/">←</Link>
        <div><b>{incident.name}</b><div className="muted small-print">Op period {op.number} · ends {fmtTime(op.end)}</div></div>
        <SyncBadge />
      </header>
      <div className="field-body">
        <div className="row">
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">Choose your team…</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
          </select>
          <input placeholder="Your name" value={me} onChange={(e) => setMe(e.target.value)} />
        </div>
        {!team ? <p className="muted">Pick your team to see your assignment.</p> : (
          <>
            <section className="card">
              <h3>Assignment {a?.number ?? '—'} <span className="tag">{a?.status ?? 'none'}</span></h3>
              {a ? (
                <>
                  <p><b>Segment:</b> {a.segment || '—'}</p>
                  <p className="pre">{a.work}</p>
                  {a.specialInstructions && <p className="pre"><b>Special instructions:</b> {a.specialInstructions}</p>}
                  <p><b>Radio:</b> {a.commsChannel || '—'}</p>
                  {a.caltopoRef.startsWith('http') && <a className="button" href={a.caltopoRef} target="_blank" rel="noreferrer">Open segment in CalTopo ↗</a>}
                </>
              ) : <p className="muted">No assignment yet. Stand by at staging.</p>}
              {op.safetyMessage && <details><summary>Safety message</summary><p className="pre">{op.safetyMessage}</p></details>}
            </section>
            {incident.type === 'avalanche' && <AvyFieldPanel incidentId={incident.id} teamId={team.id} teamName={team.name} me={me} />}
            <section className="card">
              <h3>Check in</h3>
              <input placeholder="Optional message" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="big-buttons">{statuses.map((s) => (
                <button key={s} className={/assist/i.test(s) ? 'danger-btn' : ''} disabled={!!busy} onClick={() => checkIn(s)}>{busy === s ? 'Sending…' : s}</button>
              ))}</div>
              <ul className="feed">{myCheckIns.map((c) => <li key={c.id}><b>{fmtTime(c.time)}</b> {c.status} {c.message && `· ${c.message}`} <span className="muted">{latLon(c.lat, c.lon)}</span>{c.dirty && syncEnabled ? ' ⏳' : ''}</li>)}</ul>
            </section>
            <div className="big-buttons">
              <button onClick={() => setPanel(panel === 'clue' ? '' : 'clue')}>🔎 Log a clue</button>
              <button onClick={() => setPanel(panel === 'subject' ? '' : 'subject')}>👤 Subject</button>
              {a && <button onClick={() => setPanel(panel === 'debrief' ? '' : 'debrief')}>📝 Debrief</button>}
            </div>
            {panel === 'clue' && <section className="card"><ClueForm incidentId={incident.id} teamId={team.id} assignmentId={a?.id} foundBy={me || team.name} onDone={() => setPanel('')} /></section>}
            {panel === 'debrief' && a && <section className="card"><DebriefForm a={a} team={team} by={me} onDone={() => setPanel('')} /></section>}
            {panel === 'subject' && subject && (
              <section className="card">
                {subject.photo && <img className="photo" src={subject.photo} alt="subject" />}
                <p><b>{subject.name}</b>, {subject.age} {subject.sex} · {subject.height} {subject.build}</p>
                <p><b>Clothing:</b> {subject.clothing}</p><p><b>Footwear:</b> {subject.footwear}</p>
                <p><b>Equipment:</b> {subject.equipment}</p><p><b>Medical:</b> {subject.medical}</p>
                <p><b>Last seen:</b> {subject.lastSeenTime}, {subject.lastSeenLocation}</p>
              </section>
            )}
          </>
        )}
        <p className="muted small-print center">Works offline. Entries marked ⏳ will sync when you have signal.</p>
      </div>
    </div>
  );
}
