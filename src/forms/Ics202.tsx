import { FormFrame, Box, Text, Check, StringList, fmt } from '../components/ui';
import { usePickList, opLabel } from '../lib/hooks';
import type { FormProps } from './common';

const COMPONENTS = ['202', '203', '204', '205', '205A', '206', '207', '208', 'Map/chart', 'Weather forecast', 'Subject profile'];

export function Ics202({ incident, op, update }: FormProps) {
  const picks = usePickList('objectives');
  return (
    <FormFrame num="202" title="Incident Objectives" incidentName={incident.name} opLabel={opLabel(op)}
      footer={<div className="cols2">
        <Text label="Prepared by (Planning Section Chief)" value={op.preparedBy} onCommit={(v) => update({ preparedBy: v })} />
        <Text label="Approved by (Incident Commander)" value={op.approvedBy} onCommit={(v) => update({ approvedBy: v })} />
      </div>}>
      <Box n="2" title="Operational period"><div className="ro">{fmt(op.start)} to {fmt(op.end)}</div></Box>
      <Box n="3" title="Objectives"><StringList numbered items={op.objectives} picks={picks} onChange={(objectives) => update({ objectives })} addLabel="Objective" /></Box>
      <Box n="4" title="Operational period command emphasis"><Text multiline value={op.commandEmphasis} onCommit={(v) => update({ commandEmphasis: v })} /></Box>
      <Box title="General situational awareness"><Text multiline value={op.situationalAwareness} onCommit={(v) => update({ situationalAwareness: v })} /></Box>
      <Box title="Weather"><Text multiline rows={2} value={op.weather} onCommit={(v) => update({ weather: v })} /></Box>
      <Box n="5" title="Site safety plan required?">
        <Check label="Yes, a site safety plan is required" value={op.siteSafetyPlanRequired} onChange={(siteSafetyPlanRequired) => update({ siteSafetyPlanRequired })} />
        {op.siteSafetyPlanRequired && <Text label="Approved site safety plan(s) located at" value={op.siteSafetyPlanLocation} onCommit={(v) => update({ siteSafetyPlanLocation: v })} />}
      </Box>
      <Box n="6" title="Incident Action Plan (attached components)">
        <div className="chips">{COMPONENTS.map((c) => (
          <Check key={c} label={c} value={op.iapComponents.includes(c)}
            onChange={(on) => update({ iapComponents: on ? [...op.iapComponents, c] : op.iapComponents.filter((x) => x !== c) })} />
        ))}</div>
      </Box>
    </FormFrame>
  );
}
