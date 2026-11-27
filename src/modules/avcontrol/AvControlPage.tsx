// Avalanche control tab: plan, closures, go/no-go, shot log, explosives and all clear.
import { useState } from 'react';
import { useCtx } from '../../pages/IncidentLayout';
import { useTable } from '../../lib/hooks';
import { patch, nowIso } from '../../db/db';
import type { OpPeriod } from '../../db/types';
import { Text, Select, Check, fmtTime } from '../../components/ui';
import {
  type AvControlRec, type Closure, type Target, type ClosureStatus, type ShotStatus,
  HAZARD, METHODS, TRIGGER, RESULTS, SIZES, RUNOUTS, CLOSURE_KINDS, GO_NO_GO,
  status, blankClosure, blankTarget, startFromPrevious,
} from './model';

const CLOSURE_NEXT: Record<ClosureStatus, [ClosureStatus, string, keyof Closure][]> = {
  planned: [['closed', 'Closed', 'closedAt']],
  closed: [['swept', 'Swept clear', 'sweptAt']],
  swept: [['reopened', 'Reopen', 'reopenedAt']],
  reopened: [],
};
const SHOT_LABEL: Record<ShotStatus, string> = {
  planned: 'Planned', fired: 'Fired', misfire: 'MISFIRE', 'misfire-cleared': 'Misfire cleared', skipped: 'Skipped',
};

/** Appends a line to the ICS 201 actions log for this period. */
export async function logAction(op: OpPeriod, action: string) {
  await patch<OpPeriod>('opPeriods', op.id, { actions: [...op.actions, { time: nowIso(), action }] });
}

export function useAvControl(incidentId: string, opPeriodId: string) {
  return useTable('avControl', incidentId, opPeriodId)[0];
}

export function AvControlPage() {
  const { incident, op } = useCtx();
  const rec = useAvControl(incident.id, op.id);
  const others = useTable('avControl', incident.id).length;
  if (!rec) {
    return (
      <section className="card">
        <h2>Avalanche control</h2>
        <p className="muted">No control plan for this operational period yet.</p>
        <button className="primary" onClick={() => startFromPrevious(incident.id, op.id)}>
          {others ? 'Start from the previous period\'s plan' : 'Start a control plan'}
        </button>
        {others > 0 && <p className="muted small-print">Carries over the area, hazard, closures still in place, targets not yet shot and any misfires not cleared.</p>}
      </section>
    );
  }
  return <Mission rec={rec} op={op} />;
}

function Mission({ rec, op }: { rec: AvControlRec; op: OpPeriod }) {
  const up = (c: Partial<AvControlRec>) => patch<AvControlRec>('avControl', rec.id, c);
  const st = status(rec);
  const [who, setWho] = useState('');
  const setClosure = (id: string, c: Partial<Closure>) => up({ closures: rec.closures.map((x) => (x.id === id ? { ...x, ...c } : x)) });
  const setTarget = (id: string, c: Partial<Target>) => up({ targets: rec.targets.map((x) => (x.id === id ? { ...x, ...c } : x)) });
  const allGo = GO_NO_GO.every(([k]) => rec.goNoGo[k]);

  const shoot = async (t: Target, s: ShotStatus) => {
    await setTarget(t.id, { status: s, firedAt: s === 'planned' ? undefined : s === 'misfire-cleared' ? t.firedAt : nowIso() });
    const label = `${t.path || 'Path'}${t.target ? ' / ' + t.target : ''}`;
    if (s === 'misfire') await logAction(op, `MISFIRE on ${label}. Path stays closed until cleared.`);
    if (s === 'misfire-cleared') await logAction(op, `Misfire on ${label} cleared.`);
  };

  return (
    <div className="avc">
      <section className={'card avc-status ' + (st.misfires ? 'alarm' : st.phase === 'Reopened' ? 'ok' : '')}>
        <div className="stats">
          <div className="stat"><b>{st.phase}</b><span>Mission status</span></div>
          <div className="stat"><b>{st.closed}/{st.total}</b><span>Closures in place</span></div>
          <div className="stat"><b>{st.done}/{st.targets}</b><span>Targets done</span></div>
          <div className="stat"><b className={st.misfires ? 'danger' : ''}>{st.misfires}</b><span>Misfires outstanding</span></div>
        </div>
        {st.misfires > 0 && <p className="notice"><b>Misfire on the slope.</b> Keep the affected path closed and follow the misfire procedure before anyone enters the runout.</p>}
      </section>

      <div className="cols2">
        <section className="card">
          <h3>1. Control plan</h3>
          <Text label="Control area / route" value={rec.area} onCommit={(v) => up({ area: v })} placeholder="e.g. Hwy 93N, km 0 to 40" />
          <div className="cols3">
            {(['alpine', 'treeline', 'below'] as const).map((k) => (
              <Select key={k} label={`Danger: ${k === 'below' ? 'below treeline' : k}`} value={rec.hazard[k]} options={HAZARD} onChange={(v) => up({ hazard: { ...rec.hazard, [k]: v } })} />
            ))}
          </div>
          <Text label="Avalanche problems" value={rec.problems} onCommit={(v) => up({ problems: v })} multiline rows={2} placeholder="e.g. Storm slab, wind slab on N-E aspects" />
          <Text label="Control objective" value={rec.objective} onCommit={(v) => up({ objective: v })} multiline rows={2} />
          <div className="cols2">
            <Text label="Blaster in charge" value={rec.blaster} onCommit={(v) => up({ blaster: v })} />
            <Text label="Helicopter / delivery" value={rec.aircraft} onCommit={(v) => up({ aircraft: v })} placeholder="e.g. Bell 407 C-GABC" />
          </div>
        </section>

        <section className="card">
          <h3>3. Go / no-go</h3>
          {GO_NO_GO.map(([k, label]) => (
            <div key={k}><Check label={label} value={!!rec.goNoGo[k]} onChange={(v) => up({ goNoGo: { ...rec.goNoGo, [k]: v } })} /></div>
          ))}
          {rec.goDecision
            ? <p className="ok-text"><b>GO</b> given at {fmtTime(rec.goDecision.at)} by {rec.goDecision.by}. <button className="link danger" onClick={() => up({ goDecision: undefined })}>Withdraw</button></p>
            : (
              <div className="row">
                <input placeholder="Your name" value={who} onChange={(e) => setWho(e.target.value)} />
                <button className="primary" disabled={!allGo || !who} onClick={async () => {
                  await up({ goDecision: { at: nowIso(), by: who } });
                  await logAction(op, `Avalanche control GO given by ${who}${rec.area ? ' for ' + rec.area : ''}.`);
                }}>Give GO</button>
              </div>
            )}
          {!allGo && !rec.goDecision && <p className="muted small-print">Tick every item to give the GO.</p>}
        </section>
      </div>

      <section className="card">
        <h3>2. Closures</h3>
        <div className="table-wrap">
          <table className="grid">
            <thead><tr><th>Location</th><th>Type</th><th>Guard / team</th><th>Call sign</th><th>Status</th><th>Closed</th><th>Swept</th><th>Reopened</th><th>Notes</th><th className="no-print" /></tr></thead>
            <tbody>{rec.closures.map((c) => (
              <tr key={c.id} className={c.status === 'planned' ? '' : c.status === 'reopened' ? 'avc-done' : 'avc-live'}>
                <td><Text value={c.location} onCommit={(v) => setClosure(c.id, { location: v })} /></td>
                <td><Select value={c.kind} options={CLOSURE_KINDS} onChange={(v) => setClosure(c.id, { kind: v })} /></td>
                <td><Text value={c.guard} onCommit={(v) => setClosure(c.id, { guard: v })} /></td>
                <td><Text value={c.callSign} onCommit={(v) => setClosure(c.id, { callSign: v })} /></td>
                <td><span className="tag">{c.status}</span>{' '}
                  {CLOSURE_NEXT[c.status].map(([s, label, field]) => (
                    <button key={s} className="small no-print" onClick={() => setClosure(c.id, { status: s, [field]: nowIso() })}>{label}</button>
                  ))}</td>
                <td>{fmtTime(c.closedAt)}</td><td>{fmtTime(c.sweptAt)}</td><td>{fmtTime(c.reopenedAt)}</td>
                <td><Text value={c.notes} onCommit={(v) => setClosure(c.id, { notes: v })} /></td>
                <td className="no-print"><button className="link danger" onClick={() => up({ closures: rec.closures.filter((x) => x.id !== c.id) })}>✕</button></td>
              </tr>
            ))}</tbody>
          </table>
          <button className="small no-print" onClick={() => up({ closures: [...rec.closures, blankClosure()] })}>+ Add closure</button>
        </div>
        <p className="muted small-print">Guards can also mark their closure from the Field view on their phone.</p>
      </section>

      <section className="card">
        <h3>4. Targets and shot log</h3>
        <div className="table-wrap">
          <table className="grid avc-targets">
            <thead><tr><th>Path</th><th>Target</th><th>Method</th><th>Charges</th><th>Charge size</th><th>Shot</th><th>Time</th><th>Result</th><th>Size</th><th>Runout</th><th>Depth on road (m)</th><th>Notes</th><th className="no-print" /></tr></thead>
            <tbody>{rec.targets.map((t) => (
              <tr key={t.id} className={t.status === 'misfire' ? 'avc-misfire' : t.status === 'planned' ? '' : 'avc-done'}>
                <td><Text value={t.path} onCommit={(v) => setTarget(t.id, { path: v })} /></td>
                <td><Text value={t.target} onCommit={(v) => setTarget(t.id, { target: v })} /></td>
                <td><Select value={t.method} options={METHODS} onChange={(v) => setTarget(t.id, { method: v })} /></td>
                <td className="num"><Text value={t.charges} onCommit={(v) => setTarget(t.id, { charges: v })} /></td>
                <td><Text value={t.chargeSize} onCommit={(v) => setTarget(t.id, { chargeSize: v })} /></td>
                <td className="avc-shot">
                  <span className={'tag' + (t.status === 'misfire' ? ' tag-danger' : '')}>{SHOT_LABEL[t.status]}</span>
                  <span className="no-print">
                    {t.status === 'planned' && <>
                      <button className="small" onClick={() => shoot(t, 'fired')}>Fired</button>
                      <button className="small danger" onClick={() => shoot(t, 'misfire')}>Misfire</button>
                      <button className="small" onClick={() => shoot(t, 'skipped')}>Skip</button>
                    </>}
                    {t.status === 'misfire' && <button className="small" onClick={() => shoot(t, 'misfire-cleared')}>Cleared</button>}
                    {t.status !== 'planned' && t.status !== 'misfire' && <button className="link small" onClick={() => shoot(t, 'planned')}>undo</button>}
                  </span>
                </td>
                <td>{fmtTime(t.firedAt)}</td>
                <td><Select value={t.result} options={RESULTS} onChange={(v) => setTarget(t.id, { result: v })} /></td>
                <td><Select value={t.size} options={SIZES} onChange={(v) => setTarget(t.id, { size: v })} />{t.size && <span className="muted small-print"> {TRIGGER[t.method] ?? 'X'}</span>}</td>
                <td><Select value={t.runout} options={RUNOUTS} onChange={(v) => setTarget(t.id, { runout: v })} /></td>
                <td className="num"><Text value={t.depositDepth} onCommit={(v) => setTarget(t.id, { depositDepth: v })} /></td>
                <td><Text value={t.notes} onCommit={(v) => setTarget(t.id, { notes: v })} /></td>
                <td className="no-print"><button className="link danger" onClick={() => up({ targets: rec.targets.filter((x) => x.id !== t.id) })}>✕</button></td>
              </tr>
            ))}</tbody>
          </table>
          <button className="small no-print" onClick={() => up({ targets: [...rec.targets, blankTarget()] })}>+ Add target</button>
        </div>
        <p className="muted small-print">Size is the Canadian size (1 to 5). The trigger code beside it (Xh, Xe, Xl, Xr, Xc) comes from the method, for the avalanche observation record.</p>
      </section>

      <div className="cols2">
        <section className="card">
          <h3>5. Explosives accountability</h3>
          <div className="cols2">
            <Text label="Magazine / source" value={rec.explosives.magazine} onCommit={(v) => up({ explosives: { ...rec.explosives, magazine: v } })} />
            <Text label="Checked by" value={rec.explosives.checkedBy} onCommit={(v) => up({ explosives: { ...rec.explosives, checkedBy: v } })} />
            <Text label="Charges issued" value={rec.explosives.issued} onCommit={(v) => up({ explosives: { ...rec.explosives, issued: v } })} type="number" />
            <Text label="Charges returned to magazine" value={rec.explosives.returned} onCommit={(v) => up({ explosives: { ...rec.explosives, returned: v } })} type="number" />
          </div>
          <table className="grid compact">
            <tbody>
              <tr><td>Issued</td><td className="num">{rec.explosives.issued || '—'}</td></tr>
              <tr><td>Used (fired and cleared misfires, from the shot log)</td><td className="num">{st.used}</td></tr>
              <tr><td>Still on the slope (uncleared misfires)</td><td className="num">{st.outstanding}</td></tr>
              <tr><td>Returned</td><td className="num">{rec.explosives.returned || '0'}</td></tr>
              <tr className={st.balance !== 0 && rec.explosives.issued ? 'warn' : ''}><td><b>Unaccounted</b></td><td className="num"><b>{rec.explosives.issued ? st.balance : '—'}</b></td></tr>
            </tbody>
          </table>
        </section>

        <section className="card">
          <h3>6. Clean-up and all clear</h3>
          <Text label="Debris clearing, plowing and sweep notes" value={rec.cleanup} onCommit={(v) => up({ cleanup: v })} multiline rows={3} />
          <Check label="Road and runouts inspected, debris cleared" value={!!rec.roadClear} onChange={(v) => up({ roadClear: v })} />
          {rec.allClear ? (
            <p className="ok-text"><b>All clear</b> at {fmtTime(rec.allClear.at)} by {rec.allClear.by}. Closures reopened. <button className="link danger" onClick={() => up({ allClear: undefined })}>Undo</button></p>
          ) : (
            <>
              {st.blockers.length > 0
                ? <ul className="avc-blockers">{st.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
                : <p className="ok-text">All checks pass: every target is done, no misfires, explosives balance, road cleared.</p>}
              <div className="row">
                <input placeholder="Your name" value={who} onChange={(e) => setWho(e.target.value)} />
                <button className="primary" disabled={st.blockers.length > 0 || !who} onClick={async () => {
                  const at = nowIso();
                  await up({ allClear: { at, by: who }, closures: rec.closures.map((c) => (c.status === 'reopened' ? c : { ...c, status: 'reopened', reopenedAt: at })) });
                  await logAction(op, `Avalanche control complete. All clear given by ${who}; closures reopened.`);
                }}>All clear: reopen</button>
              </div>
            </>
          )}
        </section>
      </div>
      <p className="no-print"><button onClick={() => window.print()}>Print control record</button></p>
    </div>
  );
}
