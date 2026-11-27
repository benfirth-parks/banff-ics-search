import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Text input that keeps its own state while focused and commits (debounced
 * and on blur) so live database updates never fight the cursor. */
export function Text(props: {
  label?: string; value: string | undefined; onCommit: (v: string) => void; multiline?: boolean;
  rows?: number; type?: string; placeholder?: string; list?: string; className?: string;
}) {
  const [v, setV] = useState(props.value ?? '');
  const focused = useRef(false);
  const t = useRef<number>();
  useEffect(() => { if (!focused.current) setV(props.value ?? ''); }, [props.value]);
  const change = (nv: string) => {
    setV(nv);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => props.onCommit(nv), 400);
  };
  const common = {
    value: v, placeholder: props.placeholder,
    onFocus: () => { focused.current = true; },
    onBlur: () => { focused.current = false; window.clearTimeout(t.current); if (v !== (props.value ?? '')) props.onCommit(v); },
  };
  const input = props.multiline
    ? <textarea rows={props.rows ?? 3} {...common} onChange={(e) => change(e.target.value)} />
    : <input type={props.type ?? 'text'} list={props.list} {...common} onChange={(e) => change(e.target.value)} />;
  if (!props.label) return <span className={props.className}>{input}</span>;
  return <label className={'field ' + (props.className ?? '')}><span>{props.label}</span>{input}</label>;
}

export function Check(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check"><input type="checkbox" checked={props.value} onChange={(e) => props.onChange(e.target.checked)} /> {props.label}</label>
  );
}

export function Select(props: { label?: string; value: string; options: (string | { value: string; label: string })[]; onChange: (v: string) => void; blank?: string }) {
  const sel = (
    <select value={props.value} onChange={(e) => props.onChange(e.target.value)}>
      {props.blank !== undefined && <option value="">{props.blank}</option>}
      {props.options.map((o) => typeof o === 'string'
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  if (!props.label) return sel;
  return <label className="field"><span>{props.label}</span>{sel}</label>;
}

/** Editable table for arrays of flat objects (205 channels, 206 hospitals...). */
export function RowTable<T extends object>(props: {
  rows: T[]; columns: { key: keyof T & string; label: string; type?: 'text' | 'bool'; width?: string }[];
  onChange: (rows: T[]) => void; blank: T; addLabel?: string;
}) {
  const set = (i: number, k: keyof T, val: unknown) => props.onChange(props.rows.map((r, j) => (j === i ? { ...r, [k]: val } : r)));
  return (
    <div className="table-wrap">
      <table className="grid">
        <thead><tr>{props.columns.map((c) => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}<th className="no-print" /></tr></thead>
        <tbody>
          {props.rows.map((r, i) => (
            <tr key={i}>
              {props.columns.map((c) => (
                <td key={c.key}>
                  {c.type === 'bool'
                    ? <input type="checkbox" checked={Boolean((r as Record<string, unknown>)[c.key])} onChange={(e) => set(i, c.key, e.target.checked)} />
                    : <Text value={String((r as Record<string, unknown>)[c.key] ?? '')} onCommit={(v) => set(i, c.key, v)} />}
                </td>
              ))}
              <td className="no-print"><button className="link danger" onClick={() => props.onChange(props.rows.filter((_, j) => j !== i))}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="no-print small" onClick={() => props.onChange([...props.rows, { ...props.blank }])}>+ {props.addLabel ?? 'Add row'}</button>
    </div>
  );
}

/** Editable list of strings with an optional pick-list to add from. */
export function StringList(props: { items: string[]; onChange: (v: string[]) => void; picks?: string[]; numbered?: boolean; addLabel?: string }) {
  return (
    <div>
      <ol className={props.numbered ? 'strings' : 'strings plain'}>
        {props.items.map((s, i) => (
          <li key={i}>
            <Text value={s} multiline rows={1} onCommit={(v) => props.onChange(props.items.map((x, j) => (j === i ? v : x)))} />
            <button className="link danger no-print" onClick={() => props.onChange(props.items.filter((_, j) => j !== i))}>✕</button>
          </li>
        ))}
      </ol>
      <div className="row no-print">
        <button className="small" onClick={() => props.onChange([...props.items, ''])}>+ {props.addLabel ?? 'Add'}</button>
        {props.picks && props.picks.length > 0 && (
          <select value="" onChange={(e) => e.target.value && props.onChange([...props.items, e.target.value])}>
            <option value="">Add from template…</option>
            {props.picks.filter((p) => !props.items.includes(p)).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

/** Printable ICS form frame: form number + title header, footer with prepared-by. */
export function FormFrame(props: { num: string; title: string; incidentName: string; opLabel: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="form-sheet">
      <header className="form-head">
        <div className="form-num">ICS {props.num}</div>
        <div className="form-title">{props.title}</div>
        <div className="form-meta"><div><b>Incident:</b> {props.incidentName}</div><div><b>Operational period:</b> {props.opLabel}</div></div>
      </header>
      <div className="form-body">{props.children}</div>
      {props.footer && <footer className="form-foot">{props.footer}</footer>}
    </section>
  );
}

export const Box = (p: { n?: string; title: string; children: ReactNode; className?: string }) => (
  <div className={'box ' + (p.className ?? '')}><div className="box-title">{p.n && <span className="box-n">{p.n}.</span>} {p.title}</div>{p.children}</div>
);

export const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short', hour12: false }) : '');
export const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
export const toLocalInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso); const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : '');
