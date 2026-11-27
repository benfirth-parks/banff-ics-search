// Phone view for avalanche rescuers: hazard banner, my debris area, quick
// status for involved parties, and on/off debris accountability.
import { nowIso } from '../db/db';
import { fmtTime } from '../components/ui';
import { useAvy, useNow, patchParty, patchSite, minsLabel } from './hooks';
import { STATUS_LABEL, STILL_MISSING, burialMinutes, burialPhase } from './types';
import './avalanche.css';

export function AvyFieldPanel({ incidentId, teamId, teamName, me }: { incidentId: string; teamId: string; teamName: string; me: string }) {
  const { site, parties, areas } = useAvy(incidentId);
  const now = useNow();
  if (!site) return null;
  const myAreas = areas.filter((a) => a.teamId === teamId && a.status !== 'complete');
  const who = me || teamName;
  const mine = site.onDebris.findIndex((r) => r.name === who && !r.outAt);
  const active = parties.filter((p) => STILL_MISSING.includes(p.status) || p.status === 'extricated');
  return (
    <div className="avy-field">
      <section className={'card ' + (site.overheadLevel === 'high' ? 'party-missing' : '')}>
        <h3>⚠ Avalanche hazard: overhead {site.overheadLevel}</h3>
        <p><b>Alarm:</b> {site.alarmSignal || '—'}</p>
        <p><b>Escape:</b> {site.escapeRoutes || '—'}{site.safeZone && ` → ${site.safeZone}`}</p>
        <p><b>Guard:</b> {site.guardName || 'not posted'} {site.guardChannel && `· ${site.guardChannel}`}</p>
        <button className={mine >= 0 ? 'danger-btn' : 'primary'} onClick={() => patchSite(site.id, {
          onDebris: mine >= 0 ? site.onDebris.map((r, j) => (j === mine ? { ...r, outAt: nowIso() } : r)) : [...site.onDebris, { name: who, team: teamName, inAt: nowIso() }],
        })}>{mine >= 0 ? `I'm off the debris (on since ${fmtTime(site.onDebris[mine]!.inAt)})` : 'I\'m going onto the debris'}</button>
      </section>
      <section className="card">
        <h3>My debris area</h3>
        {myAreas.length === 0 ? <p className="muted">No area assigned to your team yet.</p> : myAreas.map((a) => (
          <p key={a.id}><b>{a.name}</b> ({a.priority}) · {a.method}<br />{a.description}</p>
        ))}
      </section>
      <section className="card">
        <h3>Involved parties</h3>
        {active.map((p) => {
          const m = burialMinutes(site, p, now);
          return (
            <div key={p.id} className="handover">
              <b>{p.label}</b> {p.name || p.description} · {STATUS_LABEL[p.status]} {m != null && <span className={'phase ' + burialPhase(m).cls}>{minsLabel(m)}</span>}
              {p.status !== 'extricated' && (
                <div className="big-buttons">
                  <button onClick={() => patchParty(p.id, { status: 'located-buried', locatedAt: p.locatedAt ?? nowIso(), locatedBy: p.locatedBy || teamName })}>📍 Located</button>
                  <button onClick={() => patchParty(p.id, { status: 'extricated', extricatedAt: nowIso(), locatedAt: p.locatedAt ?? nowIso(), locatedBy: p.locatedBy || teamName })}>✅ Extricated</button>
                </div>
              )}
            </div>
          );
        })}
        {active.length === 0 && <p className="muted">All involved parties accounted for.</p>}
      </section>
    </div>
  );
}
