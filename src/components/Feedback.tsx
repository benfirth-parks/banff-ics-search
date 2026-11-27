// Floating Feedback button. Submissions go to Netlify Forms (form "feedback"),
// visible in the Netlify dashboard under Forms. If the device is offline the
// entry is queued in localStorage and sent when the connection returns.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const QUEUE = 'feedback-queue';
type Entry = Record<string, string>;

const readQueue = (): Entry[] => { try { return JSON.parse(localStorage.getItem(QUEUE) ?? '[]'); } catch { return []; } };
const writeQueue = (q: Entry[]) => { try { localStorage.setItem(QUEUE, JSON.stringify(q)); } catch { /* ignore */ } };

async function send(e: Entry) {
  const body = new URLSearchParams({ 'form-name': 'feedback', ...e }).toString();
  const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) throw new Error(String(r.status));
}

async function flush() {
  const q = readQueue();
  if (!q.length || !navigator.onLine) return;
  const left: Entry[] = [];
  for (const e of q) { try { await send(e); } catch { left.push(e); } }
  writeQueue(left);
}

export function FeedbackButton() {
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('Problem');
  const [message, setMessage] = useState('');
  const [name, setName] = useState(() => { try { return localStorage.getItem('field-name') ?? ''; } catch { return ''; } });
  const [status, setStatus] = useState('');

  useEffect(() => { void flush(); window.addEventListener('online', flush); return () => window.removeEventListener('online', flush); }, []);

  const submit = async () => {
    const entry: Entry = {
      kind, message, name, screen: loc.pathname, time: new Date().toISOString(),
      device: `${window.innerWidth}x${window.innerHeight} ${navigator.userAgent}`,
    };
    try {
      if (!navigator.onLine) throw new Error('offline');
      await send(entry);
      setStatus('Thanks, feedback sent.');
    } catch {
      writeQueue([...readQueue(), entry]);
      setStatus('Saved. It will be sent when you are back online.');
    }
    setMessage('');
    window.setTimeout(() => { setOpen(false); setStatus(''); }, 1800);
  };

  return (
    <div className="no-print">
      <button className="feedback-fab" onClick={() => setOpen(true)} aria-label="Send feedback">💬 Feedback</button>
      {open && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Send feedback</h3>
            <p className="muted small-print">Goes to the app developer. Screen: <code>{loc.pathname}</code></p>
            <div className="row">{['Problem', 'Idea', 'Question'].map((k) => (
              <label key={k} className="check"><input type="radio" checked={kind === k} onChange={() => setKind(k)} /> {k}</label>
            ))}</div>
            <label className="field"><span>What happened, or what would help?</span>
              <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} autoFocus /></label>
            <label className="field"><span>Your name or role (optional)</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
            {status ? <p className="notice">{status}</p> : (
              <div className="row"><button className="primary" disabled={!message.trim()} onClick={submit}>Send</button><button onClick={() => setOpen(false)}>Cancel</button></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
