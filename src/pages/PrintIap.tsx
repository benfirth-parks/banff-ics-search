import { useParams, useSearchParams } from 'react-router-dom';
import { useIncident, useOp } from '../lib/hooks';
import { FORMS } from '../forms';

/** Whole Incident Action Plan for printing (202-208, per the 202 component list). */
export function PrintIap() {
  const { incidentId } = useParams();
  const [q] = useSearchParams();
  const incident = useIncident(incidentId);
  const { op, update } = useOp(incident, q.get('op') ?? undefined);
  if (!incident || !op) return <div className="pad">Loading…</div>;
  const forms = FORMS.filter((f) => f.iap && op.iapComponents.includes(f.num));
  return (
    <div className="print-iap">
      <div className="no-print row pad"><button className="primary" onClick={() => window.print()}>Print IAP</button><span className="muted">Includes the components ticked on ICS 202.</span></div>
      <section className="form-sheet cover">
        <h1>Incident Action Plan</h1>
        <h2>{incident.name} {incident.number && `· ${incident.number}`}</h2>
        <p>Operational period {op.number}: {new Date(op.start).toLocaleString('en-CA', { hour12: false })} to {new Date(op.end).toLocaleString('en-CA', { hour12: false })}</p>
        <p>Contents: {forms.map((f) => `ICS ${f.num}`).join(', ')}</p>
        {incident.exercise && <p><b>EXERCISE · TRAINING DATA ONLY</b></p>}
      </section>
      {forms.map((F) => <div key={F.num} className="page-break"><F.Component incident={incident} op={op} update={update} /></div>)}
    </div>
  );
}
