// Large avalanche incident: site & hazard, involved parties (burials), debris
// search areas, patient triage and the rescue-phase checklist.
import { useState } from 'react';
import { useCtx } from '../pages/IncidentLayout';
import { useTable } from '../lib/hooks';
import { nowIso, softDelete } from '../db/db';
import { Text, Select, Check, fmt, fmtTime, toLocalInput, fromLocalInput } from '../components/ui';
import { useAvy, useNow, patchSite, patchParty, patchArea, addParty, addArea, minsLabel } from './hooks';
import {
  STATUS_LABEL, STILL_MISSING, TRIAGE_LABEL, AREA_METHODS, burialMinutes, burialPhase,
  type AvySite, type AvyParty, type AvyArea, type PartyStatus, type Triage,
} from './types';
import './avalanche.css';

type Tab = 'board' | 'parties' | 'areas' | 'patients' | 'site' | 'checklist';
const TABS: [Tab, string][] = [
  ['board', 'Status board'], ['parties', 'Involved parties'], ['areas', 'Debris search areas'],
  ['patients', 'Patients & triage'], ['site', 'Site & rescuer safety'], ['checklist', 'Rescue checklist'],
];
const DANGER = ['', '1 Low', '2 Moderate', '3 Considerable', '4 High', '5 Extreme'];

export function AvalanchePage() {
  const { incident, op } = useCtx();
  const { site, parties, areas } = useAvy(incident.id);
  const teams = useTable('teams', incident.id, op.id);
  const now = useNow();
  const [tab, setTab] = useState<Tab>('board');
  if (!site) return <p>Loading avalanche site…</p>;
  const teamOpts = teams.map((t) => ({ value: t.id, label: t.name }));
  return (
    <div className="avy">
      <AvyHeader site={site} parties={parties} now={now} />
      <div className="subtabs toolbar">
        {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        <button onClick={() => window.print()} className="no-print">Print</button>
      </div>
      {tab === 'board' && <Board site={site} parties={parties} areas={areas} now={now} teams={teams} />}
      {tab === 'parties' && <Parties incidentId={incident.id} site={site} parties={parties} areas={areas} now={now} />}
      {tab === 'areas' && <Areas incidentId={incident.id} areas={areas} parties={parties} teamOpts={teamOpts} />}
      {tab === 'patients' && <Patients parties={parties} site={site} now={now} hospitals={op.hospitals.map((h) => h.name)} />}
      {tab === 'site' && <SitePanel site={site} />}
      {tab === 'checklist' && <Checklist site={site} />}
    </div>
  );
}

function AvyHeader({ site, parties, now }: { site: AvySite; parties: AvyParty[]; now: number }) {
  const missing = parties.filter((p) => STILL_MISSING.includes(p.status)).length;
  const elapsed = site.avalancheTime ? Math.round((now - new Date(site.avalancheTime).getTime()) / 60000) : null;
  const onDebris = site.onDebris.filter((r) => !r.outAt).length;
  const max = Number(site.maxOnDebris) || 0;
  return (
    <div className="stats avy-stats">
      <div className="stat"><b>{minsLabel(elapsed)}</b><span>Since avalanche{site.avalancheTime ? ` (${fmtTime(site.avalancheTime)})` : ': set time on Site tab'}</span></div>
      <div className={'stat ' + (missing ? 'stat-bad' : 'stat-ok')}><b>{missing}</b><span>Still missing / buried of {parties.length} involved</span></div>
      <div className={'stat ' + (site.overheadLevel === 'high' ? 'stat-bad' : site.overheadLevel === 'moderate' ? 'stat-warn' : '')}>
        <b className="cap">{site.overheadLevel === 'unknown' ? '?' : site.overheadLevel}</b><span>Overhead hazard · guard: {site.guardName || <em>not posted</em>}</span>
      </div>
      <div className={'stat ' + (max && onDebris > max ? 'stat-bad' : '')}><b>{onDebris}{max ? `/${max}` : ''}</b><span>Rescuers on debris</span></div>
    </div>
  );
}

function Board({ site, parties, areas, now, teams }: { site: AvySite; parties: AvyParty[]; areas: AvyArea[]; now: number; teams: { id: string; name: string }[] }) {
  const tri = (t: Triage) => parties.filter((p) => p.triage === t).length;
  return (
    <div className="cols2">
      <section className="card">
        <h3>Involved parties</h3>
        {parties.length === 0 ? <p className="muted">No parties yet. Add them on the Involved parties tab.</p> : (
          <table className="grid compact"><thead><tr><th>#</th><th>Name</th><th>Status</th><th>Buried</th><th>Triage</th></tr></thead>
            <tbody>{parties.map((p) => {
              const m = burialMinutes(site, p, now);
              return (
                <tr key={p.id} className={STILL_MISSING.includes(p.status) ? 'warn' : ''}>
                  <td><b>{p.label}</b></td><td>{p.name || <span className="muted">{p.description || 'unknown'}</span>}</td>
                  <td>{STATUS_LABEL[p.status]}</td>
                  <td>{m == null ? '—' : <span className={'phase ' + burialPhase(m).cls}>{minsLabel(m)}</span>}</td>
                  <td>{p.triage ? <span className={'triage t-' + p.triage}>{p.triage}</span> : ''}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
        <h3>Triage</h3>
        <div className="row">{(['red', 'yellow', 'green', 'black'] as const).map((t) => <span key={t} className={'triage t-' + t}>{t}: {tri(t)}</span>)}</div>
      </section>
      <section className="card">
        <h3>Debris search areas</h3>
        {areas.length === 0 ? <p className="muted">No areas yet.</p> : (
          <table className="grid compact"><thead><tr><th>Area</th><th>Method</th><th>Team</th><th>Status</th><th>Cov.</th></tr></thead>
            <tbody>{areas.map((a) => (
              <tr key={a.id} className={a.priority === 'high' && a.status !== 'complete' ? 'warn' : ''}>
                <td><b>{a.name}</b> <span className="muted">{a.priority}</span></td><td>{a.method}</td>
                <td>{teams.find((t) => t.id === a.teamId)?.name ?? a.teamText}</td><td>{a.status}</td><td>{a.coverage && `${a.coverage}%`}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
        <h3>Rescuer safety</h3>
        <p><b>Guard:</b> {site.guardName || '—'} {site.guardPosition && `at ${site.guardPosition}`} {site.guardChannel && `· ${site.guardChannel}`}</p>
        <p><b>Alarm:</b> {site.alarmSignal || '—'}</p>
        <p><b>Escape / safe zone:</b> {site.escapeRoutes || '—'} {site.safeZone && `→ ${site.safeZone}`}</p>
        <h3>Next rescue steps</h3>
        <ul className="feed">{site.checklist.filter((c) => !c.done).slice(0, 4).map((c) => <li key={c.key}>☐ {c.text}</li>)}</ul>
      </section>
    </div>
  );
}

const STATUS_OPTS = (Object.keys(STATUS_LABEL) as PartyStatus[]).map((k) => ({ value: k, label: STATUS_LABEL[k] }));

function Parties({ incidentId, site, parties, areas, now }: { incidentId: string; site: AvySite; parties: AvyParty[]; areas: AvyArea[]; now: number }) {
  return (
    <div>
      <p className="muted no-print">One row per person caught, involved or reported. Keep unconfirmed reports as "Unaccounted for" until they are confirmed safe.</p>
      {parties.map((p) => <PartyCard key={p.id} p={p} site={site} areas={areas} now={now} />)}
      <button className="primary no-print" onClick={() => addParty(incidentId, parties)}>+ Add involved party</button>
    </div>
  );
}

function PartyCard({ p, site, areas, now }: { p: AvyParty; site: AvySite; areas: AvyArea[]; now: number }) {
  const set = (c: Partial<AvyParty>) => patchParty(p.id, c);
  const m = burialMinutes(site, p, now);
  return (
    <section className={'card party ' + (STILL_MISSING.includes(p.status) ? 'party-missing' : '')}>
      <div className="row party-head">
        <b className="party-label">{p.label}</b>
        <Text value={p.name} onCommit={(v) => set({ name: v })} placeholder="Name (if known)" className="grow" />
        <Select value={p.status} options={STATUS_OPTS} onChange={(v) => set({ status: v as PartyStatus })} />
        {m != null && <span className={'phase ' + burialPhase(m).cls} title={burialPhase(m).label}>Buried {minsLabel(m)}</span>}
      </div>
      <div className="row no-print quick">
        <button className="small" onClick={() => set({ status: 'located-buried', locatedAt: p.locatedAt ?? nowIso() })}>📍 Located</button>
        <button className="small" onClick={() => set({ status: 'extricating', locatedAt: p.locatedAt ?? nowIso() })}>⛏ Digging</button>
        <button className="small" onClick={() => set({ status: 'extricated', extricatedAt: p.extricatedAt ?? nowIso() })}>✅ Extricated</button>
        <button className="small" onClick={() => set({ status: 'accounted-safe' })}>Accounted for</button>
        <button className="link danger small" onClick={() => confirm(`Remove ${p.label}?`) && softDelete('avyParties', p.id)}>Remove</button>
      </div>
      <div className="cols4">
        <Text label="Description (clothing, gear, group)" value={p.description} onCommit={(v) => set({ description: v })} />
        <Text label="Last seen point" value={p.lastSeen} onCommit={(v) => set({ lastSeen: v })} />
        <Select label="Transceiver" value={p.transceiver} options={['yes', 'no', 'unknown']} onChange={(v) => set({ transceiver: v as AvyParty['transceiver'] })} />
        <Select label="Search area" value={p.areaId ?? ''} blank="—" options={areas.map((a) => ({ value: a.id, label: a.name }))} onChange={(v) => set({ areaId: v || undefined })} />
        <Text label="Located by" value={p.locatedBy} onCommit={(v) => set({ locatedBy: v })} placeholder="e.g. Team 2" />
        <Select label="Located how" value={p.locatedHow} blank="—" options={['Transceiver', 'RECCO', 'Dog', 'Spot probe', 'Probe line', 'Visual / surface clue', 'Shovelling']} onChange={(v) => set({ locatedHow: v })} />
        <Text label="Located at (time)" type="datetime-local" value={toLocalInput(p.locatedAt)} onCommit={(v) => set({ locatedAt: fromLocalInput(v) || undefined })} />
        <Text label="Extricated at (time)" type="datetime-local" value={toLocalInput(p.extricatedAt)} onCommit={(v) => set({ extricatedAt: fromLocalInput(v) || undefined })} />
        <Text label="Burial depth (cm)" value={p.burialDepth} onCommit={(v) => set({ burialDepth: v })} />
        <Text label="Location on debris (flag / coords)" value={p.locationNote} onCommit={(v) => set({ locationNote: v })} />
        <Select label="Airway on uncovering" value={p.airway} blank="—" options={['clear', 'obstructed', 'air-pocket', 'unknown']} onChange={(v) => set({ airway: v as AvyParty['airway'] })} />
        <Check label="RECCO reflector" value={p.recco} onChange={(v) => set({ recco: v })} />
        <Text label="Notes" value={p.notes} onCommit={(v) => set({ notes: v })} />
      </div>
    </section>
  );
}

function Areas({ incidentId, areas, parties, teamOpts }: { incidentId: string; areas: AvyArea[]; parties: AvyParty[]; teamOpts: { value: string; label: string }[] }) {
  return (
    <div>
      <p className="muted no-print">Split the debris into areas (likely burial zones first: below last-seen points, along the flow line, at the toe, around terrain traps and surface clues). Assign a team and method to each.</p>
      <div className="table-wrap">
        <table className="grid">
          <thead><tr><th>Area</th><th>Priority</th><th>Description</th><th>Method</th><th>Team</th><th>Status</th><th>Coverage %</th><th>Notes / finds</th><th className="no-print" /></tr></thead>
          <tbody>{areas.map((a) => {
            const set = (c: Partial<AvyArea>) => patchArea(a.id, c);
            const found = parties.filter((p) => p.areaId === a.id).map((p) => p.label).join(', ');
            return (
              <tr key={a.id}>
                <td className="name-cell"><Text value={a.name} onCommit={(v) => set({ name: v })} /></td>
                <td><Select value={a.priority} options={['high', 'medium', 'low']} onChange={(v) => set({ priority: v as AvyArea['priority'] })} /></td>
                <td><Text value={a.description} multiline rows={1} onCommit={(v) => set({ description: v })} placeholder="e.g. below LSP of P2, 30 x 40 m" /></td>
                <td><Select value={a.method} options={[...AREA_METHODS]} onChange={(v) => set({ method: v })} /></td>
                <td>{teamOpts.length
                  ? <Select value={a.teamId ?? ''} blank="—" options={teamOpts} onChange={(v) => set({ teamId: v || undefined })} />
                  : <Text value={a.teamText} onCommit={(v) => set({ teamText: v })} />}</td>
                <td><Select value={a.status} options={['not-started', 'in-progress', 'complete', 'suspended']} onChange={(v) => set({ status: v as AvyArea['status'] })} /></td>
                <td><Text value={a.coverage} onCommit={(v) => set({ coverage: v })} /></td>
                <td><Text value={a.notes} multiline rows={1} onCommit={(v) => set({ notes: v })} />{found && <div className="muted small-print">Parties: {found}</div>}</td>
                <td className="no-print"><button className="link danger" onClick={() => softDelete('avyAreas', a.id)}>✕</button></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <button className="primary no-print" onClick={() => addArea(incidentId, areas)}>+ Add search area</button>
    </div>
  );
}

const TRIAGE_OPTS = (Object.keys(TRIAGE_LABEL) as Exclude<Triage, ''>[]).map((k) => ({ value: k, label: TRIAGE_LABEL[k] }));

function Patients({ parties, site, now, hospitals }: { parties: AvyParty[]; site: AvySite; now: number; hospitals: string[] }) {
  const pts = parties.filter((p) => ['extricated', 'located-surface', 'self-rescued', 'deceased', 'extricating'].includes(p.status) || p.triage);
  const order: Record<string, number> = { red: 0, yellow: 1, green: 2, black: 3, '': 4 };
  pts.sort((a, b) => order[a.triage]! - order[b.triage]!);
  return (
    <div>
      <p className="muted no-print">Everyone dug out or found appears here. Burial over 35 min with a clear airway: treat as hypothermic, handle gently, horizontal.</p>
      <datalist id="avy-hospitals">{hospitals.map((h) => <option key={h} value={h} />)}</datalist>
      <datalist id="avy-transport">{['Heli (HFRS)', 'Heli (medevac)', 'Toboggan to road', 'Ground ambulance', 'Snowmobile'].map((h) => <option key={h} value={h} />)}</datalist>
      {pts.length === 0 && <p className="muted">No patients yet.</p>}
      <div className="table-wrap">
        <table className="grid">
          <thead><tr><th>#</th><th>Triage</th><th>Buried</th><th>Airway</th><th>Condition / treatment</th><th>Medic</th><th>Transport</th><th>Destination</th><th>Left site</th></tr></thead>
          <tbody>{pts.map((p) => {
            const set = (c: Partial<AvyParty>) => patchParty(p.id, c);
            const m = burialMinutes(site, p, now);
            return (
              <tr key={p.id} className={'tri-row t-' + (p.triage || 'none')}>
                <td><b>{p.label}</b> {p.name}</td>
                <td><Select value={p.triage} blank="—" options={TRIAGE_OPTS} onChange={(v) => set({ triage: v as Triage, ...(v === 'black' ? { status: 'deceased' as const } : {}) })} /></td>
                <td>{minsLabel(m)}{p.burialDepth && ` · ${p.burialDepth} cm`}</td>
                <td>{p.airway || '—'}</td>
                <td><Text value={p.condition} multiline rows={2} onCommit={(v) => set({ condition: v })} placeholder="LOC, injuries, temp, treatment" /></td>
                <td><Text value={p.medic} onCommit={(v) => set({ medic: v })} /></td>
                <td><Text value={p.transport} list="avy-transport" onCommit={(v) => set({ transport: v })} /></td>
                <td><Text value={p.destination} list="avy-hospitals" onCommit={(v) => set({ destination: v })} /></td>
                <td>{p.departedAt ? fmtTime(p.departedAt) : <button className="small no-print" onClick={() => set({ departedAt: nowIso() })}>Departed</button>}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

function SitePanel({ site }: { site: AvySite }) {
  const set = (c: Partial<AvySite>) => patchSite(site.id, c);
  const T = (label: string, k: keyof AvySite, extra: { multiline?: boolean; placeholder?: string } = {}) =>
    <Text label={label} value={site[k] as string} onCommit={(v) => set({ [k]: v } as Partial<AvySite>)} {...extra} />;
  const onNow = site.onDebris.filter((r) => !r.outAt);
  const [nm, setNm] = useState(''); const [tm, setTm] = useState('');
  return (
    <div className="cols2">
      <section className="card">
        <h3>The avalanche</h3>
        <div className="cols2">
          <Text label="Time of avalanche" type="datetime-local" value={toLocalInput(site.avalancheTime)} onCommit={(v) => set({ avalancheTime: fromLocalInput(v) })} />
          <Text label="Time reported" type="datetime-local" value={toLocalInput(site.reportedTime)} onCommit={(v) => set({ reportedTime: fromLocalInput(v) })} />
          {T('Reported by', 'reportedBy')}
          {T('Path / location', 'path')}
          {T('Coordinates', 'coords')}
          <Select label="Size" value={site.size} blank="—" options={['D1', 'D1.5', 'D2', 'D2.5', 'D3', 'D3.5', 'D4', 'D5']} onChange={(v) => set({ size: v })} />
          <Select label="Type" value={site.avyType} blank="—" options={['Storm slab', 'Wind slab', 'Persistent slab', 'Deep persistent slab', 'Wet slab', 'Loose dry', 'Loose wet', 'Cornice', 'Glide']} onChange={(v) => set({ avyType: v })} />
          <Select label="Trigger" value={site.trigger} blank="—" options={['Skier (involved party)', 'Skier (other)', 'Snowmobile', 'Natural', 'Cornice fall', 'Explosive', 'Unknown']} onChange={(v) => set({ trigger: v })} />
          {T('Aspect', 'aspect')}
          {T('Elevation', 'elevation')}
          {T('Debris length (m)', 'debrisLength')}
          {T('Debris width (m)', 'debrisWidth')}
          {T('Debris depth (m)', 'debrisDepth')}
          {T('Number involved (as reported)', 'partiesReported')}
        </div>
        {T('Witness info / last-seen points', 'witnessLastSeen', { multiline: true })}
        {T('Notes', 'notes', { multiline: true })}
      </section>
      <section className="card">
        <h3>Rescuer safety</h3>
        <div className="cols3">
          <Select label="Danger: Alpine" value={site.dangerAlp} options={DANGER} onChange={(v) => set({ dangerAlp: v })} />
          <Select label="Treeline" value={site.dangerTl} options={DANGER} onChange={(v) => set({ dangerTl: v })} />
          <Select label="Below treeline" value={site.dangerBtl} options={DANGER} onChange={(v) => set({ dangerBtl: v })} />
        </div>
        <Select label="Overhead / secondary avalanche hazard" value={site.overheadLevel} options={['unknown', 'low', 'moderate', 'high']} onChange={(v) => set({ overheadLevel: v as AvySite['overheadLevel'] })} />
        {T('Hazard assessment (hang-fire, adjacent paths, cornices)', 'overheadHazard', { multiline: true })}
        {T('Control done (explosives, ski cut, closures)', 'controlDone', { multiline: true })}
        <div className="cols3">
          {T('Avalanche guard / spotter', 'guardName')}
          {T('Guard position', 'guardPosition')}
          {T('Guard radio channel', 'guardChannel')}
        </div>
        {T('Alarm signal', 'alarmSignal')}
        {T('Escape routes', 'escapeRoutes', { multiline: true })}
        {T('Safe zone / staging', 'safeZone')}
        {T('Max rescuers on debris at once', 'maxOnDebris')}
        <h3>Rescuers on debris ({onNow.length})</h3>
        <ul className="feed">{site.onDebris.map((r, i) => (
          <li key={i} className={r.outAt ? 'done' : ''}><b>{r.name}</b> {r.team && `(${r.team})`} in {fmtTime(r.inAt)}{r.outAt ? `, out ${fmtTime(r.outAt)}` : (
            <button className="small no-print" onClick={() => set({ onDebris: site.onDebris.map((x, j) => (j === i ? { ...x, outAt: nowIso() } : x)) })}>Off debris</button>)}</li>
        ))}</ul>
        <div className="row no-print">
          <input placeholder="Rescuer name" value={nm} onChange={(e) => setNm(e.target.value)} />
          <input placeholder="Team" value={tm} onChange={(e) => setTm(e.target.value)} />
          <button disabled={!nm} onClick={() => { set({ onDebris: [...site.onDebris, { name: nm, team: tm, inAt: nowIso() }] }); setNm(''); }}>On debris</button>
        </div>
      </section>
    </div>
  );
}

function Checklist({ site }: { site: AvySite }) {
  const [txt, setTxt] = useState('');
  const set = (checklist: AvySite['checklist']) => patchSite(site.id, { checklist });
  return (
    <section className="card">
      <h3>Rescue phases</h3>
      <ul className="tasks avy-check">{site.checklist.map((c, i) => (
        <li key={c.key} className={c.done ? 'done' : ''}>
          <label className="check"><input type="checkbox" checked={c.done} onChange={(e) => set(site.checklist.map((x, j) => (j === i ? { ...x, done: e.target.checked, time: e.target.checked ? nowIso() : undefined } : x)))} /> {c.text}</label>
          {c.time && <span className="muted small-print"> · {fmt(c.time)}</span>}
        </li>
      ))}</ul>
      <div className="row no-print">
        <input placeholder="Add a task" value={txt} onChange={(e) => setTxt(e.target.value)} />
        <button disabled={!txt} onClick={() => { set([...site.checklist, { key: 'c' + Date.now(), text: txt, done: false }]); setTxt(''); }}>Add</button>
      </div>
    </section>
  );
}
