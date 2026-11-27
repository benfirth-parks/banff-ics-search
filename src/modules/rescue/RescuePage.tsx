import { useNavigate, useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCtx } from '../../pages/IncidentLayout';
import { useTable } from '../../lib/hooks';
import { db, patch, save, uid, nowIso } from '../../db/db';
import type { Incident, OpPeriod } from '../../db/types';
import { Text, Check, Select, RowTable, StringList, Box, fmt, fmtTime } from '../../components/ui';
import {
  emptyRescuePeriod, emptyMission, RESCUE_TYPES, ROPE_TYPES, ROPE_STATUS, FLIGHT_MISSIONS, PACKAGING, EVAC_METHODS, TRIAGE, PATIENT_STATUS,
  type RescuePeriod, type RescueMission, type Patient, type RescueLogEntry, type RopeSystem,
} from './types';
import './rescue.css';

const TABS = [
  ['mission', 'Mission'], ['patients', 'Patients'], ['technical', 'Technical / rope'], ['aviation', 'Aviation / HFRS'],
  ['medical', 'Medical'], ['safety', 'Rescuer safety'], ['print', 'Print rescue plan'],
] as const;

export function usePeriodRescue(op: OpPeriod, update: (c: Partial<OpPeriod>) => void) {
  const r: RescuePeriod = { ...emptyRescuePeriod(), ...op.rescue };
  return { r, setR: (c: Partial<RescuePeriod>) => update({ rescue: { ...r, ...c } }) };
}

export function RescuePage() {
  const { incident, op, update } = useCtx();
  const { tab = 'mission' } = useParams();
  const nav = useNavigate();
  const { r, setR } = usePeriodRescue(op, update);
  const p = { incident, op, r, setR };
  const all = tab === 'print';
  return (
    <div className="rescue">
      <div className="row no-print toolbar">
        <div className="subtabs">{TABS.map(([k, label]) => (
          <button key={k} className={k === tab ? 'on' : ''} onClick={() => nav(`/i/${incident.id}/rescue/${k}`)}>{label}</button>
        ))}</div>
        {all && <button className="primary" onClick={() => window.print()}>Print</button>}
      </div>
      {all && <h2>Rescue plan · {incident.name} · Op period {op.number}</h2>}
      {(all || tab === 'mission') && <MissionTab {...p} />}
      {(all || tab === 'patients') && <PatientsTab {...p} />}
      {(all || tab === 'technical') && <TechnicalTab {...p} />}
      {(all || tab === 'aviation') && <AviationTab {...p} />}
      {(all || tab === 'medical') && <MedicalTab {...p} />}
      {(all || tab === 'safety') && <SafetyTab {...p} />}
    </div>
  );
}

interface P { incident: Incident; op: OpPeriod; r: RescuePeriod; setR: (c: Partial<RescuePeriod>) => void }

function MissionTab({ incident }: P) {
  const m: RescueMission = { ...emptyMission(), ...incident.rescue };
  const set = (c: Partial<RescueMission>) => patch<Incident>('incidents', incident.id, { rescue: { ...m, ...c } });
  return (
    <section className="card">
      <h3>Mission</h3>
      <div className="cols3">
        <Select label="Rescue type" value={m.rescueType} options={RESCUE_TYPES} blank="Choose…" onChange={(rescueType) => set({ rescueType })} />
        <Text label="Parties / patients reported" value={m.parties} onCommit={(parties) => set({ parties })} />
        <Text label="Reporting party / how reported" value={m.reportingParty} onCommit={(reportingParty) => set({ reportingParty })} />
        <Text label="Site (feature, elevation, aspect)" value={m.location} onCommit={(location) => set({ location })} />
        <Text label="Site coordinates" value={m.coords} onCommit={(coords) => set({ coords })} placeholder="51.32, -116.25 or UTM" />
      </div>
      <div className="cols2">
        <Text label="What happened (mechanism)" multiline value={m.mechanism} onCommit={(mechanism) => set({ mechanism })} />
        <Text label="Access and egress routes" multiline value={m.access} onCommit={(access) => set({ access })} />
      </div>
      <Text label="Notes" multiline value={m.notes} onCommit={(notes) => set({ notes })} />
      <p className="muted small-print no-print">Objectives, org and comms are on the ICS forms. This module adds the rescue-specific parts; the per-period parts (rope systems, aviation, safety) roll forward with each new operational period.</p>
    </section>
  );
}

// ---------- Patients ----------
export const triageClass = (t: string) => 'triage t-' + t.toLowerCase();

export function PatientBoard({ patients }: { patients: Patient[] }) {
  return (
    <table className="grid compact"><thead><tr><th>Pt</th><th>Triage</th><th>Status</th><th>Location</th><th>Evac</th><th>Destination</th></tr></thead>
      <tbody>{patients.map((p) => (
        <tr key={p.id}><td><b>{p.label}</b> {p.name}</td><td><span className={triageClass(p.triage)}>{p.triage}</span></td><td>{p.status}</td>
          <td>{p.location}</td><td>{p.evacMethod}</td><td>{p.destination}</td></tr>
      ))}</tbody></table>
  );
}

const sortPatients = (ps: Patient[]) => [...ps].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

function PatientsTab({ incident, op }: P) {
  const patients = sortPatients(useTable('patients', incident.id));
  const add = async () => {
    const n = patients.length + 1;
    const p: Patient = {
      id: uid(), incidentId: incident.id, updatedAt: nowIso(), label: `P${n}`, name: '', age: '', sex: '', triage: 'Unknown', status: 'reported',
      location: '', injuries: '', treatment: '', packaging: '', evacMethod: '', destination: '', receivingEms: '', transferredAt: '', vitals: [], notes: '',
    };
    await save('patients', p);
  };
  const counts = TRIAGE.map((t) => [t, patients.filter((p) => p.triage === t).length] as const).filter(([, n]) => n);
  return (
    <section className="card">
      <div className="row"><h3 style={{ flex: 1 }}>Patients ({patients.length})</h3>
        {counts.map(([t, n]) => <span key={t} className={triageClass(t)}>{t} {n}</span>)}
        <button className="primary no-print" onClick={add}>+ Add patient</button></div>
      {patients.length > 1 && <PatientBoard patients={patients} />}
      {patients.length === 0 && <p className="muted">No patients yet. Add one per injured or stranded person.</p>}
      {patients.map((p) => <PatientCard key={p.id} p={p} hospitals={op.hospitals.map((h) => h.name).filter(Boolean)} />)}
    </section>
  );
}

function PatientCard({ p, hospitals }: { p: Patient; hospitals: string[] }) {
  const set = (c: Partial<Patient>) => patch<Patient>('patients', p.id, c);
  return (
    <div className={'card inset patient ' + 'pt-' + p.triage.toLowerCase()}>
      <div className="cols4">
        <Text label="Label" value={p.label} onCommit={(label) => set({ label })} />
        <Text label="Name" value={p.name} onCommit={(name) => set({ name })} />
        <Text label="Age" value={p.age} onCommit={(age) => set({ age })} />
        <Text label="Sex" value={p.sex} onCommit={(sex) => set({ sex })} />
        <Select label="Triage" value={p.triage} options={TRIAGE} onChange={(v) => set({ triage: v as Patient['triage'] })} />
        <Select label="Status" value={p.status} options={PATIENT_STATUS} onChange={(v) => set({ status: v as Patient['status'], transferredAt: v === 'transferred' && !p.transferredAt ? nowIso() : p.transferredAt })} />
        <Text label="Location" value={p.location} onCommit={(location) => set({ location })} />
        <Select label="Packaging" value={p.packaging} options={PACKAGING} blank="—" onChange={(packaging) => set({ packaging })} />
        <Select label="Evacuation method" value={p.evacMethod} options={EVAC_METHODS} blank="—" onChange={(evacMethod) => set({ evacMethod })} />
        <Select label="Destination" value={p.destination} options={[...new Set([...hospitals, ...(p.destination ? [p.destination] : [])])]} blank="—" onChange={(destination) => set({ destination })} />
        <Text label="Receiving EMS / unit" value={p.receivingEms} onCommit={(receivingEms) => set({ receivingEms })} />
        <label className="field"><span>Transferred</span><span className="ro">{fmt(p.transferredAt) || '—'}</span></label>
      </div>
      <div className="cols2">
        <Text label="Injuries / chief complaint" multiline value={p.injuries} onCommit={(injuries) => set({ injuries })} />
        <Text label="Treatment given" multiline value={p.treatment} onCommit={(treatment) => set({ treatment })} />
      </div>
      <b>Vitals</b>
      <RowTable rows={p.vitals} onChange={(vitals) => set({ vitals })} addLabel="Vitals"
        blank={{ time: fmtTime(nowIso()), loc: '', hr: '', rr: '', bp: '', spo2: '', temp: '', gcs: '', notes: '' }}
        columns={[{ key: 'time', label: 'Time', width: '70px' }, { key: 'loc', label: 'LOC/AVPU', width: '80px' }, { key: 'hr', label: 'HR', width: '60px' },
          { key: 'rr', label: 'RR', width: '60px' }, { key: 'bp', label: 'BP', width: '80px' }, { key: 'spo2', label: 'SpO₂', width: '60px' },
          { key: 'temp', label: 'Temp', width: '60px' }, { key: 'gcs', label: 'GCS', width: '60px' }, { key: 'notes', label: 'Notes' }]} />
      <Text label="Notes" value={p.notes} onCommit={(notes) => set({ notes })} />
    </div>
  );
}

// ---------- Technical ----------
function RopeTable({ rows, onChange }: { rows: RopeSystem[]; onChange: (r: RopeSystem[]) => void }) {
  const blank: RopeSystem = { name: `System ${rows.length + 1}`, type: 'Lower', location: '', anchors: '', mainline: '', belay: '', ma: '', rigger: '', edge: '', attendant: '', checkedBy: '', status: 'Planned' };
  const set = (i: number, c: Partial<RopeSystem>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...c } : r)));
  const txt = (i: number, k: keyof RopeSystem) => <Text value={rows[i]![k]} onCommit={(v) => set(i, { [k]: v })} />;
  return (
    <div className="table-wrap">
      <table className="grid"><thead><tr><th>System</th><th>Type</th><th>Location</th><th>Anchors</th><th>Mainline</th><th>Belay</th><th>MA</th>
        <th>Rigger</th><th>Edge</th><th>Attendant</th><th>Safety check by</th><th>Status</th><th className="no-print" /></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} className={r.status === 'In use' ? 'current' : r.status !== 'Stripped' && !r.checkedBy && r.status !== 'Planned' ? 'warn' : ''}>
            <td>{txt(i, 'name')}</td>
            <td><Select value={r.type} options={ROPE_TYPES} onChange={(type) => set(i, { type })} /></td>
            <td>{txt(i, 'location')}</td><td>{txt(i, 'anchors')}</td><td>{txt(i, 'mainline')}</td><td>{txt(i, 'belay')}</td><td>{txt(i, 'ma')}</td>
            <td>{txt(i, 'rigger')}</td><td>{txt(i, 'edge')}</td><td>{txt(i, 'attendant')}</td><td>{txt(i, 'checkedBy')}</td>
            <td><Select value={r.status} options={ROPE_STATUS} onChange={(status) => set(i, { status })} /></td>
            <td className="no-print"><button className="link danger" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button></td>
          </tr>
        ))}</tbody></table>
      <button className="small no-print" onClick={() => onChange([...rows, blank])}>+ Rope system</button>
      <p className="muted small-print">Rows turn yellow when a system is rigged or in use without a named safety check (whistle test).</p>
    </div>
  );
}

function TechnicalTab({ r, setR }: P) {
  return (
    <section className="card">
      <h3>Technical rescue plan</h3>
      <div className="cols2">
        <Text label="Technical rescue lead / rigging supervisor" value={r.techLead} onCommit={(techLead) => setR({ techLead })} />
      </div>
      <Text label="Plan (access, patient extraction, contingencies)" multiline rows={5} value={r.techPlan} onCommit={(techPlan) => setR({ techPlan })} />
      <Box title="Rope systems"><RopeTable rows={r.ropeSystems} onChange={(ropeSystems) => setR({ ropeSystems })} /></Box>
    </section>
  );
}

// ---------- Aviation ----------
function AviationTab({ incident, op, r, setR }: P) {
  const companies = useLiveQuery(() => db.aircraft.toArray()) ?? [];
  const log = useTable('rescueLog', incident.id, op.id).filter((e) => e.kind === 'flight').sort((a, b) => b.time.localeCompare(a.time));
  const addFlight = () => save<RescueLogEntry>('rescueLog', {
    id: uid(), incidentId: incident.id, opPeriodId: op.id, updatedAt: nowIso(), kind: 'flight', time: nowIso(),
    aircraft: r.aircraft[0]?.callSign ?? '', mission: 'Recon', from: r.helispots[0]?.name ?? '', to: '', load: '', notes: '',
  });
  const setE = (e: RescueLogEntry, c: Partial<RescueLogEntry>) => patch<RescueLogEntry>('rescueLog', e.id, c);
  return (
    <section className="card">
      <h3>Aviation and HFRS</h3>
      <Box title="Aircraft assigned">
        <RowTable rows={r.aircraft} onChange={(aircraft) => setR({ aircraft })} addLabel="Aircraft"
          blank={{ callSign: '', company: companies[0]?.name ?? '', reg: '', type: '', pilot: '', hfrs: false, longline: '', status: 'Available' }}
          columns={[{ key: 'callSign', label: 'Call sign' }, { key: 'company', label: 'Company' }, { key: 'reg', label: 'Registration' }, { key: 'type', label: 'Type' },
            { key: 'pilot', label: 'Pilot' }, { key: 'hfrs', label: 'HFRS capable', type: 'bool' }, { key: 'longline', label: 'Longline length' }, { key: 'status', label: 'Status' }]} />
      </Box>
      <Box title="Helispots / landing zones">
        <RowTable rows={r.helispots} onChange={(helispots) => setR({ helispots })} addLabel="Helispot"
          blank={{ name: '', coords: '', elevation: '', notes: '' }}
          columns={[{ key: 'name', label: 'Name' }, { key: 'coords', label: 'Coordinates' }, { key: 'elevation', label: 'Elevation' }, { key: 'notes', label: 'Hazards / notes' }]} />
      </Box>
      <div className="cols3">
        <Text label="Weather minimums" value={r.aviationMinimums} onCommit={(aviationMinimums) => setR({ aviationMinimums })} />
        <Text label="Last light (last HFRS flight by)" value={r.lastLight} onCommit={(lastLight) => setR({ lastLight })} />
        <Text label="HFRS spotter / rescue leader" value={r.hfrsSpotter} onCommit={(hfrsSpotter) => setR({ hfrsSpotter })} />
      </div>
      <Text label="HFRS notes (hook-up procedure, rigging checks, comms between spotter and pilot)" multiline value={r.hfrsNotes} onCommit={(hfrsNotes) => setR({ hfrsNotes })} />
      <Box title="Flight log (this op period)">
        <button className="small no-print" onClick={addFlight}>+ Log a flight now</button>
        <div className="table-wrap"><table className="grid compact"><thead><tr><th>Time</th><th>Aircraft</th><th>Mission</th><th>From</th><th>To</th><th>Load (people / kg / patient)</th><th>Notes</th><th className="no-print" /></tr></thead>
          <tbody>{log.map((e) => (
            <tr key={e.id}><td>{fmtTime(e.time)}</td>
              <td><Text value={e.aircraft} onCommit={(aircraft) => setE(e, { aircraft })} /></td>
              <td><Select value={e.mission ?? ''} options={FLIGHT_MISSIONS} onChange={(mission) => setE(e, { mission })} /></td>
              <td><Text value={e.from} onCommit={(from) => setE(e, { from })} /></td><td><Text value={e.to} onCommit={(to) => setE(e, { to })} /></td>
              <td><Text value={e.load} onCommit={(load) => setE(e, { load })} /></td><td><Text value={e.notes} onCommit={(notes) => setE(e, { notes })} /></td>
              <td className="no-print"><button className="link danger" onClick={() => setE(e, { deleted: true })}>✕</button></td></tr>
          ))}</tbody></table></div>
      </Box>
    </section>
  );
}

// ---------- Medical ----------
function MedicalTab({ incident, op, r, setR }: P) {
  const patients = sortPatients(useTable('patients', incident.id));
  return (
    <section className="card">
      <h3>Medical plan emphasis</h3>
      <div className="cols2">
        <Text label="Level of care on scene (e.g. ACP with rescue team, physician on HFRS)" value={r.careLevel} onCommit={(careLevel) => setR({ careLevel })} />
        <Text label="Hospital pre-alert (who, when, how)" value={r.hospitalPreAlert} onCommit={(hospitalPreAlert) => setR({ hospitalPreAlert })} />
      </div>
      <Check label="Multiple patients: mass casualty triage in use" value={r.massCasualty} onChange={(massCasualty) => setR({ massCasualty })} />
      <Text label="Rescue medical notes (handoff point to EMS, air ambulance rendezvous, cold injury plan)" multiline value={r.medicalNotes} onCommit={(medicalNotes) => setR({ medicalNotes })} />
      <h4>Patients and destinations</h4>
      {patients.length ? <PatientBoard patients={patients} /> : <p className="muted">No patients yet.</p>}
      <h4>Hospitals on the ICS 206</h4>
      <ul>{op.hospitals.map((h, i) => <li key={i}><b>{h.name}</b> · air {h.airTime || '?'} · ground {h.groundTime || '?'}{h.helipad ? ' · helipad' : ''}{h.trauma ? ` · trauma ${h.trauma}` : ''}</li>)}</ul>
      <Link className="no-print" to={`/i/${incident.id}/forms/206`}>Edit the ICS 206 Medical Plan</Link>
    </section>
  );
}

// ---------- Safety ----------
function SafetyTab({ incident, op, r, setR }: P) {
  const zone = useTable('rescueLog', incident.id, op.id).filter((e) => e.kind === 'zone').sort((a, b) => b.time.localeCompare(a.time));
  const inZone = zone.filter((e) => !e.outAt);
  const enter = (person: string, z: string) => person && save<RescueLogEntry>('rescueLog', {
    id: uid(), incidentId: incident.id, opPeriodId: op.id, updatedAt: nowIso(), kind: 'zone', time: nowIso(), person, zone: z, notes: '',
  });
  return (
    <section className="card">
      <h3>Rescuer safety</h3>
      <div className="row gonogo">
        <b>Go / no-go:</b>
        {(['go', 'hold', 'no-go'] as const).map((g) => (
          <button key={g} className={'gng-' + g + (r.goNoGo === g ? ' on' : '')} onClick={() => setR({ goNoGo: g, goNoGoTime: nowIso() })}>{g.toUpperCase()}</button>
        ))}
        <Text value={r.goNoGoBy} placeholder="Decided by" onCommit={(goNoGoBy) => setR({ goNoGoBy })} />
        {r.goNoGoTime && <span className="muted">set {fmt(r.goNoGoTime)}</span>}
      </div>
      <Box title="Hazards and mitigations">
        <RowTable rows={r.hazards} onChange={(hazards) => setR({ hazards })} addLabel="Hazard" blank={{ hazard: '', present: false, mitigation: '' }}
          columns={[{ key: 'present', label: 'Present', type: 'bool', width: '60px' }, { key: 'hazard', label: 'Hazard', width: '28%' }, { key: 'mitigation', label: 'Mitigation' }]} />
      </Box>
      <Box title="Abort / turnaround triggers">
        <StringList items={r.abortTriggers} onChange={(abortTriggers) => setR({ abortTriggers })} numbered addLabel="Trigger" />
      </Box>
      <Text label="Work / rest and rotation plan" multiline value={r.workRest} onCommit={(workRest) => setR({ workRest })} />
      <Box title={`Personnel in the hazard zone (${inZone.length} in now)`}>
        <ZoneEntry onAdd={enter} />
        <table className="grid compact"><thead><tr><th>Person / team</th><th>Zone</th><th>In</th><th>Out</th><th className="no-print" /></tr></thead>
          <tbody>{zone.map((e) => {
            const long = !e.outAt && Date.now() - new Date(e.time).getTime() > 2 * 3600_000;
            return (
              <tr key={e.id} className={long ? 'warn' : !e.outAt ? 'current' : ''}><td>{e.person}</td><td>{e.zone}</td><td>{fmtTime(e.time)}{long ? ' ⚠ over 2 h' : ''}</td>
                <td>{e.outAt ? fmtTime(e.outAt) : <button className="small no-print" onClick={() => patch<RescueLogEntry>('rescueLog', e.id, { outAt: nowIso() })}>Mark out</button>}</td>
                <td className="no-print"><button className="link danger" onClick={() => patch<RescueLogEntry>('rescueLog', e.id, { deleted: true })}>✕</button></td></tr>
            );
          })}</tbody></table>
      </Box>
      <p className="muted small-print">The ICS 208 Safety Message still goes in the IAP; use <Link to={`/i/${incident.id}/forms/208`}>ICS 208</Link> for the briefing version.</p>
    </section>
  );
}

function ZoneEntry({ onAdd }: { onAdd: (person: string, zone: string) => void }) {
  return (
    <form className="row no-print" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      onAdd(String(f.get('p') ?? '').trim(), String(f.get('z') ?? '').trim() || 'Work site');
      e.currentTarget.reset();
    }}>
      <input name="p" placeholder="Person or team" style={{ maxWidth: 220 }} />
      <input name="z" defaultValue="Work site" placeholder="Zone" style={{ maxWidth: 220 }} />
      <button className="small" type="submit">Log entry into zone</button>
    </form>
  );
}
