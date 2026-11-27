import { Link } from 'react-router-dom';
import { useAvy, useNow, minsLabel } from './hooks';
import { STILL_MISSING, STATUS_LABEL, burialMinutes } from './types';

/** Replaces the Subject block on the Overview for avalanche incidents. */
export function AvyOverviewCard({ incidentId }: { incidentId: string }) {
  const { site, parties } = useAvy(incidentId);
  const now = useNow();
  const missing = parties.filter((p) => STILL_MISSING.includes(p.status));
  return (
    <>
      <h3>Avalanche</h3>
      {site?.avalancheTime ? <p>{site.size} {site.avyType} at {site.path || 'unknown location'} · {minsLabel(Math.round((now - new Date(site.avalancheTime).getTime()) / 60000))} ago</p> : <p className="muted">Avalanche time not set yet.</p>}
      <p><b>{missing.length}</b> of {parties.length} involved still missing or buried{missing.length > 0 && ': '}
        {missing.map((p) => `${p.label} (${STATUS_LABEL[p.status].toLowerCase()}, ${minsLabel(burialMinutes(site, p, now))})`).join('; ')}</p>
      <Link to="avalanche">Open avalanche board</Link>
    </>
  );
}
