import { FormFrame, Box, Text, RowTable } from '../components/ui';
import type { CommsRow } from '../db/types';
import { opLabel } from '../lib/hooks';
import type { FormProps } from './common';

const blank: CommsRow = { zone: '', channel: '', func: '', name: '', assignment: '', rxFreq: '', rxTone: '', txFreq: '', txTone: '', mode: 'A', remarks: '' };

export function Ics205({ incident, op, update }: FormProps) {
  return (
    <FormFrame num="205" title="Incident Radio Communications Plan" incidentName={incident.name} opLabel={opLabel(op)}
      footer={<Text label="Prepared by (Communications Unit Leader)" value={op.preparedBy} onCommit={(v) => update({ preparedBy: v })} />}>
      <Box n="3" title="Basic radio channel use">
        <RowTable rows={op.comms} onChange={(comms) => update({ comms })} blank={blank} addLabel="Channel" columns={[
          { key: 'zone', label: 'Zone/Grp', width: '5rem' }, { key: 'channel', label: 'Ch #', width: '4rem' },
          { key: 'func', label: 'Function' }, { key: 'name', label: 'Channel name / talkgroup' }, { key: 'assignment', label: 'Assignment' },
          { key: 'rxFreq', label: 'RX freq' }, { key: 'rxTone', label: 'RX tone' }, { key: 'txFreq', label: 'TX freq' },
          { key: 'txTone', label: 'TX tone' }, { key: 'mode', label: 'Mode (A/D/M)', width: '5rem' }, { key: 'remarks', label: 'Remarks' },
        ]} />
      </Box>
      <Box n="4" title="Special instructions"><Text multiline value={op.commsSpecialInstructions} onCommit={(v) => update({ commsSpecialInstructions: v })} /></Box>
    </FormFrame>
  );
}
