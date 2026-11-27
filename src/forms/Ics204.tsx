import { FormFrame, Box, Text, Select } from '../components/ui';
import { patch, save, uid, nowIso, softDelete } from '../db/db';
import type { Assignment, Team } from '../db/types';
import { opLabel, useTable } from '../lib/hooks';
import type { FormProps } from './common';

export function newAssignment(incidentId: string, opPeriodId: string, n: number): Assignment {
  return {
    id: uid(), incidentId, opPeriodId, updatedAt: nowIso(), number: String(n), branch: 'Ground', division: '',
    segment: '', caltopoRef: '', work: '', specialInstructions: '', commsChannel: '', status: 'draft',
  };
}

export function Ics204({ incident, op, update, only }: FormProps & { only?: string }) {
  const assignments = useTable('assignments', incident.id, op.id).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  const teams = useTable('teams', incident.id, op.id);
  const list = only ? assignments.filter((a) => a.id === only) : assignments;
  const channels = op.comms.map((c) => `${c.channel} ${c.name}`);
  return (
    <div>
      {!only && (
        <div className="no-print row">
          <button onClick={() => save('assignments', newAssignment(incident.id, op.id, assignments.length + 1))}>+ New assignment (204)</button>
          <span className="muted">Each assignment prints as its own ICS 204.</span>
        </div>
      )}
      {list.length === 0 && <p className="muted">No assignments in this operational period yet.</p>}
      {list.map((a) => <One key={a.id} a={a} teams={teams} channels={channels} {...{ incident, op, update }} />)}
    </div>
  );
}

function One({ a, teams, channels, incident, op, update }: FormProps & { a: Assignment; teams: Team[]; channels: string[] }) {
  const up = (c: Partial<Assignment>) => patch<Assignment>('assignments', a.id, c);
  const team = teams.find((t) => t.id === a.teamId);
  return (
    <FormFrame num="204" title={`Assignment List · Assignment ${a.number}`} incidentName={incident.name} opLabel={opLabel(op)}
      footer={<Text label="Prepared by (Resources Unit Leader)" value={op.preparedBy} onCommit={(v) => update({ preparedBy: v })} />}>
      <div className="cols4">
        <Box n="1" title="Assignment #"><Text value={a.number} onCommit={(v) => up({ number: v })} /></Box>
        <Box n="2" title="Branch"><Text value={a.branch} onCommit={(v) => up({ branch: v })} /></Box>
        <Box n="3" title="Division / Group"><Text value={a.division} onCommit={(v) => up({ division: v })} /></Box>
        <Box title="Status">
          <Select value={a.status} options={['draft', 'assigned', 'in-field', 'complete']} onChange={(v) => up({ status: v as Assignment['status'] })} />
        </Box>
      </div>
      <Box n="4" title="Operations personnel">
        <div className="cols3">
          <div><b>Operations Section Chief:</b> {op.org.ops?.name || '—'}</div>
          <div><b>Branch Director:</b> {op.org['ground-branch']?.name || '—'}</div>
          <div><b>Division/Group Supervisor:</b> {team?.leader || '—'}</div>
        </div>
      </Box>
      <Box n="5" title="Resources assigned">
        <Select value={a.teamId ?? ''} blank="— choose team —" options={teams.map((t) => ({ value: t.id, label: `${t.name} (${t.type})` }))}
          onChange={(v) => { up({ teamId: v || undefined, status: v && a.status === 'draft' ? 'assigned' : a.status }); if (v) patch<Team>('teams', v, { status: 'assigned' }); }} />
        {team && (
          <table className="grid compact"><thead><tr><th>Resource identifier</th><th>Leader</th><th># persons</th><th>Contact</th><th>Members</th></tr></thead>
            <tbody><tr><td>{team.name} · {team.type}</td><td>{team.leader} {team.leaderCallSign && `(${team.leaderCallSign})`}</td><td>{team.members.length + 1}</td><td>{team.contact}</td><td>{team.members.join(', ')}</td></tr></tbody>
          </table>
        )}
      </Box>
      <Box n="6" title="Work assignment">
        <div className="cols2">
          <Text label="Segment / area" value={a.segment} onCommit={(v) => up({ segment: v })} />
          <Text label="CalTopo assignment / segment link" value={a.caltopoRef} onCommit={(v) => up({ caltopoRef: v })} />
        </div>
        {a.caltopoRef.startsWith('http') && <a className="no-print" href={a.caltopoRef} target="_blank" rel="noreferrer">Open in CalTopo ↗</a>}
        <Text multiline rows={4} value={a.work} onCommit={(v) => up({ work: v })} placeholder="Task, tactics, search type, coverage expected, return time" />
      </Box>
      <Box n="7" title="Special instructions">
        <Text multiline value={a.specialInstructions} onCommit={(v) => up({ specialInstructions: v })} />
        {op.safetyMessage && <p className="small-print"><b>Safety (ICS 208):</b> {op.safetyMessage}</p>}
      </Box>
      <Box n="8" title="Communications">
        <Select value={a.commsChannel} blank="— channel from ICS 205 —" options={channels} onChange={(v) => up({ commsChannel: v })} />
        <div className="small-print">Command: {op.comms.find((c) => c.func.toLowerCase().includes('command'))?.name ?? '—'}
          {' · '}Medical: see ICS 206 · Hospital: {op.hospitals[0]?.name ?? '—'}</div>
      </Box>
      <div className="no-print row"><button className="link danger" onClick={() => softDelete('assignments', a.id)}>Delete assignment</button></div>
    </FormFrame>
  );
}
