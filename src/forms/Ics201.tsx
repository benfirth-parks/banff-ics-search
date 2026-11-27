import { FormFrame, Box, Text, RowTable, StringList, fmt } from '../components/ui';
import { patch, save, uid, nowIso, softDelete } from '../db/db';
import type { Incident, ResourceRow } from '../db/types';
import { orgPositions } from '../data/positions';
import { useTable, usePickList, opLabel } from '../lib/hooks';
import type { FormProps } from './common';

export function Ics201({ incident, op, update }: FormProps) {
  const resources = useTable('resources', incident.id);
  const objectivePicks = usePickList('objectives');
  const upInc = (c: Partial<Incident>) => patch<Incident>('incidents', incident.id, c);
  const filled = orgPositions(op.org).filter((p) => op.org[p.key]?.name);
  return (
    <FormFrame num="201" title="Incident Briefing" incidentName={incident.name} opLabel={opLabel(op)}
      footer={<Text label="Prepared by (name / position)" value={op.preparedBy} onCommit={(v) => update({ preparedBy: v })} />}>
      <div className="cols3">
        <Box n="1" title="Incident name"><Text value={incident.name} onCommit={(v) => upInc({ name: v })} /></Box>
        <Box n="2" title="Incident number"><Text value={incident.number} onCommit={(v) => upInc({ number: v })} /></Box>
        <Box n="3" title="Date / time initiated"><div className="ro">{fmt(incident.startedAt)}</div></Box>
      </div>
      <Box n="4" title="Map / sketch">
        <Text label="CalTopo / SARTopo map link" value={incident.caltopoUrl} onCommit={(v) => upInc({ caltopoUrl: v })} placeholder="https://caltopo.com/m/…" />
        {incident.caltopoUrl && <a className="no-print" href={incident.caltopoUrl} target="_blank" rel="noreferrer">Open map ↗</a>}
        <Text label="Map notes (PLS/LKP, search area, ICP, staging, helispot)" multiline value={incident.mapNotes} onCommit={(v) => upInc({ mapNotes: v })} />
      </Box>
      <Box n="5" title="Situation summary and health and safety briefing">
        <Text multiline rows={6} value={incident.situationSummary} onCommit={(v) => upInc({ situationSummary: v })} />
      </Box>
      <Box n="6" title="Current and planned objectives (shared with ICS 202)">
        <StringList numbered items={op.objectives} picks={objectivePicks} onChange={(objectives) => update({ objectives })} addLabel="Objective" />
      </Box>
      <Box n="7" title="Current and planned actions, strategies and tactics">
        <RowTable rows={op.actions} columns={[{ key: 'time', label: 'Time', width: '9rem' }, { key: 'action', label: 'Action' }]}
          blank={{ time: new Date().toTimeString().slice(0, 5), action: '' }} onChange={(actions) => update({ actions })} addLabel="Action" />
      </Box>
      <Box n="8" title="Current organization (full detail on ICS 203 / 207)">
        {filled.length === 0 ? <p className="muted">No positions filled yet.</p> : (
          <table className="grid compact"><tbody>{filled.map((p) => (
            <tr key={p.key}><td>{p.title}</td><td>{op.org[p.key].name}</td><td>{op.org[p.key].callSign}</td></tr>
          ))}</tbody></table>
        )}
      </Box>
      <Box n="9" title="Resource summary">
        <table className="grid"><thead><tr><th>Resource</th><th>Identifier</th><th>Date/time ordered</th><th>ETA</th><th>Arrived</th><th>Notes (location / assignment / status)</th><th className="no-print" /></tr></thead>
          <tbody>{resources.map((r) => (
            <tr key={r.id}>
              {(['resource', 'identifier', 'ordered', 'eta'] as const).map((k) => (
                <td key={k}><Text value={r[k]} onCommit={(v) => patch<ResourceRow>('resources', r.id, { [k]: v })} /></td>
              ))}
              <td><input type="checkbox" checked={r.arrived} onChange={(e) => patch<ResourceRow>('resources', r.id, { arrived: e.target.checked })} /></td>
              <td><Text value={r.notes} onCommit={(v) => patch<ResourceRow>('resources', r.id, { notes: v })} /></td>
              <td className="no-print"><button className="link danger" onClick={() => softDelete('resources', r.id)}>✕</button></td>
            </tr>
          ))}</tbody>
        </table>
        <button className="small no-print" onClick={() => save<ResourceRow>('resources', {
          id: uid(), incidentId: incident.id, updatedAt: nowIso(), resource: '', identifier: '', ordered: fmt(nowIso()), eta: '', arrived: false, notes: '',
        })}>+ Resource</button>
      </Box>
    </FormFrame>
  );
}
