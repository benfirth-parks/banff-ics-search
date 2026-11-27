import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db, uid } from '../db/db';
import { Text } from '../components/ui';
import type { Table } from 'dexie';

const PICKLIST_LABELS: Record<string, string> = {
  objectives: 'Standard objectives', safetyMessages: 'Safety messages', teamTypes: 'Team types', checkInStatus: 'Field check-in statuses',
};

function TableEditor<T extends { id: string }>(props: { title: string; table: Table<T, string>; cols: { key: keyof T & string; label: string; list?: boolean }[] }) {
  const rows = useLiveQuery(() => props.table.toArray(), [props.table]) ?? [];
  return (
    <section className="card">
      <h2>{props.title}</h2>
      <div className="table-wrap"><table className="grid compact">
        <thead><tr>{props.cols.map((c) => <th key={c.key}>{c.label}</th>)}<th /></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}>{props.cols.map((c) => (
            <td key={c.key}><Text value={c.list ? (r[c.key] as string[]).join(', ') : String(r[c.key] ?? '')}
              onCommit={(v) => props.table.update(r.id, { [c.key]: c.list ? v.split(',').map((s) => s.trim()).filter(Boolean) : v } as never)} /></td>
          ))}<td><button className="link danger" onClick={() => props.table.delete(r.id)}>✕</button></td></tr>
        ))}</tbody>
      </table></div>
      <button className="small" onClick={() => props.table.add({ id: uid(), ...Object.fromEntries(props.cols.map((c) => [c.key, c.list ? [] : ''])) } as T)}>+ Add</button>
    </section>
  );
}

export function ReferencePage() {
  const lists = useLiveQuery(() => db.pickLists.toArray()) ?? [];
  return (
    <div className="pad reference">
      <p className="muted"><Link to="/">Home</Link> · Reference data is stored on this device and used to prefill new incidents. All entries are SAMPLE data; verify real contacts before live use.</p>
      <section className="card">
        <h2>Templates and pick-lists</h2>
        <div className="cols2">{lists.map((l) => (
          <div key={l.id}>
            <h3>{PICKLIST_LABELS[l.id] ?? l.id}</h3>
            <Text multiline rows={8} value={l.items.join('\n')} onCommit={(v) => db.pickLists.put({ id: l.id, items: v.split('\n').map((s) => s.trim()).filter(Boolean) })} />
            <p className="muted small-print">One per line.</p>
          </div>
        ))}</div>
      </section>
      <TableEditor title="Staff list" table={db.staff} cols={[{ key: 'name', label: 'Name' }, { key: 'callSign', label: 'Call sign' }, { key: 'agency', label: 'Agency' }, { key: 'quals', label: 'Qualifications (comma separated)', list: true }, { key: 'phone', label: 'Phone' }]} />
      <TableEditor title="Radio channels (prefill ICS 205)" table={db.channels} cols={[{ key: 'channel', label: 'Ch #' }, { key: 'name', label: 'Name' }, { key: 'func', label: 'Function' }, { key: 'rxFreq', label: 'RX' }, { key: 'txFreq', label: 'TX' }, { key: 'tone', label: 'Tone' }, { key: 'mode', label: 'Mode' }]} />
      <TableEditor title="Hospitals (prefill ICS 206)" table={db.hospitals} cols={[{ key: 'name', label: 'Name' }, { key: 'address', label: 'Address' }, { key: 'latLon', label: 'Lat/long' }, { key: 'contact', label: 'Contact' }, { key: 'airTime', label: 'Air' }, { key: 'groundTime', label: 'Ground' }, { key: 'trauma', label: 'Trauma' }]} />
      <TableEditor title="Helicopter / aircraft companies" table={db.aircraft} cols={[{ key: 'name', label: 'Company' }, { key: 'base', label: 'Base' }, { key: 'phone', label: 'Phone' }, { key: 'aircraft', label: 'Aircraft' }, { key: 'capabilities', label: 'Capabilities' }]} />
    </div>
  );
}
