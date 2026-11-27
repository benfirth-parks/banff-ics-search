// Overview card and Field view panel for avalanche control incidents.
import { Link } from 'react-router-dom';
import { patch, nowIso } from '../../db/db';
import { fmtTime } from '../../components/ui';
import { type AvControlRec, type Closure, status } from './model';
import { useAvControl } from './AvControlPage';

export function AvControlSummary({ incidentId, opPeriodId }: { incidentId: string; opPeriodId: string }) {
  const rec = useAvControl(incidentId, opPeriodId);
  if (!rec) return <><h3>Avalanche control</h3><p className="muted">No control plan for this period yet.</p><Link to="avcontrol">Open avalanche control</Link></>;
  const st = status(rec);
  return (
    <>
      <h3>Avalanche control</h3>
      <p><b>{st.phase}</b>{rec.area && ` · ${rec.area}`}</p>
      <p>Closures in place {st.closed}/{st.total} · Targets done {st.done}/{st.targets}
        {st.misfires > 0 && <b className="danger"> · {st.misfires} misfire(s) outstanding</b>}</p>
      {rec.goDecision && <p className="muted">GO at {fmtTime(rec.goDecision.at)} by {rec.goDecision.by}</p>}
      <Link to="avcontrol">Open avalanche control</Link>
    </>
  );
}

/** Lets a closure guard on a phone mark their closure closed, swept or reopened. */
export function AvControlFieldPanel({ incidentId, opPeriodId, teamName }: { incidentId: string; opPeriodId: string; teamName?: string }) {
  const rec = useAvControl(incidentId, opPeriodId);
  if (!rec || rec.closures.length === 0) return null;
  const st = status(rec);
  const set = (c: Closure, s: Closure['status'], field: 'closedAt' | 'sweptAt' | 'reopenedAt') =>
    patch<AvControlRec>('avControl', rec.id, { closures: rec.closures.map((x) => (x.id === c.id ? { ...x, status: s, [field]: nowIso() } : x)) });
  return (
    <section className="card">
      <h3>Avalanche control closures</h3>
      <p className="small-print"><b>{st.phase}</b> · targets done {st.done}/{st.targets}{st.misfires ? ` · ${st.misfires} MISFIRE` : ''}</p>
      {st.misfires > 0 && <p className="notice">Misfire on the slope. Hold your closure until Command clears it.</p>}
      {[...rec.closures].sort((a, b) => Number(b.guard === teamName) - Number(a.guard === teamName)).map((c) => (
        <div key={c.id} className="handover">
          <b>{c.location || 'Closure'}</b> <span className="tag">{c.status}</span>
          <div className="muted small-print">{c.guard} {c.callSign && `(${c.callSign})`}</div>
          <div className="big-buttons">
            <button disabled={c.status !== 'planned'} onClick={() => set(c, 'closed', 'closedAt')}>⛔ Closed</button>
            <button disabled={c.status !== 'closed'} onClick={() => set(c, 'swept', 'sweptAt')}>✔ Swept clear</button>
          </div>
          {c.status === 'reopened' && <p className="ok-text small-print">Reopened {fmtTime(c.reopenedAt)}</p>}
        </div>
      ))}
      <p className="muted small-print">Only Command reopens closures, after the all clear.</p>
    </section>
  );
}
