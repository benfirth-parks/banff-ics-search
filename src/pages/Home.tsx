import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, live } from '../db/db';
import { createIncident } from '../lib/ops';
import { joinRemote, syncEnabled, syncNow } from '../lib/sync';
import { loadExercise, SCENARIOS } from '../data/scenario';
import { fmt } from '../components/ui';
import type { IncidentType } from '../db/types';
import { AVC_SCENARIO, loadAvControlExercise } from '../modules/avcontrol/scenario';
import { AVY_SCENARIOS, loadAvalancheExercise } from '../avalanche/scenario';

export function Home() {
  const nav = useNavigate();
  const incidents = live(useLiveQuery(() => db.incidents.orderBy('updatedAt').reverse().toArray()));
  const [code, setCode] = useState('');
  const [role, setRole] = useState<'command' | 'field'>('command');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ name: '', number: '', location: '', icName: '', type: 'missing-person' as IncidentType });
  const [scenario, setScenario] = useState('random');
  const go = (id: string) => nav(role === 'field' ? `/i/${id}/field` : `/i/${id}`);

  const join = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    const local = await db.incidents.where('code').equals(c).first();
    if (local) return go(local.id);
    if (!syncEnabled) return setMsg('No incident with that code on this device, and cloud sync is not set up yet.');
    if (!navigator.onLine) return setMsg('You are offline. Join once while online; after that the incident works offline.');
    setMsg('Looking up code…');
    try {
      const id = await joinRemote(c);
      if (!id) return setMsg('No incident found with that code.');
      // Pull everything, then open.
      await db.meta.put({ key: `code:${id}`, value: c });
      await syncNow(id, c);
      go(id);
    } catch (e) { setMsg('Could not join: ' + (e as Error).message); }
  };

  return (
    <div className="home">
      <header className="home-head"><h1>Banff ICS for Search</h1><p>ICS forms, operational periods and handovers for missing-person searches.</p></header>
      <div className="home-grid">
        <section className="card">
          <h2>Join an incident</h2>
          <label className="field"><span>Incident code</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ELK-4821" onKeyDown={(e) => e.key === 'Enter' && join()} /></label>
          <div className="row">
            <label className="check"><input type="radio" checked={role === 'command'} onChange={() => setRole('command')} /> Command post</label>
            <label className="check"><input type="radio" checked={role === 'field'} onChange={() => setRole('field')} /> Field team (phone)</label>
          </div>
          <button className="primary" onClick={join}>Join</button>
          {msg && <p className="muted">{msg}</p>}
        </section>
        <section className="card">
          <h2>Start a new incident</h2>
          <label className="field"><span>Incident type</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as IncidentType })}>
              <option value="missing-person">Missing person search</option>
              <option value="avalanche-control">Avalanche control</option>
              <option value="avalanche">Large avalanche (multiple burials)</option>
            </select></label>
          <label className="field"><span>Incident name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Overdue hiker, Lake Agnes" /></label>
          <label className="field"><span>Incident number</span><input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></label>
          <label className="field"><span>Location</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
          <label className="field"><span>Incident Commander</span><input value={form.icName} onChange={(e) => setForm({ ...form, icName: e.target.value })} /></label>
          <button className="primary" disabled={!form.name} onClick={async () => { const i = await createIncident(form); nav(`/i/${i.id}`); }}>Create incident</button>
          <hr />
          <label className="field"><span>Tabletop exercise (fictional, training only)</span>
            <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
              <option value="random">Random scenario</option>
              <optgroup label="Missing person searches">
                {SCENARIOS.map((s, i) => <option key={s.key} value={s.key}>{i + 1}. {s.title}</option>)}
              </optgroup>
              <optgroup label="Avalanche control">
                <option value={AVC_SCENARIO.key}>{AVC_SCENARIO.title}</option>
              </optgroup>
              <optgroup label="Large avalanche">
                {AVY_SCENARIOS.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
              </optgroup>
            </select></label>
          <button onClick={async () => {
            const key = scenario === 'random' ? SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)]!.key : scenario;
            if (AVY_SCENARIOS.some((s) => s.key === key)) { const i = await loadAvalancheExercise(); return nav(`/i/${i.id}/avalanche`); }
            const i = key === AVC_SCENARIO.key ? await loadAvControlExercise() : await loadExercise(key); nav(`/i/${i.id}`);
          }}>Load tabletop exercise</button>
        </section>
      </div>
      {incidents.length > 0 && (
        <section className="card">
          <h2>On this device</h2>
          <table className="grid"><thead><tr><th>Incident</th><th>Code</th><th>Started</th><th /></tr></thead>
            <tbody>{incidents.map((i) => (
              <tr key={i.id}><td>{i.exercise && <span className="tag">EXERCISE</span>} {i.name}</td><td><code>{i.code}</code></td><td>{fmt(i.startedAt)}</td>
                <td className="row"><Link to={`/i/${i.id}`}>Command post</Link><Link to={`/i/${i.id}/field`}>Field</Link></td></tr>
            ))}</tbody>
          </table>
        </section>
      )}
      <p className="muted center"><Link to="/reference">Reference data and templates</Link> · {syncEnabled ? 'Cloud sync available' : 'Local-only mode (cloud sync not configured)'} · Training data only</p>
    </div>
  );
}
