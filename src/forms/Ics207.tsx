import { FormFrame } from '../components/ui';
import { orgPositions, defaultTeamLead, type Position } from '../data/positions';
import { opLabel, useTable } from '../lib/hooks';
import type { Team } from '../db/types';
import type { FormProps } from './common';

export function Ics207({ incident, op }: FormProps) {
  const teams = useTable('teams', incident.id, op.id);
  const all = orgPositions(op.org);
  const byKey = new Map(all.map((p) => [p.key, p]));
  const filled = all.filter((p) => Boolean(op.org[p.key]?.name));
  const filledKeys = new Set(filled.map((p) => p.key));
  // Vacant positions are left off; anyone under one moves up to the nearest filled position above it.
  const filledAbove = (key: string | undefined, seen = new Set<string>()): string | undefined => {
    while (key && !seen.has(key)) {
      if (filledKeys.has(key)) return key;
      seen.add(key);
      key = byKey.get(key)?.parent;
    }
    return undefined;
  };
  const boss = new Map<string, string | undefined>(filled.map((p) => [p.key, filledAbove(p.parent, new Set([p.key]))]));
  const teamBoss = (t: Team) => filledAbove(t.reportsTo || defaultTeamLead(op.org));
  const roots = filled.filter((p) => !boss.get(p.key));
  const orphanTeams = teams.filter((t) => !teamBoss(t));

  const teamNode = (t: Team) => (
    <li key={t.id}><div className="org-node team">
      <div className="org-title">Strike team: {t.name} ({t.type})</div>
      <div className="org-name">{t.leader || 'Leader not set'}</div>
      {t.leaderCallSign && <div className="org-cs">{t.leaderCallSign}</div>}
    </div></li>
  );
  const node = (p: Position): JSX.Element => {
    const kids = filled.filter((c) => boss.get(c.key) === p.key);
    const tms = teams.filter((t) => teamBoss(t) === p.key);
    return (
      <li key={p.key}>
        <div className="org-node">
          <div className="org-title">{p.title}</div>
          <div className="org-name">{op.org[p.key]?.name}</div>
          {op.org[p.key]?.callSign && <div className="org-cs">{op.org[p.key].callSign}</div>}
        </div>
        {(kids.length > 0 || tms.length > 0) && <ul>{kids.map(node)}{tms.map(teamNode)}</ul>}
      </li>
    );
  };
  return (
    <FormFrame num="207" title="Incident Organization Chart" incidentName={incident.name} opLabel={opLabel(op)}>
      <p className="muted no-print">Built from the ICS 203. Vacant positions are left off; strike teams appear under the position they report to.</p>
      {roots.length + orphanTeams.length === 0
        ? <p className="muted">No positions filled yet. Fill them on the ICS 203.</p>
        : <div className="org-chart"><ul>{roots.map(node)}{orphanTeams.map(teamNode)}</ul></div>}
    </FormFrame>
  );
}
