import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCtx } from './IncidentLayout';
import { useOpPeriods, useTable } from '../lib/hooks';
import { rolloverOpPeriod, recordHandover, type Snapshot201 } from '../lib/ops';
import { patch } from '../db/db';
import type { Handover } from '../db/types';
import { orgPositions, positionTitle } from '../data/positions';
import { StaffDatalist } from '../forms/Ics203';
import { fmt, toLocalInput, fromLocalInput } from '../components/ui';

export function OpsPage() {
  const { incident, op } = useCtx();
  const periods = useOpPeriods(incident.id);
  const handovers = useTable('handovers', incident.id).sort((a, b) => b.time.localeCompare(a.time));
  const history = useTable('positionLog', incident.id).sort((a, b) => a.start.localeCompare(b.start));
  const order = orgPositions(op.org).map((p) => p.key);
  const orderOf = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
  const [start, setStart] = useState(op.end);
  const [len, setLen] = useState(12);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const rollover = async () => {
    if (!confirm(`Start operational period ${op.number + 1}? Period ${op.number} will be closed.`)) return;
    setBusy(true);
    const end = new Date(new Date(start).getTime() + len * 3600_000).toISOString();
    const next = await rolloverOpPeriod(incident, op, start, end);
    setBusy(false);
    setMsg(`Operational period ${next.number} started. Review the 202 objectives and 204 assignments.`);
  };

  return (
    <div className="ops">
      <section className="card">
        <h2>Operational periods</h2>
        <table className="grid compact"><thead><tr><th>#</th><th>Start</th><th>End</th><th>Status</th><th>IC</th><th /></tr></thead>
          <tbody>{periods.map((p) => (
            <tr key={p.id} className={p.id === op.id ? 'current' : ''}>
              <td>{p.number}</td><td>{fmt(p.start)}</td><td>{fmt(p.end)}</td><td>{p.id === op.id ? 'current' : p.status}</td><td>{p.org.ic?.name}</td>
              <td><Link to={`/i/${incident.id}/print?op=${p.id}`} target="_blank">IAP</Link></td>
            </tr>
          ))}</tbody>
        </table>
        <h3>Roll over to operational period {op.number + 1}</h3>
        <p className="muted">Copies the organization, objectives, command emphasis, comms (205), medical (206), safety (208) and teams forward. Assignments not marked complete are copied as drafts for re-tasking. Everything stays editable.</p>
        <div className="row">
          <label className="field"><span>Starts</span><input type="datetime-local" value={toLocalInput(start)} onChange={(e) => setStart(fromLocalInput(e.target.value))} /></label>
          <label className="field"><span>Length (hours)</span><input type="number" min={1} max={48} value={len} onChange={(e) => setLen(Number(e.target.value))} /></label>
          <button className="primary" disabled={busy} onClick={rollover}>Start op period {op.number + 1}</button>
        </div>
        {msg && <p className="notice">{msg}</p>}
      </section>

      <HandoverForm />

      <section className="card">
        <h2>Handover log</h2>
        {handovers.length === 0 && <p className="muted">No handovers yet.</p>}
        {handovers.map((h) => <HandoverCard key={h.id} h={h} />)}
      </section>

      <section className="card">
        <h2>Position history</h2>
        <table className="grid compact"><thead><tr><th>Position</th><th>Name</th><th>From</th><th>To</th><th>How</th></tr></thead>
          <tbody>{[...new Set(history.map((x) => x.positionKey))].sort((a, b) => orderOf(a) - orderOf(b)).flatMap((k) => history.filter((x) => x.positionKey === k).map((x) => (
            <tr key={x.id}><td>{positionTitle(k, op.org)}</td><td>{x.name}</td><td>{fmt(x.start)}</td><td>{x.end ? fmt(x.end) : 'now'}</td><td>{x.reason}</td></tr>
          )))}</tbody>
        </table>
      </section>
    </div>
  );
}

function HandoverForm() {
  const { incident, op } = useCtx();
  const [key, setKey] = useState('');
  const [incoming, setIncoming] = useState('');
  const [summary, setSummary] = useState('');
  const [tasks, setTasks] = useState<string[]>(['']);
  const [done, setDone] = useState('');
  const isIc = key === 'ic';
  const outgoing = op.org[key]?.name ?? '';

  const submit = async () => {
    if (isIc && !confirm(`Transfer command from ${outgoing || '(vacant)'} to ${incoming}? A snapshot of the ICS 201 briefing will be saved with the handover.`)) return;
    await recordHandover(op, {
      positionKey: key, outgoing, incoming, summary, isCommandTransfer: isIc,
      openTasks: tasks.filter((t) => t.trim()).map((text) => ({ text, done: false })),
    });
    setDone(`${positionTitle(key, op.org)} handed over to ${incoming}.`);
    setKey(''); setIncoming(''); setSummary(''); setTasks(['']);
  };

  return (
    <section className="card">
      <h2>Shift handover / transfer of command</h2>
      <StaffDatalist />
      <div className="row">
        <label className="field"><span>Position</span>
          <select value={key} onChange={(e) => setKey(e.target.value)}>
            <option value="">Choose…</option>
            {orgPositions(op.org).map((p) => <option key={p.key} value={p.key}>{p.title}{op.org[p.key]?.name ? ` (${op.org[p.key].name})` : ''}</option>)}
          </select>
        </label>
        <label className="field"><span>Outgoing</span><input value={outgoing} readOnly /></label>
        <label className="field"><span>Incoming</span><input list="staff-names" value={incoming} onChange={(e) => setIncoming(e.target.value)} /></label>
      </div>
      {isIc && (
        <p className="notice">Transfer of command: brief the incoming IC from the <Link to={`/i/${incident.id}/forms/201`}>ICS 201</Link> (situation, objectives, actions, organization, resources). The current 201 is saved with this record.</p>
      )}
      <label className="field"><span>Handover summary (situation, decisions made, concerns)</span>
        <textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
      <div className="field"><span>Open tasks for the incoming person</span>
        {tasks.map((t, i) => (
          <input key={i} value={t} placeholder={`Task ${i + 1}`} onChange={(e) => {
            const n = tasks.map((x, j) => (j === i ? e.target.value : x));
            setTasks(i === tasks.length - 1 && e.target.value ? [...n, ''] : n);
          }} />
        ))}
      </div>
      <button className="primary" disabled={!key || !incoming} onClick={submit}>{isIc ? 'Transfer command' : 'Record handover'}</button>
      {done && <p className="notice">{done}</p>}
    </section>
  );
}

function HandoverCard({ h }: { h: Handover }) {
  const { org } = useCtx().op;
  const [show201, setShow201] = useState(false);
  const snap = h.briefingSnapshot ? (JSON.parse(h.briefingSnapshot) as Snapshot201) : null;
  const toggle = (i: number) => patch<Handover>('handovers', h.id, { openTasks: h.openTasks.map((t, j) => (j === i ? { ...t, done: !t.done } : t)) });
  return (
    <div className="handover">
      <div className="row"><b>{h.isCommandTransfer ? 'TRANSFER OF COMMAND' : positionTitle(h.positionKey, org)}</b>
        <span>{h.outgoing || '(vacant)'} → {h.incoming}</span><span className="muted">{fmt(h.time)}</span></div>
      {h.summary && <p className="pre">{h.summary}</p>}
      {h.openTasks.length > 0 && (
        <ul className="tasks">{h.openTasks.map((t, i) => (
          <li key={i}><label className="check"><input type="checkbox" checked={t.done} onChange={() => toggle(i)} /> <span className={t.done ? 'done' : ''}>{t.text}</span></label></li>
        ))}</ul>
      )}
      {snap && (
        <>
          <button className="small" onClick={() => setShow201(!show201)}>{show201 ? 'Hide' : 'Show'} 201 briefing at transfer</button>
          {show201 && (
            <div className="snapshot">
              <p><b>Situation:</b> <span className="pre">{snap.incident.situationSummary || '—'}</span></p>
              <p><b>Objectives:</b></p><ol>{snap.op.objectives.map((o, i) => <li key={i}>{o}</li>)}</ol>
              <p><b>Actions:</b></p><ul>{snap.op.actions.map((a, i) => <li key={i}>{a.time} {a.action}</li>)}</ul>
              <p><b>Organization:</b> {Object.entries(snap.op.org).map(([k, v]) => `${positionTitle(k, snap.op.org)}: ${v.name}`).join(' · ')}</p>
              <p><b>Teams:</b> {snap.teams.map((t) => `${t.name} (${t.status})`).join(', ') || '—'}</p>
              <p><b>Resources:</b> {snap.resources.map((r) => `${r.resource} ${r.identifier}`).join(', ') || '—'}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
