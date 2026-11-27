import { useState } from 'react';
import { db, save, uid, nowIso, live } from '../db/db';
import type { Clue } from '../db/types';
import { compressPhoto, getPosition, latLon } from '../lib/device';

export function ClueForm(props: { incidentId: string; teamId?: string; assignmentId?: string; foundBy: string; onDone?: () => void }) {
  const [desc, setDesc] = useState('');
  const [photo, setPhoto] = useState<string>();
  const [pos, setPos] = useState<{ lat: number; lon: number }>();
  const [locating, setLocating] = useState(false);
  const [foundBy, setFoundBy] = useState(props.foundBy);
  const locate = async () => { setLocating(true); setPos(await getPosition()); setLocating(false); };
  const submit = async () => {
    const existing = live(await db.clues.where('incidentId').equals(props.incidentId).toArray());
    const number = existing.reduce((m, c) => Math.max(m, c.number), 0) + 1;
    await save<Clue>('clues', {
      id: uid(), incidentId: props.incidentId, updatedAt: nowIso(), number, teamId: props.teamId, assignmentId: props.assignmentId,
      time: nowIso(), description: desc, lat: pos?.lat, lon: pos?.lon, photo, foundBy, action: '',
    });
    setDesc(''); setPhoto(undefined); setPos(undefined);
    props.onDone?.();
  };
  return (
    <div className="clue-form">
      <label className="field"><span>What did you find? (item, condition, direction of travel, left in place?)</span>
        <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
      <div className="row">
        <label className="button">📷 Photo<input type="file" accept="image/*" capture="environment" hidden
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setPhoto(await compressPhoto(f)); if (!pos) void locate(); } }} /></label>
        <button onClick={locate} disabled={locating}>{locating ? 'Getting GPS…' : '📍 Get GPS'}</button>
        <span className="muted">{pos ? latLon(pos.lat, pos.lon) : 'No position yet'}</span>
      </div>
      {photo && <img className="thumb" src={photo} alt="clue" />}
      <label className="field"><span>Found by</span><input value={foundBy} onChange={(e) => setFoundBy(e.target.value)} /></label>
      <button className="primary" disabled={!desc} onClick={submit}>Log clue</button>
    </div>
  );
}
