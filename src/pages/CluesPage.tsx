import { useState } from 'react';
import { useCtx } from './IncidentLayout';
import { useTable } from '../lib/hooks';
import { patch } from '../db/db';
import type { Clue } from '../db/types';
import { Text, fmt } from '../components/ui';
import { ClueForm } from '../components/ClueForm';
import { caltopoPoint, latLon } from '../lib/device';

export function CluesPage() {
  const { incident, op } = useCtx();
  const clues = useTable('clues', incident.id).sort((a, b) => b.number - a.number);
  const teams = useTable('teams', incident.id);
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <section className="card">
        <div className="row"><h2>Clue log</h2><button onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : '+ Log clue'}</button></div>
        {adding && <ClueForm incidentId={incident.id} foundBy={op.org.plans?.name ?? ''} onDone={() => setAdding(false)} />}
        <table className="grid"><thead><tr><th>#</th><th>Time</th><th>Team</th><th>Description</th><th>Location</th><th>Photo</th><th>Action taken / assessment</th></tr></thead>
          <tbody>{clues.map((c) => (
            <tr key={c.id}>
              <td>{c.number}</td><td>{fmt(c.time)}</td><td>{teams.find((t) => t.id === c.teamId)?.name ?? c.foundBy}</td>
              <td className="pre">{c.description}</td>
              <td>{c.lat != null ? <a href={caltopoPoint(c.lat, c.lon)} target="_blank" rel="noreferrer">{latLon(c.lat, c.lon)}</a> : '—'}</td>
              <td>{c.photo ? <a href={c.photo} target="_blank" rel="noreferrer"><img className="thumb small" src={c.photo} alt={`clue ${c.number}`} /></a> : '—'}</td>
              <td><Text multiline rows={2} value={c.action} onCommit={(v) => patch<Clue>('clues', c.id, { action: v })} /></td>
            </tr>
          ))}</tbody>
        </table>
        <p className="muted">Coordinates are WGS84 decimal degrees. Click a location to open it in CalTopo, then add it as a marker on the incident map.</p>
      </section>
    </div>
  );
}
