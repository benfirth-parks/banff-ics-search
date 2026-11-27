import { FormFrame, Box, Text, Check } from '../components/ui';
import { opLabel, usePickList } from '../lib/hooks';
import type { FormProps } from './common';

export function Ics208({ incident, op, update }: FormProps) {
  const picks = usePickList('safetyMessages');
  return (
    <FormFrame num="208" title="Safety Message / Plan" incidentName={incident.name} opLabel={opLabel(op)}
      footer={<Text label="Prepared by (Safety Officer)" value={op.preparedBy} onCommit={(v) => update({ preparedBy: v })} />}>
      <Box n="3" title="Safety message / expanded safety message, safety plan">
        <select className="no-print" value="" onChange={(e) => e.target.value && update({ safetyMessage: (op.safetyMessage ? op.safetyMessage + '\n' : '') + '• ' + e.target.value })}>
          <option value="">Add standard safety message…</option>
          {picks.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <Text multiline rows={8} value={op.safetyMessage} onCommit={(v) => update({ safetyMessage: v })} />
        <Text label="Safety plan" multiline rows={4} value={op.safetyPlan} onCommit={(v) => update({ safetyPlan: v })} />
      </Box>
      <Box n="4" title="Site safety plan required?">
        <Check label="Yes (shared with ICS 202)" value={op.siteSafetyPlanRequired} onChange={(siteSafetyPlanRequired) => update({ siteSafetyPlanRequired })} />
        {op.siteSafetyPlanRequired && <Text label="Approved site safety plan(s) located at" value={op.siteSafetyPlanLocation} onCommit={(v) => update({ siteSafetyPlanLocation: v })} />}
      </Box>
    </FormFrame>
  );
}
