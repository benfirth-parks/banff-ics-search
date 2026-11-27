// Search map tab: the Lost Person search map builder, fed from the incident's
// forms and kept per operational period. The planning point, direction of
// travel, subject category and terrain live on the Subject profile and are
// shared with it; ring, segment and planned-POD settings are saved per period.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { categories, LPB_CATEGORIES, LPB_TABLE, lookupBehaviour, PERCENTILES, terrains, type BehaviourTable } from './packages/behaviour/src/index.ts';
import {
  buildSearchMap, DEFAULT_TRAIL_OPTIONS, GENERATOR_VERSION, parseTrailFile, searchMapFileName, validateSearchMapInput, type SearchMapInput,
} from './packages/caltopo-export/src/index.ts';
import { formatLatLng, parseCoordinate } from './packages/geospatial/src/coords.ts';
import { BehaviourTablePanel } from './ui/BehaviourTablePanel.tsx';
import { MapPreview } from './ui/MapPreview.tsx';
import { insideCoverage, loadRidgeIndex, loadRidgePolygons, type RidgePolygons } from './ui/ridges.ts';
import { INITIAL_POD_STATE, SegmentPodPanel, segmentPodsFor, type PodState } from './ui/SegmentPodPanel.tsx';
import { useCtx } from '../pages/IncidentLayout';
import { useOpPeriods, useTable } from '../lib/hooks';
import { save, patch, uid, nowIso } from '../db/db';
import type { Assignment, SearchMapRec, Subject } from '../db/types';
import { newAssignment } from '../forms/Ics204';
import './searchmap.css';
import { DEFAULT_SETTINGS } from './defaults';

type Settings = SearchMapRec['settings'];
const PERCENTS = PERCENTILES.map(String);
const num = (s: string) => (s.trim() === '' ? NaN : Number(s));

/** Cumulative POD across periods: 1 − Π(1 − POD). */
export const cumulativePod = (pods: number[]) => 1 - pods.reduce((acc, p) => acc * (1 - p), 1);

export function SearchMapTab() {
  const { incident, op } = useCtx();
  const periods = useOpPeriods(incident.id);
  const subject = useTable('subjects', incident.id)[0];
  const allMaps = useTable('searchMaps', incident.id);
  const allAsg = useTable('assignments', incident.id);
  const [opId, setOpId] = useState(op.id);
  useEffect(() => setOpId(op.id), [op.id]);
  const rec = allMaps.find((m) => m.opPeriodId === opId);
  const viewOp = periods.find((p) => p.id === opId) ?? op;

  if (!subject) return <p>Create the subject profile first.</p>;
  return (
    <div>
      <div className="row no-print toolbar">
        <h2 style={{ margin: 0 }}>Search map</h2>
        <select value={opId} onChange={(e) => setOpId(e.target.value)}>
          {periods.map((p) => <option key={p.id} value={p.id}>Op period {p.number}{p.id === op.id ? ' (current)' : ` (${p.status})`}</option>)}
        </select>
      </div>
      {rec
        ? <Builder key={rec.id} rec={rec} subject={subject} incidentName={incident.name} opNumber={viewOp.number}
            assignments={allAsg} periods={periods.map((p) => ({ id: p.id, number: p.number }))} />
        : (
          <div className="card">
            <p>No search map for op period {viewOp.number} yet. It starts from the planning point and subject details on the <Link to={`/i/${incident.id}/subject`}>Subject profile</Link>.</p>
            <button className="primary" onClick={() => save<SearchMapRec>('searchMaps', {
              id: uid(), incidentId: incident.id, opPeriodId: opId, updatedAt: nowIso(), settings: DEFAULT_SETTINGS, pod: INITIAL_POD_STATE,
            })}>Start search map for op period {viewOp.number}</button>
          </div>
        )}
    </div>
  );
}

function Builder({ rec, subject, incidentName, opNumber, assignments, periods }: {
  rec: SearchMapRec; subject: Subject; incidentName: string; opNumber: number; assignments: Assignment[]; periods: { id: string; number: number }[];
}) {
  const f = rec.settings;
  const table = (rec.table as BehaviourTable | undefined) ?? LPB_TABLE;
  const podState = (rec.pod as PodState | undefined) ?? INITIAL_POD_STATE;
  const trails = rec.trails ?? null;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => patch<SearchMapRec>('searchMaps', rec.id, { settings: { ...f, [k]: v } });
  const setSubject = (c: Partial<Subject>) => patch<Subject>('subjects', subject.id, c);
  const [trailProblem, setTrailProblem] = useState('');
  const [ridges, setRidges] = useState<RidgePolygons | null>(null);
  const [ridgeNote, setRidgeNote] = useState('');

  const coordText = subject.planningCoord ?? '';
  const coord = useMemo(() => (coordText.trim() ? parseCoordinate(coordText) : null), [coordText]);
  const category = subject.category ?? '';
  const terrain = subject.terrain || 'temperate mountainous';
  const bearingText = subject.travelBearing ?? '';

  const toInput = (rid: RidgePolygons | null): { input: SearchMapInput; notes: string[] } => {
    const notes: string[] = [];
    const bearing = bearingText.trim() === '' ? undefined : num(bearingText);
    let rings: SearchMapInput['rings'] = [];
    let ringSource = '';
    let dispersion: NonNullable<SearchMapInput['dispersion']> = [];
    let dispersionSource = '';
    if (f.manual) {
      rings = f.rings.filter((r) => r.value.trim() !== '').map((r) => ({ percent: num(r.percent), distanceKm: num(r.value) }));
      ringSource = f.ringSource;
      dispersion = f.dispersion.filter((r) => r.value.trim() !== '').map((r) => ({ percent: num(r.percent), angleDeg: num(r.value) }));
      dispersionSource = f.dispersionSource;
    } else if (category && terrain) {
      const hit = lookupBehaviour(table, category, terrain);
      if (hit) {
        rings = PERCENTILES.map((p) => ({ percent: p, distanceKm: hit.entry.ringsKm[p] }));
        ringSource = hit.citation;
        if (hit.terrainFallback) notes.push(`No ${terrain} row for ${category}; using its "any" terrain row.`);
        if (hit.entry.dispersionDeg && bearing !== undefined) {
          dispersion = PERCENTILES.map((p) => ({ percent: p, angleDeg: hit.entry.dispersionDeg![p] }));
          dispersionSource = hit.citation;
        } else if (hit.entry.dispersionDeg) notes.push('Add a direction of travel to draw the dispersion wedges.');
      }
    }
    return {
      notes,
      input: {
        label: incidentName.slice(0, 40),
        planningPoint: { lat: coord?.ok ? coord.lat : NaN, lng: coord?.ok ? coord.lng : NaN, kind: subject.planningPointKind ?? 'LKP' },
        travelBearingDeg: bearing, subjectCategory: category || undefined, rings, ringSource, dispersion, dispersionSource,
        segments: f.sectors === '0' || f.sectors === 'ridges' ? undefined : { sectors: Number(f.sectors), inRings: f.segRings.map(num) },
        areas: f.sectors === 'ridges' && rid ? { polygons: rid.polygons, inRings: f.segRings.map(num), source: rid.source } : undefined,
        trails: trails?.lines.length ? { lines: trails.lines, halfWidthM: num(f.trailWidth), pieceLengthM: num(f.trailPiece) * 1000, inRings: f.trailRings.map(num) } : undefined,
      },
    };
  };

  const ridgeNeed = useMemo(() => {
    if (f.sectors !== 'ridges') return null;
    const pre = toInput(null).input;
    const outer = Math.max(0, ...pre.rings.filter((r) => f.segRings.includes(String(r.percent))).map((r) => r.distanceKm * 1000));
    const { lat, lng } = pre.planningPoint;
    return outer > 0 && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, radiusM: outer } : null;
  }, [rec, subject]);
  const ridgeKey = ridgeNeed && `${ridgeNeed.lat},${ridgeNeed.lng},${ridgeNeed.radiusM}`;
  useEffect(() => {
    setRidges(null);
    if (!ridgeNeed) { setRidgeNote(f.sectors === 'ridges' ? 'Enter the planning point and rings, and tick a band, to load the ridge segments.' : ''); return; }
    let alive = true;
    setRidgeNote('Loading ridge segments…');
    (async () => {
      try {
        const index = await loadRidgeIndex();
        if (!insideCoverage(index, ridgeNeed.lat, ridgeNeed.lng)) throw new Error('the planning point is outside the area the ridge data covers');
        const r = await loadRidgePolygons(index, ridgeNeed.lat, ridgeNeed.lng, ridgeNeed.radiusM);
        if (alive) { setRidges(r); setRidgeNote(''); }
      } catch (e) {
        if (alive) setRidgeNote(`No ridge segments: ${(e as Error).message}. Use ring sectors instead.`);
      }
    })();
    return () => { alive = false; };
  }, [ridgeKey, f.sectors]);

  const { input: baseInput, notes } = useMemo(() => toInput(ridges), [rec, subject, ridges]);
  const segmentNames = useMemo(() => {
    if (validateSearchMapInput(baseInput).length) return [];
    return buildSearchMap(baseInput).features.filter((x) => x.properties.class === 'Assignment').map((x) => String(x.properties.title));
  }, [baseInput]);
  const input = useMemo<SearchMapInput>(() => {
    const p = segmentPodsFor(podState, segmentNames);
    return p ? { ...baseInput, segmentPods: p.pods, segmentPodSource: p.source } : baseInput;
  }, [baseInput, podState, segmentNames]);
  const errors = useMemo(() => {
    const e = validateSearchMapInput(input);
    if (!coord?.ok) e.unshift('enter the planning point coordinates (Subject profile or below)');
    if (!f.manual && !input.rings.length)
      e.unshift(category && terrain ? `${table.name} has no ${terrain} figures for ${category}; load them or enter values by hand` : 'choose a subject category and terrain to look up the rings');
    return [...new Set(e.filter((x) => !(x.startsWith('ring source') && !f.manual && !input.rings.length)).filter((x) => !(x.startsWith('planning point') && !coord?.ok)))];
  }, [input, f.manual, category, terrain, table.name, coord]);
  const map = useMemo(() => (errors.length ? null : buildSearchMap(input)), [errors, input]);
  const counts = map && {
    rings: map.features.filter((x) => x.geometry?.type === 'LineString').length,
    segments: map.features.filter((x) => x.properties.class === 'Assignment').length,
  };

  // Searched so far: debriefed assignments whose segment matches a map segment, across all periods.
  const searched = useMemo(() => {
    const out: Record<string, { periods: number[]; pods: number[]; open: string[] }> = {};
    for (const n of segmentNames) out[n] = { periods: [], pods: [], open: [] };
    for (const a of assignments) {
      const s = out[a.segment.trim()];
      if (!s) continue;
      const pn = periods.find((p) => p.id === a.opPeriodId)?.number ?? 0;
      if (a.debrief) {
        s.periods.push(pn);
        const p = Number(a.debrief.podAchieved);
        if (Number.isFinite(p) && a.debrief.podAchieved?.trim()) s.pods.push(Math.min(Math.max(p, 0), 100) / 100);
      } else if (a.opPeriodId === rec.opPeriodId) s.open.push(a.number);
    }
    return out;
  }, [assignments, segmentNames, periods, rec.opPeriodId]);

  const thisPeriodAsg = assignments.filter((a) => a.opPeriodId === rec.opPeriodId);
  const unassigned = segmentNames.filter((n) => !thisPeriodAsg.some((a) => a.segment.trim() === n));
  const createAssignments = async (names: string[]) => {
    let n = thisPeriodAsg.length;
    for (const name of names) {
      n += 1;
      const plan = input.segmentPods?.[name];
      await save('assignments', {
        ...newAssignment(rec.incidentId, rec.opPeriodId, n), segment: name,
        work: `Search segment ${name}.${plan ? ` Planned POD (responsive): ${plan.responsivePOD}.` : ''}`,
      });
    }
  };

  async function readTrails(file: File | undefined) {
    if (!file) return;
    try {
      const r = parseTrailFile(await file.text());
      if (!r.lines.length) throw new Error('no trail lines found in the file');
      await patch<SearchMapRec>('searchMaps', rec.id, { trails: { name: file.name, ...r } });
      setTrailProblem('');
    } catch (e) { setTrailProblem(`${file.name}: ${(e as Error).message}`); }
  }
  function download() {
    if (!map) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(map)], { type: 'application/json' }));
    a.download = searchMapFileName(input).replace(/\.json$/, `-op${opNumber}.json`);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  }
  const switchToManual = () => patch<SearchMapRec>('searchMaps', rec.id, { settings: {
    ...f, manual: true,
    rings: PERCENTS.map((p) => ({ percent: p, value: String(input.rings.find((r) => String(r.percent) === p)?.distanceKm ?? '') })),
    ringSource: input.ringSource,
    dispersion: PERCENTS.map((p) => ({ percent: p, value: String(input.dispersion?.find((r) => String(r.percent) === p)?.angleDeg ?? '') })),
    dispersionSource: input.dispersionSource ?? '',
  } });

  const withFigures = categories(table);
  const cats = [...new Set([...withFigures, ...(table === LPB_TABLE ? LPB_CATEGORIES : [])])];
  const terrs = terrains(table, category || undefined).filter((t) => t !== 'any');

  return (
    <div className="sm-grid">
      <div className="sm-form card">
        <h3>1 · From the forms</h3>
        <p className="cap">These come from the Subject profile and are shared with it. Changing them here changes the profile.</p>
        <label className="field"><span>Planning point coordinates (decimal degrees, deg-min or UTM)</span>
          <input value={coordText} placeholder="51.2034, -115.6120  or  11U 594123 5677123" onChange={(e) => setSubject({ planningCoord: e.target.value })} /></label>
        {coord && <p className={'cap ' + (coord.ok ? '' : 'sm-doc-bad')}>{coord.ok ? <>Read as <b className="mono">{formatLatLng(coord.lat, coord.lng)}</b> ({coord.format}). {coord.warnings.join(' ')}</> : <>Could not read: {coord.error}.</>}</p>}
        <div className="sm-row">
          <label className="field"><span>Point</span>
            <select value={subject.planningPointKind ?? 'LKP'} onChange={(e) => setSubject({ planningPointKind: e.target.value as Subject['planningPointKind'] })}>
              <option>IPP</option><option>LKP</option><option>PLS</option>
            </select></label>
          <label className="field"><span>Direction of travel (° true)</span>
            <input inputMode="decimal" value={bearingText} placeholder="blank if unknown" onChange={(e) => setSubject({ travelBearing: e.target.value })} /></label>
        </div>
        <div className="sm-row">
          <label className="field"><span>Subject category</span>
            <select value={category} onChange={(e) => setSubject({ category: e.target.value })}>
              <option value="">Choose</option>
              {cats.map((c) => <option key={c} value={c}>{c}{withFigures.includes(c) ? '' : ' (no figures loaded)'}</option>)}
            </select></label>
          <label className="field"><span>Terrain</span>
            <select value={terrain} onChange={(e) => setSubject({ terrain: e.target.value })}>
              {[...new Set([...terrs, terrain])].map((t) => <option key={t} value={t}>{t}</option>)}
            </select></label>
        </div>
        <p className="cap">Last seen: {subject.lastSeenLocation || '—'} · {subject.lastSeenTime || '—'}</p>

        <h3>2 · Rings and dispersion</h3>
        <BehaviourTablePanel table={table} onChange={(t) => patch<SearchMapRec>('searchMaps', rec.id, { table: t })} />
        {f.manual ? (
          <>
            <ManualRows rows={f.rings} onChange={(r) => set('rings', r)} label="Distance (km)" />
            <label className="field"><span>Source of these distances</span><input value={f.ringSource} onChange={(e) => set('ringSource', e.target.value)} /></label>
            <ManualRows rows={f.dispersion} onChange={(r) => set('dispersion', r)} label="Angle (°)" />
            <label className="field"><span>Source of these angles</span><input value={f.dispersionSource} onChange={(e) => set('dispersionSource', e.target.value)} /></label>
            <button className="link" onClick={() => set('manual', false)}>Use the behaviour table again</button>
          </>
        ) : (
          <>
            {input.rings.length > 0 && (
              <table className="grid compact"><thead><tr><th>% of finds</th><th>Ring (km)</th><th>Dispersion (°)</th></tr></thead>
                <tbody>{input.rings.map((r) => <tr key={r.percent}><td>{r.percent}%</td><td>{r.distanceKm}</td><td>{input.dispersion?.find((d) => d.percent === r.percent)?.angleDeg ?? '–'}</td></tr>)}</tbody>
              </table>
            )}
            {input.ringSource && <p className="cap">{input.ringSource}</p>}
            <button className="link" onClick={switchToManual}>Enter values by hand instead</button>
          </>
        )}
        {notes.map((n) => <p key={n} className="cap">{n}</p>)}

        <h3>3 · Segments</h3>
        <label className="field"><span>Area segments</span>
          <select value={f.sectors} onChange={(e) => set('sectors', e.target.value)}>
            <option value="0">None</option><option value="4">4 ring sectors</option><option value="8">8 ring sectors</option>
            <option value="12">12 ring sectors</option><option value="16">16 ring sectors</option><option value="ridges">Ridges and creeks (needs terrain data)</option>
          </select></label>
        <Bands chosen={f.segRings} onChange={(v) => set('segRings', v)} disabled={f.sectors === '0'} />
        {ridgeNote && <p className="cap">{ridgeNote}</p>}
        <label className="field"><span>Trails file (GPX or GeoJSON, e.g. a CalTopo export of trail lines)</span>
          <input type="file" accept=".gpx,.json,.geojson" onChange={(e) => readTrails(e.target.files?.[0])} /></label>
        {trails && <p className="cap">{trails.name}: {trails.lines.length} lines. <button className="link" onClick={() => patch<SearchMapRec>('searchMaps', rec.id, { trails: undefined })}>Remove</button></p>}
        {trailProblem && <p className="sm-doc-bad">{trailProblem}</p>}
        {trails && (
          <>
            <div className="sm-row">
              <label className="field"><span>Metres either side</span><input value={f.trailWidth} onChange={(e) => set('trailWidth', e.target.value)} /></label>
              <label className="field"><span>Piece length (km)</span><input value={f.trailPiece} onChange={(e) => set('trailPiece', e.target.value)} /></label>
            </div>
            <Bands chosen={f.trailRings} onChange={(v) => set('trailRings', v)} />
          </>
        )}

        <SegmentPodPanel state={podState} onChange={(s) => patch<SearchMapRec>('searchMaps', rec.id, { pod: s })} names={segmentNames} />
      </div>

      <div className="sm-out">
        {map && counts ? (
          <>
            <MapPreview map={map} input={input} />
            <p className="meta">Op period {opNumber} · {counts.rings} rings · {counts.segments} segments · {GENERATOR_VERSION}</p>
            {table.kind === 'exercise' && !f.manual && <p className="sm-exercise">Exercise values. Load a behaviour table from a real source before using these rings for anything but training.</p>}
            <div className="row">
              <button className="primary" onClick={download}>Download CalTopo file</button>
              {unassigned.length > 0 && <button onClick={() => createAssignments(unassigned)}>Create 204s for {unassigned.length} unassigned segments</button>}
            </div>
            <div className="card">
              <h3>Segments: this period and searched so far</h3>
              <div className="table-wrap"><table className="grid compact">
                <thead><tr><th>Segment</th><th>Planned POD</th><th>204 this period</th><th>Searched in periods</th><th>Cumulative POD</th></tr></thead>
                <tbody>{segmentNames.map((n) => {
                  const s = searched[n]!;
                  const a = thisPeriodAsg.find((x) => x.segment.trim() === n);
                  return (
                    <tr key={n}>
                      <td>{n}</td><td>{input.segmentPods?.[n]?.responsivePOD ?? '–'}</td>
                      <td>{a ? <Link to={`/i/${rec.incidentId}/forms/204`}>#{a.number} ({a.status})</Link> : <button className="small" onClick={() => createAssignments([n])}>Create 204</button>}</td>
                      <td>{s.periods.length ? [...new Set(s.periods)].sort().join(', ') : '—'}</td>
                      <td>{s.pods.length ? `${Math.round(cumulativePod(s.pods) * 100)}%` : '—'}</td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
              <p className="cap">Cumulative POD = 1 − Π(1 − POD) over every debrief that gave a POD estimate for the segment, in any op period. These are team estimates of achieved coverage, not planned values.</p>
            </div>
          </>
        ) : (
          <div className="sm-todo card"><b>To build the map:</b><ul>{errors.map((e) => <li key={e}>{e.charAt(0).toUpperCase() + e.slice(1)}.</li>)}</ul></div>
        )}
      </div>
    </div>
  );
}

function ManualRows({ rows, onChange, label }: { rows: { percent: string; value: string }[]; onChange: (r: { percent: string; value: string }[]) => void; label: string }) {
  return (
    <table className="grid compact"><thead><tr><th>% of finds</th><th>{label}</th></tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={r.percent}><td>{r.percent}%</td>
          <td><input inputMode="decimal" value={r.value} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} /></td></tr>
      ))}</tbody>
    </table>
  );
}

function Bands({ chosen, onChange, disabled }: { chosen: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <fieldset className="sm-bands" disabled={disabled}>
      <legend>In ring bands</legend>
      {PERCENTS.map((p, i) => (
        <label key={p} className="sm-check">
          <input type="checkbox" checked={chosen.includes(p)}
            onChange={(e) => onChange(e.target.checked ? PERCENTS.filter((q) => q === p || chosen.includes(q)) : chosen.filter((q) => q !== p))} />
          {i === 0 ? `0 to ${p}%` : `${PERCENTS[i - 1]} to ${p}%`}
        </label>
      ))}
    </fieldset>
  );
}
