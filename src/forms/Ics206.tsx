import { FormFrame, Box, Text, RowTable, Check } from '../components/ui';
import { opLabel } from '../lib/hooks';
import type { FormProps } from './common';

export function Ics206({ incident, op, update }: FormProps) {
  return (
    <FormFrame num="206" title="Medical Plan" incidentName={incident.name} opLabel={opLabel(op)}
      footer={<Text label="Prepared by (Medical Unit Leader) / reviewed by Safety Officer" value={op.preparedBy} onCommit={(v) => update({ preparedBy: v })} />}>
      <Box n="3" title="Medical aid stations">
        <RowTable rows={op.aidStations} onChange={(aidStations) => update({ aidStations })} addLabel="Aid station"
          blank={{ name: '', location: '', contact: '', paramedics: false }}
          columns={[{ key: 'name', label: 'Name' }, { key: 'location', label: 'Location' }, { key: 'contact', label: 'Contact / frequency' }, { key: 'paramedics', label: 'Paramedics on site', type: 'bool' }]} />
      </Box>
      <Box n="4" title="Transportation (ambulance services)">
        <RowTable rows={op.ambulances} onChange={(ambulances) => update({ ambulances })} addLabel="Ambulance service"
          blank={{ service: '', location: '', contact: '', level: 'ALS' }}
          columns={[{ key: 'service', label: 'Ambulance service' }, { key: 'location', label: 'Location' }, { key: 'contact', label: 'Contact / frequency' }, { key: 'level', label: 'Level (ALS/BLS)' }]} />
      </Box>
      <Box n="5" title="Hospitals">
        <RowTable rows={op.hospitals} onChange={(hospitals) => update({ hospitals })} addLabel="Hospital"
          blank={{ name: '', address: '', latLon: '', contact: '', airTime: '', groundTime: '', trauma: '', burn: false, helipad: false }}
          columns={[{ key: 'name', label: 'Hospital' }, { key: 'address', label: 'Address' }, { key: 'latLon', label: 'Lat/long' }, { key: 'contact', label: 'Contact' },
            { key: 'airTime', label: 'Travel (air)' }, { key: 'groundTime', label: 'Travel (ground)' }, { key: 'trauma', label: 'Trauma centre' },
            { key: 'burn', label: 'Burn', type: 'bool' }, { key: 'helipad', label: 'Helipad', type: 'bool' }]} />
      </Box>
      <Box n="6" title="Special medical emergency procedures">
        <Text multiline rows={5} value={op.medicalProcedures} onCommit={(v) => update({ medicalProcedures: v })} />
        <Check label="Aviation assets are utilized for rescue" value={op.medicalAviation} onChange={(medicalAviation) => update({ medicalAviation })} />
      </Box>
    </FormFrame>
  );
}
