import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCtx } from './IncidentLayout';
import { useOp, useOpPeriods } from '../lib/hooks';
import { FORMS } from '../forms';

export function FormsPage() {
  const { incident, op: currentOp } = useCtx();
  const { form = '201' } = useParams();
  const nav = useNavigate();
  const periods = useOpPeriods(incident.id);
  const [opId, setOpId] = useState(currentOp.id);
  const { op, update } = useOp(incident, opId);
  const F = FORMS.find((f) => f.num === form) ?? FORMS[0];
  if (!op) return null;
  return (
    <div>
      <div className="row no-print toolbar">
        <div className="subtabs">{FORMS.map((f) => (
          <button key={f.num} className={f.num === F.num ? 'on' : ''} onClick={() => nav(`../forms/${f.num}`, { relative: 'path' })} title={f.title}>ICS {f.num}</button>
        ))}</div>
        <select value={opId} onChange={(e) => setOpId(e.target.value)}>
          {periods.map((p) => <option key={p.id} value={p.id}>Op period {p.number}{p.id === currentOp.id ? ' (current)' : ` (${p.status})`}</option>)}
        </select>
        <button onClick={() => window.print()}>Print this form</button>
        <Link className="button" to={`/i/${incident.id}/print?op=${op.id}`} target="_blank">Print IAP</Link>
      </div>
      {op.id !== currentOp.id && <p className="notice no-print">You are viewing a past operational period. Edits are still allowed.</p>}
      <F.Component incident={incident} op={op} update={update} />
    </div>
  );
}
