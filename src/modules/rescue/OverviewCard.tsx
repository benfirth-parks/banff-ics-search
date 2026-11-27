import { Link } from 'react-router-dom';
import { useCtx } from '../../pages/IncidentLayout';
import { useTable } from '../../lib/hooks';
import { fmtTime } from '../../components/ui';
import { PatientBoard, triageClass } from './RescuePage';
import { TRIAGE } from './types';
import './rescue.css';

/** Rescue summary shown at the top of the Overview for large rescue incidents. */
export function RescueOverviewCard() {
  const { incident, op } = useCtx();
  const patients = useTable('patients', incident.id).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const log = useTable('rescueLog', incident.id, op.id);
  const inZone = log.filter((e) => e.kind === 'zone' && !e.outAt);
  const flights = log.filter((e) => e.kind === 'flight').sort((a, b) => b.time.localeCompare(a.time));
  const r = op.rescue;
  const open = patients.filter((p) => p.status !== 'transferred' && p.status !== 'deceased').length;
  return (
    <section className="card">
      <div className="row">
        <h3 style={{ flex: 1 }}>Rescue · {incident.rescue?.rescueType || 'type not set'}</h3>
        {r?.goNoGo && <span className={'triage t-' + (r.goNoGo === 'go' ? 'green' : r.goNoGo === 'hold' ? 'yellow' : 'red')}>{r.goNoGo.toUpperCase()}</span>}
        {TRIAGE.map((t) => { const n = patients.filter((p) => p.triage === t).length; return n ? <span key={t} className={triageClass(t)}>{t} {n}</span> : null; })}
      </div>
      <p>{patients.length} patients ({open} still on scene or in transit) · {inZone.length} rescuers in the hazard zone · {flights.length} flights this period
        {flights[0] && ` · last ${fmtTime(flights[0].time)} ${flights[0].aircraft} ${flights[0].mission}`}
        {r?.lastLight && ` · last light ${r.lastLight}`}</p>
      {patients.length > 0 && <PatientBoard patients={patients} />}
      <p><Link to="rescue">Open the rescue plan</Link></p>
    </section>
  );
}
