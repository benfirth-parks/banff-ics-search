import { FormFrame } from '../components/ui';
import { POSITIONS, type Position } from '../data/positions';
import { opLabel, useTable } from '../lib/hooks';
import type { FormProps } from './common';

export function Ics207({ incident, op }: FormProps) {
  const teams = useTable('teams', incident.id, op.id);
  const filled = (p: Position) => Boolean(op.org[p.key]?.name);
  const shown = (p: Position): boolean =>
    filled(p) || (p.key === 'ground-branch' && teams.length > 0) || POSITIONS.some((c) => c.parent === p.key && shown(c));
  const kids = (key: string) => POSITIONS.filter((p) => p.parent === key && shown(p));
  const node = (p: Position): JSX.Element => (
    <li key={p.key}>
      <div className={'org-node ' + (filled(p) ? '' : 'vacant')}>
        <div className="org-title">{p.title}</div>
        <div className="org-name">{op.org[p.key]?.name || 'Vacant'}</div>
        {op.org[p.key]?.callSign && <div className="org-cs">{op.org[p.key].callSign}</div>}
      </div>
      {(kids(p.key).length > 0 || (p.key === 'ground-branch' && teams.length > 0)) && (
        <ul>
          {kids(p.key).map(node)}
          {p.key === 'ground-branch' && teams.map((t) => (
            <li key={t.id}><div className="org-node team"><div className="org-title">{t.name} · {t.type}</div><div className="org-name">{t.leader}</div></div></li>
          ))}
        </ul>
      )}
    </li>
  );
  const ic = POSITIONS[0];
  return (
    <FormFrame num="207" title="Incident Organization Chart" incidentName={incident.name} opLabel={opLabel(op)}>
      <p className="muted no-print">Built from the ICS 203. Only filled positions (and their parents) are shown; teams appear under Ground Branch.</p>
      <div className="org-chart"><ul>{node(ic)}</ul></div>
    </FormFrame>
  );
}
