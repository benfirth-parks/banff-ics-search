import { useEffect } from 'react';
import { NavLink, Outlet, useOutletContext, useParams, Link } from 'react-router-dom';
import type { Incident, OpPeriod } from '../db/types';
import { useIncident, useOp, opLabel } from '../lib/hooks';
import { startSync, stopSync } from '../lib/sync';
import { SyncBadge } from '../components/SyncBadge';

export interface Ctx { incident: Incident; op: OpPeriod; update: (c: Partial<OpPeriod>) => void }
export const useCtx = () => useOutletContext<Ctx>();

export function useIncidentSync(incident?: Incident) {
  useEffect(() => {
    if (!incident) return;
    startSync(incident.id, incident.code);
    return () => stopSync();
  }, [incident?.id, incident?.code]);
}

export function IncidentLayout() {
  const { incidentId } = useParams();
  const incident = useIncident(incidentId);
  const { op, update } = useOp(incident);
  useIncidentSync(incident);
  const avc = incident?.type === 'avalanche-control';
  if (!incident || !op) return <div className="pad">Loading… <Link to="/">Home</Link></div>;
  return (
    <div className="layout">
      <header className="topbar no-print">
        <Link to="/" className="brand">ICS Search</Link>
        <div className="inc">
          {incident.exercise && <span className="tag">EXERCISE</span>} <b>{incident.name}</b>
          <span className="muted"> · Code <code>{incident.code}</code> · Op period {opLabel(op)}</span>
        </div>
        <SyncBadge />
      </header>
      <nav className="tabs no-print">
        <NavLink end to="">Overview</NavLink>
        {incident.type === 'large-rescue' && <NavLink to="rescue">Rescue</NavLink>}
        {incident.type === 'avalanche' && <NavLink to="avalanche">Avalanche rescue</NavLink>}
        <NavLink to="forms">ICS forms</NavLink>
        <NavLink to="periods">Op periods &amp; handovers</NavLink>
        <NavLink to="teams">Teams &amp; assignments</NavLink>
        {avc && <NavLink to="avcontrol">Avalanche control</NavLink>}
        {!avc && <NavLink to="map">Search map</NavLink>}
        {!avc && <NavLink to="clues">Clue log</NavLink>}
        {!avc && incident.type !== 'avalanche' && <NavLink to="subject">Subject</NavLink>}
        <NavLink to="reference">Reference</NavLink>
        <NavLink to="field">Field view</NavLink>
      </nav>
      <main className="pad"><Outlet context={{ incident, op, update } satisfies Ctx} /></main>
    </div>
  );
}
